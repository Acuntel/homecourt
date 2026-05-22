// HOMECOURT — POST/DELETE /api/watchlist/:slug
// Idempotent server actions for the heart toggle on MarketCard.

import { NextResponse, type NextRequest } from "next/server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

type RouteContext = { params: Promise<{ slug: string }> };

async function resolveMarketId(slug: string): Promise<string | null> {
  const db = createServiceClient();
  const { data, error } = await db.from("markets").select("id").eq("slug", slug).maybeSingle();
  if (error) {
    log.error({ err: error, slug }, "watchlist slug lookup failed");
    return null;
  }
  return data?.id ?? null;
}

export async function POST(_request: NextRequest, ctx: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { slug } = await ctx.params;
  const marketId = await resolveMarketId(slug);
  if (!marketId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const db = createServiceClient();
  const { error } = await db
    .from("watchlist")
    .upsert({ user_id: user.id, market_id: marketId }, { onConflict: "user_id,market_id" });

  if (error) {
    log.error({ err: error, slug }, "watchlist add failed");
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, watching: true });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { slug } = await ctx.params;
  const marketId = await resolveMarketId(slug);
  if (!marketId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const db = createServiceClient();
  const { error } = await db
    .from("watchlist")
    .delete()
    .eq("user_id", user.id)
    .eq("market_id", marketId);

  if (error) {
    log.error({ err: error, slug }, "watchlist remove failed");
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, watching: false });
}
