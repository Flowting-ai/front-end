"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/context/onboarding-context";
import type { AccountType } from "@/context/onboarding-context";
import { useAuth } from "@/context/auth-context";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { HugeiconsIcon } from "@hugeicons/react";
import { StickyNote02Icon, OfficeChairIcon } from "@hugeicons/core-free-icons";
import { OnboardingScreen, OnboardingFooter } from "../_components/onboarding-shell";

// ── Option card ─────────────────────────────────────────────────────────────────
interface OptionConfig {
  value: AccountType;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  iconRing: string;
  iconColor: string;
  iconInner: string;
  badge?: React.ReactNode;
}

const OPTIONS: OptionConfig[] = [
  {
    value: "individual",
    title: "Just me",
    description: "A personal space, tuned to how you work — and it remembers across every chat.",
    icon: <HugeiconsIcon icon={StickyNote02Icon} size={24} strokeWidth={1.6} />,
    iconBg: "#ffbfb6",
    iconRing: "rgba(159,38,35,0.5)",
    iconColor: "#9f2623",
    iconInner: "inset 0px 2px 0px 0px rgba(253,231,231,0.7), inset 0px -2px 0px 0px rgba(159,38,35,0.1)",
    badge: <Badge label="Try for free" color="Blue" />,
  },
  {
    value: "team",
    title: "Set up a team",
    description: "A shared workspace — one credit pool, shared knowledge, and the teammates you invite.",
    icon: <HugeiconsIcon icon={OfficeChairIcon} size={24} strokeWidth={1.6} />,
    iconBg: "#cadcf1",
    iconRing: "rgba(13,110,178,0.5)",
    iconColor: "#135487",
    iconInner: "inset 0px 2px 0px 0px rgba(231,244,253,0.7), inset 0px -2px 0px 0px rgba(13,110,178,0.1)",
  },
];

function OptionCard({
  config,
  selected,
  onSelect,
}: {
  config: OptionConfig;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        position: "relative",
        flex: "1 1 0",
        minWidth: 0,
        minHeight: 158,
        display: "flex",
        flexDirection: "column",
        gap: 9,
        alignItems: "flex-start",
        textAlign: "left",
        padding: 12,
        borderRadius: 12,
        backgroundColor: "var(--neutral-white,#fff)",
        border: "none",
        cursor: "pointer",
        outline: "none",
        boxShadow: selected
          ? "0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 2px var(--neutral-900,#26211e)"
          : "0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100,#ede1d7)",
        transition: "box-shadow 120ms",
      }}
    >
      {/* Badge (top-right) */}
      {config.badge && (
        <span style={{ position: "absolute", top: 12, right: 12 }}>{config.badge}</span>
      )}

      {/* Header: icon + title */}
      <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
        <span
          style={{
            position: "relative",
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: 8,
            backgroundColor: config.iconBg,
            color: config.iconColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0px 0px 0px 1px ${config.iconRing}, ${config.iconInner}`,
          }}
        >
          {config.icon}
        </span>
        <span
          style={{
            fontFamily: "var(--font-title)",
            fontWeight: 400,
            fontSize: 24,
            lineHeight: "32px",
            color: "var(--neutral-600,#6a625d)",
            whiteSpace: "nowrap",
          }}
        >
          {config.title}
        </span>
      </div>

      {/* Description */}
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: 400,
          fontSize: 14,
          lineHeight: "22px",
          color: "var(--neutral-600,#6a625d)",
        }}
      >
        {config.description}
      </span>
    </button>
  );
}

const LogoutLink = ({ onClick }: { onClick: () => void }) => (
  <Button
    variant="default"
    size="sm"
    onClick={onClick}
    leftIcon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M13 3v10M6.5 10.5 3.5 8l3-2.5M3.5 8H11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
  >
    Log out
  </Button>
);

export default function OnboardingAccountTypePage() {
  const { push } = useRouter();
  const { logout, user } = useAuth();
  const { data, setAccountType } = useOnboarding();
  const [selected, setSelected] = useState<AccountType | null>(data.accountType);

  useEffect(() => {
    if (!user?.orgId) return
    // Invited into an existing org — treat as individual, skip this page.
    setAccountType('individual')
    push('/onboarding/import')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleContinue = async () => {
    if (!selected) return;
    setAccountType(selected);
    // Both paths go to plans — individual sees Starter/Pro/Power, team sees Team/Enterprise.
    push("/onboarding/plans");
  };

  return (
    <OnboardingScreen
      title="Just you, or the whole team?"
      subtitle="We'll tailor your setup to match. You can add or join a team later — nothing's locked in."
      footer={
        <OnboardingFooter
          onBack={() => push("/onboarding/hello")}
          onContinue={() => void handleContinue()}
          continueDisabled={!selected}
          leftSlot={<LogoutLink onClick={() => void logout()} />}
        />
      }
    >
      <div style={{ display: "flex", gap: 20 }}>
        {OPTIONS.map((opt) => (
          <OptionCard
            key={opt.value}
            config={opt}
            selected={selected === opt.value}
            onSelect={() => setSelected(opt.value)}
          />
        ))}
      </div>
    </OnboardingScreen>
  );
}
