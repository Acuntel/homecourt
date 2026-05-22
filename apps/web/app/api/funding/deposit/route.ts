// HOMECOURT — POST /api/funding/deposit. Credits play-money via journal entry.
// Idempotency: `idempotencyKey` in body OR `Idempotency-Key` header. Header wins
// if both are present.

import { NextResponse, type NextRequest } from "next/server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { depositSchema } from "@homecourt/shared";
import { log } from "@/lib/log";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const headerKey = request.headers.get("idempotency-key");
  if (headerKey) {
    body.idempotencyKey = headerKey;
  }

  const parsed = depositSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const db = createServiceClient();

  // 1. Idempotency check — same key for this user → return cached result.
  const { data: existing } = await db
    .from("journal")
    .select("id")
    .eq("user_id", user.id)
    .eq("ref", parsed.data.idempotencyKey)
    .limit(1);
  if (existing && existing.length > 0) {
    const { data: acc } = await db
      .from("accounts")
      .select("cash_cents")
      .eq("user_id", user.id)
      .maybeSingle();
    return NextResponse.json({
      ok: true,
      idempotent: true,
      cashCents: Number(acc?.cash_cents ?? 0),
    });
  }

  // 2. Ensure accounts row exists.
  const { data: account } = await db
    .from("accounts")
    .select("cash_cents")
    .eq("user_id", user.id)
    .maybeSingle();
  let currentCash = Number(account?.cash_cents ?? 0);
  if (!account) {
    const { error: e } = await db.from("accounts").insert({ user_id: user.id });
    if (e) {
      log.error({ err: e.message }, "accounts insert failed");
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
    currentCash = 0;
  }

  // 3. Insert journal entry; trigger syncs accounts.cash_cents.
  const newBalance = currentCash + parsed.data.amountCents;
  const { error } = await db.from("journal").insert({
    user_id: user.id,
    kind: "deposit",
    amount_cents: parsed.data.amountCents,
    balance_after_cents: newBalance,
    ref: parsed.data.idempotencyKey,
  });
  if (error) {
    log.error({ err: error.message }, "deposit insert failed");
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    idempotent: false,
    cashCents: newBalance,
  });
}
