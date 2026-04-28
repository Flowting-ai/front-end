"use client";

import React from "react";
import {
  Send,
  X,
  Square,
  Plus,
  Paperclip,
  Globe,
  Palette,
  Check,
  ScanText,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast-helper";
import type { AIModel } from "@/types/ai-model";
import type { TonePreset } from "./chat-tones";
import { STYLE_TONES } from "./chat-tones";
import type { Persona } from "@/components/layout/app-layout";
import { DOCUMENT_UPLOAD_ACCEPT } from "./AttachmentManager";

// ─── Prop interface ────────────────────────────────────────────────────────────

interface ChatToolbarProps {
  // ── Attach menu ──────────────────────────────────────────────────────────────
  hideAttachButton: boolean;
  showAttachMenu: boolean;
  setShowAttachMenu: (open: boolean) => void;
  attachMenuRef: React.RefObject<HTMLDivElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAttachClick: () => void;

  // ── Feature toggles ───────────────────────────────────────────────────────
  webSearchEnabled: boolean;
  setWebSearchEnabled: (enabled: boolean) => void;
  useMistralOcr: boolean;
  setUseMistralOcr: (enabled: boolean) => void;
  /** Pre-computed: canAccessFeature(user?.planType, "mistralOcr") */
  canUseMistralOcr: boolean;

  // ── Style / tone submenu ──────────────────────────────────────────────────
  showStyleSubmenu: boolean;
  setShowStyleSubmenu: (open: boolean) => void;
  selectedTone: TonePreset | null;
  setSelectedTone: (tone: TonePreset | null) => void;
  styleSubmenuTimeout: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;

  // ── Persona picker ────────────────────────────────────────────────────────
  hidePersonaButton: boolean;
  showPersonaDropdown: boolean;
  setShowPersonaDropdown: (open: boolean) => void;
  personaDropdownRef: React.RefObject<HTMLDivElement | null>;
  activePersonas: Persona[];
  selectedPersona: Persona | null;
  highlightedPersonaIndex: number;
  setHighlightedPersonaIndex: React.Dispatch<React.SetStateAction<number>>;
  onSelectPersona: (persona: Persona) => Promise<void>;
  onAddNewPersona: () => void;

  // ── Send / stop ───────────────────────────────────────────────────────────
  isResponding: boolean;
  onStopGeneration: () => void;
  input: string;
  onSend: (content: string) => void;
  selectedModel: AIModel | null;
  useFramework: boolean;
  disableInput: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * The action buttons row rendered at the bottom of the chat composer.
 * Contains: attach + feature-toggle menu, persona picker, active-toggle
 * indicator pills, and the send / stop / voice button.
 */
export function ChatToolbar({
  hideAttachButton,
  showAttachMenu,
  setShowAttachMenu,
  attachMenuRef,
  fileInputRef,
  onFileSelect,
  onAttachClick,
  webSearchEnabled,
  setWebSearchEnabled,
  useMistralOcr,
  setUseMistralOcr,
  canUseMistralOcr,
  showStyleSubmenu,
  setShowStyleSubmenu,
  selectedTone,
  setSelectedTone,
  styleSubmenuTimeout,
  hidePersonaButton,
  showPersonaDropdown,
  setShowPersonaDropdown,
  personaDropdownRef,
  activePersonas,
  selectedPersona,
  highlightedPersonaIndex,
  setHighlightedPersonaIndex,
  onSelectPersona,
  onAddNewPersona,
  isResponding,
  onStopGeneration,
  input,
  onSend,
  selectedModel,
  useFramework,
  disableInput,
}: ChatToolbarProps) {
  return (
    <div className="flex items-center gap-3">
      {/* ── Attach button + feature-toggle menu ── */}
      {!hideAttachButton && (
        <div className="relative" ref={attachMenuRef}>
          {/* Hidden file input — kept outside the conditional so it persists in DOM */}
          <input
            ref={fileInputRef}
            type="file"
            accept={DOCUMENT_UPLOAD_ACCEPT}
            multiple
            onChange={onFileSelect}
            className="hidden"
          />
          <Button
            variant="ghost"
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E5E5] bg-white p-0 hover:bg-[#F5F5F5] hover:border-[#D9D9D9]"
          >
            <Plus className="h-5 w-5 text-[#555555]" />
          </Button>

          {showAttachMenu && (
            <div
              className="absolute bottom-full left-0 mb-2 flex flex-col gap-2 rounded-lg border border-[#E5E5E5] bg-white p-2 shadow-lg"
              style={{ width: "auto" }}
            >
              {/* Attach files */}
              <button
                onClick={() => {
                  onAttachClick();
                  setShowAttachMenu(false);
                }}
                className="flex items-center gap-1.5 rounded-lg cursor-pointer bg-white p-2 text-left text-xs font-medium transition-colors hover:bg-[#E5E5E5] whitespace-nowrap"
              >
                <Paperclip className="h-3.5 w-3.5 text-[#666666]" />
                <span>Attach images or files</span>
              </button>

              {/* Web search toggle */}
              <button
                onClick={() => {
                  setWebSearchEnabled(!webSearchEnabled);
                  setShowAttachMenu(false);
                  toast(webSearchEnabled ? "Web search disabled" : "Web search enabled", {
                    description: webSearchEnabled
                      ? "Results will not include web search"
                      : "Results will include web search",
                  });
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg cursor-pointer border p-2 text-left text-xs font-medium transition-colors hover:bg-[#E5E5E5] whitespace-nowrap",
                  webSearchEnabled
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-none bg-white text-[#1E1E1E]",
                )}
              >
                <Globe
                  className={cn(
                    "h-3.5 w-3.5",
                    webSearchEnabled ? "text-blue-600" : "text-[#666666]",
                  )}
                />
                <span>Web Search</span>
                {webSearchEnabled && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" />
                )}
              </button>

              {/* Mistral OCR toggle — only for plans with access */}
              {canUseMistralOcr && (
                <button
                  onClick={() => {
                    setUseMistralOcr(!useMistralOcr);
                    setShowAttachMenu(false);
                    toast(useMistralOcr ? "Mistral OCR disabled" : "Mistral OCR enabled", {
                      description: useMistralOcr
                        ? "Using standard file processing"
                        : "Files will be processed with Mistral OCR",
                    });
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg cursor-pointer border p-2 text-left text-xs font-medium transition-colors hover:bg-[#E5E5E5] whitespace-nowrap",
                    useMistralOcr
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-none bg-white text-[#1E1E1E]",
                  )}
                >
                  <ScanText
                    className={cn(
                      "h-3.5 w-3.5",
                      useMistralOcr ? "text-orange-600" : "text-[#666666]",
                    )}
                  />
                  <span>Mistral OCR</span>
                  {useMistralOcr && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />
                  )}
                </button>
              )}

              {/* Style / tone submenu */}
              <div
                className="relative"
                onMouseEnter={() => {
                  if (styleSubmenuTimeout.current) {
                    clearTimeout(styleSubmenuTimeout.current);
                    styleSubmenuTimeout.current = null;
                  }
                  setShowStyleSubmenu(true);
                }}
                onMouseLeave={() => {
                  styleSubmenuTimeout.current = setTimeout(() => {
                    setShowStyleSubmenu(false);
                    styleSubmenuTimeout.current = null;
                  }, 150);
                }}
              >
                <button
                  onClick={() => setShowStyleSubmenu(!showStyleSubmenu)}
                  className={cn(
                    "w-full flex items-center gap-1.5 rounded-lg cursor-pointer border p-2 text-left text-xs font-medium transition-colors hover:bg-[#E5E5E5] whitespace-nowrap",
                    selectedTone
                      ? "border-purple-500 bg-purple-50 text-purple-700"
                      : "border-none bg-white text-[#1E1E1E]",
                  )}
                >
                  <Palette
                    className={cn(
                      "h-3.5 w-3.5",
                      selectedTone ? "text-purple-600" : "text-[#666666]",
                    )}
                  />
                  <span>Use Style</span>
                  <ChevronRight
                    className={cn(
                      "h-3 w-3 ml-auto",
                      selectedTone ? "text-purple-600" : "text-[#999999]",
                    )}
                  />
                </button>

                {showStyleSubmenu && (
                  <div
                    className="absolute w-[250px] max-h-[320px] left-full bottom-0 flex flex-col rounded-lg border border-[#E5E5E5] bg-white py-1 shadow-lg overflow-y-auto customScrollbar2"
                    style={{ marginLeft: "-4px", paddingLeft: "4px" }}
                  >
                    {/* None — clears the selected tone */}
                    <button
                      onClick={() => {
                        setSelectedTone(null);
                        setShowStyleSubmenu(false);
                        setShowAttachMenu(false);
                        toast("Style removed", { description: "Using default AI style" });
                      }}
                      className={cn(
                        "cursor-pointer flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-[#F5F5F5] w-full",
                        !selectedTone
                          ? "bg-[#F5F5F5] font-medium text-[#1E1E1E]"
                          : "text-[#666666]",
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">None</div>
                        <div className="text-[10px] text-[#888888]">
                          Default AI behavior
                        </div>
                      </div>
                      {!selectedTone && (
                        <Check className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                      )}
                    </button>

                    <div className="mx-2 my-1 h-px bg-[#E5E5E5]" />

                    {STYLE_TONES.map((tone) => (
                      <button
                        key={tone.tone_id}
                        onClick={() => {
                          setSelectedTone(tone);
                          setShowStyleSubmenu(false);
                          setShowAttachMenu(false);
                          toast(`Style: ${tone.label}`, { description: tone.description });
                        }}
                        className={cn(
                          "cursor-pointer flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-[#F5F5F5] w-full",
                          selectedTone?.tone_id === tone.tone_id
                            ? "bg-purple-50 text-purple-700 font-medium"
                            : "text-[#1E1E1E]",
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{tone.label}</div>
                          <div className="text-[10px] text-[#888888] truncate">
                            {tone.description}
                          </div>
                        </div>
                        {selectedTone?.tone_id === tone.tone_id && (
                          <Check className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Persona picker + active-feature indicator pills ── */}
      <div className="flex items-center gap-2">
        {!hidePersonaButton && (
          <div className="relative" ref={personaDropdownRef}>
            {/*
             * The persona trigger button is temporarily commented out in the
             * original design. The dropdown UI is preserved below so it remains
             * functional when the button is re-enabled.
             *
             * <Button
             *   variant="ghost"
             *   onClick={() => setShowPersonaDropdown(!showPersonaDropdown)}
             *   className="..."
             * >
             *   ...
             * </Button>
             */}

            {showPersonaDropdown && (
              <div
                className="absolute bottom-full left-0 mb-2 rounded-lg border border-[#E5E5E5] bg-white shadow-lg overflow-hidden"
                style={{ width: "291px", maxHeight: "181px" }}
                role="listbox"
                aria-expanded={showPersonaDropdown}
                tabIndex={-1}
                onKeyDown={(e) => {
                  if (activePersonas.length === 0) return;
                  const totalItems = activePersonas.length + 1;

                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlightedPersonaIndex((prev) =>
                      prev === -1 ? 0 : (prev + 1) % totalItems,
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlightedPersonaIndex((prev) =>
                      prev === -1 || prev === 0 ? totalItems - 1 : prev - 1,
                    );
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    if (
                      highlightedPersonaIndex >= 0 &&
                      highlightedPersonaIndex < activePersonas.length
                    ) {
                      void onSelectPersona(activePersonas[highlightedPersonaIndex]);
                    } else if (highlightedPersonaIndex === activePersonas.length) {
                      onAddNewPersona();
                    }
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setShowPersonaDropdown(false);
                  }
                }}
              >
                <div
                  className="max-h-[calc(5*32px)] overflow-y-auto overflow-x-hidden px-[5px] py-1"
                  style={{ scrollbarWidth: "thin" }}
                >
                  {activePersonas.length === 0 ? (
                    <div className="px-2 py-4 text-center text-xs text-[#888888]">
                      No active personas available
                    </div>
                  ) : (
                    activePersonas.map((persona, idx) => (
                      <button
                        key={persona.id}
                        type="button"
                        role="option"
                        aria-selected={selectedPersona?.id === persona.id}
                        onClick={() => void onSelectPersona(persona)}
                        onMouseEnter={() => setHighlightedPersonaIndex(idx)}
                        onMouseLeave={() => setHighlightedPersonaIndex(-1)}
                        className={
                          `w-full flex items-center gap-2 rounded-[6px] pl-2 pr-2 py-[5.5px] text-left text-xs transition-colors ` +
                          (idx === highlightedPersonaIndex &&
                          highlightedPersonaIndex >= 0
                            ? "bg-[var(--unofficial-accent-2,#E5E5E5)] text-black font-medium"
                            : selectedPersona?.id === persona.id &&
                                highlightedPersonaIndex === -1
                              ? "bg-[var(--unofficial-accent-2,#E5E5E5)] text-black font-medium"
                              : "bg-white text-[#1E1E1E] hover:bg-[var(--unofficial-accent-2,#E5E5E5)]")
                        }
                        style={{
                          width: "280px",
                          minHeight: "32px",
                          paddingRight: "8px",
                        }}
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] border border-[#E5E5E5]">
                          {persona.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={persona.avatar}
                              alt={persona.name}
                              className="h-full w-full rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-[10px] font-medium text-[#666666]">
                              {persona.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span className="flex-1 truncate font-medium pr-0">
                          {persona.name}
                        </span>
                        {(persona.modelName || persona.providerName) && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#F0F0F0] text-[10px] font-medium text-[#666666] border border-[#E5E5E5]">
                            {persona.modelName || persona.providerName}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>

                {activePersonas.length > 0 && (
                  <>
                    <div
                      className="mx-[5px] my-1"
                      style={{
                        width: "280px",
                        height: "1px",
                        backgroundColor: "var(--general-border, #E5E5E5)",
                      }}
                    />
                    <div className="px-[5px] pb-1">
                      <button
                        type="button"
                        onClick={onAddNewPersona}
                        onMouseEnter={() =>
                          setHighlightedPersonaIndex(activePersonas.length)
                        }
                        onMouseLeave={() => setHighlightedPersonaIndex(-1)}
                        className={
                          `w-full flex items-center gap-2 rounded-[6px] px-2 py-[5.5px] text-left text-xs transition-colors ` +
                          (highlightedPersonaIndex === activePersonas.length
                            ? "bg-[var(--unofficial-accent-2,#E5E5E5)] text-black font-medium"
                            : "bg-white text-[#1E1E1E] hover:bg-[var(--unofficial-accent-2,#E5E5E5)]")
                        }
                        style={{
                          width: "280px",
                          minHeight: "32px",
                          paddingRight: "8px",
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        <span className="font-medium">Add new persona</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Web search active indicator */}
        {webSearchEnabled && (
          <button
            type="button"
            aria-label="Disable web search"
            onClick={() => {
              setWebSearchEnabled(false);
              toast("Web search disabled", { description: "Results will not include web search" });
            }}
            className="cursor-pointer w-auto h-[36px] font-geist font-medium text-sm text-[#4A8CEB] bg-transparent rounded-[8px] flex items-center justify-between gap-2 px-3 py-2"
          >
            <Globe size={16} />
            <p>Web Search</p>
            <X size={16} />
          </button>
        )}

        {/* Mistral OCR active indicator */}
        {useMistralOcr && canUseMistralOcr && (
          <button
            type="button"
            aria-label="Disable Mistral OCR"
            onClick={() => {
              setUseMistralOcr(false);
              toast("Mistral OCR disabled", { description: "Using standard file processing" });
            }}
            className="cursor-pointer w-auto h-[36px] font-geist font-medium text-sm text-orange-600 bg-transparent rounded-[8px] flex items-center justify-between gap-2 px-3 py-2"
          >
            <ScanText size={16} />
            <p>Mistral OCR</p>
            <X size={16} />
          </button>
        )}

        {/* Style / tone active indicator */}
        {selectedTone && (
          <button
            type="button"
            aria-label="Remove style"
            onClick={() => {
              setSelectedTone(null);
              toast("Style removed", { description: "Using default AI style" });
            }}
            className="cursor-pointer w-auto h-[36px] font-geist font-medium text-sm text-[#9333EA] bg-transparent rounded-[8px] flex items-center justify-between gap-2 px-3 py-2"
          >
            <Palette size={16} />
            <p>{selectedTone.label}</p>
            <X size={16} />
          </button>
        )}
      </div>

      {/* ── Send / stop / voice button ── */}
      <div className="flex flex-1 shrink-0 items-center justify-end gap-4">
        {isResponding ? (
          <Button
            type="button"
            onClick={onStopGeneration}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1E1E1E] text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-[#0A0A0A]"
            title="Stop generation"
          >
            <Square className="h-[18px] w-[18px] fill-white" />
          </Button>
        ) : input.trim() ? (
          <TooltipProvider>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  onClick={() => onSend(input)}
                  disabled={
                    (!selectedModel && !useFramework) || disableInput
                  }
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1E1E1E] text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-[#0A0A0A] disabled:bg-[#CCCCCC] disabled:shadow-none"
                >
                  <Send className="h-[18px] w-[18px]" />
                </Button>
              </TooltipTrigger>
              {((!selectedModel && !useFramework) || disableInput) && (
                <TooltipContent
                  side="top"
                  className="bg-[#1E1E1E] text-white px-3 py-2 text-sm"
                >
                  {disableInput
                    ? "Save to test first to enable chat"
                    : "Please select a model to start the conversation"}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        ) : (
          <Button
            type="button"
            onClick={() => {
              toast.info("Voice input", { description: "Voice input feature coming soon!" });
            }}
            className="pointer-events-none flex h-11 w-11 items-center justify-center rounded-full bg-zinc-300 text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-[#0A0A0A]"
            title="Voice input"
          >
            {/* Send icon used as placeholder for voice button until voice input is implemented */}
            <Send
              className="h-[25px] w-[25px]"
              strokeWidth={2}
              style={{ minWidth: "18px", minHeight: "20px" }}
            />
          </Button>
        )}
      </div>
    </div>
  );
}
