/**
 * tag-utils.ts
 *
 * Shared utilities for normalising tag and comment data returned by the API.
 *
 * The backend can return tags and comments in multiple shapes depending on the
 * endpoint: plain strings, `TagResponse` objects (`{ tag_name, ... }`), or
 * arbitrary rich objects. These helpers collapse every variant into a clean
 * `string[]` that UI components can use directly.
 *
 * Consumers:
 *   - normalizeTagList       → pin-item.tsx, right-sidebar.tsx, app-layout.tsx
 *   - normalizeCommentStrings → right-sidebar.tsx, app-layout.tsx
 */

// ---------------------------------------------------------------------------
// normalizeTagList
// ---------------------------------------------------------------------------

/**
 * Shape of a tag object the API may return.
 * Fields are checked in priority order: `tag_name` → `name` → `label` → `text`.
 * @internal
 */
interface RawTagObject {
  tag_name?: unknown;
  name?: unknown;
  label?: unknown;
  text?: unknown;
}

/**
 * Normalises a raw tag array into a clean `string[]`.
 *
 * Handles every shape the API produces:
 *   - Plain strings              → trimmed as-is
 *   - `TagResponse` objects      → resolved from `tag_name`, `name`, `label`, `text`
 *   - Anything else              → silently dropped
 *
 * @param rawTags - The raw value from the API response (may be any type).
 * @returns An array of non-empty, trimmed tag strings. Never throws.
 *
 * @example
 *   normalizeTagList(["AI", "  react "])
 *   // → ["AI", "react"]
 *
 *   normalizeTagList([{ tag_name: "design" }, { name: "ux" }])
 *   // → ["design", "ux"]
 *
 *   normalizeTagList(null)
 *   // → []
 */
export function normalizeTagList(rawTags: unknown): string[] {
  if (!Array.isArray(rawTags)) return [];

  return rawTags
    .map((tag): string => {
      if (typeof tag === "string") return tag.trim();
      if (!tag || typeof tag !== "object") return "";

      const candidate = tag as RawTagObject;
      const value =
        candidate.tag_name ?? candidate.name ?? candidate.label ?? candidate.text;
      return typeof value === "string" ? value.trim() : "";
    })
    .filter((tag) => tag.length > 0);
}

// ---------------------------------------------------------------------------
// normalizeCommentStrings
// ---------------------------------------------------------------------------

/**
 * Shape of a comment object the API may return.
 * Fields are checked in priority order: `comment_text` → `text` → `content`.
 * @internal
 */
interface RawCommentObject {
  comment_text?: unknown;
  text?: unknown;
  content?: unknown;
}

/**
 * Normalises a raw comment array into a clean `string[]`.
 *
 * Handles every shape the API produces:
 *   - Plain strings                 → trimmed as-is
 *   - `CommentResponse` objects     → resolved from `comment_text`, `text`, `content`
 *   - Anything else                 → silently dropped
 *
 * @param raw - The raw value from the API response (may be any type).
 * @returns An array of non-empty, trimmed comment strings. Never throws.
 *
 * @example
 *   normalizeCommentStrings(["Great find!", "  Note this  "])
 *   // → ["Great find!", "Note this"]
 *
 *   normalizeCommentStrings([{ comment_text: "Useful ref" }, { text: "Follow up" }])
 *   // → ["Useful ref", "Follow up"]
 *
 *   normalizeCommentStrings(undefined)
 *   // → []
 */
export function normalizeCommentStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((comment): string => {
      if (typeof comment === "string") return comment.trim();
      if (!comment || typeof comment !== "object") return "";

      const candidate = comment as RawCommentObject;
      const value =
        candidate.comment_text ?? candidate.text ?? candidate.content;
      return typeof value === "string" ? value.trim() : "";
    })
    .filter((comment) => comment.length > 0);
}
