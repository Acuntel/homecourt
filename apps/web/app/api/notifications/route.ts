// HOMECOURT — GET /api/notifications. Returns the user's last 20 notifications.

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ items: [] }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, payload, created_at, read_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ items: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
