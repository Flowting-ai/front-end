import { OnboardingProvider } from "@/context/onboarding-context";

export default function OnboardingGroupLayout({ children }: { children: React.ReactNode }) {
  return <OnboardingProvider>{children}</OnboardingProvider>;
}
