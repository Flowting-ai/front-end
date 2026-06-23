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
  InviteScope,
  inviteRoleLabel,
  inviteTargetName,
} from "./_components/invite-ui";

// ── Screen 1 — "You're invited to {team}" ───────────────────────────────────────
// First step after the invitee logs in. Overview of what they're joining, bound
// to the rich invite payload. "Accept invite" commits membership AND completes
// onboarding atomically (POST /team-invite/{id}/accept + onboarding_completed),
// so the invitee is a full member with app access the instant they accept. The
// rest of the flow (join → profile → confirm) is optional orientation — if they
// close at any point, they simply land in /chat as a member on next visit.

export default function TeamInviteWelcomePage() {
  const { push } = useRouter();
  const { user, refreshUser } = useAuth();
  const { status, invite, errorMsg, refetch } = useTeamInviteOnboarding();
  const [submitting, setSubmitting] = useState(false);

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
  const target = inviteTargetName(invite);

  const handleAccept = async () => {
    if (submitting) return;
    setSubmitting(true);
    // Capture onboarding state BEFORE mutations — already-onboarded users skip
    // the new-user join flow and land on the profile page instead (which
    // auto-skips to /chat if all profile fields are already populated).
    const wasAlreadyOnboarded = user?.onboardingCompleted === true;
    try {
      await acceptTeamInvite(invite.inviteId);
      await updateOnboarding({ onboarding_completed: true });
      await refreshUser();
      if (wasAlreadyOnboarded) {
        push(`/onboarding/team/${invite.teamId}/profile`);
      } else {
        push(`/onboarding/team/${invite.inviteId}/join`);
      }
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError && err.status === 410) {
        toast.error("This invite has expired.");
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Couldn't accept the invite. Please try again.");
    }
  };

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
          <InviteScope invite={invite} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button size="md" loading={submitting} disabled={submitting} onClick={() => void handleAccept()}>
            Accept invite
          </Button>
        </div>
      </InviteCard>
    </InviteCanvas>
  );
}
