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
import { 
  ChevronDown, 
  ChevronRight, 
  FilePenLine, 
  MessageSquare, 
  MoreVertical, 
  Pause, 
  Play, 
  Trash2 
} from "lucide-react";
import userAvatar from "@/avatars/userAvatar.png";
import userAvatar2 from "@/avatars/userAvatar2.png";
import userAvatar3 from "@/avatars/userAvatar3.png";

// Shared types
export interface Consumer {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  tokensUsed: number;
  lastActivity: string;
  status: "active" | "paused" | "inactive";
}

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

// Unified row props
interface BaseRowProps {
  variant: "persona" | "consumer";
  id: string;
  name: string;
  avatar?: string;
  tokensUsed: number;
  status: "active" | "paused" | "inactive";
  lastActivity: string;
  onPause?: () => void;
  onResume?: () => void;
  onDelete?: () => void;
}

interface PersonaRowProps extends BaseRowProps {
  variant: "persona";
  description?: string;
  consumersCount: number;
  consumers: Consumer[];
  expanded?: boolean;
  onToggleExpand?: () => void;
  onModifyConfig?: () => void;
  onChat?: () => void;
  selectedConsumerIds?: string[];
  onToggleConsumer?: (consumerId: string) => void;
  onSelectAllConsumers?: () => void;
  onPauseAllConsumers?: () => void;
  onDeleteAllConsumers?: () => void;
}

interface ConsumerRowProps extends BaseRowProps {
  variant: "consumer";
  email: string;
  selected?: boolean;
  onToggle?: () => void;
}

export type UnifiedRowProps = PersonaRowProps | ConsumerRowProps;

// Shared utility functions
const formatTokens = (tokens: number): string => {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M tkns`;
  } else if (tokens >= 1000) {
    return `${Math.round(tokens / 1000)}K tkns`;
  }
  return `${tokens} tkns`;
};

const statusStyles: Record<"active" | "paused" | "inactive", string> = {
  active: "bg-[#E4F5EC] text-[#166534]",
  paused: "bg-[#FEF3C7] text-[#92400E]",
  inactive: "bg-[#F3F4F6] text-[#374151]",
};

// Column widths - single source of truth with responsive breakpoints
// 
// RESPONSIVE DESIGN SYSTEM:
// Mobile-first approach with progressive enhancement across breakpoints
//
// Breakpoints:
// - xs (default): < 640px (mobile phones like 390x844)
// - sm: >= 640px (large mobile)
// - md: >= 768px (tablets)
// - lg: >= 1024px (laptops)
// - xl: >= 1280px (large desktops)
//
// Key Principles:
// 1. All columns use shrink-0 to prevent compression and overlapping
// 2. Widths progressively increase at larger breakpoints
// 3. Header row uses IDENTICAL width classes to ensure perfect alignment
// 4. Text sizing scales with container width for optimal readability
// 5. On mobile, table uses w-fit to eliminate empty space after Actions column
//
// Column Width Progression:
// - Spacer: 8px -> 10px -> 12px (small padding for visual breathing room)
// - Main (Persona/Consumer): 140px -> 160px -> 170px -> 180px -> 190px (reduced for space optimization)
// - Tokens: 70px -> 80px -> 100px -> 110px (compact for numeric data)
// - Middle (Consumers/Email): 90px -> 100px -> 130px -> 150px -> 180px (expands for avatar stacks)
// - Status: 75px -> 85px -> 95px -> 100px (compact for status badges)
// - Last Activity: 80px -> 100px -> 120px -> 130px (time stamps)
// - Actions: 80px -> 90px -> 100px -> 110px (icon buttons)
//
const COLUMN_WIDTHS = {
  main: "w-[227px]",
  tokens: "w-[180px]",
  middle: "w-[180px]",
  status: "w-[180px]",
  lastActivity: "w-[180px]",
  actions: "flex-1",
  gap: "gap-2",
};

export const UnifiedRow = React.forwardRef<HTMLTableRowElement, UnifiedRowProps>(
  (props, ref) => {
    const {
      variant,
      id,
      name,
      avatar,
      tokensUsed,
      status,
      lastActivity,
      onPause,
      onResume,
      onDelete,
    } = props;

    const isPersona = variant === "persona";
    const isConsumer = variant === "consumer";

    // Persona-specific props
    const personaProps = isPersona ? (props as PersonaRowProps) : null;
    const consumerProps = isConsumer ? (props as ConsumerRowProps) : null;

    return (
      <TableRow
        ref={ref}
        className={cn(
          "!border-0 border-none",
          isPersona ? "bg-white hover:bg-[#F9FAFB]" : "bg-[#F5F5F5]",
          isPersona ? "h-[55px]" : "h-[48px]",
          "text-[var(--colors-gray-900,#0f172a)] transition-colors"
        )}
      >
        <TableCell 
          colSpan={8} 
          className={cn(
            "p-0",
            isPersona ? "bg-white" : "bg-[#F5F5F5]"
          )}
        >
          <div className="flex w-full items-center h-full overflow-x-auto">

            {/* Main Column: Name + Avatar/Checkbox */}
            <div className={cn(
              COLUMN_WIDTHS.main,
              "flex items-center justify-start shrink-0",
              COLUMN_WIDTHS.gap,
              isPersona ? "h-[55px]" : "h-[48px] pl-1"
            )}>
              {isPersona && personaProps && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={personaProps.onToggleExpand}
                    className="cursor-pointer h-7 w-[46px] h-full rounded-none! shrink-0 p-0 text-[#4b5563] hover:bg-transparent hover:text-black"
                    disabled={personaProps.consumers.length === 0}
                  >
                    {personaProps.expanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="sr-only">
                      {personaProps.expanded ? "Collapse" : "Expand"} persona
                    </span>
                  </Button>
                  <Avatar className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 shrink-0 border border-[var(--general-border,#e5e5e5)]" style={{ opacity: 1 }}>
                    <AvatarImage src={avatar} alt={name} style={{ opacity: 1 }} />
                    <AvatarFallback className="text-[10px] sm:text-xs">
                      {name.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-semibold text-[12px] sm:text-[13px] md:text-[14px] leading-[17px] tracking-[-0.01em] text-[var(--colors-gray-900,#0f172a)] truncate">
                      {name}
                    </span>
                    {personaProps.description && (
                      <span className="hidden md:block text-[11px] md:text-[12px] text-[var(--colors-gray-500,#6b7280)] truncate">
                        {personaProps.description}
                      </span>
                    )}
                  </div>
                </>
              )}
              {isConsumer && consumerProps && (
                <>
                  <Checkbox
                    checked={consumerProps.selected}
                    onCheckedChange={consumerProps.onToggle}
                    aria-label={`Select ${name}`}
                    className="h-[14px] w-[14px] shrink-0 rounded-[4px] border border-[#D4D4D4] data-[state=checked]:border-[#6366F1] data-[state=checked]:bg-[#6366F1]"
                    style={{ 
                      opacity: 1, 
                      top: '1px', 
                      left: '1px',
                      boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)'
                    }}
                  />
                  <Avatar className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 shrink-0 border border-[var(--general-border,#e5e5e5)]">
                    <AvatarImage src={avatar} alt={name} />
                    <AvatarFallback className="text-[10px] sm:text-xs">
                      {name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[12px] sm:text-[13px] md:text-sm font-medium truncate">{name}</span>
                  </div>
                </>
              )}
            </div>

            {/* Token Usage Column */}
            <div className={cn(
              COLUMN_WIDTHS.tokens,
              "flex items-center justify-center shrink-0 px-0",
              isPersona ? "h-[55px]" : "h-[48px]"
            )}>
              {isPersona ? (
                <span className="text-[10px] sm:text-[11px] md:text-[12px] font-semibold leading-[140%] tracking-[0%] text-[var(--colors-gray-900,#0f172a)] text-center capitalize" style={{ fontFamily: 'Inter', fontWeight: 600 }}>
                  {formatTokens(tokensUsed)}
                </span>
              ) : (
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: '86px',
                    height: '24px',
                    minHeight: '24px',
                    borderRadius: '9999px',
                    paddingTop: '3px',
                    paddingRight: '2px',
                    paddingBottom: '3px',
                    paddingLeft: '2px',
                    gap: '6px',
                    opacity: 1,
                    background: '#EEF2FF',
                  }}
                >
                  <span
                    className="text-center align-middle"
                    style={{
                      fontFamily: 'var(--font-geist)',
                      fontWeight: 500,
                      fontStyle: 'normal',
                      fontSize: '12px',
                      lineHeight: '150%',
                      letterSpacing: '0.015em',
                      whiteSpace: 'nowrap',
                      color: '#4F46E7',
                    }}
                  >
                    {formatTokens(tokensUsed)}
                  </span>
                </div>
              )}
            </div>

            {/* Middle Column: Consumers for persona, Email for consumer */}
            <div className={cn(
              COLUMN_WIDTHS.middle,
              "flex items-center justify-center shrink-0 px-0",
              isPersona ? "h-[55px]" : "h-[48px]"
            )}>
              {isPersona && personaProps && (
                <div className="flex items-center relative">
                  <div className="flex -space-x-1 sm:-space-x-1.5 md:-space-x-2">
                    {personaProps.consumers.slice(0, 3).map((consumer, index) => {
                      const stack = [userAvatar2, userAvatar, userAvatar3];
                      const img = stack[index % stack.length] as any;
                      const src = img?.src ?? (img as unknown as string);
                      return (
                      <Avatar
                        key={consumer.id}
                        className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8 border-2 border-[var(--general-input,#ffffff)] shadow-[0_2px_6px_rgba(15,23,42,0.12)]"
                      >
                        <AvatarImage src={src} alt={consumer.name} />
                        <AvatarFallback className="text-[8px] sm:text-[9px] md:text-[10px]">
                          {consumer.name.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      );
                    })}
                  </div>
                  {personaProps.consumersCount > 3 && (
                    <div
                      className="rounded-full flex items-center justify-center shadow-[0_2px_6px_rgba(15,23,42,0.12)] px-2"
                      style={{
                        minWidth: '60px',
                        height: '32px',
                        minHeight: '24px',
                        gap: '6px',
                        opacity: 1,
                        background: 'var(--general-secondary, #F5F5F5)',
                        marginLeft: '-8px',
                        zIndex: 5
                      }}
                    >
                      <span
                        className="text-center align-middle"
                        style={{
                          fontFamily: 'var(--font-geist)',
                          fontWeight: 500,
                          fontStyle: 'normal',
                          fontSize: '12px',
                          lineHeight: '150%',
                          letterSpacing: '0.015em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        +{personaProps.consumersCount - 3} users
                      </span>
                    </div>
                  )}
                </div>
              )}
              {isConsumer && consumerProps && (
                <span
                  className="truncate px-1"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 400,
                    fontStyle: 'normal',
                    fontSize: '10px',
                    lineHeight: '140%',
                    letterSpacing: '0',
                    // textTransform: 'capitalize', 
                    color: 'var(--Text-Default-Secondary, #757575)',
                    verticalAlign: 'middle',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {consumerProps.email}
                </span>
              )}
            </div>

            {/* Status Column */}
            <div className={cn(
              COLUMN_WIDTHS.status,
              "flex items-center justify-center shrink-0 px-0",
              isPersona ? "h-[55px]" : "h-[48px]"
            )}>
              {status === "active" ? (
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: '67px',
                    height: '24px',
                    minHeight: '24px',
                    borderRadius: '9999px',
                    paddingTop: '3px',
                    paddingRight: '2px',
                    paddingBottom: '3px',
                    paddingLeft: '2px',
                    gap: '6px',
                    opacity: 1,
                    background: 'var(--Background-Positive-Secondary, #CFF7D3)'
                  }}
                >
                  <span
                    className="shrink-0 rounded-full"
                    style={{
                      width: '8px',
                      height: '8px',
                      background: 'var(--Background-Positive-Default, #14AE5C)'
                    }}
                  />
                  <span
                    className="text-center align-middle"
                    style={{
                      fontFamily: 'var(--font-geist)',
                      fontWeight: 500,
                      fontStyle: 'normal',
                      fontSize: '12px',
                      lineHeight: '150%',
                      letterSpacing: '0.015em',
                      whiteSpace: 'nowrap',
                      color: 'var(--Background-Positive-Default, #14AE5C)'
                    }}
                  >
                    Active
                  </span>
                </div>
              ) : status === "paused" ? (
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: '67px',
                    height: '24px',
                    minHeight: '24px',
                    borderRadius: '9999px',
                    paddingTop: '3px',
                    paddingRight: '2px',
                    paddingBottom: '3px',
                    paddingLeft: '2px',
                    gap: '4px',
                    opacity: 1,
                    background: 'var(--Background-Warning-Secondary, #FEF3C7)'
                  }}
                >
                  <Pause
                    style={{
                      width: '10px',
                      height: '10px',
                      color: 'var(--Background-Warning-Default, #B45309)'
                    }}
                  />
                  <span
                    className="text-center align-middle"
                    style={{
                      fontFamily: 'var(--font-geist)',
                      fontWeight: 500,
                      fontStyle: 'normal',
                      fontSize: '12px',
                      lineHeight: '150%',
                      letterSpacing: '0.015em',
                      whiteSpace: 'nowrap',
                      color: 'var(--Background-Warning-Default, #B45309)'
                    }}
                  >
                    Paused
                  </span>
                </div>
              ) : (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full font-semibold whitespace-nowrap",
                    "text-[9px] sm:text-[10px] md:text-xs",
                    "px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1",
                    "gap-0.5 sm:gap-1 md:gap-1.5",
                    statusStyles[status]
                  )}
                >
                  <span className="hidden sm:inline">{status}</span>
                  <span className="inline sm:hidden">{status.charAt(0).toUpperCase()}</span>
                </span>
              )}
            </div>

            {/* Last Activity Column */}
            <div className={cn(
              COLUMN_WIDTHS.lastActivity,
              "flex items-center justify-center shrink-0 px-0",
              isPersona ? "h-[55px]" : "h-[48px]"
            )}>
              <span className={cn(
                "font-inter font-medium text-[#0E1620] truncate px-1",
                "text-[12px]"
              )}>
                {lastActivity}
              </span>
            </div>

            {/* Actions Column */}
            <div className={cn(
              COLUMN_WIDTHS.actions,
              "flex items-center justify-center shrink-0 px-0",
              COLUMN_WIDTHS.gap,
              isPersona ? "h-[55px]" : "h-[48px]"
            )}>
              {isPersona && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      personaProps?.onChat?.();
                    }}
                    className="cursor-pointer h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 shrink-0 rounded-[6px] bg-[var(--general-secondary,#F5F5F5)] text-[#111827] hover:bg-[#E5E7EB] hover:text-black"
                  >
                    <MessageSquare className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                    <span className="sr-only">Chat with {name}</span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 shrink-0 rounded-[6px] border-[var(--general-border,#e5e5e5)] p-0 text-[var(--colors-gray-600,#4b5563)] hover:text-black"
                      >
                        <MoreVertical className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[160px] sm:w-[180px] md:w-[196px] rounded-[8px] bg-white p-1 border-0 shadow-lg">
                        <DropdownMenuItem 
                          onClick={personaProps?.onModifyConfig}
                          className="h-8 min-h-[32px] gap-2 rounded-[6px] px-0.5 py-[5.5px] text-[11px] sm:text-[12px] md:text-[13px] text-[#111827] hover:bg-[#E5E5E5] hover:text-black focus:bg-[#E5E5E5] focus:text-black cursor-pointer"
                        >
                          <FilePenLine className="h-3.5 w-3.5 md:h-4 md:w-4 ml-2 shrink-0" />
                          <span className="truncate">Modify Configuration</span>
                        </DropdownMenuItem>
                        {status === "active" ? (
                          <DropdownMenuItem 
                            onClick={onPause}
                            className="h-8 min-h-[32px] gap-2 rounded-[6px] px-0.5 py-[5.5px] text-[11px] sm:text-[12px] md:text-[13px] text-[#111827] hover:bg-[#E5E5E5] hover:text-black focus:bg-[#E5E5E5] focus:text-black cursor-pointer"
                          >
                            <Pause className="h-3.5 w-3.5 md:h-4 md:w-4 ml-2 shrink-0" />
                            Pause
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem 
                            onClick={onResume}
                            className="h-8 min-h-[32px] gap-2 rounded-[6px] px-0.5 py-[5.5px] text-[11px] sm:text-[12px] md:text-[13px] text-[#111827] hover:bg-[#E5E5E5] hover:text-black focus:bg-[#E5E5E5] focus:text-black cursor-pointer"
                          >
                            <Play className="h-3.5 w-3.5 md:h-4 md:w-4 ml-2 shrink-0" />
                            Resume
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          onClick={onDelete} 
                          className="h-8 min-h-[32px] gap-2 rounded-[6px] px-0.5 py-[5.5px] text-[11px] sm:text-[12px] md:text-[13px] text-[#111827] hover:bg-[#E5E5E5] hover:text-black focus:bg-[#E5E5E5] focus:text-black cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4 ml-2 shrink-0" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                </>
              )}
              {isConsumer && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 shrink-0 rounded-[6px] border-[var(--general-border,#e5e5e5)] p-0 text-[var(--colors-gray-600,#4b5563)] hover:text-black"
                    >
                      <MoreVertical className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[120px] sm:w-[140px] md:w-[150px] rounded-[8px] bg-white p-1 border-0 shadow-lg">
                    {status === "active" ? (
                      <DropdownMenuItem 
                        onClick={onPause}
                        className="h-8 min-h-[32px] gap-2 rounded-[6px] px-0.5 py-[5.5px] text-[11px] sm:text-[12px] md:text-[13px] text-[#111827] hover:bg-[#E5E5E5] hover:text-black focus:bg-[#E5E5E5] focus:text-black cursor-pointer"
                      >
                        <Pause className="h-3.5 w-3.5 md:h-4 md:w-4 ml-2 shrink-0" />
                        Pause
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem 
                        onClick={onResume}
                        className="h-8 min-h-[32px] gap-2 rounded-[6px] px-0.5 py-[5.5px] text-[11px] sm:text-[12px] md:text-[13px] text-[#111827] hover:bg-[#E5E5E5] hover:text-black focus:bg-[#E5E5E5] focus:text-black cursor-pointer"
                      >
                        <Play className="h-3.5 w-3.5 md:h-4 md:w-4 ml-2 shrink-0" />
                        Resume
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem 
                      onClick={onDelete}
                      className="h-8 min-h-[32px] gap-2 rounded-[6px] px-0.5 py-[5.5px] text-[11px] sm:text-[12px] md:text-[13px] text-[#111827] hover:bg-[#E5E5E5] hover:text-black focus:bg-[#E5E5E5] focus:text-black cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4 ml-2 shrink-0" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </TableCell>
      </TableRow>
    );
  }
);

UnifiedRow.displayName = "UnifiedRow";
