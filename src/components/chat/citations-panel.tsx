"use client";

import { cn } from "@/lib/utils";
import type { MessageSource } from "./chat-message";
import { BookOpen, ExternalLink } from "lucide-react";
import chatStyles from "./chat-interface.module.css";
import { useEffect, useState } from "react";

function getUrlHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

const FAVICON_BASE = "https://www.google.com/s2/favicons?sz=32&domain=";

function SourceFavicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const hostname = getUrlHostname(url);
  const faviconUrl = hostname
    ? `${FAVICON_BASE}${encodeURIComponent(hostname)}`
    : "";

  if (!hostname) {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#E4E4E7] text-[10px] font-semibold text-[#525252]">
        ?
      </span>
    );
  }

  if (failed || !faviconUrl) {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#E4E4E7] text-[10px] font-semibold text-[#525252]">
        {hostname.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <span className="relative inline-flex h-5 w-5 shrink-0 overflow-hidden rounded-md bg-[#E4E4E7] border border-[#e5e5e5]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={faviconUrl}
        alt=""
        className="h-full w-full object-cover rounded-md"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

export interface LinkMetadata {
  title?: string;
  description?: string;
  imageUrl?: string;
}

function useLinkMetadata(url: string | null): LinkMetadata | null {
  const [meta, setMeta] = useState<LinkMetadata | null>(null);
  useEffect(() => {
    if (!url || !url.startsWith("http")) {
      setMeta(null);
      return;
    }
    let cancelled = false;
    setMeta(null);
    const encoded = encodeURIComponent(url);
    fetch(`/api/link-metadata?url=${encoded}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data === "object") {
          setMeta({
            title: typeof data.title === "string" ? data.title : undefined,
            description:
              typeof data.description === "string"
                ? data.description
                : undefined,
            imageUrl:
              typeof data.imageUrl === "string" ? data.imageUrl : undefined,
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url]);
  return meta;
}

/** Prefer title from chat (source.title), then fetched metadata, then hostname. */
function getSourceTitle(source: MessageSource, fetchedTitle?: string): string {
  if (source.title && source.title.trim()) return source.title.trim();
  if (fetchedTitle && fetchedTitle.trim()) return fetchedTitle.trim();
  return getUrlHostname(source.url);
}

const MAX_DESCRIPTION_LENGTH = 160;

function formatDescription(text: string): string {
  const s = text.trim();
  if (s.length <= MAX_DESCRIPTION_LENGTH) return s;
  return `${s.slice(0, MAX_DESCRIPTION_LENGTH - 1).trim()}…`;
}

export interface CitationsPanelProps {
  sources: MessageSource[];
  /** When true, only render the list (header is provided by parent, e.g. right sidebar). */
  hideHeader?: boolean;
  className?: string;
}

/**
 * Sources panel: same width/height as right sidebar (278px, full height).
 * Card layout: image + link first, then source title (no numbers), then source description.
 */
export function CitationsPanel({
  sources,
  hideHeader,
  className,
}: CitationsPanelProps) {
  return (
    <div
      className={cn(
        "flex h-full shrink-0 flex-col min-h-0",
        !hideHeader && "w-[278px] border-l border-[#d9d9d9] bg-white shadow-sm",
        className,
      )}
    >
      <div className="flex flex-1 flex-col min-h-0">
        {!hideHeader && (
          <div className="flex items-center justify-between border-b border-[#d9d9d9] px-4 py-3.5 shrink-0">
            <p className="text-base font-semibold text-[#1e1e1e]">Citations</p>
          </div>
        )}
        <div
          className={`flex-1 overflow-y-auto min-h-0 sources-panel-scroll ${chatStyles.customScrollbar}`}
        >
          {sources.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-5 py-14 text-center">
              <div className="rounded-full bg-[#f5f5f5] p-4">
                <BookOpen />
              </div>
              <p className="text-sm font-semibold text-[#1e1e1e]">
                No sources yet
              </p>
              <p className="text-xs text-[#737373] leading-snug max-w-[200px]">
                Sources from the latest response will appear here.
              </p>
            </div>
          ) : (
            <>
              <p className="px-3 pt-3 pb-1 text-sm font-medium text-[#303030] tabular-nums">
                Sources -{" "}
                <span className="text-[#5A5A5A]">{sources.length}</span>
              </p>
              <ol className="list-none space-y-3 px-3 py-2 pb-20">
                {sources.map((source, index) => (
                  <SourceCard key={`${source.url}-${index}`} source={source} />
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceCard({ source }: { source: MessageSource }) {
  const fetched = useLinkMetadata(source.url);
  const title = getSourceTitle(source, fetched?.title);
  const description =
    source.description ?? fetched?.description ?? source.snippet ?? "";

  return (
    <li>
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        title={source.url}
        className={cn(
          "group/card flex flex-col gap-2 rounded-[10px] border border-[#e5e5e5] bg-white overflow-hidden",
          "hover:border-[#d4d4d4] hover:bg-[#fafafa] hover:shadow-sm transition-all duration-150",
          "text-left no-underline outline-none focus-visible:ring-2 focus-visible:ring-[#1e1e1e]/20 focus-visible:ring-offset-1",
        )}
      >
        <div className="flex flex-col gap-1.5 px-3 pb-2.5 pt-2 min-w-0">
          {/* 1. Image + link first */}
          <div className="flex items-center gap-1.5 text-[11px] text-[#a3a3a3] group-hover/card:text-[#525252]">
            <SourceFavicon url={source.url} />
            <ExternalLink className="h-3 w-3 shrink-0" strokeWidth={2} />
            <span className="truncate" title={source.url}>
              {getUrlHostname(source.url)}
            </span>
          </div>
          {/* 2. Source title (no numbers) */}
          <h3 className="text-[15px] font-bold leading-snug text-[#171717] line-clamp-2 min-w-0">
            {title}
          </h3>
          {/* 3. Source description */}
          {description.trim() && (
            <p className="text-[11px] text-[#525252] leading-snug line-clamp-3">
              {formatDescription(description)}
            </p>
          )}
        </div>
      </a>
    </li>
  );
}
