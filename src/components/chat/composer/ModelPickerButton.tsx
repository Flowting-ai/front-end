"use client";

import React, { useState } from "react";
import { ArrowDownOneIcon } from "@strange-huge/icons";
import { Button } from "@/components/ui/button";
import { ModelIcon } from "@/components/ModelIcon";
import { Dropdown, type DropdownPlacement } from "@/components/Dropdown";
import { toast } from "sonner";
import type { ComposerButtonSize } from "./composer-sizes";

interface ModelPickerButtonProps {
  modelName: string;
  modelIcon?: string | null;
  onModelClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** Opens this in a Dropdown.Float when set; otherwise the button calls `onModelClick`. */
  modelMenu?: React.ReactNode;
  modelMenuPlacement: DropdownPlacement;
  /** Shown greyed out; a click explains the model is locked to the agent. */
  locked: boolean;
  disabled: boolean;
  size: ComposerButtonSize;
}

/** The model selector in the footer, with its menu when the host gives one. */
export function ModelPickerButton({
  modelName,
  modelIcon,
  onModelClick,
  modelMenu,
  modelMenuPlacement,
  locked,
  disabled,
  size,
}: ModelPickerButtonProps) {
  const [modelMenuOpen, setModelMenuOpen] = useState(false);

  return locked ? (
    <span
      style={{ display: "inline-flex", cursor: "pointer" }}
      onClick={() =>
        toast.info("Model locked to agent", {
          description:
            "This chat uses the agent's model. Remove the agent chip to unlock model selection.",
        })
      }
    >
      <Button className="kaya-model-btn"
        variant="ghost"
        size={size}
        leftIcon={<ModelIcon model={modelIcon ?? modelName} size={16} />}
        rightIcon={<ArrowDownOneIcon size={16} />}
        style={{ opacity: 0.45, pointerEvents: "none" }}
      >
        {modelName}
      </Button>
    </span>
  ) : modelMenu !== undefined ? (
    <Dropdown.Float
      open={modelMenuOpen}
      onOpenChange={setModelMenuOpen}
      placement={modelMenuPlacement}
      autoFlipVertical
      trigger={
        <Button className="kaya-model-btn"
          variant="ghost"
          size={size}
          leftIcon={<ModelIcon model={modelIcon ?? modelName} size={16} />}
          rightIcon={<ArrowDownOneIcon size={16} />}
          disabled={disabled}
        >
          {modelName}
        </Button>
      }
    >
      {/* Picking a model or toggling adaptive thinking isn't a reason
          to keep this dropdown open — clone in an onClose that closes
          it. `modelMenu` is always a <ModelMenu/> in practice, which
          reads this prop; a caller-supplied node without it just
          ignores the prop. */}
      {React.isValidElement(modelMenu)
        ? React.cloneElement(modelMenu as React.ReactElement<{ onClose?: () => void }>, {
            onClose: () => setModelMenuOpen(false),
          })
        : modelMenu}
    </Dropdown.Float>
  ) : (
    <Button className="kaya-model-btn"
      variant="ghost"
      size={size}
      leftIcon={<ModelIcon model={modelIcon ?? modelName} size={16} />}
      rightIcon={<ArrowDownOneIcon size={16} />}
      onClick={onModelClick}
      disabled={disabled}
    >
      {modelName}
    </Button>
  );
}
