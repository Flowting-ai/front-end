"use client";

import { useState, useEffect } from "react";
import { ExternalLink, Mail } from "lucide-react";
import { sanitizeURL } from "@/lib/security";

export const FAVICON_BASE = "https://www.google.com/s2/favicons?sz=32&domain=";

export function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Module-level cache so preview data survives re-renders without refetching.
// ---------------------------------------------------------------------------
const linkPreviewCache = new Map<
  string,
  { siteName: string; faviconUrl: string; title?: string; description?: string }
>();

interface LinkPreviewCardProps {
  url: string;
  label?: string;
}

/**
 * Renders a URL as a pill-shaped anchor with a site favicon and an optional
 * hover card showing the page title and description.
 *
 * Lazily fetches OG metadata via `/api/link-metadata` and caches results in
 * the module-level `linkPreviewCache` to avoid duplicate network requests
 * across message re-renders.
 */
export const LinkPreviewCard = ({ url, label }: LinkPreviewCardProps) => {
  const normalizedUrl = sanitizeURL(url.trim());
  const hostname = getHostname(normalizedUrl) || normalizedUrl;
  const [showCard, setShowCard] = useState(false);
  const [preview, setPreview] = useState<{
    siteName: string;
    faviconUrl: string;
    title?: string;
    description?: string;
  } | null>(linkPreviewCache.get(normalizedUrl) ?? null);

  const displayLabel = (
    label ||
    preview?.title ||
    hostname ||
    normalizedUrl
  ).trim();

  const fetchPreview = async () => {
    if (linkPreviewCache.has(normalizedUrl)) {
      const cached = linkPreviewCache.get(normalizedUrl)!;
      if (!preview || preview.title !== cached.title) setPreview(cached);
      return;
    }
    const faviconUrl = hostname
      ? `${FAVICON_BASE}${encodeURIComponent(hostname)}`
      : "";
    // Set basic preview immediately, then enrich with metadata
    const basic = { siteName: hostname, faviconUrl };
    linkPreviewCache.set(normalizedUrl, basic);
    setPreview(basic);

    try {
      const fullUrl = normalizedUrl.startsWith("http")
        ? normalizedUrl
        : `https://${normalizedUrl}`;
      const encoded = encodeURIComponent(fullUrl);
      const res = await fetch(`/api/link-metadata?url=${encoded}`);
      if (res.ok) {
        const data = await res.json();
        const enriched = {
          siteName: hostname,
          faviconUrl,
          title: typeof data.title === "string" ? data.title : undefined,
          description:
            typeof data.description === "string" ? data.description : undefined,
        };
        linkPreviewCache.set(normalizedUrl, enriched);
        setPreview(enriched);
      }
    } catch {
      // Keep basic preview on error
    }
  };

  // Eagerly fetch metadata on mount so the title is available for display
  useEffect(() => {
    void fetchPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedUrl]);

  const faviconSrc =
    preview?.faviconUrl ||
    (hostname ? `${FAVICON_BASE}${encodeURIComponent(hostname)}` : "");

  return (
    <span
      className="relative inline-flex max-w-full"
      onMouseEnter={() => {
        setShowCard(true);
      }}
      onMouseLeave={() => {
        setShowCard(false);
      }}
    >
      <a
        href={
          normalizedUrl.startsWith("http")
            ? normalizedUrl
            : `https://${normalizedUrl}`
        }
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-main-border bg-[#F4F4F5] px-2 py-0.5 text-xs font-medium text-[#0A0A0A] hover:bg-[#E4E4E7] hover:text-[#111827] transition-all duration-200 align-middle"
      >
        {faviconSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={faviconSrc}
            alt=""
            className="h-3.5 w-3.5 shrink-0 rounded-sm"
          />
        )}
        <span className="min-w-0 truncate max-w-[min(200px,100%)]">{displayLabel}</span>
        <ExternalLink
          className="ml-0.5 h-3 w-3 shrink-0 text-zinc-400 transition-all duration-150 group-hover:text-zinc-600"
          aria-hidden="true"
        />
      </a>
      {showCard && (
        <span
          className="absolute left-0 bottom-full mb-2 w-72 rounded-[12px] border border-zinc-200 bg-white shadow-xl z-50 overflow-hidden"
          style={{ pointerEvents: "none", display: "block" }}
        >
          <span className="flex items-start gap-3 p-3" style={{ display: "flex" }}>
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[#F4F4F5] border border-zinc-200 overflow-hidden mt-0.5">
              {faviconSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={faviconSrc}
                  alt=""
                  className="h-6 w-6 object-contain"
                />
              ) : (
                <span className="text-sm font-semibold text-zinc-500">
                  {(hostname || "?").charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <span className="flex flex-col min-w-0 gap-0.5" style={{ display: "flex" }}>
              <span className="text-[13px] font-semibold text-[#111827] line-clamp-2">
                {preview?.title || label || hostname}
              </span>
              {preview?.description && (
                <span className="text-[11px] text-[#6B7280] line-clamp-2 leading-snug">
                  {preview.description}
                </span>
              )}
              <span className="text-[11px] text-[#9CA3AF] flex items-center gap-1 mt-0.5">
                <ExternalLink className="h-3 w-3 shrink-0" />
                {hostname}
              </span>
            </span>
          </span>
        </span>
      )}
    </span>
  );
};

/**
 * Renders an email address as a `mailto:` anchor styled consistently with
 * `LinkPreviewCard`.
 */
export const MailtoLink = ({ email }: { email: string }) => (
  <a
    href={`mailto:${email}`}
    className="group inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-main-border bg-[#F4F4F5] px-2 py-0.5 text-xs font-medium text-[#0A0A0A] hover:bg-[#E4E4E7] hover:text-[#111827] transition-all duration-200 align-middle"
  >
    <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-400 group-hover:text-zinc-600 transition-colors" aria-hidden="true" />
    <span className="min-w-0 truncate max-w-[min(200px,100%)]">{email}</span>
  </a>
);

/**
 * Renders a compact row of site favicons (up to 4) stacked with negative margin,
 * used on the AI message "Sources" action button.
 */
export function SourceFaviconStack({ urls }: { urls: string[] }) {
  const [failed, setFailed] = useState<Set<number>>(() => new Set());
  const list = urls.slice(0, 4).filter(Boolean);
  const markFailed = (i: number) => {
    setFailed((prev) => new Set(prev).add(i));
  };
  if (list.length === 0) {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#E4E4E7] border border-main-border text-[10px] font-semibold text-[#525252]">
        ?
      </span>
    );
  }
  return (
    <span className="flex items-center -space-x-1">
      {list.map((url, i) => {
        const host = getHostname(url);
        const faviconUrl = host
          ? `${FAVICON_BASE}${encodeURIComponent(host)}`
          : "";
        const showFallback = !faviconUrl || failed.has(i);
        return (
          <span
            key={`${url}-${i}`}
            className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden bg-[#E4E4E7] border border-main-border rounded-md text-[10px] font-semibold text-[#525252]"
            style={{ zIndex: i + 1 }}
          >
            {showFallback ? (
              <span aria-hidden>
                {host ? host.charAt(0).toUpperCase() : "?"}
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={faviconUrl}
                alt=""
                className="w-5 h-5 object-contain"
                onError={() => markFailed(i)}
              />
            )}
          </span>
        );
      })}
    </span>
  );
}
