"use client";

import * as React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, FilePenLine, MessageSquare, MoreVertical, Pause, Play, Trash2 } from "lucide-react";
import { ConsumerRow, Consumer } from "@/components/personas/consumer-row";

export type { Consumer };

export interface Persona {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  status: "active" | "paused" | "inactive";
  tokensUsed: number;
  consumersCount: number;
  consumers: Consumer[];
  createdAt: string;
  lastActivity: string;
  version?: string;
}

export interface PersonaRowProps {
  persona: Persona;
  expanded?: boolean;
  onToggleExpand?: () => void;
  selectedConsumerIds?: string[];
  onToggleConsumer?: (consumerId: string) => void;
  onPause?: () => void;
  onResume?: () => void;
  onDelete?: () => void;
  onModifyConfig?: () => void;
  onSelectAllConsumers?: () => void;
  onPauseAllConsumers?: () => void;
  onDeleteAllConsumers?: () => void;
}

export const PersonaRow = React.forwardRef<HTMLTableRowElement, PersonaRowProps>(
  (
    {
      persona,
      expanded = false,
      onToggleExpand,
      selectedConsumerIds = [],
      onToggleConsumer,
      onPause,
      onResume,
      onDelete,
      onModifyConfig,
      onSelectAllConsumers,
      onPauseAllConsumers,
      onDeleteAllConsumers,
    },
    ref
  ) => {
    const formatTokens = (tokens: number): string => {
      if (tokens >= 1000000) {
        return `${(tokens / 1000000).toFixed(2)}M tkns`;
      } else if (tokens >= 1000) {
        return `${Math.round(tokens / 1000)}K tkns`;
      }
      return `${tokens} tkns`;
    };

    const allConsumersSelected =
      persona.consumers.length > 0 &&
      persona.consumers.every((c) => selectedConsumerIds.includes(c.id));

    const someConsumersSelected =
      !allConsumersSelected &&
      persona.consumers.some((c) => selectedConsumerIds.includes(c.id));

    const statusStyles: Record<Persona["status"], string> = {
      active: "bg-[#E4F5EC] text-[#166534]",
      paused: "bg-[#FEF3C7] text-[#92400E]",
      inactive: "bg-[#F3F4F6] text-[#374151]",
    };

    const personaConsumerIds = persona.consumers.map((consumer) => consumer.id);
    const selectedConsumersForPersona = personaConsumerIds.filter((id) => selectedConsumerIds.includes(id));
    const hasSelectedConsumers = selectedConsumersForPersona.length > 0;

    const selectAllConsumersLocally = () => {
      if (!onToggleConsumer) return;
      persona.consumers.forEach((consumer) => {
        if (!selectedConsumerIds.includes(consumer.id)) {
          onToggleConsumer(consumer.id);
        }
      });
    };

    const handleSelectAllConsumersClick = () => {
      if (onSelectAllConsumers) {
        onSelectAllConsumers();
        return;
      }
      selectAllConsumersLocally();
    };

    const handlePauseAllConsumersClick = () => {
      onPauseAllConsumers?.();
    };

    const handleDeleteAllConsumersClick = () => {
      onDeleteAllConsumers?.();
    };

    return (
      <>
        <TableRow
          ref={ref}
          className={cn(
            "group h-[55px] border-b border-[#E5E5E5] text-[var(--colors-gray-900,#0f172a)] transition-colors",
            expanded ? "bg-[#F5F5F5]" : "bg-white hover:bg-[#F9FAFB]"
          )}
        >
          <TableCell colSpan={8} className={cn("p-0", expanded ? "bg-[#F5F5F5]" : "bg-white")}>
            <div className="flex w-full items-center">
              <div className="w-[10px]"></div>
              <div className="w-[200px] h-[55px] flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleExpand}
                className="h-7 w-7 flex-shrink-0 rounded-full border border-[var(--general-border,#e5e5e5)] p-0 text-[var(--colors-gray-600,#4b5563)]"
                disabled={persona.consumers.length === 0}
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span className="sr-only">
                  {expanded ? "Collapse" : "Expand"} persona
                </span>
              </Button>
              <Avatar className="h-10 w-10 border border-[var(--general-border,#e5e5e5)]">
                <AvatarImage src={persona.avatar} alt={persona.name} />
                <AvatarFallback>
                  {persona.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-semibold text-[14px] leading-[17px] tracking-[-0.01em] text-[var(--colors-gray-900,#0f172a)]">
                  {persona.name}
                </span>
                {persona.description && (
                  <span className="text-[12px] text-[var(--colors-gray-500,#6b7280)] line-clamp-1">
                    {persona.description}
                  </span>
                )}
                </div>
              </div>
              <div className="w-[110px] h-9 flex items-center justify-end ml-3">
                <div className="h-9 flex items-center justify-end py-1 px-2">
                  <span className="font-mono text-[15px] tracking-[-0.02em] text-[var(--colors-gray-900,#0f172a)]">
                    {formatTokens(persona.tokensUsed)}
                  </span>
                </div>
              </div>
              <div className="w-[130px] h-8 flex items-center ml-3">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {persona.consumers.slice(0, 3).map((consumer) => (
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
              {persona.consumersCount > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{persona.consumersCount - 3}
                </span>
              )}
            </div>
          </div>
          <div className="w-[95px] h-9 flex items-center ml-3">
            <div className="h-9 flex items-center py-1 px-2.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize",
                  statusStyles[persona.status]
                )}
              >
                {persona.status === "active" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#166534]"></span>
                )}
                {persona.status}
              </span>
            </div>
          </div>
          <div className="w-[130px] h-9 flex items-center ml-3">
            <div className="h-9 flex items-center py-1 px-2.5">
              <span className="text-[12px] text-[var(--colors-gray-500,#6b7280)]">
                {persona.lastActivity}
              </span>
            </div>
          </div>
          <div className="flex items-center ml-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(event) => event.stopPropagation()}
                className="h-9 w-9 rounded-full bg-[var(--general-secondary,#F5F5F5)] text-[#111827] hover:bg-[#E5E7EB]"
              >
                <MessageSquare className="h-4 w-4" />
                <span className="sr-only">Message {persona.name}</span>
              </Button>
              <div className="ml-2">
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
              <DropdownMenuContent align="end" className="w-[196px] rounded-[8px] bg-white p-1 border-0 shadow-lg">
                <DropdownMenuItem 
                  onClick={onModifyConfig}
                  className="h-8 min-h-[32px] gap-2 rounded-[6px] px-0.5 py-[5.5px] text-[#111827] hover:bg-[#E5E5E5] focus:bg-[#E5E5E5] cursor-pointer"
                >
                  <FilePenLine className="h-4 w-4 ml-2" />
                  Modify Configuration
                </DropdownMenuItem>
                {persona.status === "active" ? (
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
          </div>
        </TableCell>
      </TableRow>
        {expanded && persona.consumers.length > 0 && (
          <>
            <TableRow className="bg-transparent">
              <TableCell
                colSpan={8}
                className="border-t-0 bg-[#FAFAFA] p-0 align-top"
              >
                <div className="flex flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-3 pb-2">
                    <div className="space-y-0.5">
                      <p className="text-[13px] font-semibold text-[#111827]">Resource Consumers</p>
                      <p className="text-[12px] text-[#6B7280]">
                        {persona.consumers.length} {persona.consumers.length === 1 ? "user" : "users"} connected
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <button
                        type="button"
                        className={cn(
                          "flex items-center gap-1.5 text-[12px] font-medium text-[#374151] transition-colors hover:text-[#F59E0B]",
                          !hasSelectedConsumers && "pointer-events-none opacity-40"
                        )}
                        onClick={handlePauseAllConsumersClick}
                      >
                        <Pause className="h-[14px] w-[14px]" />
                        <span>Pause all</span>
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "flex items-center gap-1.5 text-[12px] font-medium text-[#374151] transition-colors hover:text-[#EF4444]",
                          !hasSelectedConsumers && "pointer-events-none opacity-40"
                        )}
                        onClick={handleDeleteAllConsumersClick}
                      >
                        <Trash2 className="h-[14px] w-[14px]" />
                        <span>Delete all</span>
                      </button>
                      <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-[#374151]">
                        <Checkbox
                          checked={allConsumersSelected ? true : someConsumersSelected ? "indeterminate" : false}
                          onCheckedChange={() => {
                            if (onSelectAllConsumers) {
                              onSelectAllConsumers();
                              return;
                            }
                            handleSelectAllConsumersClick();
                          }}
                          className="h-4 w-4 rounded-[3px] border-[2px] border-[#D1D5DB] data-[state=checked]:border-[#6366F1] data-[state=checked]:bg-[#6366F1]"
                        />
                        Select all
                      </label>
                    </div>
                  </div>
                </div>
              </TableCell>
            </TableRow>
            {persona.consumers.map((consumer) => (
              <ConsumerRow
                key={consumer.id}
                consumer={consumer}
                selected={selectedConsumerIds.includes(consumer.id)}
                onToggle={() => onToggleConsumer?.(consumer.id)}
              />
            ))}
          </>
        )}
      </>
    );
  }
);

PersonaRow.displayName = "PersonaRow";
