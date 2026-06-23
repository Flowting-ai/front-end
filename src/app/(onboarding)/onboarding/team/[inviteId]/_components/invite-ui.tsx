"use client";

import React from "react";
import { Button } from "@/components/Button";
import type { InvitedMember, InvitedProject, TeamInviteOnboarding } from "@/types/teams";
import type { InviteLoadStatus } from "@/context/team-invite-onboarding-context";

// ── Shared building blocks for the team-invite onboarding card screens ──────────
// Screens 1 (invite), 2 (join) and 4 (confirm) are centred white cards on the
// onboarding gradient. These primitives keep them visually identical and bind
// every element to the real invite payload.

// Matches the onboarding shell gradient (Figma 5795:41421).
const CANVAS_GRADIENT =
  "linear-gradient(180deg, var(--neutral-50,#f7f2ed) 3.76%, var(--neutral-100,#ede1d7) 75%, var(--neutral-200,#d1c6bd) 116.79%)";

/** Full-screen gradient canvas that centres a single card. */
export function InviteCanvas({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: CANVAS_GRADIENT,
        padding: "40px 16px",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}

/** White rounded card. `width` controls the max content width. */
export function InviteCard({
  children,
  width = 620,
}: {
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 28,
        backgroundColor: "var(--neutral-white,#fff)",
        borderRadius: 20,
        padding: "32px 36px",
        width: "100%",
        maxWidth: width,
        boxShadow:
          "0px 12px 16px -4px rgba(130,122,116,0.12), 0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100,#ede1d7)",
      }}
    >
      {children}
    </div>
  );
}

/** Small rounded-square org logo (image when present, else initial on a gradient). */
function OrgLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const initial = (name || "?").trim()[0]?.toUpperCase() ?? "?";
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external org logo, arbitrary host
      <img
        src={logoUrl}
        alt=""
        width={22}
        height={22}
        style={{ width: 22, height: 22, borderRadius: 6, objectFit: "cover", display: "block", flexShrink: 0 }}
      />
    );
  }
  return (
    <span
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
        color: "#fff",
        fontFamily: "var(--font-body)",
        fontWeight: 600,
        fontSize: 12,
        lineHeight: 1,
      }}
    >
      {initial}
    </span>
  );
}

/** Org logo + name row, shown at the top of each card. */
export function OrgHeader({ invite }: { invite: TeamInviteOnboarding }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <OrgLogo name={invite.organizationName} logoUrl={invite.organizationLogoUrl} />
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: 500,
          fontSize: 14,
          lineHeight: "20px",
          color: "var(--neutral-800,#3b3632)",
        }}
      >
        {invite.organizationName || "Workspace"}
      </span>
    </div>
  );
}

/** Single circular avatar — member image when present, else coloured initials. */
function MemberAvatar({ member, ring = "#fff" }: { member: InvitedMember; ring?: string }) {
  const size = 28;
  const common: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    boxShadow: `0 0 0 2px ${ring}`,
  };
  if (member.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external member avatar, arbitrary host
      <img src={member.image} alt={member.name || member.email} style={{ ...common, objectFit: "cover", display: "block" }} />
    );
  }
  const initials = member.initials || (member.name || member.email || "?").trim()[0]?.toUpperCase() || "?";
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
        fontSize: 11,
        lineHeight: 1,
      }}
    >
      {initials.slice(0, 2)}
    </span>
  );
}

/**
 * Overlapping avatar stack with a trailing total-count bubble.
 * Shows up to `max` member images; the bubble always reports the full count.
 */
export function MemberStack({
  members,
  count,
  max = 3,
}: {
  members: InvitedMember[];
  count: number;
  max?: number;
}) {
  const shown = members.slice(0, max);
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {shown.map((m, i) => (
          <span key={m.userId || m.email || i} style={{ marginLeft: i === 0 ? 0 : -8 }}>
            <MemberAvatar member={m} />
          </span>
        ))}
      </div>
      {count > 0 && (
        <span
          style={{
            marginLeft: shown.length > 0 ? -8 : 0,
            minWidth: 28,
            height: 28,
            padding: "0 6px",
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--neutral-100,#ede1d7)",
            boxShadow: "0 0 0 2px #fff",
            fontFamily: "var(--font-body)",
            fontWeight: 500,
            fontSize: 12,
            color: "var(--neutral-700,#524b47)",
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

/** "Team name" heading with the member stack on the right. */
export function TeamRow({ invite }: { invite: TeamInviteOnboarding }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: 600,
          fontSize: 15,
          lineHeight: "22px",
          color: "var(--neutral-900,#26211e)",
        }}
      >
        {invite.teamName || "Team"}
      </span>
      <MemberStack members={invite.members} count={invite.memberCount} />
    </div>
  );
}

/** "Organization name" heading with the org-wide member stack on the right. */
export function OrgRow({ invite }: { invite: TeamInviteOnboarding }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: 600,
          fontSize: 15,
          lineHeight: "22px",
          color: "var(--neutral-900,#26211e)",
        }}
      >
        {invite.organizationName || "Organization"}
      </span>
      <MemberStack members={invite.organizationMembers} count={invite.organizationMemberCount} />
    </div>
  );
}

/** List of projects (title + one-line description). */
export function ProjectList({ projects }: { projects: InvitedProject[] }) {
  if (projects.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {projects.map((p) => (
        <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: 14,
              lineHeight: "20px",
              color: "var(--blue-700,#135487)",
            }}
          >
            {p.title || "Untitled project"}
          </span>
          {p.description && (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 400,
                fontSize: 13,
                lineHeight: "18px",
                color: "var(--neutral-500,#827a74)",
              }}
            >
              {p.description}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** "Invited by" label with the inviter's avatar + name. */
export function InvitedBy({ invite }: { invite: TeamInviteOnboarding }) {
  const name = invite.invitedByName || invite.invitedByEmail || "A teammate";
  const initials = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: 400,
          fontSize: 12,
          lineHeight: "16px",
          color: "var(--neutral-500,#827a74)",
        }}
      >
        Invited by
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {invite.invitedByImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- external inviter avatar, arbitrary host
          <img
            src={invite.invitedByImage}
            alt={name}
            style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", display: "block", flexShrink: 0 }}
          />
        ) : (
          <span
            aria-label={name}
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              flexShrink: 0,
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
            {initials}
          </span>
        )}
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 500,
            fontSize: 14,
            lineHeight: "20px",
            color: "var(--neutral-800,#3b3632)",
          }}
        >
          {name}
        </span>
      </div>
    </div>
  );
}

/** Card title in the serif display face. */
export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1
      style={{
        fontFamily: "var(--font-title)",
        fontWeight: 400,
        fontSize: 40,
        lineHeight: "48px",
        color: "#1a1916",
        margin: 0,
        letterSpacing: "-0.01em",
      }}
    >
      {children}
    </h1>
  );
}

/** Muted card subtitle. */
export function CardSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "var(--font-body)",
        fontWeight: 400,
        fontSize: 16,
        lineHeight: "24px",
        color: "var(--neutral-500,#827a74)",
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

/**
 * Renders the non-ready load states (loading / expired / not_found / error) as a
 * centred card, so every screen in the flow degrades identically on hard refresh.
 */
export function InviteStateScreen({
  status,
  errorMsg,
  onRetry,
  onHome,
}: {
  status: Exclude<InviteLoadStatus, "ready">;
  errorMsg?: string;
  onRetry?: () => void;
  onHome?: () => void;
}) {
  if (status === "loading") {
    return (
      <InviteCanvas>
        <InviteCard width={620}>
          <CardSubtitle>Loading your invite…</CardSubtitle>
        </InviteCard>
      </InviteCanvas>
    );
  }

  const expired = status === "expired";
  const notFound = status === "not_found";
  const title = expired ? "This invite has expired" : notFound ? "Invite not found" : "Something went wrong";
  const body = expired
    ? "This invite link has expired or been revoked. Ask your admin to send a new one."
    : notFound
      ? "This invite link doesn't exist or has already been used."
      : errorMsg || "Please try again.";

  // Close the tab. Browsers only honour window.close() for script-opened
  // windows, so fall back to leaving the flow (onHome) when it's blocked — the
  // setTimeout never fires if the window actually closed (the page unloads).
  const handleClose = () => {
    window.close();
    setTimeout(() => {
      if (onHome) onHome();
      else window.location.href = "/";
    }, 150);
  };

  return (
    <InviteCanvas>
      <InviteCard width={620}>
        <CardTitle>{title}</CardTitle>
        <CardSubtitle>{body}</CardSubtitle>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          {status === "error" && onRetry && (
            <Button variant="outline" size="md" onClick={onRetry}>Try again</Button>
          )}
          <Button variant="default" size="md" onClick={handleClose}>Close</Button>
        </div>
      </InviteCard>
    </InviteCanvas>
  );
}

/**
 * The role the invite grants, as a display word.
 * 'editor'/'viewer' are team-level grants layered on an org member; admin/owner
 * come straight from the org role.
 */
export function inviteRoleLabel(invite: TeamInviteOnboarding): string {
  if (invite.role === "owner") return "owner";
  if (invite.role === "admin") return "admin";
  if (invite.grantTeamEditor) return "editor";
  if (invite.grantTeamViewer) return "viewer";
  return "member";
}

/**
 * What the invite is joining, scoped to the backend-provided role. Used as the
 * "{target}" name across all invite screens so they stay in sync:
 *  • admin / owner   → the organization workspace
 *  • editor          → the team
 *  • member / viewer → the project (the surface they actually work in)
 */
export function inviteTargetName(invite: TeamInviteOnboarding): string {
  const role = inviteRoleLabel(invite);
  if (role === "owner" || role === "admin")
    return invite.organizationName || invite.teamName || "the organization";
  if (role === "editor")
    return invite.teamName || invite.organizationName || "the team";
  return invite.projectName || invite.teamName || invite.organizationName || "the project";
}

/**
 * Role-scoped roster/detail block, shared across screens:
 *  • admin / owner   → org-wide roster
 *  • editor          → team roster
 *  • member / viewer → team roster + the projects they'll work in
 */
export function InviteScope({ invite }: { invite: TeamInviteOnboarding }) {
  const role = inviteRoleLabel(invite);
  if (role === "owner" || role === "admin") return <OrgRow invite={invite} />;
  if (role === "editor") return <TeamRow invite={invite} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <TeamRow invite={invite} />
      <ProjectList projects={invite.projects} />
    </div>
  );
}
