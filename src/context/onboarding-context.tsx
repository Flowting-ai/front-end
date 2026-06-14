"use client";

import { createContext, use, useState } from "react";
import type { ReactNode } from "react";

export type OnboardingRole =
  | "Founder"
  | "Marketer"
  | "Designer"
  | "Engineer"
  | "Operator"
  | "Student / Researcher"
  | "Other";

export type OnboardingTone = "Direct" | "Balanced" | "Warm";

/** Chosen on the account-type decider step. Drives the branch (individual vs team). */
export type AccountType = "individual" | "team";

/** Company-size buckets from the workspace-setup step. Map to backend `role_fit`. */
export type CompanySize = "1-10" | "11-50" | "51-200" | "200+";

export interface OnboardingData {
  firstName: string;
  lastName: string;
  nickname: string;
  role: OnboardingRole | null;
  /** Free-text detail captured when role === "Other". Sent to /memory/user. */
  roleOther: string;
  tone: OnboardingTone | null;
  aiContext: string;
  // ── Account-type branch ──────────────────────────────────────────────────
  accountType: AccountType | null;
  // ── Team / workspace fields (only used when accountType === "team") ───────
  companyName: string;
  companyWebsite: string;
  companySize: CompanySize | null;
}

interface OnboardingContextValue {
  data: OnboardingData;
  setFirstName: (v: string) => void;
  setLastName: (v: string) => void;
  setNickname: (v: string) => void;
  setRole: (v: OnboardingRole) => void;
  setRoleOther: (v: string) => void;
  setTone: (v: OnboardingTone) => void;
  setAiContext: (v: string) => void;
  setAccountType: (v: AccountType) => void;
  setCompanyName: (v: string) => void;
  setCompanyWebsite: (v: string) => void;
  setCompanySize: (v: CompanySize) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<OnboardingData>({
    firstName: "",
    lastName: "",
    nickname: "",
    role: null,
    roleOther: "",
    tone: null,
    aiContext: "",
    accountType: null,
    companyName: "",
    companyWebsite: "",
    companySize: null,
  });

  const update = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  return (
    <OnboardingContext.Provider
      value={{
        data,
        setFirstName: (v) => update("firstName", v),
        setLastName: (v) => update("lastName", v),
        setNickname: (v) => update("nickname", v),
        setRole: (v) => update("role", v),
        setRoleOther: (v) => update("roleOther", v),
        setTone: (v) => update("tone", v),
        setAiContext: (v) => update("aiContext", v),
        setAccountType: (v) => update("accountType", v),
        setCompanyName: (v) => update("companyName", v),
        setCompanyWebsite: (v) => update("companyWebsite", v),
        setCompanySize: (v) => update("companySize", v),
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = use(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}

/**
 * Maps the account-type / company-size selection to the backend `role_fit`
 * enum (`just_me | small_team | large_team`). Centralised here so the import
 * step and any resume logic agree on the same derivation.
 */
export function deriveRoleFit(
  accountType: AccountType | null,
  companySize: CompanySize | null,
): "just_me" | "small_team" | "large_team" | null {
  if (accountType === "individual") return "just_me";
  if (accountType === "team") {
    return companySize === "51-200" || companySize === "200+" ? "large_team" : "small_team";
  }
  return null;
}
