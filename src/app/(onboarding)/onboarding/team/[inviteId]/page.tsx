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
import type { InvitedMember, TeamInviteOnboarding } from "@/types/teams";
import { StepCanvas, StepHeader, StepFooter } from "../../_components/step-shell";
import { InviteStateScreen } from "./_components/invite-ui";
import { CHAT_ROUTE, ONBOARDING_TEAM_PROFILE_ROUTE, WELCOME_ROUTE } from "@/lib/routes";

// ── Screen 1 — "Join a workspace" ────────────────────────────────────────────
// Figma: node 66:4387 ("Setup your team"). Two-screen A2 flow: this screen
// (accept) → profile (brand-new users only) → the shared A1/A2 Slack-modal
// landing at `${WELCOME_ROUTE}?slack=1`. Replaces the old 4-screen flow
// (invite → join → profile → confirm) — the "join" pass-through never made
// an API call and added nothing but a click, and "confirm" duplicated the
// Slack-modal landing (add-to-slack-modal.tsx) with its own bespoke
// /chat?joined= treatment instead of reusing it, which this restructuring
// corrects.
//
// The workspace card's "Join" button commits membership AND completes
// onboarding atomically (POST /org-invite/{id}/accept + onboarding_completed
// PATCH) — same contract as the old "Accept invite" button.

const AVATAR_SIZE = 24;
const AVATAR_STACK_MAX = 3;

function MemberAvatar({ member }: { member: InvitedMember }) {
  const initials = member.initials || (member.name || member.email || "?").trim()[0]?.toUpperCase() || "?";
  const common: React.CSSProperties = {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: "50%",
    flexShrink: 0,
    boxShadow: "0 0 0 2px #fff",
  };
  if (member.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external member avatar, arbitrary host
      <img src={member.image} alt={member.name || member.email} style={{ ...common, objectFit: "cover", display: "block" }} />
    );
  }
  return (
    <span
      aria-label={member.name || member.email}
      style={{
        ...common,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--neutral-400,#9c938b)",
        color: "#fff",
        fontFamily: "var(--font-body)",
        fontWeight: 500,
        fontSize: 10,
        lineHeight: 1,
      }}
    >
      {initials.slice(0, 2)}
    </span>
  );
}

// ── Workspace card — org name + member count + avatar stack + Join button ───
// Figma: node 66:4817 (the card inside 66:4387). Same for every invite
// regardless of the role it grants (admin/member) — the new design doesn't
// distinguish org-level vs project-level invites the way the old 4-screen
// flow's InviteScope did.
function WorkspaceJoinCard({
  invite,
  onJoin,
  joining,
}: {
  invite: TeamInviteOnboarding;
  onJoin: () => void;
  joining: boolean;
}) {
  const shown = invite.organizationMembers.slice(0, AVATAR_STACK_MAX);
  const overflow = invite.organizationMemberCount - shown.length;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        padding: 16,
        borderRadius: 12,
        backgroundColor: "var(--neutral-white,#fff)",
        boxSizing: "border-box",
        boxShadow: "0px 0px 0px 1px var(--blue-600,#0d6eb2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            fontSize: 20,
            lineHeight: "normal",
            color: "var(--neutral-700,#524b47)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {invite.organizationName || "Workspace"}
        </p>
        <p
          style={{
            margin: 0,
            flexShrink: 0,
            fontFamily: "var(--font-body)",
            fontWeight: 400,
            fontSize: 11,
            lineHeight: "12px",
            color: "var(--neutral-600,#6a625d)",
          }}
        >
          {invite.organizationMemberCount} member{invite.organizationMemberCount === 1 ? "" : "s"}
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {shown.map((member, i) => (
              <span key={member.userId || member.email || i} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                <MemberAvatar member={member} />
              </span>
            ))}
          </div>
          {overflow > 0 && (
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-body)",
                fontWeight: 400,
                fontSize: 11,
                lineHeight: "12px",
                color: "var(--neutral-600,#6a625d)",
              }}
            >
              +{overflow}
            </p>
          )}
        </div>
        <Button size="sm" loading={joining} disabled={joining} onClick={onJoin}>
          Join
        </Button>
      </div>
    </div>
  );
}

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
        onHome={() => push(CHAT_ROUTE)}
      />
    );
  }

  const handleJoin = async () => {
    if (submitting) return;
    setSubmitting(true);
    // Capture onboarding state BEFORE mutations — already-onboarded users skip
    // the new-user profile step and land straight on the Slack-modal landing.
    const wasAlreadyOnboarded = user?.onboardingCompleted === true;
    try {
      await acceptTeamInvite(invite.inviteId);
      await updateOnboarding({ onboarding_completed: true });
      await refreshUser();
      if (wasAlreadyOnboarded) {
        push(`${WELCOME_ROUTE}?slack=1`);
      } else {
        push(ONBOARDING_TEAM_PROFILE_ROUTE(invite.inviteId));
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
    <StepCanvas>
      <StepHeader total={2} activeIndex={0} title="Join a workspace" />
      <WorkspaceJoinCard invite={invite} onJoin={() => void handleJoin()} joining={submitting} />
      <StepFooter onBack={() => push(CHAT_ROUTE)} />
    </StepCanvas>
  );
}
