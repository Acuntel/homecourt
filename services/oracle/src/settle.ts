// Per-market settlement logic.
//
// Flow (BUILD.md §11, Flow 9):
//   1. Determine winning_outcome_idx
//        - if a listing close_price is set → bucket containing it
//        - else → weighted-random by current YES price (last fill prices)
//   2. BEGIN tx
//   3. INSERT INTO settlements (...)
//   4. UPDATE markets SET state='settled', final_bucket=..., final_price_cents=...
//   5. Per-user payout: $1.00/contract on winning outcome via journal kind='settlement'
//      Forfeits on losing outcomes are zero-credit (no row needed; locked
//      escrow is released in the same tx via accounts.locked_cents reset).
//   6. COMMIT
//   7. Publish lifecycle event over NATS.

import type { PoolClient } from "pg";
import { getPool, log } from "./db.js";
import { publishLifecycle } from "./nats.js";

export interface Bucket {
  label: string;
  low_cents: number;
  high_cents: number;
}

export interface MarketRow {
  id: string;
  slug: string;
  property_id: string;
  buckets: Bucket[];
  resolves_at: Date;
}

/**
 * Resolve a single market end-to-end. Idempotent — if the market is already
 * settled the function returns immediately.
 */
export async function settle(market: MarketRow): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Re-check state under tx — guard against double-settlement.
    const stateRes = await client.query<{ state: string }>(
      "select state from public.markets where id = $1 for update",
      [market.id],
    );
    const row = stateRes.rows[0];
    if (!row || row.state !== "open") {
      await client.query("ROLLBACK");
      log.info({ market_id: market.id, state: row?.state }, "skip — not open");
      return;
    }

    // 1. Determine outcome.
    const decision = await decideWinningOutcome(client, market);
    log.info(
      {
        market_id: market.id,
        slug: market.slug,
        winning_outcome_idx: decision.outcomeIdx,
        final_price_cents: decision.finalPriceCents,
        source: decision.source,
      },
      "settling market",
    );

    // 3. Insert settlement row.
    await client.query(
      `insert into public.settlements (market_id, final_price_cents, final_bucket, oracle_payload)
       values ($1, $2, $3, $4)
       on conflict (market_id) do nothing`,
      [
        market.id,
        decision.finalPriceCents,
        decision.outcomeIdx,
        JSON.stringify({
          source: decision.source,
          ts: new Date().toISOString(),
          buckets: market.buckets,
        }),
      ],
    );

    // 4. Flip market state.
    await client.query(
      `update public.markets
         set state = 'settled',
             final_bucket = $2,
             final_price_cents = $3
       where id = $1`,
      [market.id, decision.outcomeIdx, decision.finalPriceCents],
    );

    // 5. Pay winners.
    const winners = await client.query<{
      user_id: string;
      qty: number;
    }>(
      `with buy_qty as (
         select o.user_id, sum(f.qty)::bigint as qty
           from public.fills f
           join public.orders o on o.id = f.taker_order_id
          where f.market_id = $1
            and f.outcome  = $2
            and o.side     = 'buy'
          group by o.user_id
         union all
         select o.user_id, -sum(f.qty)::bigint as qty
           from public.fills f
           join public.orders o on o.id = f.maker_order_id
          where f.market_id = $1
            and f.outcome  = $2
            and o.side     = 'sell'
          group by o.user_id
       )
       select user_id, sum(qty)::bigint as qty
         from buy_qty
        group by user_id
       having sum(qty) > 0`,
      [market.id, decision.outcomeIdx],
    );

    let credited = 0;
    for (const w of winners.rows) {
      const qtyShares = Number(w.qty);
      if (!Number.isFinite(qtyShares) || qtyShares <= 0) continue;
      const credit = qtyShares * 100; // $1 = 100¢ per winning share
      // Pull latest balance under FOR UPDATE so the trigger-driven sync stays sane.
      const balRes = await client.query<{ cash_cents: string }>(
        "select cash_cents from public.accounts where user_id = $1 for update",
        [w.user_id],
      );
      const bal = balRes.rows[0]?.cash_cents ? Number(balRes.rows[0].cash_cents) : 0;
      const newBal = bal + credit;
      await client.query(
        `insert into public.journal
           (user_id, market_id, kind, amount_cents, balance_after_cents, ref)
         values ($1, $2, 'settlement', $3, $4, $5)`,
        [w.user_id, market.id, credit, newBal, `settle:${market.id}`],
      );
      await client.query(
        `insert into public.notifications (user_id, kind, payload)
         values ($1, 'settle', $2)`,
        [
          w.user_id,
          JSON.stringify({
            market_id: market.id,
            slug: market.slug,
            winning_outcome_idx: decision.outcomeIdx,
            qty: qtyShares,
            credit_cents: credit,
          }),
        ],
      );
      credited++;
    }

    // 6. Release any per-market locked escrow. We zero out locked_cents for
    //    accounts that traded this market — Phase-0 accounting is best-effort
    //    since the lock/release pipeline isn't fully wired yet.
    await client.query(
      `update public.accounts a
         set locked_cents = 0,
             updated_at   = now()
       where a.user_id in (
         select distinct o.user_id from public.orders o
          where o.market_id = $1
       )
         and a.locked_cents > 0`,
      [market.id],
    );

    await client.query("COMMIT");

    log.info({ market_id: market.id, slug: market.slug, winners: credited }, "settled");

    // 7. Lifecycle event (best-effort, outside tx).
    await publishLifecycle(market.slug, {
      type: "settled",
      market_id: market.id,
      slug: market.slug,
      winning_outcome_idx: decision.outcomeIdx,
      final_price_cents: decision.finalPriceCents,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    log.error({ err: errMsg(err), market_id: market.id }, "settle failed");
  } finally {
    client.release();
  }
}

interface Decision {
  outcomeIdx: number;
  finalPriceCents: number;
  source: string;
}

async function decideWinningOutcome(client: PoolClient, market: MarketRow): Promise<Decision> {
  // 1) Check listings for a close_date + a derived final price. The schema
  //    we ship doesn't have close_price_cents directly, so we synthesize it
  //    from list_price_cents if a close_date is set; otherwise we fall
  //    back to a weighted-random pick driven by recent fill prices.
  const closeRes = await client.query<{
    list_price_cents: string;
    close_date: string | null;
  }>(
    `select l.list_price_cents, l.close_date
       from public.listings l
       join public.markets m on m.listing_id = l.id
      where m.id = $1
      limit 1`,
    [market.id],
  );
  const lr = closeRes.rows[0];
  if (lr && lr.close_date) {
    const finalPriceCents = Number(lr.list_price_cents);
    const idx = bucketForCents(finalPriceCents, market.buckets);
    return { outcomeIdx: idx, finalPriceCents, source: "listing.close_date" };
  }

  // 2) Weighted-random by last-fill prices per bucket.
  const fillRes = await client.query<{ outcome: number; w: string }>(
    `select outcome, sum(qty * price_cents)::bigint as w
       from public.fills
      where market_id = $1
      group by outcome`,
    [market.id],
  );
  const weights = new Array<number>(market.buckets.length).fill(0);
  for (const r of fillRes.rows) {
    if (r.outcome >= 0 && r.outcome < weights.length) {
      weights[r.outcome] = Number(r.w);
    }
  }
  let totalWeight = 0;
  for (const w of weights) totalWeight += w;
  let idx: number;
  if (totalWeight <= 0) {
    // Uniform-random across buckets.
    idx = Math.floor(Math.random() * market.buckets.length);
  } else {
    let pick = Math.random() * totalWeight;
    idx = 0;
    for (let i = 0; i < weights.length; i++) {
      pick -= weights[i] ?? 0;
      if (pick <= 0) {
        idx = i;
        break;
      }
    }
  }
  const b = market.buckets[idx];
  if (!b) {
    return { outcomeIdx: 0, finalPriceCents: 0, source: "fallback" };
  }
  // Synthesized final price = midpoint of the winning bucket.
  const mid = Math.floor((b.low_cents + b.high_cents) / 2);
  return { outcomeIdx: idx, finalPriceCents: mid, source: "weighted_random" };
}

function bucketForCents(v: number, buckets: Bucket[]): number {
  if (buckets.length === 0) return 0;
  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  if (!first || !last) return 0;
  if (v < first.low_cents) return 0;
  if (v > last.high_cents) return buckets.length - 1;
  for (let i = 0; i < buckets.length; i++) {
    const b = buckets[i];
    if (b && v >= b.low_cents && v <= b.high_cents) return i;
  }
  return Math.floor(buckets.length / 2);
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
