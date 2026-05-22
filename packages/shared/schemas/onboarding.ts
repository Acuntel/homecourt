// HOMECOURT — onboarding zod schemas.

import { z } from "zod";

const phoneRegex = /^\+?[0-9()\-\s]{7,20}$/;

export const identitySchema = z.object({
  legalFirstName: z.string().min(1, "Required."),
  legalLastName: z.string().min(1, "Required."),
  dob: z
    .string()
    .refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s), "Use YYYY-MM-DD.")
    .refine((s) => Date.now() - +new Date(s) > 18 * 365 * 864e5, "Must be 18+."),
  phone: z.string().regex(phoneRegex, "Enter a valid phone number."),
});

export const verifyPhoneSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "6-digit code."),
});

export const twoFaSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "6-digit code."),
});

export type IdentityInput = z.infer<typeof identitySchema>;
export type VerifyPhoneInput = z.infer<typeof verifyPhoneSchema>;
export type TwoFaInput = z.infer<typeof twoFaSchema>;
