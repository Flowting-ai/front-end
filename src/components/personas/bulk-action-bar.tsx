"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface BulkAction {
  label: string;
  icon?: React.ReactNode;
  tone?: "default" | "danger";
  onClick: () => void;
}

export interface BulkActionBarProps {
  selectedCount: number;
  actions: BulkAction[];
  onClear: () => void;
  className?: string;
}

export const BulkActionBar = React.forwardRef<HTMLDivElement, BulkActionBarProps>(
  ({ selectedCount, actions, onClear, className }, ref) => {
    if (selectedCount === 0) return null;

    return (
      <div
        ref={ref}
        className={cn(
          "z-50 sticky bottom-0 left-0 rounded-[16px] border border-[var(--general-border,#e5e5e5)] bg-[var(--general-input,#ffffff)] p-4 shadow-[0_12px_20px_rgba(15,23,42,0.08)]",
          "space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-6",
          className
        )}
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--colors-gray-500,#6b7280)]">
            Bulk Actions
          </p>
          <p className="text-sm text-[var(--colors-gray-700,#374151)]">
            {selectedCount} {selectedCount === 1 ? "selection" : "selections"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              onClick={action.onClick}
              className={cn(
                "gap-2 rounded-full px-4 py-2 text-sm font-medium",
                action.tone === "danger"
                  ? "bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FECACA]"
                  : "bg-[var(--colors-gray-900,#0f172a)] text-white hover:bg-[#111827]"
              )}
            >
              {action.icon}
              <span>{action.label}</span>
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full border border-[var(--general-border,#e5e5e5)] bg-white"
            onClick={onClear}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Clear selection</span>
          </Button>
        </div>
      </div>
    );
  }
);

BulkActionBar.displayName = "BulkActionBar";
