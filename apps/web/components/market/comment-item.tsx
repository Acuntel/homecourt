"use client";

// HOMECOURT — Single comment row with vote + reply controls. Used by
// CommentsThread; recurses one level for replies.

import { formatDistanceToNow } from "date-fns";
import { ArrowUp, MessageSquare, User } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ThreadComment } from "@/components/market/comment-tree";

const AVATAR_PALETTE = [
  "bg-court-500/20 text-court-500",
  "bg-cobalt-500/20 text-cobalt-500",
  "bg-amber-500/20 text-amber-500",
  "bg-violet-500/20 text-violet-500",
];

function initials(username: string): string {
  const cleaned = username.replace(/[^a-zA-Z0-9]/g, "");
  if (cleaned.length === 0) return "?";
  if (cleaned.length === 1) return cleaned[0]!.toUpperCase();
  return (cleaned[0]! + cleaned[cleaned.length - 1]!).toUpperCase();
}

function avatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length] ?? AVATAR_PALETTE[0]!;
}

function sanitizeForRender(body: string): string {
  return DOMPurify.sanitize(body, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

export interface CommentItemProps {
  comment: ThreadComment;
  depth: number;
  viewerId: string | null;
  onReply: (parentId: string) => void;
  onVote: (commentId: string, next: 1 | 0) => void;
  voting: boolean;
  replyOpenFor: string | null;
  composerSlot: React.ReactNode;
}

export function CommentItem({
  comment,
  depth,
  viewerId,
  onReply,
  onVote,
  voting,
  replyOpenFor,
  composerSlot,
}: CommentItemProps) {
  const isOwn = viewerId !== null && viewerId === comment.userId;
  const upvoted = comment.myVote === 1;
  const displayUsername = comment.username || "user";
  const showIconFallback = displayUsername.replace(/[^a-zA-Z0-9]/g, "").length < 2;

  const handleVote = () => {
    if (isOwn || comment.pending) return;
    onVote(comment.id, upvoted ? 0 : 1);
  };

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
            avatarColor(displayUsername),
          )}
        >
          {showIconFallback ? (
            <User className="h-3.5 w-3.5" aria-hidden />
          ) : (
            initials(displayUsername)
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-foreground text-xs font-medium">@{displayUsername}</span>
            <span className="text-muted-fg text-[11px]">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>
            {comment.pending ? (
              <span className="inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-500">
                Posting…
              </span>
            ) : null}
          </div>
          <p className="text-foreground whitespace-pre-wrap break-words text-sm leading-relaxed">
            {sanitizeForRender(comment.body)}
          </p>
          <div className="text-muted-fg mt-1 flex items-center gap-3 text-[11px]">
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleVote}
                    disabled={isOwn || voting || comment.pending || viewerId === null}
                    aria-pressed={upvoted}
                    aria-label={`Upvote — score ${comment.score}`}
                    className={cn(
                      "focus-visible:ring-court-500 inline-flex items-center gap-1 rounded font-mono tabular-nums focus-visible:outline-none focus-visible:ring-1 disabled:opacity-60",
                      upvoted ? "text-court-500" : "hover:text-foreground",
                    )}
                  >
                    <ArrowUp className={cn("h-3 w-3", upvoted ? "fill-current" : "")} aria-hidden />
                    {comment.score}
                  </button>
                </TooltipTrigger>
                {isOwn ? (
                  <TooltipContent side="bottom">Can&apos;t vote on your own.</TooltipContent>
                ) : null}
              </Tooltip>
            </TooltipProvider>
            {viewerId !== null && !comment.pending ? (
              <button
                type="button"
                onClick={() => onReply(comment.id)}
                className="focus-visible:ring-court-500 hover:text-foreground inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-1"
                aria-expanded={replyOpenFor === comment.id}
              >
                <MessageSquare className="h-3 w-3" aria-hidden />
                Reply
              </button>
            ) : null}
          </div>
          {replyOpenFor === comment.id ? <div className="mt-2">{composerSlot}</div> : null}
        </div>
      </div>
      {comment.replies.length > 0 ? (
        <ul className="flex flex-col gap-0">
          {comment.replies.slice(0, 8).map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply as ThreadComment}
              depth={depth + 1}
              viewerId={viewerId}
              onReply={onReply}
              onVote={onVote}
              voting={voting}
              replyOpenFor={replyOpenFor}
              composerSlot={composerSlot}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
