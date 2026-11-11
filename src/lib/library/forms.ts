// Validation for the small Library forms. One schema is the contract for the form and for the
// message shown; the server validates again (this is for fast, specific feedback, not security).

import { z } from "zod";

/** The longest stored file name, extension included (the server's fileName limit). */
export const MAX_TITLE_LENGTH = 255;

// The server drops control characters and turns / and \ into "-" (library.py fileName); doing the same
// here means a name made only of control characters is refused instead of saved empty.
const CONTROL = /[\u0000-\u001f\u007f]/g;

/** The most characters a name can have before the server would cut it to keep `.extension`. */
export function maxTitleLength(extension?: string): number {
  return MAX_TITLE_LENGTH - (extension ? extension.length + 1 : 0);
}

/** The rename body for a file with this extension: control characters dropped, trimmed, sized to fit. */
export function renameSchemaFor(extension?: string) {
  const max = maxTitleLength(extension);
  return z.object({
    title: z
      .string()
      .transform((value) => value.replace(CONTROL, ""))
      .pipe(z.string().trim().min(1, "Enter a name").max(max, `Use ${max} characters or fewer`)),
  });
}

export const renameSchema = renameSchemaFor();

export type RenameResult = { ok: true; title: string } | { ok: false; error: string };

/** The message for the first problem with a proposed name, or the cleaned name when it is fine. Note: "/" and "\" are saved as "-". */
export function validateTitle(input: string, extension?: string): RenameResult {
  const result = renameSchemaFor(extension).safeParse({ title: input });
  if (result.success) return { ok: true, title: result.data.title };
  return { ok: false, error: result.error.issues[0]?.message ?? "Enter a name" };
}
