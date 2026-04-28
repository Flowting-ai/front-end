/**
 * Backward-compatibility shim.
 * All logic lives in ModelDialog.tsx — import from there for new code.
 */
export type { ModelSwitchConfig } from "./ModelDialog";
export type { ModelDialogProps as ModelSwitchDialogProps } from "./ModelDialog";

import { ModelDialog } from "./ModelDialog";
import type { ModelSwitchConfig } from "./ModelDialog";
import type { AIModel } from "@/types/ai-model";
import type { UserPlanType } from "@/lib/api/user";
import type { PinType } from "@/components/layout/right-sidebar";

interface ModelSwitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentModel: AIModel | null;
  pendingModel?: AIModel | null;
  onModelSwitch: (config: ModelSwitchConfig) => void;
  onFrameworkSelect?: (type: "starter" | "pro") => void;
  chatBoards?: Array<{ id: string; name: string }>;
  pins?: PinType[];
  activeChatId?: string | null;
  knownMessageCount?: number;
  frameworkType?: "starter" | "pro";
  userPlanType?: UserPlanType | null;
}

export function ModelSwitchDialog(props: ModelSwitchDialogProps) {
  return <ModelDialog mode="switch" {...props} />;
}
