"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/Button";
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
  InvitedBy,
} from "../_components/invite-ui";

// ── Screen 2 — "Join {team}" ────────────────────────────────────────────────────
// Focused join card: quick-setup framing, the inviter, and the projects. Advances
// to the profile step; membership is still committed only on the confirm screen.

export default function TeamInviteJoinPage() {
  const { push } = useRouter();
  const params = useParams<{ inviteId: string }>();
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

  const target = invite.teamName || invite.projectName || invite.organizationName || "the team";

  return (
    <InviteCanvas>
      <InviteCard>
        <OrgHeader invite={invite} />

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CardTitle>Join {target}</CardTitle>
          <CardSubtitle>Quick setup, then you&apos;re in.</CardSubtitle>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <TeamRow invite={invite} />
          <ProjectList projects={invite.projects} />
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <InvitedBy invite={invite} />
          <Button size="md" onClick={() => push(`/onboarding/team/${params.inviteId}/profile`)}>
            Continue
          </Button>
        </div>
      </InviteCard>
    </InviteCanvas>
  );
}
