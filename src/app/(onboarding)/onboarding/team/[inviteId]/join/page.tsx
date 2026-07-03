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
  InviteScope,
  InvitedBy,
  inviteTargetName,
} from "../_components/invite-ui";
import { CHAT_ROUTE, ONBOARDING_TEAM_PROFILE_ROUTE } from "@/lib/routes";

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
        onHome={() => push(CHAT_ROUTE)}
      />
    );
  }

  const target = inviteTargetName(invite);

  return (
    <InviteCanvas>
      <InviteCard>
        <OrgHeader invite={invite} />

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CardTitle>Join {target}</CardTitle>
          <CardSubtitle>Quick setup, then you&apos;re in.</CardSubtitle>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <InviteScope invite={invite} />
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <InvitedBy invite={invite} />
          <Button size="md" onClick={() => push(ONBOARDING_TEAM_PROFILE_ROUTE(params.inviteId))}>
            Continue
          </Button>
        </div>
      </InviteCard>
    </InviteCanvas>
  );
}
