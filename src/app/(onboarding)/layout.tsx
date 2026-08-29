import { OnboardingProvider } from "@/context/onboarding-context";
import { WorkspaceOnboardingProvider } from "@/context/workspace-onboarding-context";

// Both providers are mounted here: OnboardingProvider backs the previous
// team-onboarding flow (still reachable at its existing routes until those are
// cut over/removed); WorkspaceOnboardingProvider backs the new v1.5 flow
// (docs v1.5/onboarding-v1.5-flow.md). Each page only reads the one it needs.
export default function OnboardingGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingProvider>
      <WorkspaceOnboardingProvider>{children}</WorkspaceOnboardingProvider>
    </OnboardingProvider>
  );
}
