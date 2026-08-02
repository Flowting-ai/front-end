"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrg } from "@/context/org-context";
import { ORG_PLANS_ROUTE } from "@/lib/routes";
import type { CreditNoticeStatus } from "@/components/InlineCreditNotice";

const CREDIT_NOTICE_STATUSES = new Set<string>(["warning_95", "grace", "locked"]);

/**
 * Derives the org/team shared-credit-pool notice state (warning_95/grace/
 * locked) for the <InlineCreditNotice> banner shown above every chat input,
 * plus the admin-CTA navigation and per-status dismissal it needs. Shared so
 * every chat surface reads the same pool status the same way.
 */
export function useWorkspaceCreditNotice() {
  const { plan, currentUserRole } = useOrg();
  const router = useRouter();
  const [dismissed, setDismissed] = useState<CreditNoticeStatus | null>(null);

  const status: CreditNoticeStatus | null =
    plan?.poolStatus && CREDIT_NOTICE_STATUSES.has(plan.poolStatus) && plan.poolStatus !== dismissed
      ? (plan.poolStatus as CreditNoticeStatus)
      : null;

  const dismiss = useCallback(() => {
    setDismissed(status);
  }, [status]);

  const goToPlans = useCallback(() => {
    router.push(ORG_PLANS_ROUTE);
  }, [router]);

  return {
    status,
    isAdmin: currentUserRole === "admin",
    dismiss,
    goToPlans,
  };
}
