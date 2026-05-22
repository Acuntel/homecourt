// HOMECOURT — POST /api/kyc/submit. Sweepstakes mode = auto-approve.

import { NextResponse } from "next/server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createServiceClient();
  const { error } = await db.from("users").update({ kyc_status: "approved" }).eq("id", user.id);
  if (error) {
    log.error({ err: error.message }, "kyc submit failed");
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Make sure the accounts row exists before /fund step.
  const { data: existing } = await db
    .from("accounts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!existing) {
    await db.from("accounts").insert({ user_id: user.id });
  }
  return NextResponse.json({ ok: true });
}
