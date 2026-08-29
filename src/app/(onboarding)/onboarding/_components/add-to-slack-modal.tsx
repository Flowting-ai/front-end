"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CancelOneIcon } from "@strange-huge/icons";
import { Button } from "@/components/Button";
import { getSlackInstallUrl } from "@/lib/api/slack";

// ── A1 screen 5 / A2 screen 3 — "Into the app" + "Add Souvenir to Slack" modal ──
// Figma: node 55:2475 (A1), 182:10127 (A2, same modal design). This is not a
// dedicated onboarding step — it's a modal shown over the home/new-chat page
// right after onboarding completes. The illustration behind the copy (a Slack
// message-composer preview with the Souvenir app mention) is a static export
// (public/onboarding/slack-preview.png) rather than a rebuilt Slack UI mockup —
// it's purely decorative and not interactive in the design.

function SlackPreviewIllustration() {
  return (
    <div
      style={{
        width: "100%",
        borderRadius: 10,
        backgroundColor: "var(--neutral-50,#f7f2ed)",
        padding: 12,
        boxSizing: "border-box",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static decorative export, not a Next Image candidate */}
      <img
        src="/onboarding/slack-preview.png"
        alt=""
        style={{ display: "block", width: "100%", height: "auto", borderRadius: 6 }}
      />
    </div>
  );
}

export function AddSouvenirToSlackModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [connecting, setConnecting] = useState(false);

  if (!isOpen) return null;

  const handleAddToSlack = async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      const url = await getSlackInstallUrl();
      window.location.href = url;
    } catch (err) {
      setConnecting(false);
      toast.error(err instanceof Error ? err.message : "Couldn't start Slack setup — please try again.");
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        backgroundColor: "rgba(18,12,8,0.52)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add Souvenir to Slack"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
          width: 412,
          maxWidth: "100%",
          borderRadius: 18,
          backgroundColor: "var(--neutral-white,#fff)",
          padding: 16,
          boxSizing: "border-box",
          boxShadow: "0px 19px 32px 0px rgba(18,12,8,0.15), 0px 2px 2.8px 0px rgba(130,122,116,0.1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <p style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 20, lineHeight: "24px", color: "var(--neutral-700,#524b47)", margin: 0 }}>
              Add Souvenir to Slack
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontWeight: 400, fontSize: 14, lineHeight: "16px", color: "var(--neutral-600,#6a625d)", margin: 0 }}>
              Bring Souvenir right into your workspace, ready for your workspace to use.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 3, borderRadius: 6, display: "flex", color: "var(--neutral-700,#524b47)", flexShrink: 0 }}
          >
            <CancelOneIcon size={18} />
          </button>
        </div>

        <SlackPreviewIllustration />

        <Button fluid size="sm" loading={connecting} onClick={() => void handleAddToSlack()}>
          Add Souvenir to Slack
        </Button>
      </div>
    </div>
  );
}
