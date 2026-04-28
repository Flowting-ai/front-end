/**
 * Backward-compatibility shim.
 * All logic lives in ModelDialog.tsx — import from there for new code.
 */
import { ModelDialog } from "./ModelDialog";
import type { AIModel } from "@/types/ai-model";
import type { UserPlanType } from "@/lib/api/user";

interface ModelSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onModelSelect: (model: AIModel) => void;
  onFrameworkSelect: (type: "starter" | "pro") => void;
  useFramework: boolean;
  frameworkType?: "starter" | "pro";
  userPlanType?: UserPlanType | null;
}

export function ModelSelectorDialog(props: ModelSelectorDialogProps) {
  return <ModelDialog mode="select" {...props} />;
}
