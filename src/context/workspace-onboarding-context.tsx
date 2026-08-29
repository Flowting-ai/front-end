"use client";

import { createContext, use, useState } from "react";
import type { ReactNode } from "react";

// ── In-memory state for the v1.5 workspace-onboarding flow ───────────────────
// Deliberately separate from `onboarding-context.tsx`, which backs the
// previous team-onboarding flow (individual/team branch, old CompanySize
// buckets). That flow is being superseded, not extended — this context only
// covers the new flow's 3 form steps (workspace, profile, invite) and holds no
// "account type" concept at all, since the new flow has none: a workspace's
// size (including "Just me") replaces the old individual-vs-team decision.
//
// NOT yet resolved (see docs v1.5/onboarding-v1.5-flow.md): whether backend
// org creation/role_fit mapping stays as-is under the hood or changes for
// v1.5. Each step below calls the closest existing backend contract and flags
// that assumption in a comment at the call site — this context only holds
// client-side form state, not backend semantics.

export type WorkspaceSize = "just_me" | "1-5" | "5-10" | "10+";

export type WorkspaceOnboardingRole =
  | "Founder"
  | "Marketer"
  | "Designer"
  | "Engineer"
  | "Operator"
  | "Student / Researcher";

export type WorkspaceOnboardingTone = "Direct" | "Balanced" | "Warm";

/**
 * Which case (A1 "create" vs A2 "join") landed the user on the shared
 * profile step — lets that step send Back to the right screen-1, since A1's
 * "Setup your workspace" and A2's "Join a workspace" are different routes.
 * Null until whichever screen-1 sets it.
 */
export type WorkspaceOnboardingEntryFlow = "create" | "join";

export interface WorkspaceOnboardingData {
  workspaceName: string;
  workspaceSize: WorkspaceSize;
  firstName: string;
  lastName: string;
  role: WorkspaceOnboardingRole | null;
  tone: WorkspaceOnboardingTone | null;
  inviteEmails: string;
  entryFlow: WorkspaceOnboardingEntryFlow | null;
}

interface WorkspaceOnboardingContextValue {
  data: WorkspaceOnboardingData;
  setWorkspaceName: (v: string) => void;
  setWorkspaceSize: (v: WorkspaceSize) => void;
  setFirstName: (v: string) => void;
  setLastName: (v: string) => void;
  setRole: (v: WorkspaceOnboardingRole) => void;
  setTone: (v: WorkspaceOnboardingTone) => void;
  setInviteEmails: (v: string) => void;
  setEntryFlow: (v: WorkspaceOnboardingEntryFlow) => void;
}

const WorkspaceOnboardingContext = createContext<WorkspaceOnboardingContextValue | null>(null);

export function WorkspaceOnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WorkspaceOnboardingData>({
    workspaceName: "",
    workspaceSize: "just_me",
    firstName: "",
    lastName: "",
    role: null,
    tone: null,
    inviteEmails: "",
    entryFlow: null,
  });

  const update = <K extends keyof WorkspaceOnboardingData>(key: K, value: WorkspaceOnboardingData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  return (
    <WorkspaceOnboardingContext.Provider
      value={{
        data,
        setWorkspaceName: (v) => update("workspaceName", v),
        setWorkspaceSize: (v) => update("workspaceSize", v),
        setFirstName: (v) => update("firstName", v),
        setLastName: (v) => update("lastName", v),
        setRole: (v) => update("role", v),
        setTone: (v) => update("tone", v),
        setInviteEmails: (v) => update("inviteEmails", v),
        setEntryFlow: (v) => update("entryFlow", v),
      }}
    >
      {children}
    </WorkspaceOnboardingContext.Provider>
  );
}

export function useWorkspaceOnboarding() {
  const ctx = use(WorkspaceOnboardingContext);
  if (!ctx) throw new Error("useWorkspaceOnboarding must be used within WorkspaceOnboardingProvider");
  return ctx;
}
