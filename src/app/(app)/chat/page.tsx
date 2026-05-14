"use client";

import React, { Suspense, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ChatInput } from "@/components/chat/ChatInput";
import { AttachmentManager, type PendingAttachment } from "@/components/chat/AttachmentManager";
import { InitialPrompts } from "@/components/chat/InitialPrompts";
import { ModelSwitchDialog } from "@/components/chat/ModelSwitchDialog";
import { PinMentionDropdown } from "@/components/chat/PinMentionDropdown";
import { useModelSelectorContext } from "@/context/model-selector-context";
import { useChatHistoryContext } from "@/context/chat-history-context";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useFileDrop } from "@/hooks/use-file-drop";
import { usePinOperations } from "@/hooks/use-pin-operations";
import { Dropdown } from "@/components/Dropdown";
import { Chip } from "@/components/Chip";
import { Button } from "@/components/Button";
import {
  ArrowRightOneIcon,
  FolderAddIcon,
  FolderOneIcon,
  GlobalSearchIcon,
  QuillWriteTwoIcon,
  UserIcon,
  QuillWriteOneIcon,
  NeuralNetworkIcon,
  AiVisionRecognitionIcon,
  AiWebBrowsingIcon,
  CalendarFoldIcon,
  StickyNoteTwoIcon,
  AuctionIcon,
} from "@strange-huge/icons";
import type { AIModel } from "@/types/ai-model";
import type { Pin } from "@/lib/api/pins";

// ── Mentioned-pin state type ──────────────────────────────────────────────────

interface MentionedPin {
  id: string;
  label: string;
}

// ── Mention chip ──────────────────────────────────────────────────────────────

function MentionChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        borderRadius: "999px",
        backgroundColor: "var(--neutral-100, #F5F5F5)",
        border: "1px solid var(--neutral-200, #E5E5E5)",
        padding: "2px 8px 2px 10px",
        fontSize: "12px",
        fontWeight: 500,
        color: "var(--neutral-700, #444)",
        fontFamily: "var(--font-body)",
        maxWidth: "200px",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>@{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove mention @${label}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          background: "none",
          padding: "1px",
          cursor: "pointer",
          color: "var(--neutral-400, #999)",
          borderRadius: "50%",
          flexShrink: 0,
        }}
      >
        <X size={11} strokeWidth={2.5} />
      </button>
    </span>
  );
}

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        flex: 1,
        background: "white",
        border: `1px solid ${isHovered ? "var(--neutral-300)" : "var(--neutral-200)"}`,
        borderRadius: "12px",
        padding: "14px 12px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "10px",
        textAlign: "left",
        boxShadow: isHovered
          ? "0 2px 8px rgba(0,0,0,0.08)"
          : "0 1px 3px rgba(0,0,0,0.04)",
        transition: "box-shadow 150ms, border-color 150ms",
        minWidth: 0,
      }}
    >
      <div style={{ flexShrink: 0 }}>{icon}</div>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "13px",
          fontWeight: 500,
          color: "var(--neutral-700)",
          margin: 0,
          lineHeight: 1.4,
        }}
      >
        {label}
      </p>
    </button>
  );
}

// ── Chat mode action buttons ──────────────────────────────────────────────────

type ChatMode = "write" | "research" | "think" | "build";

const ACTION_BUTTONS: Array<{ mode: ChatMode; label: string; icon: React.ReactNode; disabled?: boolean }> = [
  { mode: "write",    label: "Write",    icon: <QuillWriteOneIcon      size={16} animated /> },
  { mode: "research", label: "Research", icon: <NeuralNetworkIcon      size={16} animated />, disabled: true },
  { mode: "think",    label: "Think",    icon: <AiVisionRecognitionIcon size={16} animated /> },
  { mode: "build",    label: "Build",    icon: <AiWebBrowsingIcon      size={16} animated /> },
];

const MODE_PLACEHOLDERS: Record<ChatMode, string> = {
  write:    "What would you like to write?",
  research: "What would you like to research?",
  think:    "What would you like to think through?",
  build:    "What would you like to build?",
};

// ── Template cards config ─────────────────────────────────────────────────────

const TEMPLATE_CARDS: Array<{ icon: React.ReactNode; label: string; prompt: string }> = [
  {
    icon:   <CalendarFoldIcon size={24} color="var(--yellow-500)" animated />,
    label:  "Prep me for an upcoming meeting",
    prompt: "Help me prepare for an upcoming meeting",
  },
  {
    icon:   <StickyNoteTwoIcon size={24} color="#141B34" animated />,
    label:  "Help me draft and structure my notes",
    prompt: "Help me draft and structure my notes",
  },
  {
    icon:   <AuctionIcon size={24} color="var(--green-500)" animated />,
    label:  "Compare and evaluate my options",
    prompt: "Help me compare and evaluate my options",
  },
];

// ── Add-menu (Figma 3219:33599) ───────────────────────────────────────────────

interface AddMenuProps {
  webSearchEnabled: boolean;
  onWebSearchChange: (enabled: boolean) => void;
  onAddFilesClick: () => void;
}

function AddMenu({ webSearchEnabled, onWebSearchChange, onAddFilesClick }: AddMenuProps) {
  return (
    <Dropdown style={{ width: 200 }}>
      <Dropdown.Section fluid>
        <Dropdown.Item
          label="Add files or photos"
          icon={<FolderAddIcon />}
          fluid
          onClick={onAddFilesClick}
        />
        <Dropdown.Item
          label="Web search"
          icon={<GlobalSearchIcon />}
          showSwitch
          switchChecked={webSearchEnabled}
          onSwitchChange={onWebSearchChange}
          fluid
        />
        <Dropdown.Item
          label="Use style"
          icon={<QuillWriteTwoIcon />}
          rightIcon={<ArrowRightOneIcon />}
          fluid
        />
        <Dropdown.Item
          label="Add persona"
          icon={<UserIcon />}
          rightIcon={<ArrowRightOneIcon />}
          fluid
        />
        <Dropdown.Item
          label="Pin folders"
          icon={<FolderOneIcon />}
          rightIcon={<ArrowRightOneIcon />}
          fluid
        />
      </Dropdown.Section>
    </Dropdown>
  );
}

// ── Model-menu (Figma 3208:32989) ─────────────────────────────────────────────

const MOST_USED_MODELS = [
  { id: "claude",   llm: "Claude"   as const, label: "Claude Opus 4.5" },
  { id: "gpt5",     llm: "OpenAI"   as const, label: "GPT-5" },
  { id: "gemini",   llm: "Gemini"   as const, label: "Gemini 2.5 Pro" },
  { id: "deepseek", llm: "DeepSeek" as const, label: "DeepSeek V3" },
  { id: "grok",     llm: "Grok"     as const, label: "Grok 4" },
];

const RECENT_MODELS = [
  { id: "sonnet",    llm: "Claude"  as const, label: "Claude Sonnet 4.5" },
  { id: "haiku",     llm: "Claude"  as const, label: "Claude Haiku 4.5" },
  { id: "gpt5-mini", llm: "OpenAI"  as const, label: "GPT-5 Mini" },
  { id: "mistral",   llm: "Mistral" as const, label: "Mistral Large" },
  { id: "qwen",      llm: "Qwen"    as const, label: "Qwen 3 Max" },
];

function DefaultModelMenu() {
  const [moreOpen, setMoreOpen] = React.useState(false);
  return (
    <Dropdown size="md">
      <Dropdown.Section fluid>
        <Dropdown.Item
          label="Souvenir : Advance"
          subLabel="Most capable for ambitious work"
          showSwitch
          defaultSwitchChecked={false}
          fluid
        />
        <Dropdown.Item
          label="Adaptive thinking"
          subLabel="Most capable for ambitious work"
          showSwitch
          defaultSwitchChecked={false}
          fluid
        />
        <Dropdown.Float
          open={moreOpen}
          onOpenChange={setMoreOpen}
          placement="right-end"
          trigger={
            <Dropdown.Item
              label="More models"
              rightIcon={<ArrowRightOneIcon />}
              fluid
            />
          }
        >
          <Dropdown size="md">
            <Dropdown.Section label="Most used" fluid>
              {MOST_USED_MODELS.map((m) => (
                <Dropdown.Item key={m.id} label={m.label} llm={m.llm} fluid />
              ))}
            </Dropdown.Section>
            <Dropdown.Section label="Recents" divider fluid>
              {RECENT_MODELS.map((m) => (
                <Dropdown.Item key={m.id} label={m.label} llm={m.llm} fluid />
              ))}
            </Dropdown.Section>
          </Dropdown>
        </Dropdown.Float>
      </Dropdown.Section>
    </Dropdown>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const chatIdFromUrl = searchParams.get("id") ?? undefined;

  const [activeChatId, setActiveChatId] = useState<string | undefined>(chatIdFromUrl);
  const [pendingModelSwitch, setPendingModelSwitch] = useState<AIModel | null>(null);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  const [hasMessages, setHasMessages] = useState(!!chatIdFromUrl);
  const [newChatInput, setNewChatInput] = useState("");
  const [selectedMode, setSelectedMode] = useState<ChatMode | null>(null);

  // ── Add-menu feature state ────────────────────────────────────────────────
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [newChatAttachments, setNewChatAttachments] = useState<PendingAttachment[]>([]);
  const [addMenuFiles, setAddMenuFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { processFiles, FILE_ACCEPT } = useFileUpload();

  // ── New-chat @-mention / pin state ────────────────────────────────────────
  const newChatInputWrapperRef = useRef<HTMLDivElement>(null);
  const [newChatShowPinDropdown, setNewChatShowPinDropdown] = useState(false);
  const [newChatPinQuery, setNewChatPinQuery] = useState("");
  const [newChatHighlightedPinIndex, setNewChatHighlightedPinIndex] = useState(0);
  const [newChatMentionedPins, setNewChatMentionedPins] = useState<MentionedPin[]>([]);

  const { pins } = usePinOperations();

  const newChatFilteredPins = useMemo<Pin[]>(() => {
    if (!newChatPinQuery.trim()) return pins.slice(0, 10);
    const q = newChatPinQuery.toLowerCase();
    return pins.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [pins, newChatPinQuery]);

  // Reset highlighted index on filtered list change
  useEffect(() => {
    setNewChatHighlightedPinIndex(0);
  }, [newChatFilteredPins]);

  // Close pin dropdown on outside click
  useEffect(() => {
    if (!newChatShowPinDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        newChatInputWrapperRef.current &&
        !newChatInputWrapperRef.current.contains(e.target as Node)
      ) {
        setNewChatShowPinDropdown(false);
        setNewChatPinQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [newChatShowPinDropdown]);

  const handleNewChatMentionChange = useCallback((query: string | null) => {
    if (query === null) {
      setNewChatShowPinDropdown(false);
      setNewChatPinQuery("");
    } else {
      setNewChatShowPinDropdown(true);
      setNewChatPinQuery(query);
    }
  }, []);

  const handleNewChatPinSelect = useCallback((pin: Pin) => {
    const label = (pin.title || pin.content).slice(0, 50) || pin.id;
    setNewChatInput((prev) => {
      const lastAt = prev.lastIndexOf("@");
      return lastAt !== -1 ? prev.substring(0, lastAt) : prev;
    });
    setNewChatMentionedPins((prev) =>
      prev.some((m) => m.id === pin.id) ? prev : [...prev, { id: pin.id, label }],
    );
    setNewChatShowPinDropdown(false);
    setNewChatPinQuery("");
  }, []);

  const handleNewChatRemoveMention = useCallback((pinId: string) => {
    setNewChatMentionedPins((prev) => prev.filter((m) => m.id !== pinId));
  }, []);

  const handleNewChatPinNavigate = useCallback(
    (action: "up" | "down" | "select" | "close") => {
      switch (action) {
        case "down":
          setNewChatHighlightedPinIndex((i) =>
            i < newChatFilteredPins.length - 1 ? i + 1 : 0,
          );
          break;
        case "up":
          setNewChatHighlightedPinIndex((i) =>
            i > 0 ? i - 1 : newChatFilteredPins.length - 1,
          );
          break;
        case "select":
          if (newChatFilteredPins[newChatHighlightedPinIndex]) {
            handleNewChatPinSelect(newChatFilteredPins[newChatHighlightedPinIndex]);
          }
          break;
        case "close":
          setNewChatShowPinDropdown(false);
          setNewChatPinQuery("");
          break;
      }
    },
    [newChatFilteredPins, newChatHighlightedPinIndex, handleNewChatPinSelect],
  );

  // ── File handling ─────────────────────────────────────────────────────────

  const handleAddFilesClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      if (isNewChat) {
        setNewChatAttachments((prev) => processFiles(e.target.files!, prev));
      } else {
        setAddMenuFiles(Array.from(e.target.files!));
      }
      e.target.value = "";
    }
  };

  const clearAddMenuFiles = () => setAddMenuFiles([]);

  // ── Chips (web search + mentioned pins) ──────────────────────────────────

  const webSearchChip = webSearchEnabled ? (
    <Chip
      key="web-search"
      size="Medium"
      icon={<GlobalSearchIcon size={20} color="var(--chip-text)" />}
      label="Web search"
      onRemove={() => setWebSearchEnabled(false)}
    />
  ) : null;

  // Chips for the active-chat interface (no pin chips — ChatInterface manages its own)
  const chips = webSearchChip ? [webSearchChip] : undefined;

  // Chips for the new-chat input: pin mention chips + web search chip
  const newChatChips: React.ReactNode =
    newChatMentionedPins.length > 0 ? (
      <>
        {newChatMentionedPins.map((mp) => (
          <MentionChip
            key={mp.id}
            label={mp.label}
            onRemove={() => handleNewChatRemoveMention(mp.id)}
          />
        ))}
        {webSearchChip}
      </>
    ) : (
      webSearchChip
    );

  // ── Add menu ──────────────────────────────────────────────────────────────

  const addMenu = (
    <AddMenu
      webSearchEnabled={webSearchEnabled}
      onWebSearchChange={setWebSearchEnabled}
      onAddFilesClick={handleAddFilesClick}
    />
  );

  // ── Model selector ────────────────────────────────────────────────────────

  const {
    selectedModel,
    selectModel,
    open: openModelSelector,
    museActive,
    museAdvanced,
  } = useModelSelectorContext();

  const modelButtonLabel = museActive
    ? museAdvanced
      ? "Souvenir AI Muse (Advanced)"
      : "Souvenir AI Muse (Basic)"
    : selectedModel?.modelName;

  const { rename: renameChat, renameLocal, addOptimistic } = useChatHistoryContext();

  // Sync URL param into local state (e.g. sidebar navigation)
  useEffect(() => {
    if (chatIdFromUrl !== activeChatId) {
      setActiveChatId(chatIdFromUrl);
      setHasMessages(!!chatIdFromUrl);
      setInitialPrompt(null);
    }
  }, [chatIdFromUrl]);

  const isNewChat = !activeChatId && !hasMessages && !initialPrompt;

  // Drag-and-drop on the new-chat landing page
  const { isDragging: isNewChatDragging } = useFileDrop({
    onFiles: (files) => {
      setNewChatAttachments((prev) => processFiles(files, prev));
    },
    disabled: !isNewChat,
  });

  const handleModelClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    openModelSelector(e.currentTarget);
  };

  const handleModelSwitchConfirm = () => {
    if (pendingModelSwitch) {
      selectModel(pendingModelSwitch);
      setPendingModelSwitch(null);
    }
  };

  const handleModelSwitchCancel = () => {
    setPendingModelSwitch(null);
  };

  const handleChatCreated = (chatId: string) => {
    setActiveChatId(chatId);
    setHasMessages(true);
    router.replace(`/chat?id=${chatId}`, { scroll: false });
    addOptimistic({
      id: chatId,
      title: "New chat",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      starred: false,
    });
  };

  const handleTitleUpdate = (chatId: string, title: string) => {
    // Update local state immediately — the backend already set the title via SSE,
    // so there's no need to call the rename API here.
    renameLocal(chatId, title);
  };

  const handleChatMoveToTop = (chatId: string) => {
    addOptimistic({
      id: chatId,
      title: "New chat",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      starred: false,
    });
  };

  // Capture typed message from new-chat landing → transition to ChatInterface
  const handleNewChatSend = (value: string) => {
    if (!value.trim()) return;
    const pendingFiles = newChatAttachments.map((a) => a.file);
    setAddMenuFiles(pendingFiles);
    setNewChatAttachments([]);
    setNewChatMentionedPins([]);
    setInitialPrompt(value.trim());
    setNewChatInput("");
    setHasMessages(true);
    setSelectedMode(null);
  };

  return (
    <div
      style={{
        flex:          1,
        position:      "relative",
        display:       "flex",
        flexDirection: "column",
        height:        "100%",
        minHeight:     "400px",
        overflow:      "hidden",
      }}
    >
      {/* Hidden file input — triggered by "Add files or photos" in add menu */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={FILE_ACCEPT}
        onChange={handleFileInputChange}
        style={{ display: "none" }}
        aria-hidden="true"
      />

      <AnimatePresence mode="sync" initial={false}>
        {isNewChat ? (
          <motion.div
            key="new-chat"
            exit={{ opacity: 0, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } }}
            style={{
              position:  "absolute",
              inset:     0,
              overflowY: "auto",
            }}
          >
            {/* Drop overlay */}
            {isNewChatDragging && (
              <div
                style={{
                  position:        "fixed",
                  inset:           0,
                  zIndex:          40,
                  display:         "flex",
                  alignItems:      "center",
                  justifyContent:  "center",
                  backgroundColor: "rgba(255,255,255,0.88)",
                  border:          "2px dashed var(--focus-ring)",
                  borderRadius:    "16px",
                  pointerEvents:   "none",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize:   "var(--font-size-body-md)",
                    color:      "var(--blue-600)",
                    fontWeight: 500,
                  }}
                >
                  Drop files here
                </span>
              </div>
            )}

            {/* Centering wrapper — allows vertical centering on tall screens, scrolling on short ones */}
            <div
              style={{
                minHeight:      "100%",
                display:        "flex",
                flexDirection:  "column",
                alignItems:     "center",
                justifyContent: "center",
                padding:        "40px 16px 48px",
              }}
            >
              <div
                style={{
                  display:       "flex",
                  flexDirection: "column",
                  alignItems:    "center",
                  gap:           "24px",
                  maxWidth:      "768px",
                  width:         "100%",
                }}
              >
                {/* Greeting exits upward */}
                <motion.div
                  exit={{ opacity: 0, y: -28, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
                >
                  <InitialPrompts />
                </motion.div>

                {/* Input + action buttons + template cards exit downward */}
                <motion.div
                  style={{ width: "100%", maxWidth: "640px", margin: "0 auto" }}
                  exit={{ opacity: 0, y: 36, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
                >
                  {/* Pin mention dropdown wrapper — position:relative anchor */}
                  <div ref={newChatInputWrapperRef} style={{ width: "100%", position: "relative" }}>
                    <PinMentionDropdown
                      isOpen={newChatShowPinDropdown}
                      pins={newChatFilteredPins}
                      query={newChatPinQuery}
                      highlightedIndex={newChatHighlightedPinIndex}
                      onHighlight={setNewChatHighlightedPinIndex}
                      onSelect={handleNewChatPinSelect}
                    />
                    <ChatInput
                      value={newChatInput}
                      onChange={setNewChatInput}
                      onSend={handleNewChatSend}
                      modelName={modelButtonLabel}
                      onModelClick={handleModelClick}
                      addMenu={addMenu}
                      modelMenu={<DefaultModelMenu />}
                      chips={newChatChips}
                      attachmentsSlot={
                        <AttachmentManager
                          attachments={newChatAttachments}
                          onAttachmentsChange={setNewChatAttachments}
                        />
                      }
                      placeholder={
                        selectedMode
                          ? MODE_PLACEHOLDERS[selectedMode]
                          : "How can I help you today?"
                      }
                      onMentionChange={handleNewChatMentionChange}
                      isPinDropdownOpen={newChatShowPinDropdown}
                      onPinNavigate={handleNewChatPinNavigate}
                    />
                  </div>

                  {/* ── Action mode buttons ─────────────────────────────────── */}
                  <div
                    style={{
                      display:        "flex",
                      justifyContent: "center",
                      gap:            "8px",
                      marginTop:      "16px",
                      flexWrap:       "wrap",
                    }}
                  >
                    {ACTION_BUTTONS.map((btn) => (
                      <div
                        key={btn.mode}
                        style={{
                          opacity:    (btn.disabled || (selectedMode && selectedMode !== btn.mode)) ? 0.4 : 1,
                          transition: "opacity 150ms",
                        }}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={btn.icon}
                          disabled={btn.disabled}
                          onClick={btn.disabled ? undefined : () =>
                            setSelectedMode((prev) => (prev === btn.mode ? null : btn.mode))
                          }
                        >
                          {btn.label}
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* ── Template cards ──────────────────────────────────────── */}
                  <div style={{ marginTop: "28px" }}>
                    <p
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize:   "13px",
                        fontWeight: 500,
                        color:      "var(--neutral-500)",
                        margin:     "0 0 10px",
                        textAlign:  "left",
                      }}
                    >
                      Not sure where to start?
                    </p>
                    <div style={{ display: "flex", gap: "10px" }}>
                      {TEMPLATE_CARDS.map((card, i) => (
                        <TemplateCard
                          key={i}
                          icon={card.icon}
                          label={card.label}
                          onClick={() => handleNewChatSend(card.prompt)}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="active-chat"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0, 0, 0.2, 1] } }}
            style={{
              position:      "absolute",
              inset:         0,
              display:       "flex",
              flexDirection: "column",
            }}
          >
            <ChatInterface
              chatId={activeChatId}
              onChatCreated={handleChatCreated}
              onTitleUpdate={handleTitleUpdate}
              onChatMoveToTop={handleChatMoveToTop}
              selectedModel={modelButtonLabel}
              selectedModelId={selectedModel?.id}
              onModelClick={handleModelClick}
              addMenu={addMenu}
              modelMenu={<DefaultModelMenu />}
              initialPrompt={initialPrompt}
              webSearchEnabled={webSearchEnabled}
              addMenuFiles={addMenuFiles}
              onClearAddMenuFiles={clearAddMenuFiles}
              chips={chips}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Switch confirmation dialog */}
      <ModelSwitchDialog
        isOpen={!!pendingModelSwitch}
        fromModel={selectedModel}
        toModel={pendingModelSwitch}
        onConfirm={handleModelSwitchConfirm}
        onCancel={handleModelSwitchCancel}
      />
    </div>
  );
}
