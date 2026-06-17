"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useOnboarding } from "@/context/onboarding-context";
import type { CompanySize } from "@/context/onboarding-context";
import { InputField } from "@/components/InputField";
import { deriveRoleFit } from "@/context/onboarding-context";
import { updateOnboarding } from "@/lib/api/user";
import { updateOrg } from "@/lib/api/organization";
import { OnboardingScreen, OnboardingFooter } from "../_components/onboarding-shell";

const SIZES: CompanySize[] = ["1-10", "11-50", "51-200", "200+"];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "var(--font-body)",
        fontWeight: 400,
        fontSize: 14,
        lineHeight: "22px",
        color: "var(--neutral-700,#524b47)",
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

// ── Segmented size control ──────────────────────────────────────────────────────
function SizePill({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        padding: "6px 12px",
        borderRadius: 8,
        border: "none",
        cursor: "pointer",
        outline: "none",
        backgroundColor: selected ? "var(--neutral-900,#26211e)" : "var(--neutral-white,#fff)",
        color: selected ? "var(--neutral-50,#f7f2ed)" : "var(--neutral-700,#524b47)",
        boxShadow: selected
          ? "0px 1px 1.5px 0px rgba(82,75,71,0.12)"
          : "0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200,#d1c6bd)",
        fontFamily: "var(--font-body)",
        fontWeight: 500,
        fontSize: 14,
        lineHeight: "22px",
        whiteSpace: "nowrap",
        transition: "background-color 120ms, color 120ms, box-shadow 120ms",
      }}
    >
      {label}
    </button>
  );
}

export default function OnboardingWorkspacePage() {
  const { push } = useRouter();
  const { user, logout } = useAuth();
  const { data, setAccountType, setCompanyName, setCompanyWebsite, setCompanySize } = useOnboarding();
  const [submitting, setSubmitting] = useState(false);

  // Reaching this step means the team branch — make sure the account type is set
  // even if the user deep-linked here.
  useEffect(() => {
    if (data.accountType !== "team") setAccountType("team");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canContinue = data.companyName.trim().length > 0 && data.companySize !== null;

  const handleContinue = async () => {
    if (!canContinue || submitting) return;
    setSubmitting(true);
    try {
      const roleFit = deriveRoleFit("team", data.companySize);
      const tasks: Promise<unknown>[] = [];
      if (roleFit) tasks.push(updateOnboarding({ role_fit: roleFit }));
      // Update the placeholder org name (created at account-type step) with
      // the company name the user just entered.
      if (user?.orgId) tasks.push(updateOrg(user.orgId, { name: data.companyName.trim() }));
      await Promise.all(tasks);
    } catch {
      // Non-fatal: proceed even if the org rename fails
    }
    push("/onboarding/connectors");
  };

  return (
    <OnboardingScreen
      title="Set up your workspace"
      subtitle="Your company on Souvenir — teams and projects live inside it."
      width={653}
      footer={
        <OnboardingFooter
          onBack={() => push("/onboarding/account-type")}
          onContinue={() => void handleContinue()}
          continueDisabled={!canContinue}
          continueLoading={submitting}
          leftSlot={
            <button
              type="button"
              onClick={() => void logout()}
              style={{ background: "none", border: "none", padding: "4px 0", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 14, color: "#0d6eb2", textDecoration: "underline" }}
            >
              Log out
            </button>
          }
        />
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Name + website row */}
        <div style={{ display: "flex", gap: 16 }}>
          <InputField
            label="Company name (Workspace)"
            placeholder="Acme"
            value={data.companyName}
            onChange={setCompanyName}
            fluid
          />
          <InputField
            label="Company website"
            labelSuffix={
              <span style={{ fontWeight: 400, color: "var(--neutral-400,#9e9792)" }}>
                (optional)
              </span>
            }
            placeholder="https://"
            value={data.companyWebsite}
            onChange={setCompanyWebsite}
            fluid
          />
        </div>

        {/* Company size */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <FieldLabel>Company size</FieldLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {SIZES.map((size) => (
              <SizePill
                key={size}
                label={size}
                selected={data.companySize === size}
                onSelect={() => setCompanySize(size)}
              />
            ))}
          </div>
          <FieldLabel>
            You&apos;ll be the <strong style={{ fontWeight: 600, color: "var(--neutral-900,#26211e)" }}>Owner</strong> — transferable later.
          </FieldLabel>
        </div>
      </div>
    </OnboardingScreen>
  );
}
