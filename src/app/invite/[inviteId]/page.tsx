"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/Button";
import { getTeamInviteOnboarding } from "@/lib/api/teams";
import type { InvitedMember, TeamInviteOnboarding } from "@/types/teams";
import { AUTH_LOGIN_ROUTE, ONBOARDING_TEAM_WELCOME_ROUTE } from "@/lib/routes";

// ── B1 / B2 — pre-login invite landing ("You're on the list!") ──────────────
// Figma: node 55:2884 (B1 — email already has an account) / 58:4249 (B2 — no
// account yet). Both frames are visually the "Sign in"/"Sign up" auth-page
// shell (logo, flat cream background, centered 403px column, small footer
// logo + Terms/Privacy links) — there is no code for that shell in this repo
// today, since auth itself is Auth0-hosted; this page recreates it locally
// rather than importing from a Universal-Login-only source.
//
// This is a genuinely public, pre-auth route: proxy.ts's `!session` check now
// exempts `/invite/*` (see routes.ts's INVITE_LANDING_BASE_ROUTE comment) so a
// logged-out invitee can actually reach it instead of being bounced straight
// to /auth/login.
//
// PENDING CONFIRMATION (not guessed silently):
// 1. There is no "does this email already have an account" signal anywhere in
//    the frontend or in getTeamInviteOnboarding's response shape. This page
//    reads it from an `?existingAccount=1` query param instead, which the
//    backend would need to set when generating the invite email's link
//    (it already knows the recipient's email at send time). Missing/invalid
//    values fall back to B2 (Sign up) — sending an existing-account holder to
//    "sign up" just bounces them to sign-in on Auth0's own duplicate-email
//    check, whereas sending a new visitor to "sign in" is a harder dead end.
// 2. getTeamInviteOnboarding() calls the authenticated api client, but that
//    client already omits the Authorization header gracefully when logged
//    out (see lib/jwt-utils.ts getAuthHeaders) rather than failing — so it is
//    *structurally* safe to call here. Whether the backend's
//    GET /team-invite/{id} route itself permits an anonymous request is a
//    backend-side assumption this page can't verify from the frontend alone.
// 3. Sign up wires to `${AUTH_LOGIN_ROUTE}?screen_hint=signup&returnTo=...`,
//    relying on the @auth0/nextjs-auth0 v4 SDK's default /auth/login handler
//    forwarding query params through to Auth0's /authorize call (standard v4
//    behavior, not custom code in this repo) — worth a quick smoke test.

function SouvenirMark({ size = 32 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static local icon, Next Image adds no value here
    <img src="/icons/souvenir-logo-gray.svg" alt="" width={size} height={size} style={{ display: "block" }} aria-hidden />
  );
}

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

function WorkspaceCard({ invite }: { invite: TeamInviteOnboarding }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
        padding: "16px 20px",
        borderRadius: 11.5,
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
        <p style={{ margin: 0, flexShrink: 0, fontFamily: "var(--font-body)", fontWeight: 400, fontSize: 13, lineHeight: "16px", color: "var(--neutral-500,#827a74)" }}>
          {invite.organizationMemberCount} member{invite.organizationMemberCount === 1 ? "" : "s"}
        </p>
      </div>
      <AvatarStack members={invite.organizationMembers} count={invite.organizationMemberCount} />
    </div>
  );
}

function InviteLandingContent() {
  const { inviteId } = useParams<{ inviteId: string }>();
  const params = useSearchParams();
  const isExistingAccount = params.get("existingAccount") === "1";

  const [invite, setInvite] = useState<TeamInviteOnboarding | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!inviteId) { setLoadError(true); return; }
    let cancelled = false;
    getTeamInviteOnboarding(inviteId)
      .then((data) => { if (!cancelled) setInvite(data); })
      .catch((err) => {
        console.error("Failed to load invite preview", err);
        if (!cancelled) setLoadError(true);
      });
    return () => { cancelled = true; };
  }, [inviteId]);

  const returnTo = ONBOARDING_TEAM_WELCOME_ROUTE(inviteId);
  const authUrl = isExistingAccount
    ? `${AUTH_LOGIN_ROUTE}?returnTo=${encodeURIComponent(returnTo)}`
    : `${AUTH_LOGIN_ROUTE}?screen_hint=signup&returnTo=${encodeURIComponent(returnTo)}`;

  const inviterName = invite?.invitedByName?.trim() || "your teammate";

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: BG,
        padding: "40px 16px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ width: "100%", maxWidth: 403, margin: "auto 0" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          <SouvenirMark />
          <h1
            style={{
              fontFamily: "var(--font-title)",
              fontWeight: 400,
              fontSize: 24,
              lineHeight: "32px",
              color: "var(--neutral-800,#3b3632)",
              margin: 0,
            }}
          >
            You&apos;re on the list!
          </h1>
        </div>

        {invite ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <p style={{ margin: 0, fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15, lineHeight: "22px", color: "var(--neutral-800,#3b3632)" }}>
              You have been invited to join {inviterName}&apos;s workspace.
            </p>

            <WorkspaceCard invite={invite} />

            <p style={{ margin: 0, fontFamily: "var(--font-body)", fontWeight: 400, fontSize: 14, lineHeight: "20px", color: "var(--neutral-600,#6a625d)", textAlign: "center" }}>
              {isExistingAccount
                ? "Your email address is already registered to an existing Souvenir account. Please sign in to accept the invitation and join the workspace with your existing Souvenir account."
                : "Your email address is not registered with a Souvenir account. Please sign up to accept the invitation and join the workspace with your existing Souvenir account."}
            </p>

            <Button size="sm" fluid asChild>
              <a href={authUrl}>{isExistingAccount ? "Sign in" : "Sign up"}</a>
            </Button>
          </div>
        ) : loadError ? (
          <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--neutral-500,#827a74)", margin: 0 }}>
            This invite link couldn&apos;t be found. Ask your teammate to resend it.
          </p>
        ) : (
          <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--neutral-500,#827a74)", margin: 0 }}>
            Looking up your invite…
          </p>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <SouvenirMark size={32} />
        <p style={{ margin: 0, fontFamily: "var(--font-body)", fontWeight: 400, fontSize: 12, lineHeight: "16px", color: "var(--neutral-500,#827a74)" }}>
          By continuing you agree to our <a href="/terms" style={{ color: "var(--blue-600,#0d6eb2)" }}>Terms</a> and{" "}
          <a href="/privacy" style={{ color: "var(--blue-600,#0d6eb2)" }}>Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}

const BG = "var(--neutral-50,#f7f2ed)";

export default function InviteLandingPage() {
  return (
    <Suspense fallback={null}>
      <InviteLandingContent />
    </Suspense>
  );
}
