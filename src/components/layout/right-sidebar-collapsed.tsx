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
    disabled: true,
  },
];

export function RightSidebarCollapsed({
  activePanel,
  onSelect,
  className,
}: RightSidebarCollapsedProps) {
  return (
    <aside className={cn("sidebar-collapsed-container", className)}>
      <div className="sidebar-collapsed-stack">
        {BUTTONS.map(({ panel, label, icon: Icon, helperLabel, disabled }) => {
          const isActive = activePanel === panel;
          return (
            <Button
              key={panel}
              variant="ghost"
              className={cn(
                "sidebar-collapsed-button--size52",
                disabled
                  ? "sidebar-collapsed-button--disabled"
                  : isActive
                  ? "sidebar-collapsed-button--active"
                  : "sidebar-collapsed-button--inactive"
              )}
              onClick={() => !disabled && onSelect(panel)}
              aria-pressed={isActive}
              disabled={disabled}
            >
              <Icon className="sidebar-collapsed-icon" strokeWidth={1.5} />
              <span className="sidebar-collapsed-label">
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
