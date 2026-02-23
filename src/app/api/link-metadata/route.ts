import { NextResponse } from "next/server";

const ALLOWED_PROTOCOLS = ["https:", "http:"];

function extractMeta(html: string): { title?: string; description?: string; imageUrl?: string } {
  const result: { title?: string; description?: string; imageUrl?: string } = {};
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if (ogTitle?.[1]) result.title = ogTitle[1].trim();

  const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
  if (ogDesc?.[1]) result.description = ogDesc[1].trim();

  const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (ogImage?.[1]) result.imageUrl = ogImage[1].trim();

  if (!result.title) {
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleTag?.[1]) result.title = titleTag[1].trim();
  }
  return result;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get("url");
  if (!rawUrl || typeof rawUrl !== "string") {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return NextResponse.json({ error: "Protocol not allowed" }, { status: 400 });
  }
  try {
    const res = await fetch(parsed.toString(), {
      headers: { "User-Agent": "FlowtingAI-LinkMetadata/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Fetch failed: ${res.status}` },
        { status: 502 }
      );
    }
    const html = await res.text();
    const meta = extractMeta(html);
    return NextResponse.json(meta);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch URL";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
