"use client";

import { Pin, File, UserPlus, GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RightSidebarPanel } from "./app-layout";

interface RightSidebarCollapsedProps {
  activePanel: RightSidebarPanel | null;
  onSelect: (panel: RightSidebarPanel) => void;
  isCompareActive: boolean;
  onCompareClick: () => void;
  className?: string;
}

type CollapsedButtonConfig = {
  panel: RightSidebarPanel;
  label: string;
  icon: typeof Pin;
  helperLabel?: string;
  disabled?: boolean;
};

const BUTTONS: CollapsedButtonConfig[] = [
  {
    panel: "pinboard",
    label: "Pin",
    icon: Pin,
    disabled: false,
  },
  {
    panel: "files",
    label: "Files",
    icon: File,
    disabled: true,
  },
  {
    panel: "personas",
    label: "Persona",
    icon: UserPlus,
    disabled: true,
  },
  {
    panel: "compare",
    label: "Compare",
    helperLabel: "Models",
    icon: GitCompare,
    disabled: false,
  },
];

export function RightSidebarCollapsed({
  activePanel,
  onSelect,
  isCompareActive,
  onCompareClick,
  className,
}: RightSidebarCollapsedProps) {
  return (
    <aside className={cn("w-[65px] h-full bg-white border-l border-main-border shrink-0 flex flex-col items-center justify-center")}>
      <div className="w-full h-full flex flex-col items-center gap-7 pt-5.5 px-1.5">
        {BUTTONS.map(({ panel, label, icon: Icon, helperLabel, disabled }) => {
          const isComparePanel = panel === "compare";
          const isActive = isComparePanel ? isCompareActive : activePanel === panel;
          const handleClick = isComparePanel
            ? onCompareClick
            : () => !disabled && onSelect(panel);
          return (
            <Button
              key={panel}
              variant="ghost"
              className={cn(
                "sidebar-collapsed-button w-[55px] cursor-pointer text-[#1E1E1E]",
                helperLabel ? "min-h-[64px] " : "min-h-[50px]",
                disabled
                  ? disabled
                  : isActive
                  ? "sidebar-collapsed-button--active text-white hover:text-white bg-[#1E1E1E] hover:bg-black border-2 border-[#1E1E1E] transition-all duration-300"
                  : "sidebar-collapsed-button--inactive border-2 border-transparent"
              )}
              onClick={handleClick}
              aria-pressed={isActive}
              disabled={disabled}
            >
              <Icon strokeWidth={1.4} className="size-[28px] shrink-0 pt-1 " />
              <span className="font-semibold text-center text-[11px]">
                {label}
                {helperLabel ? (
                  <>
                    <br />
                    {helperLabel}
                  </>
                ) : null}
              </span>
            </Button>
          );
        })}
      </div>
    </aside>
  );
}
