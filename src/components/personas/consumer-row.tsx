"use client";

import * as React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageSquare, MoreVertical, Pause, Play, Trash2 } from "lucide-react";

export interface Consumer {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  tokensUsed: number;
  lastActivity: string;
  status: "active" | "paused" | "inactive";
}

export interface ConsumerRowProps {
  consumer: Consumer;
  selected?: boolean;
  onToggle?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onDelete?: () => void;
}

export const ConsumerRow = React.forwardRef<HTMLTableRowElement, ConsumerRowProps>(
  ({ consumer, selected = false, onToggle, onPause, onResume, onDelete }, ref) => {
    const formatTokens = (tokens: number): string => {
      if (tokens >= 1000000) {
        return `${(tokens / 1000000).toFixed(2)}M tkns`;
      } else if (tokens >= 1000) {
        return `${Math.round(tokens / 1000)}K tkns`;
      }
      return `${tokens} tkns`;
    };

    const statusStyles: Record<Consumer["status"], string> = {
      active: "bg-[#E4F5EC] text-[#166534]",
      paused: "bg-[#FEF3C7] text-[#92400E]",
      inactive: "bg-[#F3F4F6] text-[#374151]",
    };

    return (
      <TableRow
        ref={ref}
        className="border-b border-[#E5E5E5] bg-[#F5F5F5] text-[var(--colors-gray-800,#1f2937)]"
      >
        <TableCell colSpan={8} className="p-0 bg-[#F5F5F5]">
          <div className="flex w-full items-center">
            <div className="w-[10px]"></div>
            <div className="w-[200px] flex items-center py-4 pl-1">
              <div className="flex items-center gap-3">
            <Checkbox
              checked={selected}
              onCheckedChange={onToggle}
              aria-label={`Select ${consumer.name}`}
              className="h-4 w-4 rounded-[2px] border-[2px] border-[#D1D5DB] data-[state=checked]:border-[#6366F1] data-[state=checked]:bg-[#6366F1]"
            />
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 border border-[var(--general-border,#e5e5e5)]">
                <AvatarImage src={consumer.avatar} alt={consumer.name} />
                <AvatarFallback className="text-xs">
                  {consumer.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{consumer.name}</span>
              </div>
                </div>
              </div>
            </div>
            <div className="w-[110px] flex items-center justify-end ml-3">
              <span className="font-mono text-xs tracking-[-0.01em] text-[var(--colors-gray-900,#0f172a)]">
                {formatTokens(consumer.tokensUsed)}
              </span>
            </div>
            <div className="w-[130px] flex items-center ml-3">
              <span className="text-xs text-[var(--colors-gray-500,#6b7280)]">
                {consumer.email}
              </span>
            </div>
            <div className="w-[95px] flex items-center ml-3">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize",
                  statusStyles[consumer.status]
                )}
              >
                {consumer.status === "active" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#166534]"></span>
                )}
                {consumer.status}
              </span>
            </div>
            <div className="w-[130px] flex items-center ml-3">
              <span className="text-xs text-[var(--colors-gray-500,#6b7280)]">
                {consumer.lastActivity}
              </span>
            </div>
            <div className="flex items-center ml-3">
              <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 rounded-full border border-[var(--general-border,#e5e5e5)] p-0 text-[var(--colors-gray-600,#4b5563)]"
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[150px] rounded-[8px] bg-white p-1 border-0 shadow-lg">
              {consumer.status === "active" ? (
                <DropdownMenuItem 
                  onClick={onPause}
                  className="h-8 min-h-[32px] gap-2 rounded-[6px] px-0.5 py-[5.5px] text-[#111827] hover:bg-[#E5E5E5] focus:bg-[#E5E5E5] cursor-pointer"
                >
                  <Pause className="h-4 w-4 ml-2" />
                  Pause
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem 
                  onClick={onResume}
                  className="h-8 min-h-[32px] gap-2 rounded-[6px] px-0.5 py-[5.5px] text-[#111827] hover:bg-[#E5E5E5] focus:bg-[#E5E5E5] cursor-pointer"
                >
                  <Play className="h-4 w-4 ml-2" />
                  Resume
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                onClick={onDelete}
                className="h-8 min-h-[32px] gap-2 rounded-[6px] px-0.5 py-[5.5px] text-[#111827] hover:bg-[#E5E5E5] focus:bg-[#E5E5E5] cursor-pointer"
              >
                <Trash2 className="h-4 w-4 ml-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
            </div>
          </div>
        </TableCell>
      </TableRow>
    );
  }
);

ConsumerRow.displayName = "ConsumerRow";
