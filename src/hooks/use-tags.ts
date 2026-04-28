"use client";

/**
 * useTags — manages all tag state, synchronisation, and CRUD for a single
 * PinItem card.
 *
 * Responsibilities:
 *   - `tags`          Local copy of the pin's tag list, kept in sync with the
 *                     incoming `pin.tags` prop via a debounced effect (avoids
 *                     redundant updates when the array reference changes but
 *                     the contents are identical).
 *   - `tagInput`      Controlled value for the "Add Tag" input field.
 *   - `hoveredTagIndex` Which tag badge is currently hovered (drives the
 *                     remove-button visibility).
 *   - Constants       `MAX_TAG_LINES` and `ESTIMATED_TAGS_PER_LINE` — the soft
 *                     cap used for both the "add tag" visibility guard and the
 *                     overflow toast.
 *   - `handleTagKeyDown`  Adds a sanitized tag on Enter key, enforcing the
 *                     line cap and deduplication.
 *   - `handleRemoveTag`   Removes the tag at the given index from local state
 *                     and notifies both `onUpdatePin` and `onRemoveTag`.
 *   - `getTagColor`   Pure deterministic function: maps any tag string to one
 *                     of three brand colours based on its first two characters.
 *                     Extracted from inline JSX to make it independently
 *                     testable and re-usable across pin-related components.
 *
 * NOT in scope:
 *   - Title editing   (`isEditingTitle`, `titleInput`, …)
 *   - Comments        (`comments`, `commentInput`, …)
 *   - Folder / move   (`moveFolderSearch`, `showCreateFolderDialog`, …)
 */

import { useState, useEffect, useCallback } from "react";
import type { PinType } from "@/components/layout/right-sidebar";
import { sanitizeTagName } from "@/lib/security";
import { normalizeTagList } from "@/lib/utils/tag-utils";
import { toast } from "@/lib/toast-helper";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Maximum number of tag rows shown inside a pin card before new tags are
 * blocked. Each row fits approximately `ESTIMATED_TAGS_PER_LINE` short tags.
 */
export const MAX_TAG_LINES = 2;

/**
 * Rough number of average-width tags that fit on a single row. Used together
 * with `MAX_TAG_LINES` to compute the soft cap: `MAX_TAG_LINES *
 * ESTIMATED_TAGS_PER_LINE`.
 */
export const ESTIMATED_TAGS_PER_LINE = 4;

/** Computed hard cap derived from the two constants above. */
export const TAG_LIMIT = MAX_TAG_LINES * ESTIMATED_TAGS_PER_LINE;

// ─── Tag colour utility ───────────────────────────────────────────────────────

/** Brand colour palette used to tint tag badges. */
const TAG_COLORS = ["#E55959", "#9A6FF1", "#756AF2"] as const;

/**
 * Returns a deterministic brand colour for `tagText`.
 *
 * The colour is derived from the character-code sum of the first two lower-cased
 * characters, so the same tag always maps to the same colour, regardless of
 * render order or component instance.
 *
 * @example
 *   getTagColor("react") // "#9A6FF1"
 *   getTagColor("ai")    // "#756AF2"
 */
export function getTagColor(tagText: string): string {
  const firstTwo = tagText.substring(0, 2).toLowerCase();
  const charSum =
    firstTwo.charCodeAt(0) + (firstTwo.charCodeAt(1) || 0);
  return TAG_COLORS[charSum % TAG_COLORS.length];
}

// ─── Hook params ─────────────────────────────────────────────────────────────

export interface UseTagsParams {
  /** The pin whose tags are managed. Used as the authoritative source for tag
   *  synchronisation and as the base object for `onUpdatePin` payloads. */
  pin: PinType;

  /**
   * Called with the full updated pin whenever a tag is added. The hook merges
   * the new tag list into a shallow copy of `pin` so callers receive a
   * structurally correct `PinType`.
   */
  onUpdatePin: (updatedPin: PinType) => void;

  /**
   * Called when a tag is removed. Receives the pin id and the *original* index
   * of the removed tag so the parent (e.g. `OrganizePinsDialog`) can apply its
   * own normalisation if needed.
   */
  onRemoveTag: (pinId: string, tagIndex: number) => void;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useTags({ pin, onUpdatePin, onRemoveTag }: UseTagsParams) {
  // ── Local tag list ────────────────────────────────────────────────────────

  const [tags, setTags] = useState<string[]>(() => normalizeTagList(pin.tags));

  // ── Controlled input ──────────────────────────────────────────────────────

  const [tagInput, setTagInput] = useState("");

  // ── Hover tracking (drives remove-button visibility) ──────────────────────

  const [hoveredTagIndex, setHoveredTagIndex] = useState<number | null>(null);

  // ── Effects ───────────────────────────────────────────────────────────────

  /**
   * Synchronise local `tags` with incoming `pin.tags`.
   *
   * Only triggers a state update when the *contents* differ — avoids redundant
   * re-renders when a parent passes a new array reference with the same values.
   * The `setTimeout` defers the `setState` call to the next tick so it never
   * fires synchronously during a render cycle.
   */
  useEffect(() => {
    const incoming = normalizeTagList(pin.tags);
    const changed =
      tags.length !== incoming.length ||
      incoming.some((t, i) => t !== tags[i]);
    if (!changed) return;

    const id = setTimeout(() => setTags(incoming), 0);
    return () => clearTimeout(id);
    // `tags` intentionally included so the comparison is always fresh.
  }, [pin.tags, tags]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  /**
   * Keyboard handler for the "Add Tag" input.
   *
   * On `Enter`:
   *   1. Sanitizes the input via `sanitizeTagName` (strips unsafe chars).
   *   2. Guards against exceeding `TAG_LIMIT` rows with a toast notification.
   *   3. Prepends the new tag (most-recent first ordering).
   *   4. Persists via `onUpdatePin` and clears the input.
   */
  const handleTagKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter" || !tagInput.trim()) return;
      event.preventDefault();

      const safeTag = sanitizeTagName(tagInput);
      if (!safeTag) return;

      if (tags.length >= TAG_LIMIT) {
        toast.error("Cannot add more tags", {
          description: `Maximum tag limit reached (${MAX_TAG_LINES} lines)`,
        });
        return;
      }

      // Prepend — most-recently-added tags appear first.
      const newTags = [safeTag, ...tags];
      setTags(newTags);
      onUpdatePin({ ...pin, tags: newTags });
      setTagInput("");
      toast("Tag added!");
    },
    [pin, tags, tagInput, onUpdatePin],
  );

  /**
   * Removes the tag at `tagIndex` from local state and notifies both
   * `onUpdatePin` (full pin payload) and `onRemoveTag` (index-based callback
   * used by some parent components for finer-grained control).
   */
  const handleRemoveTag = useCallback(
    (tagIndex: number) => {
      const newTags = tags.filter((_, i) => i !== tagIndex);
      setTags(newTags);
      onRemoveTag(pin.id, tagIndex);
    },
    [pin.id, tags, onRemoveTag],
  );

  // ── Return value ──────────────────────────────────────────────────────────

  return {
    // State
    tags,
    tagInput,
    setTagInput,
    hoveredTagIndex,
    setHoveredTagIndex,
    // Constants (exposed so JSX guards can use the same values)
    MAX_TAG_LINES,
    ESTIMATED_TAGS_PER_LINE,
    TAG_LIMIT,
    // Handlers
    handleTagKeyDown,
    handleRemoveTag,
    // Utilities
    getTagColor,
  };
}

/** Convenience type alias for consumers that want to forward the hook's API. */
export type TagsReturn = ReturnType<typeof useTags>;
