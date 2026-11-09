"use client";

/**
 * Pill breadcrumb for the chat name in the TopBar.
 *
 * Shape: shadcnspace "Breadcrumb 01 — Pill Breadcrumb" — crumbs on one pill with
 * chevrons between them — kept in this app's original top-bar styling: a single
 * square-rounded (8px) pill, one hairline (the inset ring), no nested/raised
 * pills and no second border. The actions menu sits OUTSIDE the pill, as its own
 * icon button to the right of it.
 *
 * The menu itself is the sidebar chat row's menu: this renders the same
 * `Dropdown.Float` → `Dropdown` → `Dropdown.Section` stack
 * (src/components/layout/sidebar/FlatChatHistoryItem.tsx) and lets the host fill
 * it with the same `Dropdown.Item` rows, rather than a second, hand-styled menu
 * that only looks similar.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontalIcon } from "@strange-huge/icons";
import { Dropdown } from "@/components/Dropdown";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BreadcrumbCrumb {
  label: string;
  /** Omit for a plain (non-navigable) parent crumb. */
  href?: string;
}

/** What the host's menu rows need from the breadcrumb. */
export interface ChatBreadcrumbMenuContext {
  /** Close the menu — every row does this first, as the sidebar's rows do. */
  close: () => void;
  /** Put the name into inline edit (what the menu's "Rename" row calls). */
  startRename: () => void;
}

interface ChatBreadcrumbProps {
  /** Parent crumbs, left to right (e.g. the project). */
  crumbs?: BreadcrumbCrumb[];
  /** The current page — the last crumb. */
  current: string;
  /** Enables inline rename (double-click the name, or the menu's Rename row). */
  onRename?: (title: string) => void;
  /**
   * The menu's contents — a `<Dropdown>` of `Dropdown.Item` rows. Omit for no
   * menu (and no button).
   */
  renderMenu?: (ctx: ChatBreadcrumbMenuContext) => React.ReactNode;
}

// ── Bits ──────────────────────────────────────────────────────────────────────

const TEXT: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--font-size-body)",
  lineHeight: "var(--line-height-body)",
};

function ChevronSeparator() {
  return (
    <svg
      aria-hidden
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--neutral-400)"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

const parentCrumbStyle: React.CSSProperties = {
  ...TEXT,
  fontWeight: "var(--font-weight-semibold)",
  color: "var(--neutral-900)",
  whiteSpace: "nowrap",
  flexShrink: 0,
  textDecoration: "none",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatBreadcrumb({ crumbs = [], current, onRename, renderMenu }: ChatBreadcrumbProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the draft in step with a title that changed elsewhere (the backend's
  // async auto-title, a rename from the sidebar) — adjusted during render, not
  // in an effect, so there is no cascading re-render.
  const [lastCurrent, setLastCurrent] = useState(current);
  if (current !== lastCurrent) {
    setLastCurrent(current);
    if (!editing) setDraft(current);
  }

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== current) onRename?.(trimmed);
    setEditing(false);
  };

  const startRename = () => {
    if (!onRename) return;
    setDraft(current);
    setEditing(true);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, maxWidth: "100%" }}>
      {/* The pill — one border (the inset ring), square-rounded, as the bar had before. */}
      <nav
        aria-label="Breadcrumb"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          minWidth: 0,
          maxWidth: "100%",
          padding: "5px 8px",
          borderRadius: "8px",
          backgroundColor: "var(--card-bg)",
          boxShadow: "inset 0 0 0 1px var(--button-outline-border)",
          overflow: "hidden",
        }}
      >
        {crumbs.map((crumb) => (
          <span
            key={`${crumb.label}-${crumb.href ?? ""}`}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", minWidth: 0 }}
          >
            {crumb.href ? (
              <Link
                href={crumb.href}
                style={parentCrumbStyle}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                {crumb.label}
              </Link>
            ) : (
              <span style={parentCrumbStyle}>{crumb.label}</span>
            )}
            <ChevronSeparator />
          </span>
        ))}

        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setDraft(current); setEditing(false); }
            }}
            aria-label="Chat name"
            style={{
              ...TEXT,
              width: `${Math.max(8, Math.min(draft.length + 1, 36))}ch`,
              padding: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              fontWeight: "var(--font-weight-medium)",
              color: "var(--button-outline-text)",
            }}
          />
        ) : (
          <span
            aria-current="page"
            onDoubleClick={startRename}
            title={current}
            style={{
              ...TEXT,
              fontWeight: "var(--font-weight-medium)",
              color: "var(--button-outline-text)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              flexShrink: 1,
              minWidth: 0,
              cursor: onRename ? "text" : "default",
            }}
          >
            {current}
          </span>
        )}
      </nav>

      {/* Actions — outside the pill, to its right. Same menu as the sidebar's chat row. */}
      {renderMenu && (
        <Dropdown.Float
          open={menuOpen}
          onOpenChange={setMenuOpen}
          placement="bottom-start"
          // The bar sits at the top of the card, so this normally drops down —
          // flipping only if the window is short enough for it not to fit.
          autoFlipVertical
          trigger={
            <button
              type="button"
              aria-label="Chat options"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                padding: 0,
                border: "none",
                borderRadius: "8px",
                background: menuOpen ? "var(--neutral-50)" : "transparent",
                color: "var(--neutral-500)",
                cursor: "pointer",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--neutral-50)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = menuOpen ? "var(--neutral-50)" : "transparent")}
            >
              <MoreHorizontalIcon size={16} color="currentColor" />
            </button>
          }
        >
          {renderMenu({ close: () => setMenuOpen(false), startRename })}
        </Dropdown.Float>
      )}
    </div>
  );
}
