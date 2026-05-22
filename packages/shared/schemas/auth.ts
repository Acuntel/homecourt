// HOMECOURT — shared auth zod schemas.
// Source of truth used by both client forms and server actions.

import { z } from "zod";

export const emailSignUpSchema = z.object({
  email: z.string().email("Enter a valid email."),
  username: z
    .string()
    .min(3, "At least 3 characters.")
    .max(20, "Max 20 characters.")
    .regex(/^[a-z0-9_]+$/i, "Letters, numbers, and underscores only."),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms." }),
  }),
});

export const emailLoginSchema = z.object({
  email: z.string().email("Enter a valid email."),
});

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  token: z.string().min(6, "Enter the code from your email."),
});

export type EmailSignUpInput = z.infer<typeof emailSignUpSchema>;
export type EmailLoginInput = z.infer<typeof emailLoginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
