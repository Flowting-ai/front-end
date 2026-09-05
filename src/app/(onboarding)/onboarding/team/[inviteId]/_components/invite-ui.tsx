"use client";

import React from "react";
import { Button } from "@/components/Button";
import type { InviteLoadStatus } from "@/context/team-invite-onboarding-context";
import { ROOT_ROUTE } from "@/lib/routes";

// ── Shared building blocks for the team-invite onboarding flow ──────────────
// The 2 real screens ("Join a workspace" / "Create your profile") use the
// StepCanvas/StepHeader/StepFooter system from ../../_components/step-shell
// instead — these primitives now back only the non-"ready" load states
// (loading/expired/not_found/error), which have no Figma frame of their own
// and deliberately keep this flow's original gradient-card look rather than
// inventing an unspecified design.

// Matches the onboarding shell gradient (Figma 5795:41421).
const CANVAS_GRADIENT =
  "linear-gradient(180deg, var(--neutral-50,#f7f2ed) 3.76%, var(--neutral-100,#ede1d7) 75%, var(--neutral-200,#d1c6bd) 116.79%)";

/** Full-screen gradient canvas that centres a single card. */
export function InviteCanvas({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: CANVAS_GRADIENT,
        padding: "40px 16px",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}

/** White rounded card. `width` controls the max content width. */
export function InviteCard({
  children,
  width = 620,
}: {
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 28,
        backgroundColor: "var(--neutral-white,#fff)",
        borderRadius: 20,
        padding: "32px 36px",
        width: "100%",
        maxWidth: width,
        boxShadow:
          "0px 12px 16px -4px rgba(130,122,116,0.12), 0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100,#ede1d7)",
      }}
    >
      {children}
    </div>
  );
}

/** Card title in the serif display face. */
export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1
      style={{
        fontFamily: "var(--font-title)",
        fontWeight: 400,
        fontSize: 40,
        lineHeight: "48px",
        color: "#1a1916",
        margin: 0,
        letterSpacing: "-0.01em",
      }}
    >
      {children}
    </h1>
  );
}

/** Muted card subtitle. */
export function CardSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "var(--font-body)",
        fontWeight: 400,
        fontSize: 16,
        lineHeight: "24px",
        color: "var(--neutral-500,#827a74)",
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

/**
 * Renders the non-ready load states (loading / expired / not_found / error) as a
 * centred card, so every screen in the flow degrades identically on hard refresh.
 */
export function InviteStateScreen({
  status,
  errorMsg,
  onRetry,
  onHome,
}: {
  status: Exclude<InviteLoadStatus, "ready">;
  errorMsg?: string;
  onRetry?: () => void;
  onHome?: () => void;
}) {
  if (status === "loading") {
    return (
      <InviteCanvas>
        <InviteCard width={620}>
          <CardSubtitle>Loading your invite…</CardSubtitle>
        </InviteCard>
      </InviteCanvas>
    );
  }

  const expired = status === "expired";
  const notFound = status === "not_found";
  const title = expired ? "This invite has expired" : notFound ? "Invite not found" : "Something went wrong";
  const body = expired
    ? "This invite link has expired or been revoked. Ask your admin to send a new one."
    : notFound
      ? "This invite link doesn't exist or has already been used."
      : errorMsg || "Please try again.";

  // Close the tab. Browsers only honour window.close() for script-opened
  // windows, so fall back to leaving the flow (onHome) when it's blocked — the
  // setTimeout never fires if the window actually closed (the page unloads).
  const handleClose = () => {
    window.close();
    setTimeout(() => {
      if (onHome) onHome();
      else window.location.href = ROOT_ROUTE;
    }, 150);
  };

  return (
    <InviteCanvas>
      <InviteCard width={620}>
        <CardTitle>{title}</CardTitle>
        <CardSubtitle>{body}</CardSubtitle>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          {status === "error" && onRetry && (
            <Button variant="outline" size="md" onClick={onRetry}>Try again</Button>
          )}
          <Button variant="default" size="md" onClick={handleClose}>Close</Button>
        </div>
      </InviteCard>
    </InviteCanvas>
  );
}
