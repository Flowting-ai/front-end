"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ExternalLink } from "lucide-react";
import type { Source } from "@/types/chat";
import { sanitizeURL } from "@/lib/security";

const FAVICON_BASE = "https://www.google.com/s2/favicons?domain=";

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

interface CitationsPanelProps {
  sources: Source[];
  isOpen: boolean;
  onClose: () => void;
  highlightedIndex?: number | null;
}

export function CitationsPanel({
  sources,
  isOpen,
  onClose,
  highlightedIndex,
}: CitationsPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightedIndex != null && listRef.current) {
      const el = listRef.current.querySelector(
        `[data-citation-index="${highlightedIndex}"]`,
      );
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "360px",
            maxWidth: "100vw",
            backgroundColor: "var(--neutral-white)",
            borderLeft: "1px solid var(--neutral-200)",
            zIndex: 50,
            display: "flex",
            flexDirection: "column",
            boxShadow: "var(--shadow-lg)",
          }}
          role="complementary"
          aria-label="Citations panel"
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderBottom: "1px solid var(--neutral-200)",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--font-size-body-md)",
                fontWeight: "var(--font-weight-semibold)",
                color: "var(--neutral-900)",
                margin: 0,
              }}
            >
              Sources ({sources.length})
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close citations panel"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "transparent",
                color: "var(--neutral-600)",
                cursor: "pointer",
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Sources list */}
          <div
            ref={listRef}
            className="kaya-scrollbar"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 16px",
            }}
          >
            {sources.length === 0 && (
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--font-size-body-sm)",
                  color: "var(--neutral-500)",
                  textAlign: "center",
                  padding: "24px 0",
                }}
              >
                No sources available
              </p>
            )}
            {sources.map((source, idx) => {
              const safeUrl = sanitizeURL(source.url);
              const isHighlighted = highlightedIndex === idx + 1;

              return (
                <a
                  key={source.id}
                  data-citation-index={idx + 1}
                  href={safeUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "12px",
                    marginBottom: "8px",
                    borderRadius: "10px",
                    textDecoration: "none",
                    backgroundColor: isHighlighted
                      ? "var(--blue-50)"
                      : "var(--neutral-50)",
                    border: isHighlighted
                      ? "1px solid var(--blue-200)"
                      : "1px solid transparent",
                    transition: "all 150ms",
                    cursor: safeUrl ? "pointer" : "default",
                  }}
                >
                  {/* Index badge */}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "22px",
                      height: "22px",
                      borderRadius: "6px",
                      backgroundColor: "var(--blue-100)",
                      color: "var(--blue-700)",
                      fontFamily: "var(--font-body)",
                      fontSize: "11px",
                      fontWeight: "var(--font-weight-semibold)",
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title */}
                    <div
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "13px",
                        fontWeight: "var(--font-weight-medium)",
                        color: "var(--neutral-900)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {source.title || getHostname(source.url)}
                    </div>

                    {/* Domain with favicon */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        marginTop: "4px",
                      }}
                    >
                      {source.favicon ? (
                        <img
                          src={source.favicon}
                          alt=""
                          width={12}
                          height={12}
                          style={{ borderRadius: "2px" }}
                        />
                      ) : (
                        <img
                          src={`${FAVICON_BASE}${getHostname(source.url)}`}
                          alt=""
                          width={12}
                          height={12}
                          style={{ borderRadius: "2px" }}
                        />
                      )}
                      <span
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "11px",
                          color: "var(--neutral-500)",
                        }}
                      >
                        {getHostname(source.url)}
                      </span>
                      <ExternalLink
                        size={10}
                        style={{ color: "var(--neutral-400)" }}
                      />
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
