"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import type { OnboardingRole, OnboardingTone } from "@/context/onboarding-context";
import { useTeamInviteOnboarding } from "@/context/team-invite-onboarding-context";
import { Dropdown, DropdownFloat } from "@/components/Dropdown";
import { createUser, updateUser, updateOnboarding } from "@/lib/api/user";
import { StepCanvas, StepHeader, StepFooter, FieldLabel, TextField } from "../../../_components/step-shell";
import { InviteStateScreen } from "../_components/invite-ui";
import { CHAT_ROUTE, AUTH_LOGIN_ROUTE, WELCOME_ROUTE } from "@/lib/routes";

// ── Screen 2 — "Create your profile" ─────────────────────────────────────────
// Figma: node 66:4341 (same visual system as onboarding/profile/page.tsx's A1
// step). Tone is asked here too, inline as a third dropdown field rather than
// the separate full-screen /onboarding/tone step the self-signup flow uses —
// this is a 2-step invite flow (see StepHeader total={2} below), and an
// invited member otherwise never gets asked their tone preference at all
// (it stays unset until they happen to visit Settings → Account later).
//
// Used in two modes:
//   Invite mode  — [inviteId] is a real invite ID; context loads, after saving
//                  advances to the shared A1/A2 Slack-modal landing.
//   Standalone   — [inviteId] is actually a teamId (already-onboarded user was
//                  redirected here after accepting an invite). Context 404s so
//                  status is never "ready"; after saving we go straight to /chat.
//
// In both modes: if the user already has firstName, lastName, and onboardingRole
// we auto-redirect to /chat immediately — no need to ask again.
//
// Deliberately has no Back button, unlike the Figma frame — the invite is
// deactivated the instant screen 1's "Join" succeeds, so a Back-then-re-Join
// would 404 "Invite not found" instead of re-accepting. Nothing left on this
// screen to reconsider once membership is already committed.

const ROLES: OnboardingRole[] = [
  "Founder",
  "Marketer",
  "Designer",
  "Engineer",
  "Operator",
  "Student / Researcher",
  "Other",
];

// Same 3 choices + copy as the self-signup flow's dedicated /onboarding/tone
// step (TONES there) — kept in sync manually since that page's version also
// carries a symbol glyph this compact dropdown has no room for.
const TONES: Array<{ id: OnboardingTone; subtitle: string }> = [
  { id: "Direct", subtitle: "Skip the preamble. Just the answer." },
  { id: "Balanced", subtitle: "Friendly but efficient. The default." },
  { id: "Warm", subtitle: "Conversational, with context and reasoning." },
];

// ── Role select (same Dropdown/DropdownFloat + Dropdown.Section pattern as
// onboarding/profile/page.tsx's RoleSelect — different role type/list, so the
// component itself isn't shared, just the pattern). ─────────────────────────
function RoleSelect({ value, onChange }: { value: OnboardingRole | null; onChange: (v: OnboardingRole) => void }) {
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
            backgroundColor: "var(--neutral-white,#fff)",
            boxShadow: "0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100,#ede1d7)",
            cursor: "pointer",
            outline: "none",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 400,
              fontSize: 14,
              lineHeight: "16px",
              color: value ? "var(--neutral-900,#26211e)" : "var(--neutral-400,#9c938b)",
            }}
          >
            {value ?? "Designer"}
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
        <Dropdown.Section fluid>
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
        </Dropdown.Section>
      </Dropdown>
    </DropdownFloat>
  );
}

// ── Tone select (same Dropdown/DropdownFloat pattern as RoleSelect above,
// plus a one-line subLabel per option — the short description each choice
// needs to be legible without the full /onboarding/tone screen's cards). ───
function ToneSelect({ value, onChange }: { value: OnboardingTone; onChange: (v: OnboardingTone) => void }) {
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
            backgroundColor: "var(--neutral-white,#fff)",
            boxShadow: "0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100,#ede1d7)",
            cursor: "pointer",
            outline: "none",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 400,
              fontSize: 14,
              lineHeight: "16px",
              color: "var(--neutral-900,#26211e)",
            }}
          >
            {value}
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
      <Dropdown style={{ width: 280 }}>
        <Dropdown.Section fluid>
          {TONES.map((t) => (
            <Dropdown.Item
              key={t.id}
              fluid
              label={t.id}
              subLabel={t.subtitle}
              selected={t.id === value}
              onClick={() => {
                onChange(t.id);
                setOpen(false);
              }}
            />
          ))}
        </Dropdown.Section>
      </Dropdown>
    </DropdownFloat>
  );
}

export default function TeamInviteProfilePage() {
  const { push } = useRouter();
  const { isHydrated, isAuthenticated, user, refreshUser } = useAuth();
  const { status, invite, refetch } = useTeamInviteOnboarding();

  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [role, setRole] = useState<OnboardingRole | null>(null);
  // Balanced pre-selected, same as the self-signup flow's own default (see
  // TONES above — it's the one explicitly labeled "The default") — unlike
  // Role, this isn't left null, so every invited member ends up with a real
  // tone set rather than none at all.
  const [tone, setTone] = useState<OnboardingTone>("Balanced");
  const [touched, setTouched] = useState(false);
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
  const firstError = touched && firstValue.trim().length === 0;
  const lastError = touched && lastValue.trim().length === 0;

  // If all three profile fields already exist, skip straight to /chat.
  const hasCompleteProfile = useMemo(
    () => isHydrated && !!user && !!profileFirst && !!profileLast && !!user.onboardingRole,
    [isHydrated, user, profileFirst, profileLast],
  );

  useEffect(() => {
    if (hasCompleteProfile) push(CHAT_ROUTE);
  }, [hasCompleteProfile, push]);

  // Ensure the backend user record exists so the PATCH calls succeed.
  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) { window.location.href = AUTH_LOGIN_ROUTE; return; }
    void createUser();
  }, [isHydrated, isAuthenticated]);

  // Invite context is still fetching — show loading (applies to both modes).
  if (status === "loading") {
    return (
      <InviteStateScreen
        status="loading"
        errorMsg=""
        onRetry={refetch}
        onHome={() => push(CHAT_ROUTE)}
      />
    );
  }

  // STANDALONE MODE: status is not_found / expired / error, meaning the URL
  // segment is a teamId rather than a real inviteId. Show the form and send
  // the user to /chat after saving (no Slack-modal landing to advance to).
  const isStandalone = status !== "ready" || !invite;

  const canContinue = firstValue.trim().length > 0 && lastValue.trim().length > 0;

  const handleContinue = async () => {
    setTouched(true);
    if (!canContinue || isSaving) return;
    setIsSaving(true);
    try {
      await Promise.all([
        updateUser({ first_name: firstValue.trim(), last_name: lastValue.trim() }),
        updateOnboarding({ user_role: role, ai_tone: tone }),
      ]);
      // Without this, hasCompleteProfile above would see the stale pre-save
      // name/role if this screen is ever revisited before something else
      // refreshes the cached user.
      await refreshUser();
      push(isStandalone ? CHAT_ROUTE : `${WELCOME_ROUTE}?slack=1`);
    } catch (err) {
      console.error("Onboarding submission failed", err);
      toast.error("Something went wrong — please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <StepCanvas>
      <StepHeader total={2} activeIndex={1} title="Create your profile" />

      <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
        <div style={{ display: "flex", gap: 20 }}>
          <TextField
            label="First name"
            required
            placeholder="John"
            value={firstValue}
            onChange={setFirstName}
            onBlur={() => setTouched(true)}
            error={firstError}
          />
          <TextField
            label="Last name"
            required
            placeholder="Doe"
            value={lastValue}
            onChange={setLastName}
            onBlur={() => setTouched(true)}
            error={lastError}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <FieldLabel>Role</FieldLabel>
          <RoleSelect value={role} onChange={setRole} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <FieldLabel>Style</FieldLabel>
          <ToneSelect value={tone} onChange={setTone} />
        </div>
      </div>

      <StepFooter
        onNext={() => void handleContinue()}
        nextDisabled={!canContinue}
        nextLoading={isSaving}
      />
    </StepCanvas>
  );
}
