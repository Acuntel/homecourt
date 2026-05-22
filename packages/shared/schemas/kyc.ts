// HOMECOURT — KYC zod schemas.
// P0 sweepstakes mode = optional/permissive; the wizard auto-passes.

import { z } from "zod";

export const kycSchema = z.object({
  legalFirstName: z.string().min(1, "Required."),
  legalLastName: z.string().min(1, "Required."),
  dob: z
    .string()
    .refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s), "Use YYYY-MM-DD.")
    .refine((s) => Date.now() - +new Date(s) > 18 * 365 * 864e5, "Must be 18+."),
  ssnLast4: z
    .string()
    .regex(/^\d{4}$/, "Last 4 digits of SSN.")
    .optional(),
  addressLine1: z.string().min(1, "Required.").optional(),
  city: z.string().min(1, "Required.").optional(),
  state: z.string().length(2, "2-letter state.").optional(),
  zip: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, "Valid US ZIP.")
    .optional(),
});

export const kycSubmitSchema = z.object({
  sweepstakesAutoPass: z.boolean().default(true),
});

export type KycInput = z.infer<typeof kycSchema>;
export type KycSubmitInput = z.infer<typeof kycSubmitSchema>;
