// HOMECOURT — POST /api/onboarding/complete. Provisions the welcome bonus
// (account row + initial journal deposit). Idempotent.

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { provisionStartingFunds } from "@/lib/onboarding/provision";
import { log } from "@/lib/log";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await provisionStartingFunds(user.id);
    return NextResponse.json(result);
  } catch (err) {
    log.error({ err: (err as Error).message }, "onboarding complete failed");
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
