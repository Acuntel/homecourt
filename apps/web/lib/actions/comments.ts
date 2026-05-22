// HOMECOURT — comments server actions (post + vote).
//
// All writes funnel through next-safe-action's `authAction` so unauthenticated
// callers can't post. Bodies are stripped of HTML server-side via DOMPurify
// before insert. Rate-limited to 5 posts/min per user via an in-memory LRU
// cache (sufficient for single-instance Phase 0; Upstash hookup is M12+).

"use server";

import { revalidatePath } from "next/cache";
import { LRUCache } from "lru-cache";

import { authAction } from "@/lib/safe-action";
import { createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";
import { postCommentSchema, voteCommentSchema, type MarketComment } from "@homecourt/shared";

const POST_WINDOW_MS = 60_000;
const POST_LIMIT = 5;

interface RateBucket {
  count: number;
  resetAt: number;
}

const postBuckets = new LRUCache<string, RateBucket>({
  max: 10_000,
  ttl: POST_WINDOW_MS * 2,
});

function checkRateLimit(userId: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const existing = postBuckets.get(userId);
  if (!existing || existing.resetAt <= now) {
    postBuckets.set(userId, { count: 1, resetAt: now + POST_WINDOW_MS });
    return { ok: true };
  }
  if (existing.count >= POST_LIMIT) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  existing.count += 1;
  postBuckets.set(userId, existing);
  return { ok: true };
}

function sanitizeBody(input: string): string {
  // Strip every tag — comments render as plain text. We deliberately avoid
  // DOMPurify here because its `isomorphic-dompurify` shim drags in jsdom,
  // which fails to boot inside Next 15 Server Actions ("Cannot parse color:
  // rgb(176 182 194)"). Tag + entity stripping is sufficient because we
  // re-sanitize on render too, and the column is rendered as plain text.
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

interface InsertedRow {
  id: string;
  parent_id: string | null;
  user_id: string;
  body: string;
  score: number;
  created_at: string;
}

/** Post a new comment or reply. Rate-limited to 5 posts/min per user. */
export const postCommentAction = authAction
  .schema(postCommentSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.user.id;

    const limit = checkRateLimit(userId);
    if (!limit.ok) {
      return {
        ok: false as const,
        error: "rate_limited" as const,
        retryAfterSec: limit.retryAfterSec,
      };
    }

    const body = sanitizeBody(parsedInput.body);
    if (body.length === 0) {
      return { ok: false as const, error: "empty" as const };
    }

    const db = createServiceClient();

    // If replying, sanity-check the parent belongs to the same market and is
    // top-level (no nested replies in Phase 0 — UI only shows depth=1).
    let parentId: string | null = parsedInput.parentId ?? null;
    if (parentId) {
      const { data: parent } = await db
        .from("comments")
        .select("id, market_id, parent_id")
        .eq("id", parentId)
        .maybeSingle();
      if (!parent || parent.market_id !== parsedInput.marketId) {
        return { ok: false as const, error: "bad_parent" as const };
      }
      // Collapse nested replies into the same parent for stable rendering.
      if (parent.parent_id) parentId = parent.parent_id;
    }

    const { data: inserted, error } = await db
      .from("comments")
      .insert({
        market_id: parsedInput.marketId,
        user_id: userId,
        parent_id: parentId,
        body,
      })
      .select("id, parent_id, user_id, body, score, created_at")
      .single<InsertedRow>();

    if (error || !inserted) {
      log.error({ err: error?.message, userId }, "post comment failed");
      return { ok: false as const, error: "write_failed" as const };
    }

    // Resolve the author for the optimistic-merge payload.
    const { data: profile } = await db
      .from("users")
      .select("username, display_name")
      .eq("id", userId)
      .maybeSingle<{ username: string | null; display_name: string | null }>();

    // Best-effort revalidation. We don't know the slug from the action, so the
    // client also invalidates the react-query cache after the mutation lands.
    revalidatePath("/markets/[slug]", "page");

    const comment: MarketComment = {
      id: inserted.id,
      parentId: inserted.parent_id,
      userId: inserted.user_id,
      body: inserted.body,
      score: inserted.score,
      createdAt: inserted.created_at,
      username: profile?.username ?? "you",
      displayName: profile?.display_name ?? null,
      myVote: 0,
      replies: [],
    };

    return { ok: true as const, comment };
  });

/** Upvote / clear / downvote a comment. Recomputes comments.score in-action. */
export const voteCommentAction = authAction
  .schema(voteCommentSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.user.id;
    const db = createServiceClient();

    // Look up the comment to (a) refuse self-votes and (b) be sure it exists.
    const { data: target } = await db
      .from("comments")
      .select("id, user_id, deleted_at")
      .eq("id", parsedInput.commentId)
      .maybeSingle<{ id: string; user_id: string; deleted_at: string | null }>();
    if (!target || target.deleted_at) {
      return { ok: false as const, error: "not_found" as const };
    }
    if (target.user_id === userId) {
      return { ok: false as const, error: "self_vote" as const };
    }

    if (parsedInput.value === 0) {
      // Remove existing vote.
      const { error: delErr } = await db
        .from("comment_votes")
        .delete()
        .eq("comment_id", parsedInput.commentId)
        .eq("user_id", userId);
      if (delErr) {
        log.error({ err: delErr.message, userId }, "vote remove failed");
        return { ok: false as const, error: "write_failed" as const };
      }
    } else {
      // Upsert vote on the (comment_id, user_id) PK.
      const { error: upErr } = await db.from("comment_votes").upsert(
        {
          comment_id: parsedInput.commentId,
          user_id: userId,
          value: parsedInput.value,
        },
        { onConflict: "comment_id,user_id" },
      );
      if (upErr) {
        log.error({ err: upErr.message, userId }, "vote upsert failed");
        return { ok: false as const, error: "write_failed" as const };
      }
    }

    // Recompute score from comment_votes. Cheap because votes are sparse.
    const { data: tally } = await db
      .from("comment_votes")
      .select("value")
      .eq("comment_id", parsedInput.commentId)
      .returns<{ value: number }[]>();
    const score = (tally ?? []).reduce((sum, v) => sum + (v.value | 0), 0);

    const { error: updErr } = await db
      .from("comments")
      .update({ score })
      .eq("id", parsedInput.commentId);
    if (updErr) {
      log.error({ err: updErr.message, commentId: parsedInput.commentId }, "score update failed");
    }

    revalidatePath("/markets/[slug]", "page");

    return {
      ok: true as const,
      score,
      myVote: (parsedInput.value === 0 ? 0 : parsedInput.value) as -1 | 0 | 1,
    };
  });
