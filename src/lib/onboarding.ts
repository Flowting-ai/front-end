import type { OnboardingNextStep } from "@/lib/api/onboarding";

export function getOnboardingRoute(
  nextStep: OnboardingNextStep,
  completed: boolean,
): string {
  if (completed) return "/onboarding/pricing";

  switch (nextStep) {
    case "user_role":
      return "/onboarding/role";
    case "ai_tone":
      return "/onboarding/tone";
    case "role_fit":
      return "/onboarding/org-size";
    default:
      // Profile fields are filled but API omitted next_step — go to plan selection.
      return "/onboarding/pricing";
  }
}
