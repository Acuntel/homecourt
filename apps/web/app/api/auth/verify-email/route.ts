// HOMECOURT — POST /api/auth/verify-email. Verifies a 6-digit OTP from email.

import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { verifyEmailSchema } from "@homecourt/shared";
import { log } from "@/lib/log";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = verifyEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });
  if (error || !data.session) {
    log.warn({ err: error?.message }, "verify-email failed");
    return NextResponse.json({ error: error?.message ?? "Verification failed." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
