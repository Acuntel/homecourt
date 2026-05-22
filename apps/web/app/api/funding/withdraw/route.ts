// HOMECOURT — POST /api/funding/withdraw. P0 sweepstakes: always refused.

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: false, reason: "sweepstakes" }, { status: 200 });
}
