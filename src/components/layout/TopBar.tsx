"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useAuth } from "@/context/auth-context";
import { sanitizeInlineMarkdown } from "@/lib/security";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TopBarProps {
  chatId?: string;
  title?: string;
  model?: string;
  showCitationsToggle?: boolean;
  citationsOpen?: boolean;
  onTitleChange?: (chatId: string, title: string) => Promise<void>;
  onCitationsToggle?: () => void;
}

// ── Shared menu item style ────────────────────────────────────────────────────

const menuItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "7px 12px",
  borderRadius: "8px",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  fontWeight: "var(--font-weight-medium)",
  fontSize: "var(--font-size-body)",
  lineHeight: "var(--line-height-body)",
  color: "var(--neutral-700)",
  outline: "none",
  userSelect: "none",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function TopBar({
  chatId,
  title = "",
  model,
  showCitationsToggle = false,
  citationsOpen = false,
  onTitleChange,
  onCitationsToggle,
}: TopBarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftTitle(title);
  }, [title]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  const commitTitle = () => {
    const trimmed = sanitizeInlineMarkdown(draftTitle.trim());
    if (trimmed && trimmed !== title && chatId && onTitleChange) {
      void onTitleChange(chatId, trimmed);
    } else {
      setDraftTitle(title);
    }
    setIsEditingTitle(false);
  };

  const cancelTitle = () => {
    setDraftTitle(title);
    setIsEditingTitle(false);
  };

  const displayName = user
    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
      user.name ||
      ""
    : "";

  const initials = displayName
    ? displayName
        .split(" ")
        .slice(0, 2)
        .map((n: string) => n[0]?.toUpperCase() ?? "")
        .join("")
    : "?";

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "56px",
        paddingLeft: "20px",
        paddingRight: "16px",
        backgroundColor: "var(--neutral-white)",
        borderBottom: "1px solid var(--neutral-100)",
        flexShrink: 0,
        gap: "12px",
      }}
    >
      {/* ── Left: Chat title ── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
        }}
      >
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitTitle();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelTitle();
              }
            }}
            style={{
              width: "100%",
              maxWidth: "480px",
              fontFamily: "var(--font-body)",
              fontWeight: "var(--font-weight-semibold)",
              fontSize: "var(--font-size-body)",
              lineHeight: "var(--line-height-body)",
              color: "var(--neutral-800)",
              backgroundColor: "var(--neutral-50)",
              border: "1px solid var(--blue-300)",
              borderRadius: "8px",
              padding: "4px 10px",
              outline: "none",
              boxShadow: "0 0 0 2px var(--blue-100)",
            }}
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => {
              if (chatId && onTitleChange) {
                setDraftTitle(title);
                setIsEditingTitle(true);
              }
            }}
            title={chatId ? "Double-click to rename" : undefined}
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: "var(--font-weight-semibold)",
              fontSize: "var(--font-size-body)",
              lineHeight: "var(--line-height-body)",
              color: title ? "var(--neutral-800)" : "var(--neutral-400)",
              background: "none",
              border: "none",
              padding: "4px 0",
              cursor: chatId ? "text" : "default",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "480px",
            }}
          >
            {title || "New chat"}
          </button>
        )}
      </div>

      {/* ── Right: model chip + citations + user avatar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexShrink: 0,
        }}
      >
        {/* Model chip */}
        {model && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "3px 10px",
              borderRadius: "999px",
              backgroundColor: "var(--blue-50)",
              fontFamily: "var(--font-body)",
              fontWeight: "var(--font-weight-medium)",
              fontSize: "var(--font-size-caption)",
              lineHeight: "var(--line-height-caption)",
              color: "var(--blue-600)",
              whiteSpace: "nowrap",
            }}
          >
            {model}
          </div>
        )}

        {/* Citations toggle */}
        {showCitationsToggle && (
          <button
            type="button"
            onClick={onCitationsToggle}
            title={citationsOpen ? "Hide citations" : "Show citations"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: citationsOpen
                ? "var(--blue-50)"
                : "transparent",
              cursor: "pointer",
              color: citationsOpen ? "var(--blue-600)" : "var(--neutral-500)",
            }}
          >
            {/* Citations icon — simple list SVG */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
            >
              <path
                d="M2 4h12M2 8h8M2 12h10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}

        {/* User avatar → dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                border: "none",
                padding: 0,
                cursor: "pointer",
                overflow: "hidden",
                backgroundColor: "var(--neutral-200)",
                flexShrink: 0,
              }}
              aria-label="User menu"
            >
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: "var(--font-weight-semibold)",
                  fontSize: "var(--font-size-caption)",
                  color: "var(--neutral-700)",
                }}
              >
                {initials}
              </span>
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side="bottom"
              align="end"
              sideOffset={8}
              style={{
                backgroundColor: "var(--neutral-white)",
                borderRadius: "12px",
                padding: "4px",
                boxShadow:
                  "0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
                zIndex: 200,
                minWidth: "200px",
                outline: "none",
              }}
            >
              {/* Account info */}
              <div
                style={{
                  padding: "10px 12px 8px",
                  borderBottom: "1px solid var(--neutral-100)",
                  marginBottom: "4px",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-body)",
                    fontWeight: "var(--font-weight-semibold)",
                    fontSize: "var(--font-size-body)",
                    color: "var(--neutral-800)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {displayName || "Account"}
                </p>
                {user?.email && (
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--font-size-caption)",
                      color: "var(--neutral-500)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {user.email}
                  </p>
                )}
              </div>

              <DropdownMenu.Item
                style={menuItemStyle}
                onSelect={() => router.push("/settings")}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.backgroundColor =
                    "var(--neutral-50)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.backgroundColor =
                    "transparent")
                }
              >
                Settings
              </DropdownMenu.Item>

              <DropdownMenu.Separator
                style={{
                  height: "1px",
                  backgroundColor: "var(--neutral-100)",
                  margin: "4px 0",
                }}
              />

              <DropdownMenu.Item
                style={menuItemStyle}
                onSelect={() => logout()}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.backgroundColor =
                    "var(--neutral-50)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.backgroundColor =
                    "transparent")
                }
              >
                Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
