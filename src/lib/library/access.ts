// How people are named in Library. What a person may do with a file lives on LibraryFile (file.ts).

import { sanitizeDisplayText } from "./format";
import type { Person } from "./schemas";

export const ONLY_OWNER_TIP = "Only the owner can change this";

/** "You" for the viewer, the person's sanitised name otherwise. */
export function personName(person: Person, viewerId: string | undefined): string {
  if (viewerId !== undefined && person.id === viewerId) return "You";
  return sanitizeDisplayText(person.name) || "Someone";
}
