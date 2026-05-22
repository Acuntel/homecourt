// HOMECOURT — Loads top-level comments + 1-level replies for a market.
// Used by the SSR detail page; M10 will add post/reply UI.

import { createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";
import type { MarketComment } from "@homecourt/shared";

const TOP_LEVEL_LIMIT = 20;
const REPLY_LIMIT_PER_PARENT = 5;

interface CommentRow {
  id: string;
  parent_id: string | null;
  body: string;
  score: number;
  created_at: string;
  user_id: string;
  deleted_at: string | null;
}

interface UserRow {
  id: string;
  username: string;
  display_name: string | null;
}

export async function loadMarketComments(marketId: string): Promise<MarketComment[]> {
  const supabase = createServiceClient();

  const { data: top, error: topErr } = await supabase
    .from("comments")
    .select("id, parent_id, body, score, created_at, user_id, deleted_at")
    .eq("market_id", marketId)
    .is("parent_id", null)
    .is("deleted_at", null)
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(TOP_LEVEL_LIMIT)
    .returns<CommentRow[]>();

  if (topErr) {
    log.error({ err: topErr, marketId }, "comments top-level lookup failed");
    return [];
  }
  if (!top || top.length === 0) return [];

  const parentIds = top.map((c) => c.id);
  const { data: replies, error: repErr } = await supabase
    .from("comments")
    .select("id, parent_id, body, score, created_at, user_id, deleted_at")
    .in("parent_id", parentIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .returns<CommentRow[]>();

  if (repErr) {
    log.warn({ err: repErr, marketId }, "comments reply lookup failed");
  }

  const allUserIds = new Set<string>();
  for (const c of top) allUserIds.add(c.user_id);
  for (const r of replies ?? []) allUserIds.add(r.user_id);

  const { data: users } = await supabase
    .from("users")
    .select("id, username, display_name")
    .in("id", Array.from(allUserIds))
    .returns<UserRow[]>();

  const userById = new Map<string, UserRow>();
  for (const u of users ?? []) userById.set(u.id, u);

  const repliesByParent = new Map<string, CommentRow[]>();
  for (const r of replies ?? []) {
    if (!r.parent_id) continue;
    const list = repliesByParent.get(r.parent_id) ?? [];
    list.push(r);
    repliesByParent.set(r.parent_id, list);
  }

  return top.map((c) => mapComment(c, userById, repliesByParent));
}

function mapComment(
  row: CommentRow,
  userById: Map<string, UserRow>,
  repliesByParent: Map<string, CommentRow[]>,
): MarketComment {
  const user = userById.get(row.user_id);
  const childRows = (repliesByParent.get(row.id) ?? []).slice(0, REPLY_LIMIT_PER_PARENT);
  return {
    id: row.id,
    parentId: row.parent_id,
    body: row.body,
    score: row.score,
    createdAt: row.created_at,
    username: user?.username ?? "user",
    displayName: user?.display_name ?? null,
    replies: childRows.map((r) => mapComment(r, userById, new Map())),
  };
}
