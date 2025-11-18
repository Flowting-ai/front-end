"use client";

import { memo, type MouseEvent, type ReactNode } from "react";
import { Star, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Pin, PinTag } from "./types";

const tagThemeMap: Record<
  PinTag,
  {
    cardBg: string;
    border: string;
    title: string;
    preview: string;
    tagBadge: string;
  }
> = {
  Notes: {
    cardBg: "bg-[#ECFEFF]",
    border: "border-[#06B6D4]/50",
    title: "text-[#0F172A]",
    preview: "text-[#0F172A]/80",
    tagBadge: "bg-[#06B6D4]/10 text-[#0F172A] border-[#06B6D4]/40",
  },
  Tone: {
    cardBg: "bg-[#EEF2FF]",
    border: "border-[#6366F1]/40",
    title: "text-[#111827]",
    preview: "text-[#111827]/70",
    tagBadge: "bg-[#6366F1]/10 text-[#111827] border-[#6366F1]/30",
  },
  Actions: {
    cardBg: "bg-[#FEF9C3]",
    border: "border-[#EAB308]/50",
    title: "text-[#78350F]",
    preview: "text-[#92400E]",
    tagBadge: "bg-[#FDE68A] text-[#78350F] border-[#FACC15]/60",
  },
  Formats: {
    cardBg: "bg-[#FCE7F3]",
    border: "border-[#DB2777]/40",
    title: "text-[#831843]",
    preview: "text-[#9D174D]",
    tagBadge: "bg-[#FBCFE8] text-[#831843] border-[#F472B6]/50",
  },
};

const formatUpdatedAt = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

const renderInlineContent = (value: string, keyPrefix: string): ReactNode => {
  if (!value) return null;
  const boldRegex = /(\*\*|__)(.+?)\1/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let boldCount = 0;

  while ((match = boldRegex.exec(value)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(value.slice(lastIndex, match.index));
    }
    nodes.push(
      <strong
        key={`${keyPrefix}-bold-${boldCount++}`}
        className="font-semibold text-slate-900"
      >
        {match[2] ?? ""}
      </strong>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    nodes.push(value.slice(lastIndex));
  }

  if (nodes.length === 0) {
    nodes.push(value);
  }

  return nodes;
};

interface PinCardProps {
  pin: Pin;
  className?: string;
  onInsert?: (pin: Pin) => void;
  onSelect?: (pin: Pin) => void;
  onEditPin?: (pin: Pin) => void;
  onDeletePin?: (pin: Pin) => void;
  onToggleFavorite?: (pin: Pin, next: boolean) => void;
}

export const PinCard = memo(function PinCard({
  pin,
  className,
  onInsert,
  onSelect,
  onEditPin,
  onDeletePin,
  onToggleFavorite,
}: PinCardProps) {
  const theme = tagThemeMap[pin.tag] ?? tagThemeMap.Notes;
  const handleInsert = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onInsert?.(pin);
  };

  const handleFavorite = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onToggleFavorite?.(pin, !pin.isFavorite);
  };

  const handleEdit = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onEditPin?.(pin);
  };

  const handleDelete = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onDeletePin?.(pin);
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(pin)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onSelect?.(pin);
        }
      }}
      className={cn(
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary rounded-2xl w-full min-w-0",
        className
      )}
    >
      <div
        className={cn(
          "relative flex flex-col gap-4 rounded-2xl border p-5 shadow-[0_14px_28px_rgba(15,23,42,0.08)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_22px_40px_rgba(99,102,241,0.22)]",
          theme.cardBg,
          theme.border
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-3 pr-1.5">
            <div className="flex flex-wrap gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                  theme.tagBadge
                )}
              >
                {pin.tag}
              </span>
              {pin.type && (
                <span className="inline-flex items-center rounded-full border border-white/70 bg-white/70 px-2 py-0.5 text-[11px] font-medium text-slate-500/80">
                  {pin.type}
                </span>
              )}
            </div>
            <div>
              <h3 className={cn("text-base font-semibold leading-snug", theme.title)}>
                {pin.title}
              </h3>
            </div>
            <p className={cn("text-sm leading-relaxed line-clamp-4", theme.preview)}>
              {renderInlineContent(
                pin.preview ?? pin.content ?? "",
                `${pin.id ?? pin.title}-preview`
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={handleFavorite}
              className={cn(
                "rounded-full p-1.5 transition text-slate-500 hover:text-amber-500 hover:bg-white/70",
                pin.isFavorite && "text-amber-500"
              )}
              aria-label={pin.isFavorite ? "Unfavorite pin" : "Favorite pin"}
            >
              <Star
                className="h-4 w-4"
                strokeWidth={1.5}
                fill={pin.isFavorite ? "currentColor" : "transparent"}
              />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36 rounded-xl">
                <DropdownMenuItem onClick={handleEdit}>Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete}>Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="h-px bg-slate-900/10" />
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="text-xs text-slate-600/80">
            {formatUpdatedAt(pin.updatedAt) ?? "Pinned insight"}
          </div>
          <Button
            size="sm"
            className="h-8 rounded-full bg-[hsl(var(--primary))] px-3 text-xs font-semibold tracking-tight text-white shadow-[0_8px_20px_rgba(99,102,241,0.35)] hover:bg-[hsl(var(--accent-strong))] hover:shadow-[0_10px_24px_rgba(79,70,229,0.35)]"
            onClick={handleInsert}
          >
            Insert
          </Button>
        </div>
      </div>
    </article>
  );
});
