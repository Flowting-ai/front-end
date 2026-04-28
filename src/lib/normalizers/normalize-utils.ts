/**
 * normalize-utils.ts
 *
 * Shared normalization utilities for UUIDs and URLs.
 *
 * These functions were previously duplicated inline across multiple components.
 * They are pure, side-effect-free, and fully typed.
 *
 * Consumers:
 *   - isValidUUID          → compare-models.tsx, WorkflowChatFullPage.tsx
 *   - normalizeUuid        → compare-models.tsx
 *   - normalizeUrl         → chat-interface.tsx
 *   - normalizeUuidReference → use-streaming-chat.ts, chat-interface.tsx (handlePin)
 *
 * Note on UUID strictness:
 *   `isValidUUID` and `normalizeUuid` use a **loose** regex that accepts any
 *   UUID version (v1–v8) without requiring specific variant bits. This matches
 *   the broadest common use-case (model IDs, chat IDs, workflow IDs from the
 *   API). `normalizeUuidReference` uses a stricter v4-like pattern with variant
 *   bits, matching the API's expectations for message/chat IDs.
 */

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/**
 * Loose UUID pattern — matches v1–v8 UUIDs, no variant-bit restriction.
 * Suitable for general API-response ID validation.
 *
 * @internal
 */
const UUID_LOOSE_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `urn:uuid:` namespace prefix that some APIs prepend to UUID values. @internal */
const URN_UUID_PREFIX = "urn:uuid:";

// ---------------------------------------------------------------------------
// isValidUUID
// ---------------------------------------------------------------------------

/**
 * Returns `true` when `value` is a well-formed UUID string (any version,
 * loose check — no variant-bit restriction).
 *
 * @param value - The string to test.
 *
 * @example
 *   isValidUUID("550e8400-e29b-41d4-a716-446655440000")  // → true
 *   isValidUUID("not-a-uuid")                            // → false
 *   isValidUUID("")                                      // → false
 */
export function isValidUUID(value: string): boolean {
  return UUID_LOOSE_RE.test(value);
}

// ---------------------------------------------------------------------------
// normalizeUuid
// ---------------------------------------------------------------------------

/**
 * Normalises a raw UUID value from an API response:
 *
 * 1. Coerces `value` to a trimmed string (accepts `unknown` input).
 * 2. Strips a leading `urn:uuid:` prefix if present.
 * 3. Validates the result against the loose UUID pattern.
 * 4. Returns the lower-cased UUID on success, or `null` if invalid.
 *
 * @param value - Raw value from an API response (may be any type).
 * @returns A normalised UUID string, or `null` if the input is not a valid UUID.
 *
 * @example
 *   normalizeUuid("urn:uuid:550e8400-e29b-41d4-a716-446655440000")
 *   // → "550e8400-e29b-41d4-a716-446655440000"
 *
 *   normalizeUuid("550E8400-E29B-41D4-A716-446655440000")
 *   // → "550e8400-e29b-41d4-a716-446655440000"
 *
 *   normalizeUuid(null)    // → null
 *   normalizeUuid("bad")   // → null
 */
export function normalizeUuid(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const withoutUrn = raw.toLowerCase().startsWith(URN_UUID_PREFIX)
    ? raw.slice(URN_UUID_PREFIX.length)
    : raw;

  return UUID_LOOSE_RE.test(withoutUrn) ? withoutUrn : null;
}

// ---------------------------------------------------------------------------
// normalizeUrl
// ---------------------------------------------------------------------------

/**
 * Normalises a URL for reliable string comparison and deduplication:
 *
 * - Trims surrounding whitespace.
 * - Strips the fragment (`#hash`).
 * - Strips the query string (`?search`).
 * - Removes a trailing slash from the pathname (preserving the root `/`).
 * - Returns `origin + normalised_pathname`.
 *
 * Falls back to `url.trim()` when the input cannot be parsed as a URL
 * (e.g. relative paths or malformed strings).
 *
 * @param url - The URL to normalise.
 * @returns A canonical URL string suitable for equality checks.
 *
 * @example
 *   normalizeUrl("https://example.com/page/?ref=abc#section")
 *   // → "https://example.com/page"
 *
 *   normalizeUrl("https://example.com/")
 *   // → "https://example.com/"   (root path preserved)
 *
 *   normalizeUrl("not a url")
 *   // → "not a url"  (fallback)
 */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = "";
    u.search = "";
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.origin}${path}`;
  } catch {
    return url.trim();
  }
}

// ---------------------------------------------------------------------------
// normalizeUuidReference
// ---------------------------------------------------------------------------

/**
 * Strict UUID pattern — v4-like with variant bits (`8`, `9`, `a`, or `b`).
 * Used for message IDs and chat IDs that the API guarantees to be v4 UUIDs.
 * @internal
 */
const UUID_V4_LIKE_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Normalises a raw reference value to a v4-like UUID string accepted by the
 * chat/streaming API:
 *
 * 1. Coerces the input to a trimmed string.
 * 2. Strips a leading `urn:uuid:` prefix.
 * 3. Validates the result against the strict v4-like pattern.
 * 4. If validation fails, attempts to recover the UUID prefix from strings
 *    that have a role suffix appended by the UI (e.g. `<uuid>-assistant`).
 * 5. Returns the matched UUID string, or `null` on failure.
 *
 * @param value - Raw value from API response or local message ID (any type).
 * @returns A normalised UUID string or `null` if the input is not a valid reference.
 *
 * @example
 *   normalizeUuidReference("urn:uuid:550e8400-e29b-41d4-a716-446655440000")
 *   // → "550e8400-e29b-41d4-a716-446655440000"
 *
 *   normalizeUuidReference("550e8400-e29b-41d4-a716-446655440000-assistant")
 *   // → "550e8400-e29b-41d4-a716-446655440000"
 *
 *   normalizeUuidReference(null)   // → null
 *   normalizeUuidReference("bad")  // → null
 */
export function normalizeUuidReference(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const withoutUrn = raw.toLowerCase().startsWith("urn:uuid:")
    ? raw.slice("urn:uuid:".length)
    : raw;

  if (UUID_V4_LIKE_RE.test(withoutUrn)) return withoutUrn;

  // Recover the UUID prefix from UI-local IDs that append a role suffix
  // (e.g. "<uuid>-assistant"). Needed so backend endpoints receive a valid ID.
  const withSuffixMatch = withoutUrn.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-[a-z0-9_-]+$/i,
  );
  return withSuffixMatch ? withSuffixMatch[1] : null;
}
