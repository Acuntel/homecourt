// HOMECOURT mock settlement oracle.
//
// Every POLL_INTERVAL_MS the worker:
//   1. Selects markets with state='open' AND resolves_at < now()
//   2. For each market, settles it via settle.ts
//   3. Sleeps and repeats
//
// Single-process, single-node. No leader election — fine for Phase 0.

import "dotenv/config";
import { closePool, getPool, log } from "./db.js";
import { settle, type Bucket, type MarketRow } from "./settle.js";
import { closeNats } from "./nats.js";

const POLL_INTERVAL_MS = Number(process.env.ORACLE_POLL_INTERVAL_MS ?? 60_000);

let shuttingDown = false;

async function tick(): Promise<void> {
  const pool = getPool();
  const res = await pool.query<{
    id: string;
    slug: string;
    property_id: string;
    buckets: Bucket[];
    resolves_at: Date;
  }>(
    `select id, slug, property_id, buckets, resolves_at
       from public.markets
      where state = 'open'
        and resolves_at < now()
      order by resolves_at asc
      limit 50`,
  );
  if (res.rowCount === 0) {
    log.debug({}, "no markets to settle");
    return;
  }
  log.info({ count: res.rowCount }, "settling markets");
  for (const row of res.rows) {
    if (shuttingDown) break;
    const market: MarketRow = {
      id: row.id,
      slug: row.slug,
      property_id: row.property_id,
      buckets: typeof row.buckets === "string" ? JSON.parse(row.buckets) : row.buckets,
      resolves_at: row.resolves_at,
    };
    await settle(market);
  }
}

async function main(): Promise<void> {
  log.info({ poll_ms: POLL_INTERVAL_MS }, "oracle starting");

  // Smoke-test DB connectivity up front so a misconfig fails loudly.
  try {
    await getPool().query("select 1");
  } catch (err) {
    log.error({ err: errMsg(err) }, "db unreachable — exiting");
    process.exit(1);
  }

  // First tick immediately, then on the interval.
  while (!shuttingDown) {
    const started = Date.now();
    try {
      await tick();
    } catch (err) {
      log.error({ err: errMsg(err) }, "tick failed");
    }
    const elapsed = Date.now() - started;
    const sleep = Math.max(0, POLL_INTERVAL_MS - elapsed);
    await new Promise<void>((resolve) => setTimeout(resolve, sleep));
  }

  log.info({}, "draining…");
  await closeNats().catch(() => undefined);
  await closePool().catch(() => undefined);
  log.info({}, "oracle stopped");
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

process.on("SIGINT", () => {
  log.info({ sig: "SIGINT" }, "shutdown signal");
  shuttingDown = true;
});
process.on("SIGTERM", () => {
  log.info({ sig: "SIGTERM" }, "shutdown signal");
  shuttingDown = true;
});

main().catch((err: unknown) => {
  log.error({ err: errMsg(err) }, "oracle fatal");
  process.exit(1);
});
