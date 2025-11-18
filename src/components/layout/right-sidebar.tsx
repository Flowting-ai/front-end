"use client";

import { useContext, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronsLeft, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppLayoutContext } from "./app-layout";
import { PinsSidebar } from "../pins/pins-sidebar";
import { PIN_TAG_ACCENTS } from "../pins/types";
import type { Pin as StickyPin, PinAccent, PinTag } from "../pins/types";

export interface PinType {
  id: string;
  text: string;
  tags: string[];
  notes: string;
  chatId: string;
  time: Date;
  messageId?: string;
}

interface RightSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  pins: PinType[];
  setPins: React.Dispatch<React.SetStateAction<PinType[]>>;
  chatBoards: unknown[];
  onPinDeleteRequest?: (pin: StickyPin) => void;
}

const tagSynonyms: Record<PinTag, string[]> = {
  Tone: ["style", "tone", "persona", "voice"],
  Actions: ["process", "workflow", "steps", "method", "action"],
  Notes: ["knowledge", "note", "context", "info", "reference"],
  Formats: ["template", "format", "structure", "outline"],
};

const fallbackTag: PinTag = "Notes";

const accentByTag: Record<PinTag, PinAccent> = {
  Tone: "lemon",
  Actions: "sky",
  Notes: "blush",
  Formats: "mint",
};

const resolvePinTag = (tags?: string[]): PinTag => {
  if (!tags || tags.length === 0) {
    return fallbackTag;
  }

  for (const rawTag of tags) {
    const clean = rawTag.trim().toLowerCase();
    for (const [canonical, synonyms] of Object.entries(tagSynonyms) as Array<
      [PinTag, string[]]
    >) {
      const match = synonyms.some(
        (keyword) => clean === keyword || clean.includes(keyword)
      );
      if (match) {
        return canonical;
      }
    }
  }

  return fallbackTag;
};

const deriveTitle = (value: string) => {
  if (!value) return "Pinned insight";
  const firstLine =
    value
      .split("\n")
      .map((segment) => segment.trim())
      .find(Boolean) ?? value.trim();
  return firstLine.length > 64 ? `${firstLine.slice(0, 61)}...` : firstLine;
};

const derivePreview = (pin: PinType) => {
  if (pin.notes?.trim()) {
    return pin.notes.trim();
  }
  return pin.text.replace(/\s+/g, " ").slice(0, 140);
};

const legacyPinToSticky = (pin: PinType): StickyPin => {
  const primaryTag = resolvePinTag(pin.tags);

  return {
    id: pin.id,
    title: deriveTitle(pin.text),
    type: primaryTag,
    content: pin.text,
    preview: derivePreview(pin),
    tag: primaryTag,
    accentColor: PIN_TAG_ACCENTS[primaryTag] ?? accentByTag[primaryTag],
    isFavorite: false,
    updatedAt: pin.time ? pin.time.toISOString() : undefined,
    chatId: pin.chatId,
  };
};

const stickyPinToLegacy = (
  pin: StickyPin,
  options?: { previous?: PinType; fallbackChatId?: string }
): PinType => {
  const previous = options?.previous;
  const selectedText =
    pin.content && pin.content.trim().length > 0
      ? pin.content
      : previous?.text ?? pin.title;
  const notes =
    pin.preview ?? previous?.notes ?? pin.content?.slice(0, 140) ?? "";

  const pinTag = pin.tag ?? fallbackTag;
  return {
    id: pin.id,
    text: selectedText,
    tags: [pinTag],
    notes,
    chatId: pin.chatId ?? previous?.chatId ?? options?.fallbackChatId ?? "",
    time: pin.updatedAt
      ? new Date(pin.updatedAt)
      : previous?.time ?? new Date(),
  };
};

export function RightSidebar({
  isCollapsed,
  onToggle,
  pins,
  setPins,
  onPinDeleteRequest,
}: RightSidebarProps) {
  const layoutContext = useContext(AppLayoutContext);
  const stickyPins = useMemo(() => pins.map(legacyPinToSticky), [pins]);

  const handlePinCreate = (pin: StickyPin) => {
    const legacy = stickyPinToLegacy(pin, {
      fallbackChatId: layoutContext?.activeChatId ?? "",
    });
    setPins((prev) => [legacy, ...prev]);
  };

  const handlePinUpdate = (pin: StickyPin) => {
    setPins((prev) =>
      prev.map((existing) =>
        existing.id === pin.id
          ? stickyPinToLegacy(pin, { previous: existing })
          : existing
      )
    );
  };

  const handlePinDelete = (pin: StickyPin) => {
    setPins((prev) => prev.filter((existing) => existing.id !== pin.id));
    onPinDeleteRequest?.(pin);
  };

  const handleInsertPin = (pin: StickyPin) => {
    if (pin.chatId && layoutContext?.setActiveChatId) {
      layoutContext.setActiveChatId(pin.chatId);
    }
  };

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col border-l bg-white/90 backdrop-blur-sm transition-all duration-300 ease-in-out relative shadow-[-12px_0_30px_rgba(15,23,42,0.03)]",
        isCollapsed ? "w-[58px]" : "w-[min(320px,26vw)]"
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="absolute top-1/2 -translate-y-1/2 -left-4 bg-card border hover:bg-accent z-10 h-8 w-8 rounded-full"
      >
        <ChevronsLeft
          className={cn("h-4 w-4 transition-transform", !isCollapsed && "rotate-180")}
        />
      </Button>

      <div className="flex h-full flex-col">
        {isCollapsed ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <Pin className="h-5 w-5" />
            Pins
          </div>
        ) : (
          <PinsSidebar
            className="border-0 w-full h-full"
            pins={stickyPins}
            onInsertPin={handleInsertPin}
            onPinCreate={handlePinCreate}
            onPinUpdate={handlePinUpdate}
            onPinDelete={handlePinDelete}
          />
        )}
      </div>
    </aside>
  );
}
