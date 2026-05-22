// HOMECOURT — settings zod schemas (M12).

import { z } from "zod";

const phoneRegex = /^\+?[0-9()\-\s]{7,20}$/;

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a display name.").max(60, "Max 60 characters."),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || phoneRegex.test(v), "Enter a valid phone number.")
    .optional()
    .default(""),
});

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1, "Name your key.").max(40, "Max 40 characters."),
});

export const revokeApiKeySchema = z.object({
  notificationId: z.string().uuid("Invalid id."),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type RevokeApiKeyInput = z.infer<typeof revokeApiKeySchema>;
