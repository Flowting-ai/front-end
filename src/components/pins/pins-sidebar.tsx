"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PinCard } from "./pin-card";
import { PinModal, type PinModalMode } from "./pin-modal";
import {
  PIN_TAG_ACCENTS,
  PIN_TAG_DESCRIPTIONS,
  PIN_TAGS,
  type Pin,
  type PinDraft,
  type PinAccent,
  type PinTag,
} from "./types";

interface PinsSidebarProps {
  pins?: Pin[];
  className?: string;
  onInsertPin?: (pin: Pin) => void;
  onPinCreate?: (pin: Pin) => void;
  onPinUpdate?: (pin: Pin) => void;
  onPinDelete?: (pin: Pin) => void;
  onSelectPin?: (pin: Pin) => void;
}

const accentOrder: PinAccent[] = ["lemon", "sky", "blush", "mint"];

const samplePins: Pin[] = [
  {
    id: "brand-tone",
    title: "Brand Tone Starter",
    type: "Tone",
    content:
      "Use friendly-but-expert tone. Mention data citations. Close with an open invitation for follow-up questions.",
    preview:
      "Friendly tone, cite data, close with next-step invite for the reader.",
    tag: "Tone",
    accentColor: "lemon",
    isFavorite: true,
    updatedAt: "2 days ago",
  },
  {
    id: "bug-report",
    title: "Bug Reproduction Steps",
    type: "Actions",
    content:
      "1. Outline the user context.\n2. Provide numbered steps to reproduce.\n3. Expected vs actual behavior.\n4. Attach console/network evidence.",
    preview: "Template for crisp bug reports with context + expected vs actual.",
    tag: "Actions",
    accentColor: "sky",
    isFavorite: false,
    updatedAt: "4 hours ago",
  },
  {
    id: "css-palette",
    title: "Neutral Palette Primer",
    type: "Notes",
    content:
      "Warm gray: #F5F2EC, Graphite: #25262D, Accent: #FFC28C. Use for calm UI panels.",
    preview: "Palette: F5F2EC / 25262D / FFC28C for calm UI panels.",
    tag: "Notes",
    accentColor: "blush",
    isFavorite: false,
    updatedAt: "1 week ago",
  },
  {
    id: "handoff",
    title: "Designer to Dev Handoff",
    type: "Formats",
    content:
      "Always link to the figma branch, include spacing tokens, typography decisions, and interactive expectations.",
    preview: "Figma link + tokens + interactive states summary.",
    tag: "Formats",
    accentColor: "mint",
    isFavorite: true,
    updatedAt: "3 days ago",
  },
];

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const buildPin = (draft: PinDraft, accentFallback: PinAccent): Pin => {
  const tag = draft.tag ?? PIN_TAGS[0];
  const accent = draft.accentColor ?? PIN_TAG_ACCENTS[tag] ?? accentFallback;
  return {
    id: draft.id ?? createId(),
    title: draft.title || "Untitled Pin",
    type: draft.type || tag,
    content: draft.content || "",
    preview: draft.content?.split("\n").join(" ").slice(0, 120),
    tag,
    accentColor: accent,
    isFavorite: draft.isFavorite ?? false,
    updatedAt: draft.updatedAt ?? new Date().toISOString(),
    chatId: draft.chatId,
  };
};

export function PinsSidebar({
  pins,
  className,
  onInsertPin,
  onPinCreate,
  onPinUpdate,
  onPinDelete,
  onSelectPin,
}: PinsSidebarProps) {
  const initialPins = pins && pins.length > 0 ? pins : samplePins;
  const [internalPins, setInternalPins] = useState<Pin[]>(initialPins);
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<PinTag[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<PinModalMode>("view");
  const [activePin, setActivePin] = useState<Pin | undefined>(undefined);
  const initialGuideOpen = initialPins.length <= 2;
  const [tagGuideOpen, setTagGuideOpen] = useState(initialGuideOpen);

  useEffect(() => {
    if (internalPins.length <= 2) {
      setTagGuideOpen(true);
    }
  }, [internalPins.length]);

  useEffect(() => {
    if (pins) {
      setInternalPins(pins);
    }
  }, [pins]);

  useEffect(() => {
    if (internalPins.length > 2 && tagGuideOpen) {
      setTagGuideOpen(false);
    }
  }, [internalPins.length, tagGuideOpen]);

  const filteredPins = useMemo(() => {
    const searchable = query.trim().toLowerCase();
    const tagSet = new Set(selectedTags);
    return internalPins
      .filter((pin) => {
        const matchesQuery =
          !searchable ||
          pin.title.toLowerCase().includes(searchable) ||
          pin.type.toLowerCase().includes(searchable) ||
          pin.content.toLowerCase().includes(searchable) ||
          pin.tag.toLowerCase().includes(searchable);
        const matchesTag = tagSet.size === 0 || tagSet.has(pin.tag);
        return matchesQuery && matchesTag;
      })
      .sort((a, b) => Number(b.isFavorite ?? false) - Number(a.isFavorite ?? false));
  }, [internalPins, query, selectedTags]);

  const toggleTag = (tag: PinTag) => {
    setSelectedTags((previous) => {
      const exists = previous.includes(tag);
      if (exists) {
        return previous.filter((item) => item !== tag);
      }
      return [...previous, tag];
    });
  };

  const clearTags = () => setSelectedTags([]);

  const openModal = (mode: PinModalMode, pin?: Pin) => {
    setModalMode(mode);
    setActivePin(pin);
    setIsModalOpen(true);
  };

  const handleCreateClick = () => {
    openModal("create");
  };

  const handleGuideToggle = () => {
    setTagGuideOpen(!tagGuideOpen);
  };

  const handleSelectPin = (pin: Pin) => {
    onSelectPin?.(pin);
    openModal("view", pin);
  };

  const handleInsert = (pin: Pin) => {
    onInsertPin?.(pin);
  };

  const handleToggleFavorite = (pin: Pin, next: boolean) => {
    setInternalPins((prev) =>
      prev.map((item) =>
        item.id === pin.id ? { ...item, isFavorite: next } : item
      )
    );
    onPinUpdate?.({ ...pin, isFavorite: next });
  };

  const handleDeletePin = (pin: Pin) => {
    setInternalPins((prev) => prev.filter((item) => item.id !== pin.id));
    onPinDelete?.(pin);
  };

  const handleModalSubmit = (draft: PinDraft) => {
    if (modalMode === "create") {
      const accent =
        accentOrder[(internalPins.length + 1) % accentOrder.length] ?? "lemon";
      const newPin = buildPin(draft, accent);
      setInternalPins((prev) => [newPin, ...prev]);
      onPinCreate?.(newPin);
      setIsModalOpen(false);
      setActivePin(newPin);
      return;
    }

    if (modalMode === "edit" && activePin) {
      const draftPayload: PinDraft = {
        ...activePin,
        ...draft,
        id: activePin.id,
        tag: draft.tag ?? activePin.tag,
      };
      const updatedPin = buildPin(
        draftPayload,
        activePin.accentColor ?? "lemon"
      );
      setInternalPins((prev) =>
        prev.map((item) => (item.id === activePin.id ? updatedPin : item))
      );
      onPinUpdate?.(updatedPin);
      setActivePin(updatedPin);
      setIsModalOpen(false);
    }
  };

  return (
    <aside
      className={cn(
        "flex w-full min-w-0 flex-col bg-transparent/50 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex items-center justify-between border-b px-5 py-4 bg-white/80">
        <div>
          <h2 className="text-base font-semibold text-foreground">Pins</h2>
          <p className="text-xs text-muted-foreground">
            Save snippets you reuse often
          </p>
        </div>
        <Button
          size="sm"
          className="rounded-full font-medium"
          onClick={handleCreateClick}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New
        </Button>
      </div>

      <div className="border-b px-5 py-4 bg-white/75">
        {/* Search input keeps filtering instantaneous */}
        <label className="relative flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pins..."
            className="pl-9 rounded-full text-sm"
          />
        </label>
        <button
          type="button"
          className="mt-2 text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
          onClick={handleGuideToggle}
        >
          {tagGuideOpen ? "Hide tag guide" : "What are tags?"}
        </button>
      </div>
      <div className="border-b px-5 py-3 bg-white/70">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={clearTags}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition",
              selectedTags.length === 0
                ? "bg-slate-900 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
            aria-pressed={selectedTags.length === 0}
          >
            All
          </button>
          {PIN_TAGS.map((tag) => {
            const isActive = selectedTags.includes(tag);
            return (
              <button
                type="button"
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition flex items-center gap-1",
                  isActive
                    ? "bg-slate-900 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
                aria-pressed={isActive}
              >
                {tag}
                {isActive && <span className="text-[10px] opacity-80">×</span>}
              </button>
            );
          })}
        </div>
        {selectedTags.length > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Cross-filtering pins by: <span className="font-semibold">{selectedTags.join(", ")}</span>
          </p>
        )}
      </div>
      {tagGuideOpen && (
        <div className="border-b px-5 py-3 bg-white/70">
          <div className="rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-slate-100 p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Essential tag system
            </p>
            <div className="mt-2.5 grid gap-2 text-xs sm:grid-cols-2">
              {PIN_TAGS.map((tag) => {
                const isReferenced = selectedTags.includes(tag);
                const isMuted = selectedTags.length > 0 && !isReferenced;
                return (
                  <div
                    key={tag}
                    className={cn(
                      "space-y-1 rounded-lg bg-white border p-2 shadow-sm transition",
                      isReferenced
                        ? "border-slate-900 shadow-md"
                        : "border-slate-300",
                      isMuted && "opacity-60"
                    )}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                      {tag}
                    </span>
                    <p className="text-[11px] leading-relaxed text-slate-700">
                      {PIN_TAG_DESCRIPTIONS[tag]}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {filteredPins.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center text-sm text-muted-foreground">
          <p>No pins yet. Pin your favorite answers and reuse them across chats.</p>
          <Button className="mt-4 rounded-full" onClick={handleCreateClick}>
            Create your first pin
          </Button>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-6 px-5 py-5">
            {filteredPins.map((pin) => (
              <PinCard
                key={pin.id}
                pin={pin}
                onInsert={handleInsert}
                onSelect={handleSelectPin}
                onEditPin={(current) => openModal("edit", current)}
                onDeletePin={handleDeletePin}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      <PinModal
        open={isModalOpen}
        mode={modalMode}
        pin={activePin}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        onInsert={handleInsert}
        onRequestEdit={() => setModalMode("edit")}
      />
    </aside>
  );
}
