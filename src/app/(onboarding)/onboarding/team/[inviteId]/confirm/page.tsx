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
  CardTitle,
  CardSubtitle,
  InviteScope,
  inviteRoleLabel,
  inviteTargetName,
} from "../_components/invite-ui";
import { CHAT_ROUTE } from "@/lib/routes";

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
        onHome={() => push(CHAT_ROUTE)}
      />
    );
  }

  const roleLabel = inviteRoleLabel(invite);
  const adminName = invite.invitedByName || invite.invitedByEmail || "your admin";

  // What the invitee is joining + the roster shown are scoped to the backend
  // role (admin → org, member → project), shared across screens.
  const target = inviteTargetName(invite);

  const handleEnter = () => {
    // Membership + onboarding were already committed on screen 1; just enter.
    toast.success(`You've joined ${target}`);
    push(`${CHAT_ROUTE}?joined=${encodeURIComponent(target)}`);
  };

  return (
    <InviteCanvas>
      <InviteCard>
        <OrgHeader invite={invite} />

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CardTitle>You&apos;re joining {target}</CardTitle>
          <CardSubtitle>{target} welcomes you - know these before you dive in.</CardSubtitle>
        </div>

        {/* Role-scoped context: org roster for admins, org roster +
            project list for members. */}
        <InviteScope invite={invite} />

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <InfoSection
            title={`Admin: ${adminName}`}
            body="You can request credits, connectors, or any project-level changes from your admin."
          />
          <InfoSection
            title="Shared: projects, agents, connectors"
            body="These surfaces are shared and you'll have your personal space too."
          />
          <InfoSection
            title={`As ${roleLabel === "admin" ? "an" : "a"} ${capitalize(roleLabel)}: chat, run Brain, create your own agents`}
            body="You can share useful content with your organization. Reusable resources everyone benefits from."
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
