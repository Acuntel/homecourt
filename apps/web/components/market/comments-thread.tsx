"use client";

// HOMECOURT — Threaded comments with optimistic post + vote.
// M10: replaces the read-only M5 view. SSR seeds `comments` via initialData,
// react-query owns subsequent state. Item rendering lives in comment-item.tsx
// and the pure tree mutators in comment-tree.ts.

import { useMemo, useState, useTransition } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { CommentComposer } from "@/components/market/comment-composer";
import { CommentItem } from "@/components/market/comment-item";
import {
  applyVote,
  insertComment,
  replaceTempWithServer,
  setCommentScore,
  type ThreadComment,
} from "@/components/market/comment-tree";
import { postCommentAction, voteCommentAction } from "@/lib/actions/comments";
import { cn } from "@/lib/utils";
import type { MarketComment } from "@homecourt/shared";

interface CommentsThreadProps {
  marketId: string;
  comments: MarketComment[];
  totalCount: number;
  viewerId: string | null;
  className?: string;
}

export function CommentsThread({
  marketId,
  comments,
  totalCount,
  viewerId,
  className,
}: CommentsThreadProps) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["comments", marketId] as const, [marketId]);
  const [replyOpenFor, setReplyOpenFor] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const { data: threadComments } = useQuery<ThreadComment[]>({
    queryKey,
    queryFn: () =>
      Promise.resolve(
        (queryClient.getQueryData<ThreadComment[]>(queryKey) ?? comments) as ThreadComment[],
      ),
    initialData: comments as ThreadComment[],
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });

  const postMutation = useMutation({
    mutationFn: async (vars: { body: string; parentId: string | null; tempId: string }) => {
      const result = await postCommentAction({
        marketId,
        body: vars.body,
        parentId: vars.parentId ?? undefined,
      });
      if (result?.serverError) throw new Error(result.serverError);
      const data = result?.data;
      if (!data || data.ok === false) {
        const code = data?.ok === false ? data.error : "unknown";
        if (code === "rate_limited" && data?.ok === false && "retryAfterSec" in data) {
          throw new Error(`rate_limited:${data.retryAfterSec}`);
        }
        throw new Error(code);
      }
      return { server: data.comment, tempId: vars.tempId };
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ThreadComment[]>(queryKey) ?? [];
      const optimistic: ThreadComment = {
        id: vars.tempId,
        parentId: vars.parentId,
        userId: viewerId ?? "you",
        body: vars.body,
        score: 0,
        createdAt: new Date().toISOString(),
        username: "you",
        displayName: null,
        myVote: 0,
        replies: [],
        pending: true,
      };
      const next = insertComment(previous, optimistic);
      queryClient.setQueryData<ThreadComment[]>(queryKey, next);
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) queryClient.setQueryData(queryKey, ctx.previous);
      const message = err instanceof Error ? err.message : "Couldn't post.";
      if (message.startsWith("rate_limited")) {
        const wait = message.split(":")[1] ?? "60";
        toast.error(`Slow down — try again in ${wait}s.`);
      } else {
        toast.error("Couldn't post comment.");
      }
    },
    onSuccess: ({ server, tempId }) => {
      queryClient.setQueryData<ThreadComment[]>(queryKey, (curr) =>
        replaceTempWithServer(curr ?? [], tempId, server as ThreadComment),
      );
    },
  });

  const voteMutation = useMutation({
    mutationFn: async (vars: { commentId: string; next: 1 | 0 }) => {
      const result = await voteCommentAction({
        commentId: vars.commentId,
        value: vars.next,
      });
      if (result?.serverError) throw new Error(result.serverError);
      const data = result?.data;
      if (!data || data.ok === false) throw new Error("vote_failed");
      return { commentId: vars.commentId, score: data.score, myVote: data.myVote };
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ThreadComment[]>(queryKey) ?? [];
      const next = applyVote(previous, vars.commentId, vars.next);
      queryClient.setQueryData<ThreadComment[]>(queryKey, next);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) queryClient.setQueryData(queryKey, ctx.previous);
      toast.error("Couldn't update vote.");
    },
    onSuccess: ({ commentId, score, myVote }) => {
      queryClient.setQueryData<ThreadComment[]>(queryKey, (curr) =>
        setCommentScore(curr ?? [], commentId, score, myVote),
      );
    },
  });

  const handlePost = (body: string, parentId: string | null) => {
    const tempId = `temp-${Math.random().toString(36).slice(2)}`;
    startTransition(() => {
      postMutation.mutate({ body, parentId, tempId });
    });
  };

  const handleVote = (commentId: string, next: 1 | 0) => {
    if (viewerId === null) {
      toast.error("Sign in to vote.");
      return;
    }
    voteMutation.mutate({ commentId, next });
  };

  const sorted = useMemo(
    () =>
      [...threadComments].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [threadComments],
  );

  const replyComposer = replyOpenFor ? (
    <CommentComposer
      key={replyOpenFor}
      autoFocus
      placeholder="Write a reply…"
      submitLabel="Reply"
      onSubmit={async (body) => {
        handlePost(body, replyOpenFor);
        setReplyOpenFor(null);
      }}
      onCancel={() => setReplyOpenFor(null)}
      disabled={!viewerId}
      textareaId={`reply-${replyOpenFor}`}
    />
  ) : null;

  return (
    <section
      className={cn("border-border bg-card flex flex-col rounded-xl border", className)}
      aria-label="Comments"
    >
      <header className="border-border flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">Comments</h2>
        <span className="text-muted-fg text-xs tabular-nums">
          {totalCount.toLocaleString("en-US")} total
        </span>
      </header>

      {sorted.length === 0 ? (
        <p className="text-muted-fg px-4 py-6 text-center text-xs">No comments yet.</p>
      ) : (
        <ul className="divide-border/60 flex flex-col divide-y px-4">
          {sorted.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              depth={0}
              viewerId={viewerId}
              onReply={(parentId) =>
                setReplyOpenFor((curr) => (curr === parentId ? null : parentId))
              }
              onVote={handleVote}
              voting={voteMutation.isPending}
              replyOpenFor={replyOpenFor}
              composerSlot={replyComposer}
            />
          ))}
        </ul>
      )}

      <footer className="border-border border-t px-4 py-3">
        {viewerId ? (
          <CommentComposer
            placeholder="Post a comment…"
            submitLabel="Post"
            onSubmit={async (body) => handlePost(body, null)}
            disabled={postMutation.isPending}
            textareaId="comment-root-composer"
          />
        ) : (
          <p className="text-muted-fg text-center text-[11px]">Sign in to join the conversation.</p>
        )}
      </footer>
    </section>
  );
}
