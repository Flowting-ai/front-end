import { redirect } from "next/navigation";
import { ONBOARDING_HELLO_ROUTE } from "@/lib/routes";

export default function OnboardingIndexPage() {
  redirect(ONBOARDING_HELLO_ROUTE);
}
