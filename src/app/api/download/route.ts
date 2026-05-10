import { type NextRequest } from "next/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/download?url=<encoded>&filename=<encoded>
 *
 * Proxies a generated file from the backend storage (S3) back to the browser
 * with a Content-Disposition: attachment header so the browser always saves
 * the file rather than displaying it inline.
 *
 * SSRF protection: only requests to trusted domains are forwarded.
 */

// Allowlist of hostname suffixes that are allowed as download sources.
// Tighten to the exact S3 bucket hostname if you know it upfront.
const ALLOWED_HOSTNAME_SUFFIXES = [".amazonaws.com"]

function isAllowedUrl(raw: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return false
  }
  if (parsed.protocol !== "https:") return false
  return ALLOWED_HOSTNAME_SUFFIXES.some((suffix) =>
    parsed.hostname.endsWith(suffix),
  )
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

  let upstream: Response
  try {
    upstream = await fetch(fileUrl, {
      redirect: "follow",
      headers: { "User-Agent": "Souvenir/1.0" },
    })
  } catch {
    return new Response("Failed to fetch file", { status: 502 })
  }

  if (!upstream.ok || !upstream.body) {
    return new Response("Upstream error", { status: upstream.status })
  }

  const contentType =
    upstream.headers.get("content-type") ?? "application/octet-stream"

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
      // Prevent the browser from sniffing a different MIME type
      "X-Content-Type-Options": "nosniff",
    },
  })
}
