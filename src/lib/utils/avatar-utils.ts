/**
 * avatar-utils.ts
 *
 * Shared utilities for resolving persona avatar URLs.
 *
 * The backend may return avatar paths as:
 *   - A fully-qualified URL  ("https://cdn.example.com/…")
 *   - A data URI             ("data:image/png;base64,…")
 *   - A blob URL             ("blob:https://…")
 *   - A relative path        ("/media/avatars/…" or "media/avatars/…")
 *
 * `getFullAvatarUrl` normalises all four cases into a URL that is safe to
 * use in <img src> or Next.js <Image> components.
 *
 * `isUnoptimizedAvatarUrl` indicates when Next.js image optimisation must be
 * bypassed (data URIs, blob URLs, and external URLs that are not served
 * through the Next.js image proxy).
 *
 * Consumers:
 *   - getFullAvatarUrl      → personas/admin/page.tsx
 *                             personas/page.tsx
 *                             personas/new/configure/page.tsx
 *                             PersonaChatFullPage.tsx
 *   - isUnoptimizedAvatarUrl → available for any future Next.js <Image> usage
 */

import { API_BASE_URL } from "@/lib/config";

// ---------------------------------------------------------------------------
// getFullAvatarUrl
// ---------------------------------------------------------------------------

/**
 * Resolves a raw avatar value to a fully-qualified URL.
 *
 * - Absolute URLs, data URIs, and blob URLs are returned unchanged.
 * - Relative paths (with or without a leading `/`) are prefixed with
 *   `API_BASE_URL`, inserting a `/` separator only when needed.
 * - Null, undefined, or blank strings return `null`.
 *
 * @param url - Raw URL string from the API response.
 * @returns A fully-qualified URL string, or `null` if the input is empty.
 *
 * @example
 *   getFullAvatarUrl("https://cdn.example.com/avatar.png")
 *   // → "https://cdn.example.com/avatar.png"   (unchanged)
 *
 *   getFullAvatarUrl("/media/avatars/123.png")
 *   // → "https://api.example.com/media/avatars/123.png"
 *
 *   getFullAvatarUrl("media/avatars/123.png")
 *   // → "https://api.example.com/media/avatars/123.png"
 *
 *   getFullAvatarUrl(null)
 *   // → null
 */
export function getFullAvatarUrl(url: string | null | undefined): string | null {
  if (!url || url.trim() === "") return null;

  if (
    url.startsWith("http") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  ) {
    return url;
  }

  // Relative path — prepend backend base URL, normalising the separator.
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

// ---------------------------------------------------------------------------
// isUnoptimizedAvatarUrl
// ---------------------------------------------------------------------------

/**
 * Returns `true` when Next.js image optimisation should be disabled for this
 * URL (i.e. the `unoptimized` prop on `<Image>` should be set).
 *
 * This is required for:
 *   - **data URIs** — not supported by the Next.js image pipeline.
 *   - **blob URLs** — ephemeral, browser-local; cannot be fetched server-side.
 *   - **External URLs** — not listed in `next.config` `remotePatterns`.
 *
 * @param url - Raw URL string (pre- or post-resolution).
 *
 * @example
 *   isUnoptimizedAvatarUrl("data:image/png;base64,…")  // → true
 *   isUnoptimizedAvatarUrl("/media/avatars/123.png")   // → true  (resolves to http…)
 *   isUnoptimizedAvatarUrl(null)                       // → false
 */
export function isUnoptimizedAvatarUrl(url: string | null | undefined): boolean {
  const resolved = getFullAvatarUrl(url);
  if (!resolved) return false;

  return (
    resolved.startsWith("data:") ||
    resolved.startsWith("blob:") ||
    resolved.startsWith("http")
  );
}
