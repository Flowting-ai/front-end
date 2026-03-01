"use client";

import { Pin, GitCompare } from "lucide-react";
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
    panel: "compare",
    label: "Compare",
    helperLabel: "Models",
    icon: GitCompare,
    disabled: false,
  },
  // References panel is opened from the "Sources" button on AI messages.
  //   {
  //   panel: "personas",
  //   label: "Persona",
  //   icon: UserPlus,
  //   disabled: true,
  // },
  // {
  //   panel: "files",
  //   label: "Files",
  //   icon: File,
  //   disabled: true,
  // },
];

export function RightSidebarCollapsed({
  activePanel,
  onSelect,
  isCompareActive,
  onCompareClick,
}: RightSidebarCollapsedProps) {
  return (
    <aside
      className={cn(
        "w-[65px] h-full bg-main-bg1 border-l border-main-border shrink-0 flex flex-col items-center justify-center",
      )}
    >
      <div className="w-full h-full flex flex-col items-center gap-7 pt-5.5 px-1.5">
        {BUTTONS.map(({ panel, label, icon: Icon, helperLabel, disabled }) => {
          const isComparePanel = panel === "compare";
          const isActive = isComparePanel
            ? isCompareActive
            : activePanel === panel;
          const handleClick = isComparePanel
            ? onCompareClick
            : () => !disabled && onSelect(panel);
          return (
            <Button
              key={panel}
              variant="ghost"
              className={cn(
                "sidebar-collapsed-button w-[55px] cursor-pointer text-rsb-text flex flex-col items-center justify-center transition-all duration-300",
                helperLabel ? "min-h-[64px] " : "min-h-[50px]",
                disabled
                  ? disabled
                  : isActive
                    ? " text-rsb-text hover:text-rsb-text bg-rsb-button-bg-active hover:bg-rsb-button-bg-active border-2 border-main-border"
                    : " hover:bg-rsb-button-bg-active border-2 border-transparent",
              )}
              onClick={handleClick}
              aria-pressed={isActive}
              disabled={disabled}
            >
              <Icon strokeWidth={1.4} className="text-rsb-icon size-[28px] shrink-0 pt-1" />
              <span className="font-semibold text-center text-[11px]">
                {label}
                {helperLabel ? (
                  <>
                    <br />
                    <span className="text-[11px]">{helperLabel}</span>
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
