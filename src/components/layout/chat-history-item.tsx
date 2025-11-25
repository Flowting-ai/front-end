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
  renameInputRef?: RefObject<HTMLInputElement>;
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
        "flex h-8 w-[210px] items-center justify-between rounded-[6px] px-2.5 text-[13px] text-black transition-colors",
        isRenaming ? "cursor-default" : "cursor-pointer select-none",
        isSelected ? "bg-[#E5E5E5]" : "bg-transparent hover:bg-[#F1F1F1]"
      )}
    >
      {isRenaming ? (
        <form
          onSubmit={handleRenameSubmit}
          className="mr-1.5 flex min-w-0 flex-1 items-center gap-1.5"
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
            className="h-[30px] flex-1 rounded-[6px] border border-[#D9D9D9] bg-white px-3 text-[13px] leading-tight text-[#0A0A0A] placeholder:text-[#9F9F9F] focus-visible:ring-0 focus-visible:ring-offset-0"
            maxLength={120}
            aria-label="Rename chat"
            disabled={isRenamePending}
            autoComplete="off"
          />
          <div className="flex items-center gap-1">
            <button
              type="submit"
              className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] bg-[#2C2C2C] text-white transition-colors hover:bg-[#1F1F1F] disabled:bg-[#A8A8A8]"
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
              className="flex h-[26px] w-[26px] items-center justify-center rounded-[4px] border border-[#D9D9D9] bg-white text-[#5B5B5B] transition-colors hover:bg-[#F4F4F4]"
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
        <span className="flex-1 min-w-0 mr-2 truncate font-normal leading-[18px]">
          {title}
        </span>
      )}
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {pinnedCount > 0 && (
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
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleStar();
                }}
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[#5B5B5B] transition-colors",
                  isStarred && "text-[#F5C04E]",
                  (isRenaming || isStarPending) && "pointer-events-none opacity-40"
                )}
                aria-pressed={isStarred}
                aria-label={isStarred ? "Unstar chat" : "Star chat"}
                disabled={isRenamePending || isRenaming || isStarPending}
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
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(event) => event.stopPropagation()}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[#5B5B5B] transition-colors hover:bg-[#E5E5E5]",
                (isRenaming || isRenamePending) && "pointer-events-none opacity-40"
              )}
              aria-label="Chat options"
              disabled={isRenamePending || isRenaming}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-[108px] h-[76px] rounded-lg border border-[#E5E5E5] bg-white p-0.5 shadow-[0px_2px_4px_-2px_rgba(0,0,0,0.1),0px_4px_6px_-1px_rgba(0,0,0,0.1)]"
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
