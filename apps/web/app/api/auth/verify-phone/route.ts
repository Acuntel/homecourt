// HOMECOURT — POST /api/auth/verify-phone. P0 stub: accepts only `000000`.

import { NextResponse, type NextRequest } from "next/server";

import { verifyPhoneSchema } from "@homecourt/shared";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = verifyPhoneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  if (parsed.data.code !== "000000") {
    return NextResponse.json(
      { error: "Invalid code. Use 000000 in sweepstakes mode." },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
