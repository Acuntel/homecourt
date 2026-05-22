// HOMECOURT — Pure tree mutators for the optimistic CommentsThread cache.

import type { MarketComment } from "@homecourt/shared";

export type ThreadComment = MarketComment & { pending?: boolean };

export function insertComment(tree: ThreadComment[], next: ThreadComment): ThreadComment[] {
  if (next.parentId === null) return [next, ...tree];
  return tree.map((c) => {
    if (c.id === next.parentId) {
      return { ...c, replies: [...c.replies, next] };
    }
    return c;
  });
}

export function replaceTempWithServer(
  tree: ThreadComment[],
  tempId: string,
  server: ThreadComment,
): ThreadComment[] {
  return tree.map((c) => {
    if (c.id === tempId) return server;
    const replies = (c.replies as ThreadComment[]).map((r) => (r.id === tempId ? server : r));
    return { ...c, replies };
  });
}

export function applyVote(tree: ThreadComment[], commentId: string, next: 1 | 0): ThreadComment[] {
  return tree.map((c) => {
    const updated = adjustOne(c, commentId, next);
    const replies = (c.replies as ThreadComment[]).map((r) => adjustOne(r, commentId, next));
    return { ...updated, replies };
  });
}

function adjustOne(c: ThreadComment, commentId: string, next: 1 | 0): ThreadComment {
  if (c.id !== commentId) return c;
  const prev = c.myVote;
  const delta = next - prev;
  return { ...c, myVote: next, score: c.score + delta };
}

export function setCommentScore(
  tree: ThreadComment[],
  commentId: string,
  score: number,
  myVote: -1 | 0 | 1,
): ThreadComment[] {
  return tree.map((c) => {
    if (c.id === commentId) return { ...c, score, myVote };
    const replies = (c.replies as ThreadComment[]).map((r) =>
      r.id === commentId ? { ...r, score, myVote } : r,
    );
    return { ...c, replies };
  });
}
