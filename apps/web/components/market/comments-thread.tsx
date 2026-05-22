"use client";

// HOMECOURT — Read-only comments thread for M5. M10 wires posting + voting.

import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowUp, MessageSquare } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { MarketComment } from "@homecourt/shared";

interface CommentsThreadProps {
  comments: MarketComment[];
  totalCount: number;
  className?: string;
}

function initials(username: string): string {
  const cleaned = username.replace(/[^a-zA-Z0-9]/g, "");
  if (cleaned.length === 0) return "?";
  if (cleaned.length === 1) return cleaned[0]!.toUpperCase();
  return (cleaned[0]! + cleaned[cleaned.length - 1]!).toUpperCase();
}

const AVATAR_PALETTE = [
  "bg-court-500/20 text-court-500",
  "bg-cobalt-500/20 text-cobalt-500",
  "bg-amber-500/20 text-amber-500",
  "bg-violet-500/20 text-violet-500",
];

function avatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length] ?? AVATAR_PALETTE[0]!;
}

interface CommentItemProps {
  comment: MarketComment;
  depth: number;
}

function CommentItem({ comment, depth }: CommentItemProps) {
  return (
    <li
      className={cn(
        "flex flex-col gap-2 border-l border-transparent py-3",
        depth > 0 ? "border-border/60 ml-4 pl-3" : "",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold uppercase",
            avatarColor(comment.username),
          )}
        >
          {initials(comment.username)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-foreground text-xs font-medium">@{comment.username}</span>
            <span className="text-muted-fg text-[11px]">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>
          </div>
          <p className="text-foreground whitespace-pre-wrap break-words text-sm leading-relaxed">
            {comment.body}
          </p>
          <div className="text-muted-fg mt-1 flex items-center gap-3 text-[11px]">
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled
                    className="hover:text-foreground inline-flex items-center gap-1 font-mono tabular-nums disabled:opacity-60"
                    aria-label={`Upvote — ${comment.score}`}
                  >
                    <ArrowUp className="h-3 w-3" aria-hidden />
                    {comment.score}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Voting opens in M10.</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled
                    className="hover:text-foreground inline-flex items-center gap-1 disabled:opacity-60"
                  >
                    <MessageSquare className="h-3 w-3" aria-hidden />
                    Reply
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Replies open in M10.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
      {comment.replies.length > 0 ? (
        <ul className="flex flex-col gap-0">
          {comment.replies.slice(0, 8).map((reply) => (
            <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function CommentsThread({ comments, totalCount, className }: CommentsThreadProps) {
  const sorted = useMemo(
    () =>
      [...comments].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [comments],
  );

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
            <CommentItem key={c.id} comment={c} depth={0} />
          ))}
        </ul>
      )}

      <footer className="border-border text-muted-fg border-t px-4 py-3 text-[11px]">
        Posting opens in M10. For now, read what others are watching.
      </footer>
    </section>
  );
}
