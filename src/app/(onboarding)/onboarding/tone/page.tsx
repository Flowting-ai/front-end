"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/context/onboarding-context";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/Button";
import { updateOnboarding, updateUser } from "@/lib/api/user";
import { toast } from "sonner";
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
  return (
    <button
      type="button"
      onClick={onSelect}
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
            letterSpacing: "0.5px",
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
  const { push } = useRouter();
  const { data, setTone } = useOnboarding();
  const { setUser, user, logout } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    if (isSubmitting || data.tone === null) return;
    setIsSubmitting(true);
    try {
      // Note: role_fit is a backend enum (team size: just_me|small_team|large_team)
      // and has no UI step yet, so it is intentionally not sent. The nickname and
      // "Other" role text are session-only — there is no backend field for them.
      const payload = {
        user_role: data.role ?? null,
        ai_tone: data.tone,
        onboarding_completed: false,
      };

      // Save tone/role. Onboarding is NOT marked complete — that happens on the import step.
      const onboardingResult = await updateOnboarding(payload);

      if (onboardingResult === null) {
        toast.error("Failed to save preferences — please try again.");
        setIsSubmitting(false);
        return;
      }

      // Name was already saved on the welcome step. Fire and forget here so a
      // transient /users/me failure never blocks onboarding completion.
      void updateUser({ first_name: data.firstName || null, last_name: data.lastName || null });

      // Update auth state with role/tone but do NOT mark onboarding complete yet.
      if (user) {
        setUser({
          ...user,
          onboardingRole: onboardingResult.user_role ?? user.onboardingRole,
          onboardingTone: onboardingResult.ai_tone ?? user.onboardingTone,
        });
      }

      push("/onboarding/import");
    } catch (err) {
      console.error("Onboarding submission failed", err);
      toast.error("Something went wrong — please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--neutral-50, #f7f2ed)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative background; Next Image doesn't support SVG patterns with embedded raster images */}
      <img src="https://souvenirai-storage.s3.us-east-1.amazonaws.com/public/souvenir-onboarding-bg.svg" alt="Souvenir onboarding background" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0, pointerEvents: "none" }} />
    <div
      style={{
        position: "relative",
        zIndex: 1,
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
        <Button variant="secondary" size="sm" onClick={() => push("/onboarding/role")}>
          Back
        </Button>
        {/* eslint-disable-next-line react-doctor/design-no-vague-button-label -- onboarding wizard: "Continue" completes onboarding; flow context makes action clear */}
        <Button
          size="sm"
          disabled={data.tone === null || isSubmitting}
          loading={isSubmitting}
          onClick={() => void handleContinue()}
        >
          Continue
        </Button>
      </div>

      {/* Log out */}
      <Button variant="ghost" size="sm" onClick={() => void logout()}>
        <span style={{ color: "#0d6eb2", textDecoration: "underline" }}>Log out</span>
      </Button>
    </div>
    </div>
  );
}
