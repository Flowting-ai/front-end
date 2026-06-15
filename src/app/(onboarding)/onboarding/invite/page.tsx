"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useOnboarding, deriveRoleFit } from "@/context/onboarding-context";
import { Button } from "@/components/Button";
import { updateOnboarding, updateUser } from "@/lib/api/user";
import { createOrganization } from "@/lib/api/organization";
import { apiFetch } from "@/lib/api/client";
import { MEMORY_USER_ENDPOINT } from "@/lib/config";
import { Dropdown, DropdownFloat } from "@/components/Dropdown";
import { OnboardingScreen } from "../_components/onboarding-shell";

const INVITE_ROLES = ["Member", "Admin", "Owner"] as const;
type InviteRole = (typeof INVITE_ROLES)[number];

export default function OnboardingInvitePage() {
  const { push } = useRouter();
  const { refreshUser, logout } = useAuth();
  const { data } = useOnboarding();
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState<InviteRole>("Member");
  const [roleOpen, setRoleOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const submitOnboarding = async () => {
    setLoading(true);
    try {
      // Create the team's organization so the backend stamps org_id on the
      // profile — that unlocks the Organization settings (members / teams /
      // plans). Best-effort: a failure must NOT block onboarding completion.
      if (data.companyName.trim().length > 0) {
        try {
          await createOrganization({
            name: data.companyName.trim(),
            tags: data.companySize ? [data.companySize] : [],
          });
        } catch (orgErr) {
          console.error("Organization creation failed", orgErr);
        }
      }

      await Promise.all([
        updateUser({ first_name: data.firstName, last_name: data.lastName }),
        updateOnboarding({
          user_role: data.role ?? null,
          role_fit: deriveRoleFit(data.accountType, data.companySize),
        }),
      ]);

      // Persist "Other" role detail as a user memory.
      if (data.role === "Other" && data.roleOther.trim().length > 0) {
        void apiFetch(MEMORY_USER_ENDPOINT, {
          method: "POST",
          body: JSON.stringify({ content: `My role: ${data.roleOther.trim()}` }),
        });
      }

      await refreshUser();
      push('/onboarding/plans');
    } catch (err) {
      console.error("Team onboarding submission failed", err);
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        gap: 16,
      }}
    >
      {/* Left: role info link */}
      <button
        type="button"
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: "var(--font-body)",
          fontWeight: 600,
          fontSize: 14,
          lineHeight: "22px",
          color: "var(--neutral-700, #524b47)",
        }}
        onClick={() => { /* placeholder: open role info */ }}
      >
        Know more about Role
      </button>

      {/* Right: logout + skip + continue */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={() => void logout()}
          style={{ background: "none", border: "none", padding: "4px 0", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 14, color: "#0d6eb2", textDecoration: "underline" }}
        >
          Log out
        </button>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void submitOnboarding()}
        >
          Skip for now
        </Button>
        <Button
          size="sm"
          loading={loading}
          onClick={() => void submitOnboarding()}
        >
          Continue
        </Button>
      </div>
    </div>
  );

  return (
    <OnboardingScreen
      title="Invite your team."
      subtitle="Add your teammates so they can collaborate from day one."
      width={653}
      footer={footer}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Email label */}
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 500,
            fontSize: 14,
            lineHeight: "22px",
            color: "#0a0a0a",
            letterSpacing: "0.07px",
            margin: 0,
          }}
        >
          Email addresses (comma or newline separated):
        </p>

        {/* Email textarea */}
        <div
          style={{
            backgroundColor: "white",
            border: "1px solid #e5e5e5",
            borderRadius: "18px",
            padding: "12px",
            boxShadow: "0px 1px 1px rgba(0,0,0,0.05)",
          }}
        >
          <textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="Email addresses, comma or newline separated"
            rows={5}
            style={{
              width: "100%",
              border: "none",
              // eslint-disable-next-line react-doctor/no-outline-none -- global :focus-visible handles outline
              outline: "none",
              resize: "vertical",
              fontFamily: "var(--font-body)",
              fontWeight: 400,
              fontSize: 14,
              lineHeight: "22px",
              color: "#1e1e1e",
              backgroundColor: "transparent",
              padding: 0,
            }}
          />
        </div>

        {/* Role selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 400,
              fontSize: 14,
              lineHeight: "22px",
              color: "var(--neutral-700, #524b47)",
              margin: 0,
            }}
          >
            Role
          </p>

          <DropdownFloat
            open={roleOpen}
            onOpenChange={setRoleOpen}
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
                  padding: "7px 10px",
                  borderRadius: 10,
                  border: "none",
                  backgroundColor: "white",
                  boxShadow:
                    "0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100, #ede1d7)",
                  cursor: "pointer",
                  outline: "none",
                  width: "100%",
                  maxWidth: 300,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontWeight: 400,
                    fontSize: 14,
                    lineHeight: "22px",
                    color: "var(--neutral-600, #6a625d)",
                  }}
                >
                  {role === "Member" ? "Member (default)" : role}
                </span>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path
                    d="M5 8l5 5 5-5"
                    stroke="var(--neutral-400, #9c938b)"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            }
          >
            <Dropdown style={{ width: 300 }}>
              {INVITE_ROLES.map((r) => (
                <Dropdown.Item
                  key={r}
                  fluid
                  label={r}
                  selected={r === role}
                  onClick={() => {
                    setRole(r);
                    setRoleOpen(false);
                  }}
                />
              ))}
            </Dropdown>
          </DropdownFloat>

          <p
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 400,
              fontSize: 14,
              lineHeight: "22px",
              color: "var(--neutral-700, #524b47)",
              margin: 0,
            }}
          >
            Can use and create privately in conversations.{" "}
            <button
              type="button"
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                fontSize: 14,
                color: "var(--neutral-700, #524b47)",
              }}
              onClick={() => { /* placeholder: open role info */ }}
            >
              Know more about Role
            </button>
          </p>
        </div>
      </div>
    </OnboardingScreen>
  );
}
