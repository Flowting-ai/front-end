"use client";

import { Pin, File, UserPlus, GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RightSidebarPanel } from "./app-layout";

interface RightSidebarCollapsedProps {
  activePanel: RightSidebarPanel | null;
  onSelect: (panel: RightSidebarPanel) => void;
  className?: string;
}

type CollapsedButtonConfig = {
  panel: RightSidebarPanel;
  label: string;
  icon: typeof Pin;
  helperLabel?: string;
};

const BUTTONS: CollapsedButtonConfig[] = [
  {
    panel: "pinboard",
    label: "Pin",
    icon: Pin,
  },
  {
    panel: "files",
    label: "Files",
    icon: File,
  },
  {
    panel: "personas",
    label: "Persona",
    icon: UserPlus,
  },
  {
    panel: "compare",
    label: "Compare",
    helperLabel: "Models",
    icon: GitCompare,
  },
];

export function RightSidebarCollapsed({
  activePanel,
  onSelect,
  className,
}: RightSidebarCollapsedProps) {
  return (
    <aside
      className={cn(
        "hidden h-full w-[68px] flex-shrink-0 flex-col items-center justify-center border-l border-[#d9d9d9] bg-white lg:flex",
        className
      )}
    >
      <div className="flex h-full w-full flex-col items-center gap-6 px-[13px] py-6">
        {BUTTONS.map(({ panel, label, icon: Icon, helperLabel }) => {
          const isActive = activePanel === panel;
          return (
            <Button
              key={panel}
              variant="ghost"
              className={cn(
                "flex h-[52px] w-[52px] flex-col items-center gap-1 rounded-xl border border-transparent p-1 text-[#1e1e1e] transition-all",
                isActive
                  ? "border-[#1e1e1e] bg-[#f3f3f3]"
                  : "hover:border-[#c9c9c9] hover:bg-[#f5f5f5]"
              )}
              onClick={() => onSelect(panel)}
              aria-pressed={isActive}
            >
              <Icon className="h-[24px] w-[24px] text-[#1e1e1e]" strokeWidth={1.5} />
              <span className="text-center text-[10px] font-semibold leading-[130%] text-[#1e1e1e]">
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
