"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import type { OnboardingRole } from "@/context/onboarding-context";
import { useTeamInviteOnboarding } from "@/context/team-invite-onboarding-context";
import { InputField } from "@/components/InputField";
import { Dropdown, DropdownFloat } from "@/components/Dropdown";
import { createUser, updateUser, updateOnboarding } from "@/lib/api/user";
import { OnboardingScreen, OnboardingFooter } from "../../../_components/onboarding-shell";
import { InviteStateScreen } from "../_components/invite-ui";

// ── Screen 3 — profile (name + role) ────────────────────────────────────────────
// Used in two modes:
//   Invite mode  — [inviteId] is a real invite ID; context loads, after saving
//                  advances to the confirm screen.
//   Standalone   — [inviteId] is actually a teamId (already-onboarded user was
//                  redirected here after accepting an invite). Context 404s so
//                  status is never "ready"; after saving we go straight to /chat.
//
// In both modes: if the user already has firstName, lastName, and onboardingRole
// we auto-redirect to /chat immediately — no need to ask again.

const ROLES: OnboardingRole[] = [
  "Founder",
  "Marketer",
  "Designer",
  "Engineer",
  "Operator",
  "Student / Researcher",
  "Other",
];

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

function RoleSelect({ value, onChange }: { value: OnboardingRole | null; onChange: (v: OnboardingRole) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownFloat
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      offset={4}
      trigger={
        <button
          type="button"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            width: "100%",
            padding: "7px 10px",
            borderRadius: 10,
            border: "none",
            backgroundColor: "var(--text-field-bg,#fff)",
            boxShadow:
              "0px 1px 1.5px 0px var(--neutral-700-12,rgba(82,75,71,0.12)), 0px 0px 0px 1px var(--neutral-100,#ede1d7)",
            cursor: "pointer",
            outline: "none",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 400,
              fontSize: 14,
              lineHeight: "22px",
              color: value ? "var(--text-field-text,#26211e)" : "var(--text-field-placeholder,#9c938b)",
            }}
          >
            {value ?? "Roles"}
          </span>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M5 8l5 5 5-5" stroke="var(--neutral-400,#9c938b)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      }
    >
      <Dropdown style={{ width: 403 }}>
        {ROLES.map((role) => (
          <Dropdown.Item
            key={role}
            fluid
            label={role}
            selected={role === value}
            onClick={() => {
              onChange(role);
              setOpen(false);
            }}
          />
        ))}
      </Dropdown>
    </DropdownFloat>
  );
}

export default function TeamInviteProfilePage() {
  const { push } = useRouter();
  const params = useParams<{ inviteId: string }>();
  const { isHydrated, isAuthenticated, user } = useAuth();
  const { status, invite, errorMsg, refetch } = useTeamInviteOnboarding();

  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [role, setRole] = useState<OnboardingRole | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Prefill from the authenticated profile, skipping Auth0's email default.
  const email = user?.email ?? "";
  const profileFirst = (() => {
    const fn = user?.firstName ?? "";
    return fn && fn !== email && !fn.includes("@") ? fn : "";
  })();
  const profileLast = (() => {
    const ln = user?.lastName ?? "";
    return ln && ln !== email && !ln.includes("@") ? ln : "";
  })();
  const firstValue = firstName ?? profileFirst;
  const lastValue = lastName ?? profileLast;

  // If all three profile fields already exist, skip straight to /chat.
  const hasCompleteProfile = useMemo(
    () => isHydrated && !!user && !!profileFirst && !!profileLast && !!user.onboardingRole,
    [isHydrated, user, profileFirst, profileLast],
  );

  useEffect(() => {
    if (hasCompleteProfile) push("/chat");
  }, [hasCompleteProfile, push]);

  // Ensure the backend user record exists so the PATCH calls succeed.
  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) { window.location.href = "/auth/login"; return; }
    void createUser();
  }, [isHydrated, isAuthenticated]);

  // Invite context is still fetching — show loading (applies to both modes).
  if (status === "loading") {
    return (
      <InviteStateScreen
        status="loading"
        errorMsg=""
        onRetry={refetch}
        onHome={() => push("/chat")}
      />
    );
  }

  // STANDALONE MODE: status is not_found / expired / error, meaning the URL
  // segment is a teamId rather than a real inviteId. Show the form and send
  // the user to /chat after saving (no confirm screen to advance to).
  const isStandalone = status !== "ready" || !invite;

  const canContinue = firstValue.trim().length > 0 && lastValue.trim().length > 0 && role !== null;

  const handleContinue = async () => {
    if (!canContinue || isSaving) return;
    setIsSaving(true);
    try {
      await Promise.all([
        updateUser({ first_name: firstValue.trim(), last_name: lastValue.trim() }),
        updateOnboarding({ user_role: role }),
      ]);
    } finally {
      setIsSaving(false);
    }
    push(isStandalone ? "/chat" : `/onboarding/team/${params.inviteId}/confirm`);
  };

  const greetingName = firstValue.trim() || user?.firstName || "there";

  return (
    <OnboardingScreen
      title={`Hello ${greetingName}!`}
      subtitle="Let's check a few things before we start."
      footer={
        <OnboardingFooter
          onBack={() => push(isStandalone ? "/chat" : `/onboarding/team/${params.inviteId}/join`)}
          onContinue={() => { void handleContinue(); }}
          continueDisabled={!canContinue}
          continueLoading={isSaving}
        />
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 16 }}>
          <InputField label="First name" placeholder="First name" value={firstValue} onChange={setFirstName} fluid />
          <InputField label="Last name" placeholder="Last name" value={lastValue} onChange={setLastName} fluid />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <FieldLabel>Let&apos;s understand your role so we can update you accordingly</FieldLabel>
          <RoleSelect value={role} onChange={setRole} />
        </div>
      </div>
    </OnboardingScreen>
  );
}
