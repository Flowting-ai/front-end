/**
 * Replace the origin of a backend-generated share URL with the app's own
 * base URL from the environment, so super-links always point to the correct
 * deployment regardless of what the backend stored.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_APP_BASE_URL  (set in .env / deployment env vars)
 *   2. window.location.origin    (client-side fallback)
 *   3. rawUrl unchanged          (SSR with no env var — safe no-op)
 */
export function canonicalShareUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl

  const configured = process.env.NEXT_PUBLIC_APP_BASE_URL
  const base =
    configured
      ? configured.replace(/\/+$/, '')
      : typeof window !== 'undefined'
        ? window.location.origin
        : ''

  if (!base) return rawUrl

  try {
    const { pathname, search, hash } = new URL(rawUrl)
    return `${base}${pathname}${search}${hash}`
  } catch {
    return rawUrl
  }
}
