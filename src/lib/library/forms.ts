// Validation for the small Library forms. One schema is the contract for the form and for the
// message shown; the server validates again (this is for fast, specific feedback, not security).

import { z } from "zod";

export const MAX_TITLE_LENGTH = 255;

export const renameSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter a name")
    .max(MAX_TITLE_LENGTH, `Use ${MAX_TITLE_LENGTH} characters or fewer`),
});

export type RenameResult = { ok: true; title: string } | { ok: false; error: string };

/** The message for the first problem with a proposed name, or the cleaned name when it is fine. */
export function validateTitle(input: string): RenameResult {
  const result = renameSchema.safeParse({ title: input });
  if (result.success) return { ok: true, title: result.data.title };
  return { ok: false, error: result.error.issues[0]?.message ?? "Enter a name" };
}
