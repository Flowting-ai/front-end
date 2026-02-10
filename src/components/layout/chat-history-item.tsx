"use client";

import type { FormEvent, KeyboardEvent, RefObject } from "react";
import { Check, Loader2, MoreHorizontal, Star, X, Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Input } from "../ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

export interface ChatHistoryItemProps {
  title: string;
  isSelected: boolean;
  isStarred: boolean;
  pinnedCount: number;
  onSelect: () => void;
  onToggleStar: () => void;
  onRename: () => void;
  onDelete: () => void;
  isRenaming?: boolean;
  renameValue?: string;
  onRenameChange?: (value: string) => void;
  onRenameSubmit?: () => void;
  onRenameCancel?: () => void;
  renameInputRef?: RefObject<HTMLInputElement | null>;
  isRenamePending?: boolean;
  isStarPending?: boolean;
}

export function ChatHistoryItem({
  title,
  isSelected,
  isStarred,
  pinnedCount,
  onSelect,
  onToggleStar,
  onRename,
  onDelete,
  isRenaming = false,
  renameValue,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  renameInputRef,
  isRenamePending = false,
  isStarPending = false,
}: ChatHistoryItemProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  const handleRenameSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onRenameSubmit?.();
  };

  return (
    <div
      role={isRenaming ? "group" : "button"}
      tabIndex={isRenaming ? -1 : 0}
      onClick={isRenaming ? undefined : onSelect}
      onKeyDown={isRenaming ? undefined : handleKeyDown}
      className={cn(
        "group flex h-8 w-full items-center justify-between rounded-[6px] text-[13px] text-black transition-colors pr-1",
        isRenaming ? "cursor-default" : "cursor-pointer select-none",
        isSelected ? "bg-[#E5E5E5]" : "bg-transparent hover:bg-[#F1F1F1]"
      )}
    >
      {isRenaming ? (
        <form
          onSubmit={handleRenameSubmit}
          className="flex min-w-0 flex-1 items-center gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          <Input
            ref={renameInputRef}
            value={renameValue ?? ""}
            onChange={(event) => onRenameChange?.(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onRenameCancel?.();
              }
            }}
            className="h-[30px] flex-1 rounded-[6px] border border-[#D9D9D9] bg-white px-3 text-[13px] leading-[18px] text-[#0A0A0A] placeholder:text-[#9F9F9F] focus-visible:ring-0 focus-visible:ring-offset-0"
            maxLength={120}
            aria-label="Rename chat"
            disabled={isRenamePending}
            autoComplete="off"
          />
          <div className="flex items-center gap-1">
            <button
              type="submit"
              className="cursor-pointer flex h-[26px] w-[26px] items-center justify-center rounded-[6px] bg-[#2C2C2C] text-white transition-colors hover:bg-[#1F1F1F] disabled:bg-[#A8A8A8]"
              disabled={isRenamePending || !renameValue?.trim()}
              aria-label="Save chat name"
            >
              {isRenamePending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              className="cursor-pointer flex h-[26px] w-[26px] items-center justify-center rounded-[4px] border border-[#D9D9D9] bg-white text-[#5B5B5B] transition-colors hover:bg-[#F4F4F4]"
              onClick={(event) => {
                event.stopPropagation();
                onRenameCancel?.();
              }}
              disabled={isRenamePending}
              aria-label="Cancel rename"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      ) : (
        <span className="flex-1 min-w-0 truncate font-normal leading-[18px] pl-2.5 transition-[margin] group-hover:mr-2">
          {title}
        </span>
      )}
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-1.5 shrink-0">
          {!isRenaming && pinnedCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex h-[17px] w-[17px] items-center justify-center rounded-full bg-[#5B5B5B] text-[9px] font-semibold text-white">
                  {pinnedCount}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p>Pins in this chat</p>
              </TooltipContent>
            </Tooltip>
          )}
          {!isRenaming && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleStar();
                  }}
                  className={cn(
                    "cursor-pointer flex items-center justify-center rounded-full text-[#5B5B5B] transition-all overflow-hidden",
                    isStarred && "text-[#F5C04E]",
                    isStarPending && "pointer-events-none opacity-40",
                    !isStarPending && (isStarred ? "opacity-100 w-5 h-5" : "opacity-0 w-0 h-5 group-hover:opacity-100 group-hover:w-5")
                  )}
                  aria-pressed={isStarred}
                  aria-label={isStarred ? "Unstar chat" : "Star chat"}
                  disabled={isStarPending}
                  aria-busy={isStarPending}
                >
                  {isStarPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Star className={cn("h-4 w-4", isStarred && "fill-current")} />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p>Star this chat</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(event) => event.stopPropagation()}
              className={cn(
                "cursor-pointer flex items-center justify-center rounded-full text-[#5B5B5B] transition-all hover:bg-[#E5E5E5] overflow-hidden",
                (isRenaming || isRenamePending) && "pointer-events-none opacity-40",
                !(isRenaming || isRenamePending) && "opacity-0 w-0 h-5 group-hover:opacity-100 group-hover:w-5"
              )}
              aria-label="Chat options"
              disabled={isRenamePending || isRenaming}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-[108px] h-[76px] rounded-lg border border-[#E5E5E5] bg-white shadow-[0px_2px_4px_-2px_rgba(0,0,0,0.1),0px_4px_6px_-1px_rgba(0,0,0,0.1)]"
          >
            <DropdownMenuItem
              onClick={() => {
                onRename();
              }}
              disabled={isRenamePending}
              className="flex items-center gap-2 text-black cursor-pointer"
            >
              <Edit className="h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                onDelete();
              }}
              disabled={isRenamePending}
              className="flex items-center gap-2 text-black cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>
    </div>
  );
}
