"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dropdown, DropdownFloat } from "@/components/Dropdown";
import { updateUser, updateOnboarding } from "@/lib/api/user";
import {
  useWorkspaceOnboarding,
  type WorkspaceOnboardingRole,
  type WorkspaceOnboardingTone,
} from "@/context/workspace-onboarding-context";
import { StepCanvas, StepHeader, StepFooter, FieldLabel, FieldError } from "../_components/step-shell";
import { ONBOARDING_WORKSPACE_ROUTE, ONBOARDING_JOIN_ROUTE, ONBOARDING_INVITE_ROUTE } from "@/lib/routes";

// ── A1 screen 3 / A2 screen 2 — "Create your profile" ────────────────────────
// Figma: node 11:459 (default state), 55:2680 (empty/required-field error
// state — First/Last name labels + message go red, same "This field can not
// be empty" pattern as the workspace step). Role has no asterisk in the
// design — it renders as a dropdown trigger but the field itself is optional.

const ROLES: WorkspaceOnboardingRole[] = [
  "Founder",
  "Marketer",
  "Designer",
  "Engineer",
  "Operator",
  "Student / Researcher",
];

// Reinstated from the previous flow's onboarding/tone/page.tsx (dropped from
// the v1.5 spec's screen list, then explicitly added back here per product
// request 2026-08-29) — same 3 values and copy, just a dropdown instead of a
// full illustrated-card step so it fits alongside Role rather than being its
// own screen. updateOnboarding() already maps these labels to the backend's
// real tone enum (see TONE_API_MAP in lib/api/user.ts).
const TONES: { value: WorkspaceOnboardingTone; subtitle: string }[] = [
  { value: "Direct", subtitle: "Skip the preamble. Just the answer." },
  { value: "Balanced", subtitle: "Friendly but efficient. The default." },
  { value: "Warm", subtitle: "Conversational, with context and reasoning." },
];

function TextField({
  label,
  required,
  placeholder,
  value,
  onChange,
  onBlur,
  error,
}: {
  label: string;
  required?: boolean;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
      <FieldLabel error={error}>
        {label}
        {required ? "*" : ""}
      </FieldLabel>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          padding: "7px 10px",
          borderRadius: 10,
          backgroundColor: "var(--neutral-white,#fff)",
          boxSizing: "border-box",
          boxShadow: error
            ? "0px 0px 0px 1px var(--red-600,#c62b29)"
            : "0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100,#ede1d7)",
        }}
      >
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          style={{
            width: "100%",
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
      </div>
      {error && <FieldError>This field can not be empty</FieldError>}
    </div>
  );
}

// ── Role select (same Dropdown/DropdownFloat pattern as onboarding/hello) ────
function RoleSelect({
  value,
  onChange,
}: {
  value: WorkspaceOnboardingRole | null;
  onChange: (v: WorkspaceOnboardingRole) => void;
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

// ── Tone select (same Dropdown/DropdownFloat pattern as RoleSelect above) ────
function ToneSelect({
  value,
  onChange,
}: {
  value: WorkspaceOnboardingTone | null;
  onChange: (v: WorkspaceOnboardingTone) => void;
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
            {value ?? "Balanced"}
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
        {TONES.map((tone) => (
          <Dropdown.Item
            key={tone.value}
            fluid
            label={tone.value}
            subLabel={tone.subtitle}
            selected={tone.value === value}
            onClick={() => {
              onChange(tone.value);
              setOpen(false);
            }}
          />
        ))}
      </Dropdown>
    </DropdownFloat>
  );
}

export default function OnboardingProfilePage() {
  const { push } = useRouter();
  const { data, setFirstName, setLastName, setRole, setTone } = useWorkspaceOnboarding();
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const trimmedFirst = data.firstName.trim();
  const trimmedLast = data.lastName.trim();
  const firstError = touched && trimmedFirst.length === 0;
  const lastError = touched && trimmedLast.length === 0;

  const handleNext = async () => {
    setTouched(true);
    if (trimmedFirst.length === 0 || trimmedLast.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const tasks: Promise<unknown>[] = [
        updateUser({ first_name: trimmedFirst, last_name: trimmedLast }),
      ];
      if (data.role || data.tone) {
        tasks.push(updateOnboarding({
          ...(data.role ? { user_role: data.role } : {}),
          ...(data.tone ? { ai_tone: data.tone } : {}),
        }));
      }
      await Promise.all(tasks);
    } catch (err) {
      // Non-fatal, same tolerance as the workspace step — profile details can
      // be edited later in settings.
      console.error("Profile setup failed", err);
      toast.error("We couldn't save your profile — you can update it later in settings.");
    } finally {
      setSubmitting(false);
    }
    push(ONBOARDING_INVITE_ROUTE);
  };

  return (
    <StepCanvas>
      <StepHeader total={3} activeIndex={1} title="Create your profile" />

      <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%", padding: "24px 0 0" }}>
        <div style={{ display: "flex", gap: 20 }}>
          <TextField
            label="First name"
            required
            placeholder="John"
            value={data.firstName}
            onChange={setFirstName}
            onBlur={() => setTouched(true)}
            error={firstError}
          />
          <TextField
            label="Last name"
            required
            placeholder="Doe"
            value={data.lastName}
            onChange={setLastName}
            onBlur={() => setTouched(true)}
            error={lastError}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <FieldLabel>Role</FieldLabel>
          <RoleSelect value={data.role} onChange={setRole} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <FieldLabel>How should your AI sound?</FieldLabel>
          <ToneSelect value={data.tone} onChange={setTone} />
        </div>
      </div>

      <StepFooter
        onBack={() => push(data.entryFlow === "join" ? ONBOARDING_JOIN_ROUTE : ONBOARDING_WORKSPACE_ROUTE)}
        onNext={() => void handleNext()}
        nextDisabled={trimmedFirst.length === 0 || trimmedLast.length === 0}
        nextLoading={submitting}
      />
    </StepCanvas>
  );
}
