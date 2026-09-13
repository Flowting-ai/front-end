"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/auth-context";
import { useWorkspaceOnboarding } from "@/context/workspace-onboarding-context";
import { getTeamInviteOnboarding, acceptTeamInvite } from "@/lib/api/teams";
import type { InvitedMember, TeamInviteOnboarding } from "@/types/teams";
import { StepCanvas, StepHeader } from "../_components/step-shell";
import { ONBOARDING_PROFILE_ROUTE } from "@/lib/routes";

// ── A2 screen 1 — "Join a workspace" ─────────────────────────────────────────
// Figma: node 66:4387. The Figma export for this node has its text outlined to
// vector paths (no live `<text>` content), so exact copy came from the
// requester directly rather than from Figma: header "Join a Workspace", a
// workspace card showing "{Inviter Name}'s Workspace" / "{x} members" with a
// 3-avatar stack + a "Join" button, and a Back button — no separate page-level
// "Next" (the card's Join button is the primary action). Structural facts
// (dot state, card size/border colour, button shape) ARE confirmed from the
// raw SVG the requester sent: a 3-segment dot indicator with the *middle*
// segment active (unlike A1's workspace/profile screens, which show the
// first), and a 402x101 white card with a blue (#0D6EB2) border.
//
// PENDING CONFIRMATION (not guessed silently): there is no existing backend
// contract for "the workspace this email's domain matches" — the closest real
// contract is the team-invite flow's GET /team-invite/{id}, which happens to
// return exactly the fields this screen needs (organizationName,
// organizationMemberCount, organizationMembers, invitedByName). This page
// assumes an `inviteId` search param is present on arrival (e.g. the backend
// resolves a pending invite for the signed-up email and redirects here with
// it) and reuses that contract. If A2 is actually meant to work off email
// domain matching with no invite record at all, this needs a real endpoint
// and this assumption should be revisited.

function AvatarStack({ members, count }: { members: InvitedMember[]; count: number }) {
  const shown = members.slice(0, 3);
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {shown.map((m, i) => {
          const initials = m.initials || (m.name || m.email || "?").trim()[0]?.toUpperCase() || "?";
          return (
            <span
              key={m.userId || m.email || i}
              style={{
                marginLeft: i === 0 ? 0 : -8,
                width: 24,
                height: 24,
                borderRadius: "50%",
                flexShrink: 0,
                boxShadow: "0 0 0 2px #fff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                backgroundColor: "var(--neutral-400,#9c938b)",
              }}
            >
              {m.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- external member avatar, arbitrary host
                <img src={m.image} alt={m.name || m.email} width={24} height={24} style={{ objectFit: "cover", display: "block" }} />
              ) : (
                <span style={{ fontFamily: "var(--font-body)", fontWeight: 500, fontSize: 10, color: "#fff", lineHeight: 1 }}>
                  {initials.slice(0, 2)}
                </span>
              )}
            </span>
          );
        })}
      </div>
      {count > shown.length && (
        <span
          style={{
            marginLeft: -8,
            minWidth: 24,
            height: 24,
            padding: "0 5px",
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--neutral-100,#ede1d7)",
            boxShadow: "0 0 0 2px #fff",
            fontFamily: "var(--font-body)",
            fontWeight: 500,
            fontSize: 11,
            color: "var(--neutral-700,#524b47)",
          }}
        >
          +{count - shown.length}
        </span>
      )}
    </div>
  );
}

function WorkspaceCard({
  invite,
  joining,
  onJoin,
}: {
  invite: TeamInviteOnboarding;
  joining: boolean;
  onJoin: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        width: "100%",
        minHeight: 101,
        padding: "16px 20px",
        borderRadius: 11.5,
        backgroundColor: "var(--neutral-white,#fff)",
        boxSizing: "border-box",
        boxShadow: "0px 0px 0px 1px var(--blue-600,#0d6eb2)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            fontSize: 15,
            lineHeight: "20px",
            color: "var(--neutral-900,#26211e)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {invite.organizationName || `${invite.invitedByName || "Their"}'s Workspace`}
        </p>
        <p style={{ margin: 0, fontFamily: "var(--font-body)", fontWeight: 400, fontSize: 13, lineHeight: "16px", color: "var(--neutral-500,#827a74)" }}>
          {invite.organizationMemberCount} member{invite.organizationMemberCount === 1 ? "" : "s"}
        </p>
        <AvatarStack members={invite.organizationMembers} count={invite.organizationMemberCount} />
      </div>
      <Button size="sm" loading={joining} onClick={onJoin} style={{ flexShrink: 0 }}>
        Join
      </Button>
    </div>
  );
}

function OnboardingJoinContent() {
  const { push } = useRouter();
  const { logout } = useAuth();
  const { setEntryFlow } = useWorkspaceOnboarding();
  const params = useSearchParams();
  const inviteId = params.get("inviteId");

  const [invite, setInvite] = useState<TeamInviteOnboarding | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!inviteId) { setLoadError(true); return; }
    let cancelled = false;
    getTeamInviteOnboarding(inviteId)
      .then((data) => { if (!cancelled) setInvite(data); })
      .catch((err) => {
        console.error("Failed to load workspace invite", err);
        if (!cancelled) setLoadError(true);
      });
    return () => { cancelled = true; };
  }, [inviteId]);

  const handleJoin = async () => {
    if (!inviteId || joining) return;
    setJoining(true);
    try {
      await acceptTeamInvite(inviteId);
      setEntryFlow("join");
      push(ONBOARDING_PROFILE_ROUTE);
    } catch (err) {
      console.error("Failed to join workspace", err);
      toast.error("Couldn't join the workspace — please try again.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <StepCanvas>
      <StepHeader total={3} activeIndex={1} title="Join a Workspace" />

      <div style={{ width: "100%", padding: "24px 0 0" }}>
        {invite ? (
          <WorkspaceCard invite={invite} joining={joining} onJoin={() => void handleJoin()} />
        ) : loadError ? (
          <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--neutral-500,#827a74)", margin: 0 }}>
            We couldn&apos;t find a workspace to join. Ask your teammate to resend the invite.
          </p>
        ) : (
          <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--neutral-500,#827a74)", margin: 0 }}>
            Looking up your workspace…
          </p>
        )}
      </div>

      <div style={{ display: "flex", width: "100%" }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void logout()}
          leftIcon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        >
          Back
        </Button>
      </div>
    </StepCanvas>
  );
}

export default function OnboardingJoinPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingJoinContent />
    </Suspense>
  );
}
