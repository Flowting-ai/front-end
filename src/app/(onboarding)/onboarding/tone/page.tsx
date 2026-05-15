"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/context/onboarding-context";
import { Button } from "@/components/Button";
import type { OnboardingTone } from "@/context/onboarding-context";

const TONES: Array<{ id: OnboardingTone; subtitle: string; symbol: string }> = [
  { id: "Direct", subtitle: "Skip the preamble. Just the answer.", symbol: "◇◇" },
  { id: "Balanced", subtitle: "Friendly but efficient. The default.", symbol: "∞" },
  { id: "Warm", subtitle: "Conversational, with context and reasoning.", symbol: "✦" },
];

function ToneCard({
  tone,
  subtitle,
  symbol,
  selected,
  onSelect,
}: {
  tone: OnboardingTone;
  subtitle: string;
  symbol: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        padding: "12px",
        borderRadius: "16px",
        backgroundColor: "white",
        boxShadow: selected
          ? "0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 2px #26211e"
          : "0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px #ede1d7",
        cursor: "pointer",
        border: "none",
        textAlign: "left",
        width: "100%",
        outline: "none",
        transition: "box-shadow 120ms",
        gap: "12px",
      }}
    >
      {/* Icon placeholder */}
      <div
        style={{
          width: 65,
          height: 65,
          borderRadius: "8px",
          backgroundColor: "#cfbeac",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow:
            "0px 1.091px 1.09px 0px rgba(59,54,50,0.05), 0px 1.455px 1px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px #ede1d7",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-title)",
            fontWeight: 400,
            fontSize: "18px",
            color: "rgba(255,255,255,0.9)",
            letterSpacing: "2px",
          }}
        >
          {symbol}
        </span>
      </div>

      {/* Text */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", justifyContent: "center", flex: 1 }}>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 400,
            fontSize: "16px",
            lineHeight: "22px",
            color: "var(--neutral-900, #26211e)",
            margin: 0,
          }}
        >
          {tone}
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 400,
            fontSize: "14px",
            lineHeight: "22px",
            color: "#857a72",
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {subtitle}
        </p>
      </div>
    </button>
  );
}

export default function OnboardingTonePage() {
  const router = useRouter();
  const { data, setTone } = useOnboarding();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "24px",
        width: "100%",
        maxWidth: "420px",
        padding: "40px 16px",
      }}
    >
      {/* Heading */}
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
        <h1
          style={{
            fontFamily: "var(--font-title)",
            fontWeight: 400,
            fontSize: "24px",
            lineHeight: "32px",
            color: "#000",
            margin: 0,
          }}
        >
          How should your AI sound?
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 400,
            fontSize: "14px",
            lineHeight: "22px",
            color: "var(--neutral-700, #524b47)",
            margin: 0,
          }}
        >
          Choose a default. Souvenir adjusts per task and you can override anytime.
        </p>
      </div>

      {/* Tone cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
        {TONES.map((t) => (
          <ToneCard
            key={t.id}
            tone={t.id}
            subtitle={t.subtitle}
            symbol={t.symbol}
            selected={data.tone === t.id}
            onSelect={() => setTone(t.id)}
          />
        ))}
      </div>

      {/* Nav buttons */}
      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        <Button variant="outline" size="sm" onClick={() => router.push("/onboarding/role")}>
          Back
        </Button>
        <Button
          size="sm"
          disabled={data.tone === null}
          onClick={() => router.push("/onboarding/import")}
        >
          Continue
        </Button>
      </div>

      {/* Log out */}
      <a
        href="/auth/logout"
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: 400,
          fontSize: "11px",
          lineHeight: "16px",
          color: "#0d6eb2",
          textDecoration: "underline",
        }}
      >
        Log out
      </a>
    </div>
  );
}
