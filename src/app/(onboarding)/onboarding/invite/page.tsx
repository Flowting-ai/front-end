"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useOnboarding, deriveRoleFit } from "@/context/onboarding-context";
import { Button } from "@/components/Button";
import { updateOnboarding, updateUser } from "@/lib/api/user";
import { fetchTeams, inviteTeamMembers, createTeam } from "@/lib/api/teams";
import { listOrganizations } from "@/lib/api/organization";
import type { WorkspaceRole } from "@/types/teams";
import { apiFetch } from "@/lib/api/client";
import { MEMORY_USER_ENDPOINT } from "@/lib/config";
import { Dropdown, DropdownFloat } from "@/components/Dropdown";
import { OnboardingScreen } from "../_components/onboarding-shell";
import { toast } from "sonner";

const INVITE_ROLES = ["Member", "Admin"] as const;
type InviteRole = (typeof INVITE_ROLES)[number];

export default function OnboardingInvitePage() {
  const { logout, user } = useAuth();
  const { data } = useOnboarding();
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState<InviteRole>("Member");
  const [roleOpen, setRoleOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const submitOnboarding = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Send invites best-effort — failure must never block onboarding completion.
      // Org creation is handled in pricing/confirmation — always before this page.
      const parsedEmails = emails.split(/[\n,]+/).map(e => e.trim()).filter(Boolean)
      if (parsedEmails.length > 0) {
        try {
          // user.orgId is often absent from /users/me — fall back to listOrganizations.
          let resolvedOrgId = user?.orgId ?? null
          if (!resolvedOrgId) {
            const orgs = await listOrganizations()
            resolvedOrgId = orgs[0]?.id ?? null
          }
          if (resolvedOrgId) {
            // Get the default team; create one if the org has none yet.
            let teams = await fetchTeams(resolvedOrgId)
            if (teams.length === 0) {
              const newTeam = await createTeam(resolvedOrgId, 'General')
              teams = [newTeam]
            }
            const mappedRole: WorkspaceRole = role === 'Admin' ? 'admin' : 'member'
            await inviteTeamMembers(resolvedOrgId, teams[0].id, parsedEmails, mappedRole)
            toast.success(
              parsedEmails.length === 1
                ? "Invite sent"
                : `${parsedEmails.length} invites sent`,
            )
          }
        } catch (inviteErr) {
          console.error('Team invite failed', inviteErr)
          toast.error("Couldn't send invites — you can add members later in Org → Members.")
        }
      }

      // Update the name only when we still have it. The onboarding context is
      // plain in-memory state, and the team flow's full-page redirect to Stripe
      // (between /plans and /confirmation) remounts the provider and wipes it —
      // so by this step data.firstName/lastName are usually "". Sending those
      // blanks would clobber the real name already saved at the hello step. This
      // write is best-effort and must never block completion, so don't await it.
      const namePayload: { first_name?: string; last_name?: string } = {};
      if (data.firstName.trim()) namePayload.first_name = data.firstName.trim();
      if (data.lastName.trim())  namePayload.last_name  = data.lastName.trim();
      if (Object.keys(namePayload).length > 0) void updateUser(namePayload);

      // Persisting completion is the ONLY call that gates entry to the app — the
      // (app) OnboardingGuard and the server proxy both require it. Await just
      // this one and verify it actually persisted; everything else is best-effort.
      const result = await updateOnboarding({
        user_role: data.role ?? null,
        role_fit: deriveRoleFit(data.accountType, data.companySize),
        onboarding_completed: true,
      });

      if (!result?.completed) {
        // Completion didn't persist — navigating now would just bounce off the
        // onboarding guard. Surface the failure instead of leaving the user stuck.
        toast.error("Couldn't finish setup. Please try again.");
        return;
      }

      // Persist "Other" role detail as a user memory (fire-and-forget).
      if (data.role === "Other" && data.roleOther.trim().length > 0) {
        void apiFetch(MEMORY_USER_ENDPOINT, {
          method: "POST",
          body: JSON.stringify({ content: `My role: ${data.roleOther.trim()}` }),
        });
      }

      // Land on /welcome with a FULL-PAGE navigation, not router.push. A soft
      // client transition here gets aborted: the setLoading(false) in `finally`
      // is an urgent update that interrupts the in-flight push, so the URL never
      // commits — the /welcome RSC is fetched but discarded and the user is left
      // on /onboarding/invite. A hard navigation can't be interrupted, re-hydrates
      // auth from the now-persisted onboarding state, and is gated cleanly by the
      // proxy (which already allows /welcome once onboarding_completed=true).
      // Prefer the persisted profile name (the onboarding context is wiped by the
      // team flow's full-page redirect to Stripe).
      const ownerName = (user?.firstName ?? data.firstName).trim();
      const ownerParam = ownerName ? `owner=${encodeURIComponent(ownerName)}` : '';
      const nameParam  = data.companyName.trim() ? `name=${encodeURIComponent(data.companyName.trim())}` : '';
      const connParam  = `connectors=${data.connectorCount ?? 0}`;
      const query      = [ownerParam, nameParam, connParam].filter(Boolean).join('&');
      window.location.href = `/welcome${query ? `?${query}` : ''}`;
    } catch (err) {
      console.error("Team onboarding submission failed", err);
      toast.error("Something went wrong. Please try again.");
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
        <Button variant="default" size="sm" onClick={() => void logout()} leftIcon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M13 3v10M6.5 10.5 3.5 8l3-2.5M3.5 8H11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}>
          Log out
        </Button>
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
          Email addresses :
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
            placeholder="Enter email addresses of your teammates (separated by commas)"
            rows={5}
            style={{
              width: "100%",
              border: "none",
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
