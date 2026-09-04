"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { useWorkspaceOnboarding, type WorkspaceSize } from "@/context/workspace-onboarding-context";
import { createOrganization, updateOrg, listOrganizations } from "@/lib/api/organization";
import { updateOnboarding } from "@/lib/api/user";
import { StepCanvas, StepHeader, StepFooter, FieldLabel, FieldError } from "../_components/step-shell";
import { ONBOARDING_SETUP_ROUTE, ONBOARDING_PROFILE_ROUTE } from "@/lib/routes";

// ── A1 screen 2 / A2 screen 1 — "Setup your workspace" / "Join a workspace" ──
// Figma: node 27:1196 (default state), 55:2726 (empty/required-field error
// state — label + message go red: "This field can not be empty").
//
// PENDING CONFIRMATION (see docs v1.5/onboarding-v1.5-flow.md item 2): there is
// no plan/billing step anywhere before this one in the new flow, unlike the
// old team flow (which created the org only after a Stripe checkout). The
// createOrganization()/updateOnboarding() calls below are the closest existing
// backend contracts, called best-effort — confirm with backend whether org
// creation should really happen here, unconditionally, with no payment step.
// The 4 workspace-size buckets ("Just me"/"1-5"/"5-10"/"10+") also don't map
// 1:1 onto the existing 3-value `role_fit` enum (just_me|small_team|large_team)
// — the mapping below is a reasonable guess, not a confirmed contract.

const SIZE_OPTIONS: { value: WorkspaceSize; label: string }[] = [
  { value: "just_me", label: "Just me" },
  { value: "1-5", label: "1-5" },
  { value: "5-10", label: "5-10" },
  { value: "10+", label: "10+" },
];

function deriveRoleFitFromSize(size: WorkspaceSize): "just_me" | "small_team" | "large_team" {
  if (size === "just_me") return "just_me";
  if (size === "10+") return "large_team";
  return "small_team";
}

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
        padding: "6px 10px 8px",
        borderRadius: 10,
        border: "none",
        cursor: "pointer",
        outline: "none",
        backgroundColor: selected ? "var(--neutral-100,#ede1d7)" : "var(--neutral-white,#fff)",
        boxShadow: selected
          ? "0px 0px 0px 1px var(--neutral-200,#d1c6bd)"
          : "0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100,#ede1d7)",
        fontFamily: "var(--font-body)",
        fontWeight: 500,
        fontSize: 14,
        lineHeight: "16px",
        color: "var(--neutral-700,#524b47)",
        whiteSpace: "nowrap",
        transition: "background-color 120ms, box-shadow 120ms",
      }}
    >
      {label}
    </button>
  );
}

export default function OnboardingWorkspacePage() {
  const { push } = useRouter();
  const { user, refreshUser } = useAuth();
  const { data, setWorkspaceName, setWorkspaceSize, setEntryFlow } = useWorkspaceOnboarding();
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Marks this as the "create" entry so the profile step's Back button
  // returns here rather than to A2's "Join a workspace" screen.
  useEffect(() => {
    setEntryFlow("create");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trimmedName = data.workspaceName.trim();
  const showError = touched && trimmedName.length === 0;

  const handleNext = async () => {
    setTouched(true);
    if (trimmedName.length === 0 || submitting) return;
    setSubmitting(true);
    const toastId = toast.loading("Saving your workspace…");
    try {
      const fullName = `${trimmedName}-workspace`;
      // GET /users/me never returns an org id at all (no such field in the
      // response schema) — user.orgId is always null, refreshUser() can't
      // populate it either. Resolving via listOrganizations() first (same
      // fallback used in invite/page.tsx and onboarding/connectors/page.tsx)
      // is the only reliable way to tell "already has a workspace" apart
      // from "doesn't yet" — without it, clicking Back then Next again
      // always re-triggers createOrganization() and 400s with "You already
      // belong to an organization".
      let orgId = user?.orgId ?? null;
      if (!orgId) {
        const orgs = await listOrganizations();
        orgId = orgs[0]?.id ?? null;
      }
      await Promise.all([
        updateOnboarding({ role_fit: deriveRoleFitFromSize(data.workspaceSize) }),
        orgId ? updateOrg(orgId, { name: fullName }) : createOrganization({ name: fullName }),
      ]);
      toast.dismiss(toastId);
    } catch (err) {
      // Non-fatal: don't trap the user here over a workspace-naming failure —
      // same tolerance the previous flow's equivalent step used. Surface it,
      // but let them continue; the name can be fixed later in settings.
      console.error("Workspace setup failed", err);
      toast.error("We couldn't save your workspace details — you can update them later in settings.", { id: toastId });
    } finally {
      setSubmitting(false);
    }
    // See the matching comment in onboarding/profile/page.tsx: the backend
    // silently flips onboarding_completed=true once user_role + ai_tone +
    // role_fit are all set, which this role_fit PATCH can complete for a user
    // returning here after already visiting profile (e.g. Back then Next).
    // Refresh before navigating so OnboardingGuard/the proxy never disagree
    // on a stale cached value.
    await refreshUser();
    push(ONBOARDING_PROFILE_ROUTE);
  };

  return (
    <StepCanvas>
      <StepHeader total={3} activeIndex={0} title="Setup your workspace" />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
          width: "100%",
          padding: "24px 0 0",
        }}
      >
        {/* Workspace name */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <FieldLabel error={showError}>Workspace&apos;s name*</FieldLabel>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              padding: "7px 10px",
              borderRadius: 10,
              backgroundColor: "var(--neutral-white,#fff)",
              boxSizing: "border-box",
              boxShadow: "0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100,#ede1d7)",
            }}
          >
            <input
              value={data.workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="John’s"
              style={{
                flex: 1,
                minWidth: 0,
                border: "none",
                outline: "none",
                background: "transparent",
                fontFamily: "var(--font-body)",
                fontWeight: 400,
                fontSize: 14,
                lineHeight: "16px",
                color: "var(--neutral-900,#26211e)",
                padding: 0,
              }}
            />
            <span
              style={{
                flexShrink: 0,
                fontFamily: "var(--font-body)",
                fontWeight: 500,
                fontSize: 14,
                lineHeight: "16px",
                color: "var(--neutral-900,#26211e)",
                whiteSpace: "nowrap",
              }}
            >
              -workspace
            </span>
          </div>
          {showError && <FieldError>This field can not be empty</FieldError>}
        </div>

        {/* Workspace size */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <FieldLabel>Workspace size</FieldLabel>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {SIZE_OPTIONS.map((opt) => (
              <SizePill
                key={opt.value}
                label={opt.label}
                selected={data.workspaceSize === opt.value}
                onSelect={() => setWorkspaceSize(opt.value)}
              />
            ))}
          </div>
        </div>
      </div>

      <StepFooter
        onBack={() => push(ONBOARDING_SETUP_ROUTE)}
        onNext={() => void handleNext()}
        nextDisabled={trimmedName.length === 0}
        nextLoading={submitting}
      />
    </StepCanvas>
  );
}
