"use client";

import type { FormEvent, KeyboardEvent, RefObject } from "react";
import { Check, Loader2, MoreHorizontal, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Input } from "../ui/input";

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
        "flex h-8 w-[210px] items-center justify-between rounded-[6px] px-3 text-[14px] text-black transition-colors",
        isRenaming ? "cursor-default" : "cursor-pointer select-none",
        isSelected ? "bg-[#E5E5E5]" : "bg-transparent hover:bg-[#F1F1F1]"
      )}
    >
      {isRenaming ? (
        <form
          onSubmit={handleRenameSubmit}
          className="mr-2 flex max-w-[120px] flex-1 items-center gap-1"
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
            className="h-[26px] flex-1 rounded-[4px] border border-[#D9D9D9] bg-white px-2 text-[13px] text-[#0A0A0A] placeholder:text-[#9F9F9F] focus-visible:ring-0 focus-visible:ring-offset-0"
            maxLength={120}
            aria-label="Rename chat"
            disabled={isRenamePending}
            autoComplete="off"
          />
          <div className="flex items-center gap-1">
            <button
              type="submit"
              className="flex h-[26px] w-[26px] items-center justify-center rounded-[4px] bg-[#2C2C2C] text-white transition-colors hover:bg-[#1F1F1F] disabled:bg-[#A8A8A8]"
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
        <span className="mr-2 max-w-[120px] truncate font-normal leading-5">
          {title}
        </span>
      )}
      <div className="flex items-center gap-2">
        <span className="flex h-[20.5px] w-[20.5px] items-center justify-center rounded-full bg-[#5B5B5B] text-[11px] font-semibold text-white">
          {pinnedCount}
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleStar();
          }}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full text-[#5B5B5B] transition-colors",
            isStarred && "text-[#F5C04E]",
            isRenaming && "pointer-events-none opacity-40"
          )}
          aria-pressed={isStarred}
          aria-label={isStarred ? "Unstar chat" : "Star chat"}
          disabled={isRenamePending || isRenaming}
        >
          <Star className={cn("h-4 w-4", isStarred && "fill-current")} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(event) => event.stopPropagation()}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[#5B5B5B] transition-colors hover:bg-[#E5E5E5]",
                (isRenaming || isRenamePending) && "pointer-events-none opacity-40"
              )}
              aria-label="Chat options"
              disabled={isRenamePending || isRenaming}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              onClick={() => {
                onRename();
              }}
              disabled={isRenamePending}
            >
              Rename chat
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                onDelete();
              }}
              disabled={isRenamePending}
            >
              Delete chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
