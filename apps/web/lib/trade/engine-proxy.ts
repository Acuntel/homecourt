// HOMECOURT — typed fetch wrapper for the Go matching engine.
//
// Wraps:
//   POST   /v1/orders         place an order
//   DELETE /v1/orders/:id     cancel an order
//
// Responsibilities:
//   - Build the engine URL from `ENGINE_URL` (server env).
//   - Generate / pass through the `Idempotency-Key` header.
//   - Forward the Supabase JWT as `Authorization: Bearer <token>` so the
//     engine can verify the `sub` claim equals the user_id in the body.
//   - Retry 503 with exponential backoff (max 3 attempts).
//   - Surface a typed `EngineFetchResult` to the caller — never throws on
//     non-2xx, only on hard network failure.

import { log } from "@/lib/log";

export interface EngineOrderRequest {
  marketSlug: string;
  outcome: number;
  side: "buy" | "sell";
  priceCents: number;
  qty: number;
  userId: string;
}

export interface EngineFillResponse {
  price_cents: number;
  qty: number;
  maker_order_id: string;
}

export interface EngineOrderResponse {
  order_id: string;
  status: "open" | "partial" | "filled" | "cancelled";
  filled_qty: number;
  resting_qty: number;
  fills: EngineFillResponse[];
  seq: number;
  market_id: string;
  market_slug: string;
  outcome: number;
  side: "buy" | "sell";
  price_cents: number;
  qty: number;
}

export interface EngineCancelResponse {
  order_id: string;
  status: "cancelled";
  cancelled_qty: number;
  market_id: string;
}

export interface EngineErrorBody {
  error?: string;
  message?: string;
}

export type EngineFetchResult<T> =
  | { ok: true; status: number; data: T; idempotentReplay: boolean }
  | { ok: false; status: number; error: string; message?: string };

const MAX_RETRIES = 3;
const BACKOFF_MS = [50, 200, 600] as const;

function engineBaseUrl(): string {
  const raw = process.env.ENGINE_URL ?? "http://localhost:8080";
  return raw.replace(/\/$/, "");
}

export function newOrderIdempotencyKey(): string {
  return `hcrt_order_${crypto.randomUUID()}`;
}

interface PlaceOrderOptions {
  idempotencyKey?: string;
  jwt?: string | null;
  signal?: AbortSignal;
}

interface CancelOrderOptions {
  jwt?: string | null;
  signal?: AbortSignal;
}

async function tryParseError(res: Response): Promise<{ error: string; message?: string }> {
  try {
    const body = (await res.json()) as EngineErrorBody;
    const out: { error: string; message?: string } = {
      error: body.error ?? "engine_error",
    };
    if (typeof body.message === "string") out.message = body.message;
    return out;
  } catch {
    return { error: "engine_error" };
  }
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetch(url, init);
      if (res.status !== 503) return res;
      // 503 — wait, then retry.
      if (attempt < MAX_RETRIES - 1) {
        await sleep(BACKOFF_MS[attempt] ?? 600);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES - 1) {
        await sleep(BACKOFF_MS[attempt] ?? 600);
        continue;
      }
      throw err;
    }
  }
  // unreachable; satisfies TS
  throw lastErr ?? new Error("engine fetch failed");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Place an order on the matching engine. The caller is responsible for auth.
 * Returns a tagged result rather than throwing on non-2xx.
 */
export async function placeOrderOnEngine(
  req: EngineOrderRequest,
  opts: PlaceOrderOptions = {},
): Promise<EngineFetchResult<EngineOrderResponse> & { idempotencyKey: string }> {
  const idempotencyKey = opts.idempotencyKey ?? newOrderIdempotencyKey();
  const url = `${engineBaseUrl()}/v1/orders`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Idempotency-Key": idempotencyKey,
  };
  if (opts.jwt) headers.Authorization = `Bearer ${opts.jwt}`;

  const body = JSON.stringify({
    market_slug: req.marketSlug,
    user_id: req.userId,
    outcome: req.outcome,
    side: req.side,
    price_cents: req.priceCents,
    qty: req.qty,
  });

  try {
    const init: RequestInit = {
      method: "POST",
      headers,
      body,
      cache: "no-store",
    };
    if (opts.signal) init.signal = opts.signal;
    const res = await fetchWithRetry(url, init);
    const idempotentReplay = res.headers.get("x-idempotent-replay") === "true";

    if (!res.ok) {
      const errBody = await tryParseError(res);
      return {
        ok: false,
        status: res.status,
        ...errBody,
        idempotencyKey,
      } as EngineFetchResult<EngineOrderResponse> & {
        idempotencyKey: string;
      };
    }
    const data = (await res.json()) as EngineOrderResponse;
    return { ok: true, status: res.status, data, idempotentReplay, idempotencyKey };
  } catch (err) {
    log.warn({ err, marketSlug: req.marketSlug }, "engine place order failed");
    return {
      ok: false,
      status: 503,
      error: "engine_unreachable",
      message: "Engine offline, try again.",
      idempotencyKey,
    } as EngineFetchResult<EngineOrderResponse> & { idempotencyKey: string };
  }
}

/** Cancel a resting order on the matching engine. */
export async function cancelOrderOnEngine(
  orderId: string,
  opts: CancelOrderOptions = {},
): Promise<EngineFetchResult<EngineCancelResponse>> {
  const url = `${engineBaseUrl()}/v1/orders/${encodeURIComponent(orderId)}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.jwt) headers.Authorization = `Bearer ${opts.jwt}`;

  try {
    const init: RequestInit = { method: "DELETE", headers, cache: "no-store" };
    if (opts.signal) init.signal = opts.signal;
    const res = await fetchWithRetry(url, init);
    if (!res.ok) {
      const errBody = await tryParseError(res);
      return { ok: false, status: res.status, ...errBody };
    }
    const data = (await res.json()) as EngineCancelResponse;
    return { ok: true, status: res.status, data, idempotentReplay: false };
  } catch (err) {
    log.warn({ err, orderId }, "engine cancel order failed");
    return {
      ok: false,
      status: 503,
      error: "engine_unreachable",
      message: "Engine offline, try again.",
    };
  }
}
