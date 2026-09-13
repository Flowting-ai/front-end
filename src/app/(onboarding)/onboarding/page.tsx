import { redirect } from "next/navigation";
import { ONBOARDING_SETUP_ROUTE } from "@/lib/routes";

export default function OnboardingIndexPage() {
  redirect(ONBOARDING_SETUP_ROUTE);
}
