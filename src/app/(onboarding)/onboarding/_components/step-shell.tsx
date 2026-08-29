"use client";

import React from "react";
import { Button } from "@/components/Button";

// ── Shared shell for the v1.5 workspace-onboarding steps ─────────────────────
// Figma: Onboarding v1, nodes 27:1196 / 55:2726 ("Setup your workspace"),
// 11:459 / 55:2680 ("Create your profile"), 27:1353 ("Invite your team
// members"). These three steps share the same dot-progress + title header and
// Back/Next footer; screen 1 (the Slack/Souvenir choice, onboarding/setup) and
// the post-onboarding "into the app" modal are NOT part of this step count —
// the dots only track the 3 real form steps.
//
// Deliberately separate from the older `onboarding-shell.tsx` (OnboardingScreen/
// OnboardingFooter) — that shell's gradient canvas + big logo header belongs to
// the previous team-onboarding flow. This design is flat-background, no logo,
// with a dot-slider instead.

const BG = "var(--neutral-50,#f7f2ed)";

// ── Dot / pill progress indicator ────────────────────────────────────────────
// Figma: active segment is a 12x4 rounded pill (#6a625d); inactive segments are
// 4x4 circles (#dcd1c8); 4px gap between all segments.

export function StepDots({ total, activeIndex }: { total: number; activeIndex: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }} role="presentation" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            height: 4,
            width: i === activeIndex ? 12 : 4,
            borderRadius: 8,
            backgroundColor: i === activeIndex ? "var(--neutral-600,#6a625d)" : "var(--neutral-200,#dcd1c8)",
            transition: "width 200ms ease, background-color 200ms ease",
          }}
        />
      ))}
    </div>
  );
}

// ── Step header: dots + serif title ──────────────────────────────────────────

export function StepHeader({
  total,
  activeIndex,
  title,
}: {
  total: number;
  activeIndex: number;
  title: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <StepDots total={total} activeIndex={activeIndex} />
      <h1
        style={{
          fontFamily: "var(--font-title)",
          fontWeight: 400,
          fontSize: 24,
          lineHeight: "32px",
          color: "var(--neutral-800,#3b3632)",
          margin: 0,
        }}
      >
        {title}
      </h1>
    </div>
  );
}

// ── Field label + inline error ───────────────────────────────────────────────
// Figma: label turns red (#c62b29) and a "This field can not be empty" message
// appears below the field when invalid (node 55:2726 is the same screen's error state).

export function FieldLabel({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return (
    <p
      style={{
        fontFamily: "var(--font-body)",
        fontWeight: 400,
        fontSize: 14,
        lineHeight: "16px",
        color: error ? "var(--red-600,#c62b29)" : "var(--neutral-700,#524b47)",
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

export function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "var(--font-body)",
        fontWeight: 400,
        fontSize: 14,
        lineHeight: "16px",
        color: "var(--red-600,#c62b29)",
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3.5 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Footer: Back (ghost) + Next/primary action ───────────────────────────────
// Figma shows Back as plain text with no visible border/background — variant
// "ghost", not "outline" (screenshot confirms no border chrome around it).

export function StepFooter({
  onBack,
  backLabel = "Back",
  onSkip,
  skipLabel = "Skip for now",
  skipDisabled = false,
  onNext,
  nextLabel = "Next",
  nextDisabled = false,
  nextLoading = false,
}: {
  /** Omit to hide the Back control entirely — confirm per-screen whether it's present before wiring. */
  onBack?: () => void;
  backLabel?: string;
  /** Omit to hide the secondary "Skip for now" action — only node 27:1353 (invite) has this third button. */
  onSkip?: () => void;
  skipLabel?: string;
  skipDisabled?: boolean;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      {onBack ? (
        <Button variant="ghost" size="sm" onClick={onBack} leftIcon={<ChevronLeft />}>
          {backLabel}
        </Button>
      ) : (
        <span />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {onSkip && (
          <Button variant="ghost" size="sm" onClick={onSkip} disabled={skipDisabled}>
            {skipLabel}
          </Button>
        )}
        <Button size="sm" onClick={onNext} disabled={nextDisabled} loading={nextLoading} rightIcon={<ArrowRight />}>
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}

// ── Page canvas ───────────────────────────────────────────────────────────────

export function StepCanvas({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: BG,
        padding: "40px 16px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%", maxWidth: 403 }}>{children}</div>
    </div>
  );
}

// ── Popover card wrapper (the rounded white/beige card holding the form) ────

export function StepCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%", borderRadius: 18 }}>{children}</div>
  );
}
