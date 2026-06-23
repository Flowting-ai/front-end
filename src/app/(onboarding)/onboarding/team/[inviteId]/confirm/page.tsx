"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/Button";
import { useTeamInviteOnboarding } from "@/context/team-invite-onboarding-context";
import {
  InviteCanvas,
  InviteCard,
  InviteStateScreen,
  OrgHeader,
  OrgRow,
  CardTitle,
  CardSubtitle,
  TeamRow,
  ProjectList,
  inviteRoleLabel,
} from "../_components/invite-ui";

// ── Screen 4 — "You're joining {team}" (confirmation) ───────────────────────────
// Final orientation step. Membership + onboarding were already committed on
// screen 1 ("Accept invite"), so "Enter Workspace" simply lands the now-member on
// the first-time joined chat screen.

function InfoSection({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: 600,
          fontSize: 15,
          lineHeight: "22px",
          color: "var(--neutral-900,#26211e)",
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: 400,
          fontSize: 13,
          lineHeight: "19px",
          color: "var(--neutral-500,#827a74)",
        }}
      >
        {body}
      </span>
    </div>
  );
}

function capitalize(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

export default function TeamInviteConfirmPage() {
  const { push } = useRouter();
  const { status, invite, errorMsg, refetch } = useTeamInviteOnboarding();

  if (status !== "ready" || !invite) {
    return (
      <InviteStateScreen
        status={status === "ready" ? "loading" : status}
        errorMsg={errorMsg}
        onRetry={refetch}
        onHome={() => push("/chat")}
      />
    );
  }

  const roleLabel = inviteRoleLabel(invite);
  const adminName = invite.invitedByName || invite.invitedByEmail || "your admin";

  // What the invitee is joining is scoped to their role:
  //  • admin / owner  → the organization (they get org-wide context)
  //  • editor         → the team (team roster + projects)
  //  • member / viewer → the team, project-first (the projects they'll work in)
  const isOrgRole = roleLabel === "admin" || roleLabel === "owner";
  const target = isOrgRole
    ? invite.organizationName || invite.teamName || "the organization"
    : invite.teamName || invite.projectName || invite.organizationName || "the team";

  const handleEnter = () => {
    // Membership + onboarding were already committed on screen 1; just enter.
    toast.success(`You've joined ${target}`);
    push(`/chat?joined=${encodeURIComponent(target)}`);
  };

  return (
    <InviteCanvas>
      <InviteCard>
        <OrgHeader invite={invite} />

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CardTitle>You&apos;re joining {target}</CardTitle>
          <CardSubtitle>{target} welcomes you - know these before you dive in.</CardSubtitle>
        </div>

        {/* Role-scoped context: org roster for admins, team roster for editors,
            the project list for members/viewers. */}
        {isOrgRole ? (
          <OrgRow invite={invite} />
        ) : roleLabel === "editor" ? (
          <TeamRow invite={invite} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <TeamRow invite={invite} />
            <ProjectList projects={invite.projects} />
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {invite.creditCap != null && (
            <InfoSection
              title={`Credits assigned to you${invite.creditCap > 0 ? ` — ${invite.creditCap.toLocaleString()}` : ""}`}
              body="These credits are assigned to you. You can always request more credits when you run out of them."
            />
          )}
          <InfoSection
            title={`Admin: ${adminName}`}
            body="You can request credits, connectors, or any project-level changes from your admin."
          />
          <InfoSection
            title="Shared: projects, personas, connectors"
            body="These surfaces are shared and you'll have your personal space too."
          />
          <InfoSection
            title={`As ${roleLabel === "admin" || roleLabel === "owner" ? "an" : "a"} ${capitalize(roleLabel)}: chat, run Brain, create your own agent`}
            body="You can share useful content with the team. Reusable resources with the team."
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button size="md" onClick={handleEnter}>
            Enter Workspace
          </Button>
        </div>
      </InviteCard>
    </InviteCanvas>
  );
}
