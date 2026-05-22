// HOMECOURT — POST /api/auth/signup. Magic-link sign-up.

import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { emailSignUpSchema } from "@homecourt/shared";
import { log } from "@/lib/log";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = emailSignUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${SITE_URL}/api/auth/callback?next=/onboarding/identity`,
      data: {
        username: parsed.data.username,
        display_name: parsed.data.username,
      },
      shouldCreateUser: true,
    },
  });
  if (error) {
    log.warn({ err: error.message }, "signup magic-link failed");
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
