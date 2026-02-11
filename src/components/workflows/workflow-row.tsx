"use client";

import * as React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  FilePenLine,
  MoreVertical,
  Pause,
  Play,
  Trash2,
  Workflow,
  MessageSquare,
} from "lucide-react";

export interface Consumer {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  lastActivity: string;
  status: "active" | "paused";
}

export interface WorkflowItem {
  id: string;
  name: string;
  description?: string;
  status: "active" | "paused" | "inactive";
  creditUsage: number;
  consumers: Consumer[];
  consumersCount: number;
  nodeCount: number;
  edgeCount: number;
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
  version?: string;
  tags?: string[];
}

export interface WorkflowRowProps {
  workflow: WorkflowItem;
  onPause?: () => void;
  onResume?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onView?: () => void;
  onChat?: () => void;
}

export const WorkflowRow = React.forwardRef<
  HTMLTableRowElement,
  WorkflowRowProps
>(({ workflow, onPause, onResume, onDelete, onEdit, onView, onChat }, ref) => {
  const formatCredits = (credits: number): string => {
    if (credits >= 1000000) {
      return `${(credits / 1000000).toFixed(2)}M credits`;
    } else if (credits >= 1000) {
      return `${Math.round(credits / 1000)}K credits`;
    }
    return `${credits} credits`;
  };

  const statusStyles: Record<WorkflowItem["status"], string> = {
    active: "bg-[#E4F5EC] text-[#166534]",
    paused: "bg-[#FEF3C7] text-[#92400E]",
    inactive: "bg-[#F3F4F6] text-[#374151]",
  };

  return (
    <TableRow
      ref={ref}
      className={cn(
        "group h-[55px] border-b border-[#E5E5E5] text-[var(--colors-gray-900,#0f172a)] transition-colors bg-white hover:bg-[#F9FAFB]",
      )}
    >
      <TableCell colSpan={8} className="p-0 bg-white">
        <div className="flex w-full items-center">
          {/* Spacer */}
          <div className="w-[47px]"></div>

          {/* Workflow Unit */}
          <div className="w-[180px] h-[55px] flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-gradient-to-br from-blue-400 to-blue-600 text-white flex-shrink-0">
              <Workflow className="h-5 w-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-[14px] leading-[17px] tracking-[-0.01em] text-[var(--colors-gray-900,#0f172a)] truncate">
                {workflow.name}
              </span>
              {workflow.description && (
                <span className="text-[12px] text-[var(--colors-gray-500,#6b7280)] line-clamp-1">
                  {workflow.description}
                </span>
              )}
            </div>
          </div>

          {/* Credit Usage */}
          <div className="w-[180px] h-9 flex items-center justify-center">
            <div className="h-9 flex items-center justify-center py-1 px-2">
              <span className="font-mono text-[15px] tracking-[-0.02em] text-[var(--colors-gray-900,#0f172a)]">
                {formatCredits(workflow.creditUsage)}
              </span>
            </div>
          </div>

          {/* Consumers */}
          <div className="w-[180px] h-8 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {workflow.consumers.slice(0, 3).map((consumer) => (
                  <Avatar
                    key={consumer.id}
                    className="h-8 w-8 border-2 border-[var(--general-input,#ffffff)] shadow-[0_2px_6px_rgba(15,23,42,0.12)]"
                  >
                    <AvatarImage src={consumer.avatar} alt={consumer.name} />
                    <AvatarFallback className="text-xs">
                      {consumer.name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              {workflow.consumersCount > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{workflow.consumersCount - 3}
                </span>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="w-[180px] h-8 flex items-center justify-center">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                statusStyles[workflow.status],
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  workflow.status === "active" && "bg-[#16A34A]",
                  workflow.status === "paused" && "bg-[#D97706]",
                  workflow.status === "inactive" && "bg-[#6B7280]",
                )}
              />
              {workflow.status.charAt(0).toUpperCase() +
                workflow.status.slice(1)}
            </span>
          </div>

          {/* Last Activity */}
          <div className="w-[180px] h-8 flex items-center justify-center">
            <span className="text-sm text-[var(--colors-gray-600,#4b5563)]">
              {workflow.lastActivity}
            </span>
          </div>

          {/* Actions */}
          <div className="flex-1 h-8 flex items-center justify-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-full p-0"
              onClick={onChat}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            {/* <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 rounded-full p-0"
                onClick={onEdit}
              >
                <FilePenLine className="h-4 w-4" />
              </Button> */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 rounded-full p-0"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[160px]">
                <DropdownMenuItem
                  onClick={workflow.status === "active" ? onPause : onResume}
                >
                  {workflow.status === "active" ? (
                    <>
                      <Pause className="mr-2 h-4 w-4" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Resume
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit}>
                  <FilePenLine className="h-4 w-4 mr-2" />
                  Edit Workflow
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
});

WorkflowRow.displayName = "WorkflowRow";
