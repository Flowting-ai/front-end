"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/auth-context";
import { useTeamInviteOnboarding } from "@/context/team-invite-onboarding-context";
import { ApiError } from "@/lib/api/client";
import { acceptTeamInvite } from "@/lib/api/teams";
import { updateOnboarding } from "@/lib/api/user";
import {
  InviteCanvas,
  InviteCard,
  InviteStateScreen,
  OrgHeader,
  CardTitle,
  CardSubtitle,
  TeamRow,
  inviteRoleLabel,
} from "../_components/invite-ui";

// ── Screen 4 — "You're joining {team}" (confirmation) ───────────────────────────
// Final step. "Enter Workspace" commits the membership (POST /team-invite/{id}/
// accept), marks onboarding complete so the app gate lets the invitee in, then
// lands them on the first-time joined chat screen.

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
  const { refreshUser } = useAuth();
  const { status, invite, errorMsg, refetch } = useTeamInviteOnboarding();
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

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
  const roleLabel = inviteRoleLabel(invite);
  const adminName = invite.invitedByName || invite.invitedByEmail || "your admin";

  const handleEnter = async () => {
    if (submitting || accepted) return;
    setSubmitting(true);
    try {
      // 1) Commit membership. 2) Mark onboarding complete so OnboardingGuard /
      // proxy let the invitee into the app. 3) Refresh so auth-context picks up
      // the new org + completion before we navigate.
      await acceptTeamInvite(invite.inviteId);
      await updateOnboarding({ onboarding_completed: true });
      await refreshUser();
      setAccepted(true);
      toast.success(`You've joined ${target}`);
      push(`/chat?joined=${encodeURIComponent(target)}`);
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError && err.status === 410) {
        toast.error("This invite has expired.");
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Couldn't join the team. Please try again.");
    }
  };

  return (
    <InviteCanvas>
      <InviteCard>
        <OrgHeader invite={invite} />

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CardTitle>You&apos;re joining {target}</CardTitle>
          <CardSubtitle>Team-welcome primer — what to know before you dive in.</CardSubtitle>
        </div>

        <TeamRow invite={invite} />

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <InfoSection
            title={`Credits assigned to you${invite.creditCap > 0 ? ` — ${invite.creditCap.toLocaleString()}` : ""}`}
            body="These credits are assigned to you. You can always request more credits when you run out of them."
          />
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
          <Button size="md" loading={submitting} disabled={submitting} onClick={() => void handleEnter()}>
            Enter Workspace
          </Button>
        </div>
      </InviteCard>
    </InviteCanvas>
  );
}
