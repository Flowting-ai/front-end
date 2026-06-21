"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/auth-context";
import { useTeamInviteOnboarding } from "@/context/team-invite-onboarding-context";
import {
  InviteCanvas,
  InviteCard,
  InviteStateScreen,
  OrgHeader,
  CardTitle,
  CardSubtitle,
  TeamRow,
  ProjectList,
  inviteRoleLabel,
} from "./_components/invite-ui";

// ── Screen 1 — "You're invited to {team}" ───────────────────────────────────────
// First step after the invitee logs in. Overview of what they're joining, bound
// to the rich invite payload. "Accept invite" advances through the flow; the
// membership is committed once, on the final confirm screen.

export default function TeamInviteWelcomePage() {
  const { push } = useRouter();
  const { user } = useAuth();
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

  const firstName = user?.firstName?.trim() || user?.name?.split(" ")[0]?.trim() || "there";
  const target = invite.teamName || invite.projectName || invite.organizationName || "the team";

  return (
    <InviteCanvas>
      <InviteCard>
        <OrgHeader invite={invite} />

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CardTitle>You&apos;re invited to {target}</CardTitle>
          <CardSubtitle>
            Hi {firstName}, {invite.invitedByName || "your teammate"} invited you to join{" "}
            <strong style={{ fontWeight: 600, color: "var(--neutral-800,#3b3632)" }}>{target}</strong>{" "}
            as a {inviteRoleLabel(invite)}.
          </CardSubtitle>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <TeamRow invite={invite} />
          <ProjectList projects={invite.projects} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button size="md" onClick={() => push(`/onboarding/team/${invite.inviteId}/join`)}>
            Accept invite
          </Button>
        </div>
      </InviteCard>
    </InviteCanvas>
  );
}
