// HOMECOURT — POST /api/onboarding/identity. Saves first/last/dob/phone onto
// public.users for the current session.

import { NextResponse, type NextRequest } from "next/server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { identitySchema } from "@homecourt/shared";
import { log } from "@/lib/log";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = identitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const db = createServiceClient();
  const fullName = `${parsed.data.legalFirstName} ${parsed.data.legalLastName}`.trim();
  const { error } = await db
    .from("users")
    .update({ display_name: fullName, phone: parsed.data.phone })
    .eq("id", user.id);
  if (error) {
    log.error({ err: error.message }, "save identity failed");
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
