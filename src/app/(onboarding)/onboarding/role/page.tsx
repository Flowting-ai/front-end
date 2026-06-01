"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/context/onboarding-context";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/Button";
import type { OnboardingRole } from "@/context/onboarding-context";
import { InputField } from "@/components/InputField";
import { updateOnboarding } from "@/lib/api/user";

// Persona avatar placeholder colors per role
const ROLE_COLORS: Record<OnboardingRole, string> = {
  Founder: "#c8b89a",
  Marketer: "#b8a88e",
  Designer: "#a89880",
  Engineer: "#988870",
  Operator: "#887860",
  "Student / Researcher": "#786850",
  Other: "#cfbeac",
};

const ROLES: Array<{ id: OnboardingRole; subtitle: string }> = [
  { id: "Founder", subtitle: "Strategy, fundraising, ops." },
  { id: "Marketer", subtitle: "Campaigns, copy, brand." },
  { id: "Designer", subtitle: "Visual, product, research." },
  { id: "Engineer", subtitle: "Code, infra, debugging." },
  { id: "Operator", subtitle: "Process, hiring, finance." },
  { id: "Student / Researcher", subtitle: "Research, writing, study." },
];

function RoleCard({
  role,
  subtitle,
  selected,
  onSelect,
}: {
  role: OnboardingRole;
  subtitle: string;
  selected: boolean;
  onSelect: () => void;
}) {
  // eslint-disable-next-line react-doctor/rerender-state-only-in-handlers -- hovered feeds isActive which is used in render
  const [hovered, setHovered] = useState(false);
  const isActive = selected || hovered;

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
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
        flex: "1 1 0",
        minWidth: 0,
        transition: "box-shadow 120ms",
        outline: "none",
      }}
    >
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
        {/* Avatar placeholder */}
        <div
          style={{
            width: 65,
            height: 65,
            borderRadius: "8px",
            backgroundColor: ROLE_COLORS[role],
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
              fontSize: "22px",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {role[0]}
          </span>
        </div>

        {/* Text */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", justifyContent: "center" }}>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 400,
              fontSize: "16px",
              lineHeight: "22px",
              color: "var(--neutral-900, #26211e)",
              margin: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {role}
          </p>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 400,
              fontSize: "14px",
              lineHeight: "22px",
              color: "#857a72",
              margin: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {subtitle}
          </p>
        </div>
      </div>
    </button>
  );
}

export default function OnboardingRolePage() {
  const { push } = useRouter();
  const { data, setRole, setRoleOther } = useOnboarding();
  const { logout } = useAuth();
  const canContinue = data.role !== null && (data.role !== "Other" || data.roleOther.trim().length > 0);

  const handleContinue = () => {
    if (!canContinue) return;
    // Persist role selection to backend as user progresses — fire and forget.
    // updateOnboarding maps the display name to the backend enum. The "Other"
    // free-text detail (data.roleOther) is session-only — there is no backend
    // field for it, and role_fit is a separate team-size enum, not free text.
    void updateOnboarding({ user_role: data.role! });
    push("/onboarding/tone");
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
        maxWidth: "860px",
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
          What do you do?
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
          This tunes routing and picks smart defaults. You can change everything later.
        </p>
      </div>

      {/* Role grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
        {/* Row 1 */}
        <div style={{ display: "flex", gap: "16px" }}>
          {ROLES.slice(0, 3).map((r) => (
            <RoleCard
              key={r.id}
              role={r.id}
              subtitle={r.subtitle}
              selected={data.role === r.id}
              onSelect={() => setRole(r.id)}
            />
          ))}
        </div>
        {/* Row 2 */}
        <div style={{ display: "flex", gap: "16px" }}>
          {ROLES.slice(3, 6).map((r) => (
            <RoleCard
              key={r.id}
              role={r.id}
              subtitle={r.subtitle}
              selected={data.role === r.id}
              onSelect={() => setRole(r.id)}
            />
          ))}
        </div>

        {/* Other - full width card with input */}
        <button
          type="button"
          onClick={() => setRole("Other")}
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            padding: "12px",
            borderRadius: "16px",
            backgroundColor: "white",
            boxShadow:
              data.role === "Other"
                ? "0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 2px #26211e"
                : "0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px #ede1d7",
            cursor: "pointer",
            border: "none",
            textAlign: "left",
            width: "100%",
            outline: "none",
            transition: "box-shadow 120ms",
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 65,
              height: 65,
              borderRadius: "8px",
              backgroundColor: ROLE_COLORS["Other"],
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
                fontSize: "22px",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              ?
            </span>
          </div>

          {/* Text */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 500,
                fontSize: "16px",
                lineHeight: "22px",
                color: "var(--neutral-900, #26211e)",
                margin: 0,
              }}
            >
              Other
            </p>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 400,
                fontSize: "14px",
                lineHeight: "22px",
                color: "#857a72",
                margin: 0,
              }}
            >
              {`Tell us in one line - we'll route accordingly.`}
            </p>
          </div>

          {/* Input - shown when Other is selected */}
          {data.role === "Other" && (
            // eslint-disable-next-line click-events-have-key-events, no-static-element-interactions -- interactive div; keyboard handling delegated to inner elements
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: 327, flexShrink: 0 }}
            >
              <InputField
                placeholder="e.g. Product manager at a B2B SaaS"
                value={data.roleOther}
                onChange={setRoleOther}
                fluid
              />
            </div>
          )}
        </button>
      </div>

      {/* Nav buttons */}
      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        <Button variant="secondary" size="sm" onClick={() => push("/onboarding/welcome")}>
          Back
        </Button>
        {/* eslint-disable-next-line react-doctor/design-no-vague-button-label -- onboarding wizard: "Continue" advances to tone step; flow context makes action clear */}
        <Button size="sm" disabled={!canContinue} onClick={handleContinue}>
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
