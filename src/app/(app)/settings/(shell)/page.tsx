import { redirect } from "next/navigation";
import { SETTINGS_ACCOUNT_ROUTE } from "@/lib/routes";

// Settings home: a server redirect to personal settings. Login is enforced by
// proxy.ts before this runs, so there is no client auth check or blank frame.
export default function SettingsPage() {
  redirect(SETTINGS_ACCOUNT_ROUTE);
}
