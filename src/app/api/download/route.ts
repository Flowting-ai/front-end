import { type NextRequest } from "next/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/download?url=<encoded>&filename=<encoded>
 *
 * Proxies a generated file from the backend storage (S3) back to the browser
 * with a Content-Disposition: attachment header so the browser always saves
 * the file rather than displaying it inline.
 *
 * SSRF protection: only our own buckets, and no redirects (an S3 website
 * bucket can redirect anywhere, which would defeat the allowlist). The
 * session check lives in proxy.ts, like every /api route.
 */

// Exact hostnames from DOWNLOAD_ALLOWED_HOSTS (comma separated) when set;
// otherwise any Souvenir bucket (souvenir*), virtual-hosted, with or without region.
const ALLOWED_HOSTS = (process.env.DOWNLOAD_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean)
const MAX_DOWNLOAD_BYTES = 200 * 1024 * 1024
const SOUVENIR_BUCKET = /^souvenir[a-z0-9-]*\.s3(\.[a-z0-9-]+)?\.amazonaws\.com$/

function isAllowedUrl(raw: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return false
  }
  if (parsed.protocol !== "https:") return false
  const host = parsed.hostname.toLowerCase()
  return ALLOWED_HOSTS.length ? ALLOWED_HOSTS.includes(host) : SOUVENIR_BUCKET.test(host)
}

/** Strip characters that are unsafe in a Content-Disposition filename. */
function safeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "_").trim() || "download"
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const fileUrl = searchParams.get("url") ?? ""
  const filename = safeFilename(searchParams.get("filename") ?? "download")

  if (!fileUrl) {
    return new Response("Missing url parameter", { status: 400 })
  }

  if (!isAllowedUrl(fileUrl)) {
    return new Response("URL domain not permitted", { status: 403 })
  }

  // Bounds the wait for headers only; a large file may take longer to stream.
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), 30_000)
  let upstream: Response
  try {
    upstream = await fetch(fileUrl, {
      redirect: "manual",
      signal: abort.signal,
      headers: { "User-Agent": "Souvenir/1.0" },
    })
  } catch {
    return new Response("Failed to fetch file", { status: 502 })
  } finally {
    clearTimeout(timer)
  }

  if (!upstream.ok || !upstream.body) {
    // A redirect is not followed, so it surfaces as a failure, not a 3xx without a Location.
    return new Response("Upstream error", { status: upstream.status >= 400 ? upstream.status : 502 })
  }

  // Files we generate are well under this; anything bigger is not ours to relay.
  const size = Number(upstream.headers.get("content-length") ?? 0)
  if (size > MAX_DOWNLOAD_BYTES) {
    await upstream.body.cancel()
    return new Response("File too large", { status: 413 })
  }

  const contentType =
    upstream.headers.get("content-type") ?? "application/octet-stream"

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      // Prevent the browser from sniffing a different MIME type
      "X-Content-Type-Options": "nosniff",
    },
  })
}
