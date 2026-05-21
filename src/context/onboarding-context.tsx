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

export interface OnboardingData {
  firstName: string;
  lastName: string;
  nickname: string;
  role: OnboardingRole | null;
  roleOther: string;
  tone: OnboardingTone | null;
  aiContext: string;
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
