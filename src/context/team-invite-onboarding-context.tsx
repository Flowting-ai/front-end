"use client";

import { createContext, use, useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import { getTeamInviteOnboarding } from "@/lib/api/teams";
import type { TeamInviteOnboarding } from "@/types/teams";

// ── Team-invite onboarding state ────────────────────────────────────────────────
// Powers the dedicated onboarding flow shown to a user who was invited into an
// existing org/team — kept separate from the individual OnboardingProvider so the
// two flows can diverge freely. Holds the server-fetched invite payload plus the
// load lifecycle. Screen-specific form fields get added here as Figma lands.

export type InviteLoadStatus =
  | "loading"
  | "ready"
  | "expired"
  | "not_found"
  | "error";

interface TeamInviteOnboardingContextValue {
  status: InviteLoadStatus;
  invite: TeamInviteOnboarding | null;
  /** Friendly message when status === "error". */
  errorMsg: string;
  /** Re-run the fetch (e.g. a "Try again" button). */
  refetch: () => void;
}

const TeamInviteOnboardingContext =
  createContext<TeamInviteOnboardingContextValue | null>(null);

export function TeamInviteOnboardingProvider({
  inviteId,
  children,
}: {
  inviteId: string;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<InviteLoadStatus>("loading");
  const [invite, setInvite] = useState<TeamInviteOnboarding | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Fetch sets state only inside the promise callbacks (async) — never
  // synchronously — so it's safe to kick off directly from the effect.
  const fetchInvite = useCallback(() => {
    if (!inviteId) return;
    getTeamInviteOnboarding(inviteId)
      .then((data) => {
        setInvite(data);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          if (err.status === 404) setStatus("not_found");
          else if (err.status === 410) setStatus("expired");
          else {
            setErrorMsg(err.message);
            setStatus("error");
          }
        } else {
          setErrorMsg("Something went wrong. Please try again.");
          setStatus("error");
        }
      });
  }, [inviteId]);

  const refetch = useCallback(() => {
    setStatus("loading");
    fetchInvite();
  }, [fetchInvite]);

  useEffect(() => {
    fetchInvite();
  }, [fetchInvite]);

  return (
    <TeamInviteOnboardingContext.Provider
      value={{ status, invite, errorMsg, refetch }}
    >
      {children}
    </TeamInviteOnboardingContext.Provider>
  );
}

export function useTeamInviteOnboarding() {
  const ctx = use(TeamInviteOnboardingContext);
  if (!ctx)
    throw new Error(
      "useTeamInviteOnboarding must be used within TeamInviteOnboardingProvider",
    );
  return ctx;
}
