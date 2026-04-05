"use client";

import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PRO_LIMITS, type WorkspaceUsageCounts } from "@/lib/plan-downgrade-limits";

function downgradeBlockedCopy(targetPlan: "starter" | "pro"): string {
  if (targetPlan === "starter") {
    return "Your current workspace has more personas, pins, or workflows than the Starter plan allows. Please delete or remove them to fit within the Starter limits, then try again.";
  }
  return `Your current workspace has more pins or workflows than the Pro plan allows (${PRO_LIMITS.totalPinCount} pins, ${PRO_LIMITS.totalWorkflowsCount} workflows; personas are unlimited). Please delete or remove items to fit within the Pro limits, then try again.`;
}

export function DowngradeBlockedDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPlan: "starter" | "pro" | null;
  counts: WorkspaceUsageCounts;
}) {
  const { open, onOpenChange, targetPlan, counts } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white p-6 rounded-2xl border border-zinc-200 shadow-lg">
        <DialogHeader>
          <DialogTitle className="font-clash font-semibold text-[#171717] text-left text-lg">
            Unable to downgrade
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-left">
          <p className="font-geist text-sm text-[#525252] leading-relaxed">
            {targetPlan ? downgradeBlockedCopy(targetPlan) : null}
          </p>
          <div className="flex items-start gap-3 rounded-xl bg-zinc-50 border border-zinc-100 px-4 py-3">
            <Info
              className="h-5 w-5 shrink-0 text-zinc-500 mt-0.5"
              aria-hidden
            />
            <p className="font-geist text-sm text-[#171717]">
              {counts.totalPersonaCount} personas • {counts.totalPinCount} pins
              • {counts.totalWorkflowsCount} workflows
            </p>
          </div>
        </div>
        <DialogFooter className="sm:justify-end pt-2">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="bg-black text-white hover:bg-[#0A0A0A]"
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
