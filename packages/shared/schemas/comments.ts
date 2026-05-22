// HOMECOURT — comment schemas for the M10 write-side.
//
// The DB constraint on comments.body is 1..600 chars (see
// 0005_social_settlement.sql). The form caps user input at 600 to match.

import { z } from "zod";

export const COMMENT_BODY_MAX = 600;

export const postCommentSchema = z.object({
  marketId: z.string().uuid("Invalid market id."),
  body: z
    .string()
    .trim()
    .min(1, "Say something.")
    .max(COMMENT_BODY_MAX, `Keep it under ${COMMENT_BODY_MAX} characters.`),
  parentId: z.string().uuid().optional().nullable(),
});

export type PostCommentInput = z.infer<typeof postCommentSchema>;

export const voteCommentSchema = z.object({
  commentId: z.string().uuid("Invalid comment id."),
  /** 1 = upvote, -1 = downvote, 0 = remove existing vote. */
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
});

export type VoteCommentInput = z.infer<typeof voteCommentSchema>;
