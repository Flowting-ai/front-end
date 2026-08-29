"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiMagicIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/Button";
import { getSlackInstallUrl } from "@/lib/api/slack";
import { ONBOARDING_WORKSPACE_ROUTE } from "@/lib/routes";

// ── Screen 1 of the workspace onboarding flow ────────────────────────────────
// Figma: Onboarding v1, node 181:7750 ("Setup your team" in the file — renamed
// here per the team→workspace terminology shift; nothing about the flow itself
// is team-specific).
//
// Choice: continue onboarding inside Slack (grabs workspace details
// automatically, no further setup) or continue in the Souvenir web app
// (the multi-step flow starting at ONBOARDING_WORKSPACE_ROUTE).
//
// PENDING CONFIRMATION (flagged, not guessed): what happens after a user
// finishes the Slack-side install — does the backend return them to
// /onboarding/workspace with name/size pre-filled, straight to /chat, or
// somewhere else? Wired to the existing getSlackInstallUrl()/redirect pattern
// (same one SlackConnectModal already uses) since that's the only confirmed
// backend contract for starting a Slack install; the continuation needs a
// product/backend answer before this can be considered done.
//
// Two icons on this screen: the "ai-magic" sparkle note glyph uses AiMagicIcon
// (hugeicons) — a same-named, same-meaning stand-in already used elsewhere in
// this codebase's icon set, confirmed correct. The mark next to "Set up in
// Souvenir" uses the actual Souvenir logo (public/icons/souvenir-logo.svg),
// replacing an earlier GridIcon placeholder.

function SlackMark({ size = 24 }: { size?: number }) {
  // Reuses the project's existing Slack asset (public/connector-logos/slack.svg)
  // rather than re-downloading the mark from Figma — same glyph, already in use
  // on the personal-connectors onboarding step.
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static public SVG, no Next Image benefit for a 24px icon
    <img src="/connector-logos/slack.svg" alt="" width={size} height={size} style={{ display: "block", flexShrink: 0 }} />
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3.5 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Recommended chip ─────────────────────────────────────────────────────────
// Figma: small badge overlapping the Slack card's top-left border. No shared
// "Chip"/"Badge" component in the design system matches this exact treatment
// (blue-100 fill, blue-700 text, 1px blue border) — hand-styled inline, same
// convention as YellowBadge in onboarding/plans/page.tsx.

function RecommendedChip() {
  return (
    <div
      style={{
        position: "absolute",
        top: -11,
        left: 16,
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 6px",
        borderRadius: 6,
        backgroundColor: "var(--blue-100,#cadcf1)",
        boxShadow:
          "0px 1px 1.5px 0px rgba(2,15,24,0.2), 0px 0px 0px 1px rgba(13,110,178,0.5), inset 0px 1px 0px 0px rgba(231,244,253,0.7), inset 0px -1px 0px 0px rgba(13,110,178,0.1)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: 500,
          fontSize: 11,
          lineHeight: "16px",
          color: "var(--blue-700,#135487)",
          whiteSpace: "nowrap",
        }}
      >
        Recommended
      </span>
    </div>
  );
}

// ── Option card shell ────────────────────────────────────────────────────────

function OptionCard({
  bordered,
  children,
}: {
  /** Slack card uses a blue border + white surface; Souvenir card uses a subtle border + beige surface. */
  bordered: "blue" | "subtle";
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        padding: bordered === "blue" ? "24px 16px 16px" : 16,
        borderRadius: 10,
        backgroundColor: bordered === "blue" ? "var(--color-surface-raised,#fff)" : "var(--color-surface-base,#f7f2ed)",
        border: bordered === "blue" ? "1px solid rgba(13,110,178,0.5)" : "1px solid var(--color-border-subtle,#b6aca4)",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}

function OptionHeading({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      {icon}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 312 }}>
        <p style={{ fontFamily: "var(--font-title)", fontWeight: 500, fontSize: 20, lineHeight: "24px", color: "var(--color-text-primary,#524b47)", margin: 0 }}>
          {title}
        </p>
        <p style={{ fontFamily: "var(--font-body)", fontWeight: 400, fontSize: 14, lineHeight: "16px", color: "var(--color-text-secondary,#6a625d)", margin: 0 }}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OnboardingSetupChoicePage() {
  const { push } = useRouter();
  const [connectingSlack, setConnectingSlack] = useState(false);

  const handleContinueWithSlack = async () => {
    if (connectingSlack) return;
    setConnectingSlack(true);
    try {
      const url = await getSlackInstallUrl();
      window.location.href = url;
    } catch (err) {
      setConnectingSlack(false);
      toast.error(err instanceof Error ? err.message : "Couldn't start Slack setup — please try again.");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--neutral-50,#f7f2ed)",
        padding: "40px 16px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%", maxWidth: 392 }}>
        {/* ── Slack option ── */}
        <OptionCard bordered="blue">
          <RecommendedChip />
          <OptionHeading
            icon={<SlackMark />}
            title="Add Souvenir to Slack"
            subtitle="Bring Souvenir right into your workspace, ready for your workspace to use."
          />
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              padding: 8,
              borderRadius: 10,
              backgroundColor: "var(--color-surface-base,#f7f2ed)",
            }}
          >
            <div style={{ flexShrink: 0, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--neutral-700,#524b47)" }}>
              <HugeiconsIcon icon={AiMagicIcon} size={16} strokeWidth={1.6} />
            </div>
            <p style={{ flex: 1, fontFamily: "var(--font-body)", fontWeight: 400, fontSize: 14, lineHeight: "16px", color: "var(--color-text-secondary,#6a625d)", margin: 0 }}>
              We&apos;ll also grab your workspace details, so no setup required
            </p>
          </div>
          <Button
            fluid
            size="sm"
            loading={connectingSlack}
            onClick={() => void handleContinueWithSlack()}
            rightIcon={<ArrowRightIcon />}
          >
            Continue with Slack
          </Button>
        </OptionCard>

        {/* ── Souvenir self-serve option ── */}
        <OptionCard bordered="subtle">
          <OptionHeading
            icon={
              <div style={{ flexShrink: 0, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- static local icon, Next Image adds no value here */}
                <img src="/icons/souvenir-logo.svg" alt="" width={24} height={24} style={{ display: "block" }} aria-hidden />
              </div>
            }
            title="Set up in Souvenir"
            subtitle="Prefer to do it yourself? Walk through a few quick steps to set up your workspace."
          />
          <Button fluid variant="outline" size="sm" onClick={() => push(ONBOARDING_WORKSPACE_ROUTE)}>
            Continue setting up
          </Button>
        </OptionCard>
      </div>
    </div>
  );
}
