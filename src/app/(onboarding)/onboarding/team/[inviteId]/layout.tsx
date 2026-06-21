"use client";

import { useParams } from "next/navigation";
import { TeamInviteOnboardingProvider } from "@/context/team-invite-onboarding-context";

// Dedicated onboarding tree for users invited into an existing org/team.
// Lives under (onboarding) so it inherits the gradient canvas + shell, but is
// driven by its own provider — fully separate from the individual flow.
export default function TeamInviteOnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ inviteId: string }>();
  return (
    <TeamInviteOnboardingProvider inviteId={params.inviteId}>
      {children}
    </TeamInviteOnboardingProvider>
  );
}
