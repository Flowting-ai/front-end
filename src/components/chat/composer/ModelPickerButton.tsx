"use client";

import React, { useCallback, useState } from "react";
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

// The model name is the one label in the footer that carries a value rather
// than naming an action, and it sat a step below the text the composer itself
// renders. On the full-size composer it tracks the input (16px/22px); the
// compact one stays on the 14px body step its own text uses.
function modelLabelStyle(size: ComposerButtonSize): React.CSSProperties {
  return size === "md"
    ? { fontSize: "var(--font-size-body-lg)", lineHeight: "var(--line-height-body-lg)", fontWeight: "var(--font-weight-medium)" }
    : { fontSize: "var(--font-size-body)", lineHeight: "var(--line-height-body)", fontWeight: "var(--font-weight-medium)" };
}

/**
 * The caret, pointing the way the menu actually opens — down for a dropdown, up
 * for a drop-up. One icon rotated, not two different glyphs, so the two states
 * are the same shape.
 */
function MenuCaret({ side, shown }: { side: "top" | "bottom"; shown: boolean }) {
  return (
    <span
      style={{
        display:    "inline-flex",
        transform:  side === "top" ? "rotate(180deg)" : "none",
        // Hidden until the button is reached — the model name is the point, the
        // caret only matters once you go for it. Opacity, not display, so the
        // button never changes width as it appears.
        opacity:    shown ? 1 : 0,
        transition: "transform 140ms ease, opacity 140ms ease",
      }}
    >
      <ArrowDownOneIcon size={16} />
    </span>
  );
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
  // Starts from the requested placement and is corrected to where the panel
  // really landed — Dropdown.Float's autoFlipVertical can flip it when the
  // composer sits too close to the viewport edge.
  const [menuSide, setMenuSide] = useState<"top" | "bottom">(
    modelMenuPlacement.startsWith("top") ? "top" : "bottom",
  );
  const handleSideChange = useCallback((side: string) => {
    if (side === "top" || side === "bottom") setMenuSide(side);
  }, []);
  // Focus counts as reaching for it too, so the caret is there for keyboard use.
  const [hovered, setHovered] = useState(false);
  const hoverProps = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    onFocus:      () => setHovered(true),
    onBlur:       () => setHovered(false),
  };

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
        rightIcon={<MenuCaret side={menuSide} shown={false} />}
        style={{ ...modelLabelStyle(size), opacity: 0.45, pointerEvents: "none" }}
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
      onSideChange={handleSideChange}
      trigger={
        <Button className="kaya-model-btn"
          variant="ghost"
          size={size}
          leftIcon={<ModelIcon model={modelIcon ?? modelName} size={16} />}
          rightIcon={<MenuCaret side={menuSide} shown={hovered || modelMenuOpen} />}
          style={modelLabelStyle(size)}
          disabled={disabled}
          {...hoverProps}
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
      rightIcon={<MenuCaret side={menuSide} shown={hovered} />}
      style={modelLabelStyle(size)}
      onClick={onModelClick}
      disabled={disabled}
      {...hoverProps}
    >
      {modelName}
    </Button>
  );
}
