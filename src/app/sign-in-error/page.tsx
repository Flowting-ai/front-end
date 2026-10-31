"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AUTH_LOGIN_ROUTE } from "@/lib/routes";
import { SouvenirLogo } from "@/components/SouvenirLogo";

// Where a failed Auth0 callback lands (lib/auth0.ts). It used to go straight back to /auth/login,
// which sent the user to Auth0 again: an error that repeats on every attempt (a blocked account,
// an unverified email, a denied Action) looped with nothing on screen. This page stops the loop,
// says what happened, and lets the user try again on purpose.

const REASONS: Record<string, string> = {
  access_denied: "Sign-in was refused for this account. If you think that's wrong, contact your workspace admin.",
  unauthorized: "Sign-in was refused for this account. If you think that's wrong, contact your workspace admin.",
  login_required: "Your sign-in expired before it finished. Please try again.",
};

function SignInErrorContent() {
  const params = useSearchParams();
  const reason = params.get("reason") ?? "";
  const returnTo = params.get("returnTo");
  // Only same-site paths, as Auth0's own returnTo handling allows.
  const safeReturnTo = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : null;
  const retryUrl = safeReturnTo ? `${AUTH_LOGIN_ROUTE}?returnTo=${encodeURIComponent(safeReturnTo)}` : AUTH_LOGIN_ROUTE;

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "40px 16px", background: "var(--neutral-50)", boxSizing: "border-box" }}>
      <div role="alert" style={{ width: "100%", maxWidth: 403, display: "flex", flexDirection: "column", gap: 16 }}>
        <SouvenirLogo variant="gray" size={32} />
        <h1 style={{ margin: 0, fontFamily: "var(--font-title)", fontWeight: 400, fontSize: 24, lineHeight: "32px", color: "var(--neutral-800,#3b3632)" }}>
          We couldn&apos;t sign you in
        </h1>
        <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: 15, lineHeight: "22px", color: "var(--neutral-600,#5f5853)" }}>
          {REASONS[reason] ?? "Something went wrong while signing you in. Please try again."}
        </p>
        <Button size="sm" fluid onClick={() => { window.location.href = retryUrl; }}>
          Try again
        </Button>
      </div>
    </div>
  );
}

export default function SignInErrorPage() {
  return (
    <Suspense fallback={null}>
      <SignInErrorContent />
    </Suspense>
  );
}
