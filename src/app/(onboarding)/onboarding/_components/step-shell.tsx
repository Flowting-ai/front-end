"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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

// ── Shared text field (used by both the A1 and A2 profile steps) ────────────

export function TextField({
  label,
  required,
  placeholder,
  value,
  onChange,
  onBlur,
  error,
}: {
  label: string;
  required?: boolean;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
      <FieldLabel error={error}>
        {label}
        {required ? "*" : ""}
      </FieldLabel>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          padding: "7px 10px",
          borderRadius: 10,
          backgroundColor: "var(--neutral-white,#fff)",
          boxSizing: "border-box",
          boxShadow: error
            ? "0px 0px 0px 1px var(--red-600,#c62b29)"
            : "0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100,#ede1d7)",
        }}
      >
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          style={{
            width: "100%",
            border: "none",
            outline: "none",
            background: "transparent",
            fontFamily: "var(--font-body)",
            fontWeight: 400,
            fontSize: 14,
            lineHeight: "16px",
            color: "var(--neutral-900,#26211e)",
            padding: 0,
          }}
        />
      </div>
      {error && <FieldError>This field can not be empty</FieldError>}
    </div>
  );
}

// ── Leave-without-saving guard ───────────────────────────────────────────────
// Warns before the user loses in-progress input on a workspace-onboarding
// step. Two independent mechanisms, since Next's App Router has no first-
// party "block navigation" hook (that's a Pages Router-only API):
//   1. `beforeunload` — covers a real page unload (refresh, closing the tab,
//      typing a new URL, or this step's own `window.location.href` handoff
//      to /welcome). Standard browser confirmation; text is not
//      customizable by any browser, so there's no custom copy here.
//   2. A pushState/popstate trick — covers the browser Back/Forward buttons,
//      which don't unload the page in an SPA and so never fire
//      `beforeunload`. On the first render where the step has unsaved input,
//      a duplicate history entry is pushed; a Back press lands on that
//      duplicate (caught via `popstate`) instead of actually leaving, and
//      shows the styled confirmation below. "Leave" replays the Back press
//      (skips both the duplicate and the real entry); "Stay" just re-arms.
//      This does not touch this step's own in-flow Back/Next buttons (they
//      call router.push, which never fires `popstate`).
//
// `bypass()` lets a caller doing an intentional `window.location.href`
// handoff (see onboarding/invite/page.tsx) suppress the `beforeunload` guard
// for that one navigation — it flips the ref straight from an event handler,
// not through the `isDirty` prop, so no render has to land before the
// navigation actually starts.

export function useLeaveGuard(isDirty: boolean) {
  const isDirtyRef = useRef(isDirty);
  const armedRef = useRef(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    if (!isDirty) {
      armedRef.current = false;
      return;
    }
    if (armedRef.current) return;
    armedRef.current = true;
    window.history.pushState({ onboardingLeaveGuard: true }, "", window.location.href);

    const onPopState = () => {
      if (!isDirtyRef.current) return;
      window.history.pushState({ onboardingLeaveGuard: true }, "", window.location.href);
      setOpen(true);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isDirty]);

  const stay = useCallback(() => setOpen(false), []);
  const leave = useCallback(() => {
    setOpen(false);
    armedRef.current = false;
    isDirtyRef.current = false;
    window.history.go(-2);
  }, []);
  const bypass = useCallback(() => {
    isDirtyRef.current = false;
  }, []);

  return { open, stay, leave, bypass };
}

export function LeaveGuardModal({
  open,
  onStay,
  onLeave,
}: {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}) {
  if (!open) return null;
  return (
    <div
      role="presentation"
      onClick={onStay}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        backgroundColor: "rgba(18,12,8,0.4)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Unsaved changes"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "var(--neutral-white,#fff)",
          borderRadius: 16,
          padding: 24,
          width: 380,
          maxWidth: "calc(100vw - 32px)",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          boxShadow: "0px 8px 32px 0px rgba(38,33,30,0.18), 0px 0px 0px 1px var(--neutral-100,#ede1d7)",
        }}
      >
        <div>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: 16,
              lineHeight: "24px",
              color: "var(--neutral-900,#26211e)",
              margin: 0,
            }}
          >
            Leave this step?
          </p>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 400,
              fontSize: 14,
              lineHeight: "22px",
              color: "var(--neutral-500,#8a8078)",
              margin: "8px 0 0",
            }}
          >
            You have unsaved changes on this page. If you leave now, they won&apos;t be saved.
          </p>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={onStay}>
            Stay on this page
          </Button>
          <Button variant="danger" size="sm" onClick={onLeave}>
            Leave without saving
          </Button>
        </div>
      </div>
    </div>
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
  skipLoading = false,
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
  skipLoading?: boolean;
  /** Omit to hide the primary Next/action button entirely — e.g. a screen whose
   *  only action lives elsewhere on the page (a card's own embedded button). */
  onNext?: () => void;
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
          <Button variant="ghost" size="sm" onClick={onSkip} disabled={skipDisabled} loading={skipLoading}>
            {skipLabel}
          </Button>
        )}
        {onNext && (
          <Button size="sm" onClick={onNext} disabled={nextDisabled} loading={nextLoading} rightIcon={<ArrowRight />}>
            {nextLabel}
          </Button>
        )}
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
