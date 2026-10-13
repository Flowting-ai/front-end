// Storage URLs come from the API and end up in an <img> or <audio> src. Only schemes that cannot run
// code are allowed there: https storage, same-origin paths, blob: (local playback), and data: for
// images only (the sample art and tiny inline previews). Everything else renders as "unavailable".

export type AssetKind = "image" | "audio";

export function safeAssetUrl(url: string | undefined | null, kind: AssetKind): string | null {
  if (!url) return null;
  if (/^https:\/\//i.test(url) || (url.startsWith("/") && !url.startsWith("//"))) return url;
  if (url.startsWith("blob:")) return url;
  if (kind === "image" && /^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml)[;,]/i.test(url)) return url;
  return null;
}
