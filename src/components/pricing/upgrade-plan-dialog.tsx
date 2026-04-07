"use client";

import { useRouter } from "next/navigation";
import { TriangleAlert, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PLAN_LIMITS, type PlanResourceLimits } from "@/lib/plan-config";
import type { UserPlanType } from "@/lib/api/user";

const RESOURCE_LABELS: Record<keyof PlanResourceLimits, string> = {
  personas: "personas",
  pins: "pins",
  workflows: "workflows",
  webSearchesPerDay: "web searches per day",
};

function formatLimit(value: number): string {
  return Number.isFinite(value) ? String(value) : "unlimited";
}

function nextTier(plan: UserPlanType): UserPlanType | null {
  if (plan === "starter") return "pro";
  if (plan === "pro") return "power";
  return null;
}

const TIER_LABEL: Record<UserPlanType, string> = {
  starter: "Starter",
  pro: "Pro",
  power: "Power",
};

export function UpgradePlanDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: UserPlanType;
  resource: keyof PlanResourceLimits;
  currentCount: number;
}) {
  const { open, onOpenChange, currentPlan, resource, currentCount } = props;
  const router = useRouter();

  const limit = PLAN_LIMITS[currentPlan][resource];
  const next = nextTier(currentPlan);
  const nextLimit = next ? PLAN_LIMITS[next][resource] : null;
  const resourceLabel = RESOURCE_LABELS[resource];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white p-6 rounded-2xl border border-zinc-200 shadow-lg">
        <DialogHeader>
          <DialogTitle className="font-clash font-medium text-[#171717] text-left text-2xl flex items-center gap-2">
            <TriangleAlert className="h-5 w-5 text-red-500" />
            {Number.isFinite(limit)
              ? `${TIER_LABEL[currentPlan]} plan limit reached`
              : "Plan limit reached"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-left">
          <p className="font-geist text-base text-[#525252] leading-relaxed">
            You&apos;ve used{" "}
            <span className="font-semibold text-[#171717]">
              {currentCount} / {formatLimit(limit)}
            </span>{" "}
            {resourceLabel} on your{" "}
            <span className="font-semibold">{TIER_LABEL[currentPlan]}</span>{" "}
            plan.
          </p>

          {next && nextLimit !== null && (
            <p className="font-geist text-base text-[#525252] leading-relaxed">
              Upgrade to{" "}
              <span className="font-semibold text-[#171717]">
                {TIER_LABEL[next]}
              </span>{" "}
              to get{" "}
              <span className="font-semibold text-[#171717]">
                {formatLimit(nextLimit)}
              </span>{" "}
              {resourceLabel}.
            </p>
          )}
        </div>

        <DialogFooter className="sm:justify-end pt-2 gap-2">
          <Button
            type="button"
            className="bg-black text-white hover:bg-[#0A0A0A]"
            onClick={() => {
              onOpenChange(false);
              router.push("/settings/usage-and-billing/change-plan");
            }}
          >
            Upgrade now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
