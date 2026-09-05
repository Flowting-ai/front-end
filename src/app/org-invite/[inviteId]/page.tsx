"use client";

import { useParams } from "next/navigation";
import { Button } from "@/components/Button";
import { AUTH_LOGIN_ROUTE, ONBOARDING_TEAM_WELCOME_ROUTE } from "@/lib/routes";

// ── B1/B2 — pre-login invite landing ("You're on the list!") ────────────────
// Figma: node 55:2884 / 58:4249. Deliberately generic and static — no API call
// of any kind.
//
// Lives at /org-invite/{inviteId} to match what the backend's
// build_invite_url() actually emails (back-end/services/organizations/
// service.py) — the emailed link never pointed at the old /invite/{inviteId}
// path this page used to live at, so the "Accept" link 404'd before anyone
// saw this screen.
//
// This used to also call getTeamInviteOnboarding() to show a personalized
// workspace card (org name, member count, avatars) and to pick "Sign in" vs
// "Sign up" via an `?existingAccount=1` query param the backend was supposed
// to set (but per the prior version of this file's own comment, never
// confirmed to actually do). Both of those required GET /org-invite/{id} to
// succeed — but that route requires an authenticated caller
// (services/organizations/router.py's preview_invite depends on
// get_current_user, an HTTPBearer() dependency with no auto_error=False), so
// it always failed for the logged-out visitor this page exists to serve,
// leaving the whole card — including the Sign in/Sign up buttons — replaced
// by a "couldn't be found" error.
//
// Fix (2026-09-06, frontend-only, no backend change): drop the data
// dependency entirely. This screen's only job is routing the visitor into
// Auth0 — `inviteId` is all either button needs (via `returnTo`). The real,
// personalized invite details (org name, members, role, Accept action) are
// shown one step later on "Join a workspace"
// (onboarding/team/[inviteId]/page.tsx), which already works correctly
// because by the time a visitor reaches it they're authenticated and
// GET /org-invite/{id} succeeds naturally — no backend change needed there
// either. Both "Sign in" and "Sign up" are shown explicitly (rather than
// guessing which one applies, or relying on Auth0's hosted page to offer
// both on its own) to match how this app already disambiguates the two
// elsewhere via `screen_hint=signup`.

function SouvenirMark({ size = 32 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static local icon, Next Image adds no value here
    <img src="/icons/souvenir-logo-gray.svg" alt="" width={size} height={size} style={{ display: "block" }} aria-hidden />
  );
}

const BG = "var(--neutral-50,#f7f2ed)";

export default function InviteLandingPage() {
  const { inviteId } = useParams<{ inviteId: string }>();
  const returnTo = ONBOARDING_TEAM_WELCOME_ROUTE(inviteId);
  const signUpUrl = `${AUTH_LOGIN_ROUTE}?screen_hint=signup&returnTo=${encodeURIComponent(returnTo)}`;
  const signInUrl = `${AUTH_LOGIN_ROUTE}?returnTo=${encodeURIComponent(returnTo)}`;

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

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <p style={{ margin: 0, fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15, lineHeight: "22px", color: "var(--neutral-800,#3b3632)" }}>
            You&apos;ve been invited to join a workspace on Souvenir.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Button size="sm" fluid asChild>
              <a href={signUpUrl}>Sign up</a>
            </Button>
            <Button variant="ghost" size="sm" fluid asChild>
              <a href={signInUrl}>Already have an account? Sign in</a>
            </Button>
          </div>
        </div>
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
