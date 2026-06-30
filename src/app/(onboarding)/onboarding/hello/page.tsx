"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useOnboarding, effectiveUserRole } from "@/context/onboarding-context";
import type { OnboardingRole } from "@/context/onboarding-context";
import { InputField } from "@/components/InputField";
import { Dropdown, DropdownFloat } from "@/components/Dropdown";
import { createUser, updateUser, updateOnboarding } from "@/lib/api/user";
import { Button } from "@/components/Button";
import { OnboardingScreen, OnboardingFooter } from "../_components/onboarding-shell";

const ROLES: OnboardingRole[] = [
  "Founder",
  "Marketer",
  "Designer",
  "Engineer",
  "Operator",
  "Student / Researcher",
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

// ── Role select (design-system Dropdown wired to a field-style trigger) ──────────
function RoleSelect({
  value,
  onChange,
}: {
  value: OnboardingRole | null;
  onChange: (v: OnboardingRole) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownFloat
      open={open}
      onOpenChange={setOpen}
      placement="top-start"
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
            <path
              d="M5 8l5 5 5-5"
              stroke="var(--neutral-400,#9c938b)"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
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

export default function OnboardingHelloPage() {
  const { push } = useRouter();
  const { isHydrated, isAuthenticated, user, logout } = useAuth();
  const { data, setFirstName, setLastName, setNickname, setRole } = useOnboarding();
  const [isSaving, setIsSaving] = useState(false);

  // Pre-fill name from the authenticated profile, skipping values that look like
  // an email (Auth0 defaults first_name to the email on new signups).
  useEffect(() => {
    const email = user?.email ?? "";
    const fn = user?.firstName ?? "";
    const ln = user?.lastName ?? "";
    if (fn && fn !== email && !fn.includes("@") && !data.firstName) setFirstName(fn);
    if (ln && ln !== email && !ln.includes("@") && !data.lastName) setLastName(ln);
    if (user?.nickname && !data.nickname) setNickname(user.nickname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Auth state is client-side, so redirect unauthenticated users from the client.
  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) { window.location.href = "/auth/login"; return; }
    // Upsert the backend user record (POST /users/create). Idempotent — safe to
    // call on every page load. Ensures PATCH /users/me succeeds on the first visit.
    void createUser();
  }, [isHydrated, isAuthenticated]);

  const canContinue =
    data.firstName.trim().length > 0 &&
    data.lastName.trim().length > 0 &&
    data.role !== null;

  const handleContinue = async () => {
    if (!canContinue || isSaving) return;
    setIsSaving(true);
    try {
      // Persist name + role before advancing. The final commit (role_fit +
      // completion) happens on the import step.
      await Promise.all([
        updateUser({
          first_name: data.firstName.trim(),
          last_name: data.lastName.trim(),
          nickname: data.nickname.trim() || null,
        }),
        updateOnboarding({ user_role: effectiveUserRole(data) }),
      ]);
    } finally {
      setIsSaving(false);
    }
    push("/onboarding/account-type");
  };

  if (!isHydrated) return null;

  const firstName = data.firstName.trim() || user?.firstName || "there";

  return (
    <OnboardingScreen
      title={`Hello ${firstName}!`}
      subtitle="Let's check a few things before we start."
      footer={
        <OnboardingFooter
          onContinue={() => { void handleContinue(); }}
          continueDisabled={!canContinue}
          continueLoading={isSaving}
          leftSlot={
            <Button variant="default" size="sm" onClick={() => void logout()} leftIcon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M13 3v10M6.5 10.5 3.5 8l3-2.5M3.5 8H11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}>
              Log out
            </Button>
          }
        />
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Name row */}
        <div style={{ display: "flex", gap: 16 }}>
          <InputField label="First name" placeholder="First name" value={data.firstName} onChange={setFirstName} fluid />
          <InputField label="Last name" placeholder="Last name" value={data.lastName} onChange={setLastName} fluid />
        </div>

        {/* Display name */}
        <InputField
          label="Display name"
          placeholder="Nickname or preferred name"
          value={data.nickname}
          onChange={setNickname}
          fluid
        />

        {/* Role */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <FieldLabel>Let&apos;s understand your role so we can update you accordingly</FieldLabel>
          <RoleSelect value={data.role} onChange={setRole} />
        </div>

      </div>
    </OnboardingScreen>
  );
}
