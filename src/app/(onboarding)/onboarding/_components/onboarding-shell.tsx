"use client";

import React from "react";
import { Button } from "@/components/Button";

// ── Shared canvas ───────────────────────────────────────────────────────────────
// All new onboarding steps (hello, account-type, workspace) render through this
// shell so the gradient canvas, logo, heading block, and footer stay identical
// from screen to screen. Figma 5795:41421 — neutral-50 → neutral-100 → neutral-200.

const CANVAS_GRADIENT =
  "linear-gradient(180deg, var(--neutral-50,#f7f2ed) 3.76%, var(--neutral-100,#ede1d7) 75%, var(--neutral-200,#d1c6bd) 116.79%)";

// ── Logo glyph ──────────────────────────────────────────────────────────────────

export function SouvenirGlyph({ size = 60 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external SVG logo; Next Image adds no value here
    <img
      src="https://souvenirai-storage.s3.us-east-1.amazonaws.com/public/souvenir-blue.svg"
      alt="Souvenir"
      style={{ display: "block", height: "auto", width: "auto", maxHeight: size, maxWidth: size }}
    />
  );
}

// ── Screen ──────────────────────────────────────────────────────────────────────

export function OnboardingScreen({
  title,
  subtitle,
  width = 518,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  /** Content-column width in px. Decider/hello use 518; workspace uses 653. */
  width?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 32,
          width: "100%",
          maxWidth: width,
        }}
      >
        {/* Heading block */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SouvenirGlyph />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
            {subtitle && (
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 400,
                  fontSize: 16,
                  lineHeight: "22px",
                  color: "var(--neutral-800,#3b3632)",
                  margin: 0,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Step content */}
        {children}

        {/* Footer */}
        {footer && <div style={{ marginTop: 16 }}>{footer}</div>}
      </div>
    </div>
  );
}

// ── Footer (Go back / Continue) ─────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M10 3L5 8l5 5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function OnboardingFooter({
  onBack,
  backLabel = "Go back",
  onContinue,
  continueLabel = "Continue",
  continueDisabled = false,
  continueLoading = false,
  leftSlot,
}: {
  onBack?: () => void;
  backLabel?: string;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  continueLoading?: boolean;
  /** Optional node rendered just before the Continue button (e.g. "Skip"). */
  leftSlot?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        gap: 16,
      }}
    >
      {onBack ? (
        <Button variant="outline" size="sm" onClick={onBack} leftIcon={<ChevronLeft />}>
          {backLabel}
        </Button>
      ) : (
        <span />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {leftSlot}
        <Button
          size="sm"
          onClick={onContinue}
          disabled={continueDisabled}
          loading={continueLoading}
        >
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}
