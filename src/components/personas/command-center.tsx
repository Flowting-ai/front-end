"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

export interface CommandCenterProps extends React.HTMLAttributes<HTMLDivElement> {
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  children?: React.ReactNode;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Personas" },
  { value: "active", label: "Active Personas" },
  { value: "paused", label: "Paused Personas" },
  { value: "inactive", label: "Inactive Personas" },
];

export const CommandCenter = React.forwardRef<HTMLDivElement, CommandCenterProps>(
  ({ statusFilter, onStatusFilterChange, children, className, ...rest }, ref) => {
    const currentStatusLabel =
      STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ?? STATUS_OPTIONS[0].label;

    return (
      <Card
        ref={ref}
        role="region"
        className={cn(
          "w-full max-w-full border border-[var(--general-border,#e5e5e5)] bg-[var(--general-input,#ffffff)] px-[1px] py-0 text-[var(--colors-gray-700,#374151)] shadow-[0_8px_15px_rgba(0,0,0,0.05)]",
          "!rounded-[16px]",
          className
        )}
        {...rest}
      >
        <div className="flex flex-col gap-[12px] rounded-[14px] bg-white px-4 pt-[14px] pb-0">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-[24px] font-semibold leading-[28.8px] tracking-[-0.03em] text-[var(--colors-gray-900,#0f172a)]">
              Command Center
            </p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="inline-flex items-center rounded-[8px] text-sm font-medium text-[var(--colors-gray-700,#374151)] hover:text-black"
                  style={{
                    width: '128.25px',
                    height: '36px',
                    minHeight: '36px',
                    gap: '8px',
                    borderRadius: '8px',
                    paddingTop: '7.5px',
                    paddingRight: '4px',
                    paddingBottom: '7.5px',
                    paddingLeft: '4px',
                    background: 'var(--unofficial-ghost-hover, #0000000D)'
                  }}
                >
                  {currentStatusLabel}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px] rounded-[8px] bg-white p-1 border-0 shadow-lg">
                {STATUS_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onSelect={() => {
                      onStatusFilterChange(option.value);
                    }}
                    className="h-8 min-h-[32px] gap-2 rounded-[6px] px-0.5 py-[5.5px] text-[#111827] hover:bg-[#E5E5E5] hover:text-black focus:bg-[#E5E5E5] focus:text-black cursor-pointer"
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p className="text-sm leading-[19.6px] text-[var(--colors-gray-600,#4b5563)]">
            Real-time observation of intelligence infrastructure.
          </p>
        </div>
        {children && <div className="mt-[14px] px-4 pb-2">{children}</div>}
      </Card>
    );
  }
);

CommandCenter.displayName = "CommandCenter";
