"use client";

import React, { Suspense, useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { AnimatePresence, m } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
const WelcomeModal = dynamic(() => import("@/components/onboarding/WelcomeModal").then(m => ({ default: m.WelcomeModal })), { ssr: false, loading: () => null });
import { X } from "lucide-react";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ChatInput } from "@/components/chat/ChatInput";
import { AttachmentManager, type PendingAttachment } from "@/components/chat/AttachmentManager";
import { InitialPrompts } from "@/components/chat/InitialPrompts";
const ModelSwitchDialog = dynamic(() => import("@/components/chat/ModelSwitchDialog").then(m => ({ default: m.ModelSwitchDialog })), { ssr: false, loading: () => null });
import { PinMentionDropdown } from "@/components/chat/PinMentionDropdown";
import { useModelSelectorContext } from "@/context/model-selector-context";
import { useChatHistoryContext } from "@/context/chat-history-context";
import { useHighlight } from "@/context/highlight-context";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useFileDrop } from "@/hooks/use-file-drop";
import { usePinboard, type PinItem } from "@/context/pinboard-context";
import type { PinMentionable } from "@/components/chat/PinMentionDropdown";
import { Dropdown } from "@/components/Dropdown";
import { Chip } from "@/components/Chip";
import { Button } from "@/components/Button";
import { ChatAddMenu, USE_STYLE_OPTIONS, type SelectedPersonaInfo } from "@/components/chat/AddMenu";
import { fetchPersonas, getVersion } from "@/lib/api/personas";
import { ModelMenu } from "@/components/chat/ModelMenu";
import {
  FolderOneIcon,
  GlobalSearchIcon,
  QuillWriteTwoIcon,
  QuillWriteOneIcon,
  NeuralNetworkIcon,
  AiVisionRecognitionIcon,
  AiWebBrowsingIcon,
  CalendarFoldIcon,
  StickyNoteTwoIcon,
  AuctionIcon,
} from "@strange-huge/icons";
import type { AIModel } from "@/types/ai-model";
import type { PinFolder } from "@/lib/api/pins";

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
  { mode: "research", label: "Research", icon: <NeuralNetworkIcon      size={16} animated /> },
  { mode: "think",    label: "Think",    icon: <AiVisionRecognitionIcon size={16} animated /> },
  { mode: "build",    label: "Build",    icon: <AiWebBrowsingIcon      size={16} animated /> },
];

const MODE_PLACEHOLDERS: Record<ChatMode, string> = {
  write:    "What would you like to write?",
  research: "What would you like to research?",
  think:    "What would you like to think through?",
  build:    "What would you like to build?",
};

const MODE_PROMPT_PREFIX: Record<ChatMode, string> = {
  write:    "Write",
  research: "Research",
  think:    "Think",
  build:    "Build",
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

// ── Per-chat settings helpers ─────────────────────────────────────────────────
// Settings (webSearch, persona) are stored per-chatId so each chat remembers
// its own state and navigating between chats never bleeds settings across.

interface ChatSettings {
  webSearch: boolean;
  persona: SelectedPersonaInfo | null;
}

function loadChatSettings(chatId: string): ChatSettings | null {
  try {
    const raw = localStorage.getItem(`souvenir_chat_${chatId}`);
    return raw ? (JSON.parse(raw) as ChatSettings) : null;
  } catch { return null; }
}

function saveChatSettings(chatId: string, settings: ChatSettings): void {
  try { localStorage.setItem(`souvenir_chat_${chatId}`, JSON.stringify(settings)); } catch {}
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
      <WelcomeModal />
    </Suspense>
  );
}

// eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
function ChatPageInner() {
  const searchParams = useSearchParams();
  const { replace } = useRouter();
  const chatIdFromUrl = searchParams.get("id") ?? undefined;
  const msgFromUrl    = searchParams.get("msg") ?? undefined;

  const [activeChatId, setActiveChatId] = useState<string | undefined>(chatIdFromUrl);
  const [pendingModelSwitch, setPendingModelSwitch] = useState<AIModel | null>(null);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  const [hasMessages, setHasMessages] = useState(!!chatIdFromUrl);
  const [newChatInput, setNewChatInput] = useState("");
  const [selectedMode, setSelectedMode] = useState<ChatMode | null>(null);

  // ── Add-menu feature state ────────────────────────────────────────────────
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [selectedStyleId,  setSelectedStyleId]  = useState<string | null>(null);
  const [styleChipOpen,       setStyleChipOpen]       = useState(false);
  const [personaChipOpen,     setPersonaChipOpen]     = useState(false);
  const [chipPersonas,        setChipPersonas]        = useState<SelectedPersonaInfo[]>([]);
  const [loadingChipPersonas, setLoadingChipPersonas] = useState(false);
  const [selectedFolders,  setSelectedFolders]  = useState<PinFolder[]>([]);
  const [selectedPersona,  setSelectedPersona]  = useState<SelectedPersonaInfo | null>(null);

  // Tracks which chatIds were created in this session as persona chats.
  // This prevents routing an existing regular chatId through the persona endpoint.
  const personaChatIds = useRef(new Map<string, string>()); // chatId → personaId

  // When the URL chatId changes (navigation), load that chat's stored settings.
  // Settings are per-chat — navigating away resets to defaults so no cross-chat bleed.
  useEffect(() => {
    if (chatIdFromUrl) {
      const s = loadChatSettings(chatIdFromUrl);
      setWebSearchEnabled(s?.webSearch ?? false);
      setSelectedPersona(s?.persona ?? null);
      // Restore persona overlay for chats we previously sent persona_id for.
      // Stored value is the version id (what the backend expects on /chats),
      // with a fall-back to s.persona.id for entries saved before that change.
      const restoredVersionId = s?.persona?.activeVersionId ?? s?.persona?.id;
      if (restoredVersionId) personaChatIds.current.set(chatIdFromUrl, restoredVersionId);
    } else {
      setWebSearchEnabled(false);
      setSelectedPersona(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatIdFromUrl]);

  // Persist settings whenever they change for an existing active chat.
  useEffect(() => {
    if (!activeChatId) return;
    saveChatSettings(activeChatId, { webSearch: webSearchEnabled, persona: selectedPersona });
  }, [activeChatId, webSearchEnabled, selectedPersona]);
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

  const { pins } = usePinboard();

  const newChatFilteredPins = useMemo<PinItem[]>(() => {
    if (!newChatPinQuery.trim()) return pins.slice(0, 10);
    const q = newChatPinQuery.toLowerCase();
    return pins.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [pins, newChatPinQuery]);

  // Reset highlighted index on filtered list change
  // eslint-disable-next-line react-doctor/no-derived-state-effect -- index reset on filter change; not a component-level key-prop candidate
  useEffect(() => {
    setNewChatHighlightedPinIndex(0);
  }, [newChatFilteredPins]);

  // When no active chat is open, listen for pin:insert events from the Pinboard
  // and append the pin's content to the new-chat input. ChatInterface handles
  // the same event for active chats, so only register here when there's no chatId.
  useEffect(() => {
    if (activeChatId) return;
    const handler = (e: Event) => {
      const content = (e as CustomEvent<{ content: string }>).detail?.content;
      if (content) setNewChatInput((prev) => prev ? `${prev}\n\n${content}` : content);
    };
    window.addEventListener("pin:insert", handler);
    return () => window.removeEventListener("pin:insert", handler);
  }, [activeChatId]);

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

  const handleNewChatPinSelect = useCallback((pin: PinMentionable) => {
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
    if (e.target.files && e.target.files.length > 0) {
      // Capture into a stable Array before clearing the input — e.target.value = ""
      // causes the browser to replace e.target.files with a new empty FileList, and
      // React's setState updater runs after the clear, so it would see an empty list.
      const files = Array.from(e.target.files);
      if (isNewChat) {
        setNewChatAttachments((prev) => processFiles(files, prev));
      } else {
        setAddMenuFiles(files);
      }
      e.target.value = "";
    }
  };

  const clearAddMenuFiles = () => setAddMenuFiles([]);

  // ── Chips (style + folders + web search + mentioned pins) ───────────────────

  const activeStyle = USE_STYLE_OPTIONS.find(s => s.id === selectedStyleId) ?? null

  const styleChip = activeStyle && (
    <Dropdown.Float
      open={styleChipOpen}
      onOpenChange={setStyleChipOpen}
      placement="top-start"
      trigger={
        <Chip
          label={activeStyle.label}
          icon={<QuillWriteTwoIcon size={20} color="var(--chip-text)" />}
          onRemove={() => setSelectedStyleId(null)}
          onExpand={() => setStyleChipOpen(v => !v)}
        />
      }
    >
      <Dropdown size="md">
        <Dropdown.Section fluid>
          {USE_STYLE_OPTIONS.map(opt => (
            <Dropdown.Item
              key={opt.id}
              label={opt.label}
              subLabel={opt.subLabel}
              selected={opt.id === 'none' ? selectedStyleId === null : selectedStyleId === opt.id}
              onClick={() => { setSelectedStyleId(opt.id === 'none' ? null : opt.id); setStyleChipOpen(false) }}
              fluid
            />
          ))}
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )

  const webSearchChip = webSearchEnabled ? (
    <Chip
      key="web-search"
      size="Medium"
      icon={<GlobalSearchIcon size={20} color="var(--chip-text)" />}
      label="Web search"
      onRemove={() => setWebSearchEnabled(false)}
    />
  ) : null;

  const folderChips = selectedFolders.map(folder => (
    <Chip
      key={folder.id}
      label={folder.name}
      icon={<FolderOneIcon size={20} color="var(--chip-text)" />}
      onRemove={() => setSelectedFolders(prev => prev.filter(f => f.id !== folder.id))}
    />
  ));

  const personaChip = selectedPersona ? (
    <Dropdown.Float
      open={personaChipOpen}
      onOpenChange={setPersonaChipOpen}
      placement="top-start"
      trigger={
        <Chip
          label={selectedPersona.name}
          personaImage={selectedPersona.imageUrl ?? undefined}
          onRemove={() => setSelectedPersona(null)}
          onExpand={() => setPersonaChipOpen(v => !v)}
          title={undefined}
          style={undefined}
        />
      }
    >
      <Dropdown size="md" style={{ minWidth: 200 }} maxHeight="min(280px, calc(100dvh - 120px))">
        <Dropdown.Section fluid>
          {loadingChipPersonas
            ? <Dropdown.Item label="Loading…" fluid disabled />
            : chipPersonas.length > 0
              ? chipPersonas.map(p => (
                  <Dropdown.Item
                    key={p.id}
                    label={p.name}
                    fluid
                    selected={selectedPersona.id === p.id}
                    onClick={() => { setSelectedPersona(p); setPersonaChipOpen(false) }}
                  />
                ))
              : <Dropdown.Item label="No personas yet" fluid disabled />
          }
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  ) : null;

  // Chips for ChatInterface (style + folders + web search + persona)
  const chips: React.ReactNode = (styleChip || folderChips.length > 0 || webSearchChip || personaChip) ? (
    <>{styleChip}{folderChips}{webSearchChip}{personaChip}</>
  ) : undefined;

  // Chips for the new-chat input (adds pin mention chips on top)
  const newChatChips: React.ReactNode = (
    <>
      {styleChip}
      {folderChips}
      {newChatMentionedPins.map((mp) => (
        <MentionChip key={mp.id} label={mp.label} onRemove={() => handleNewChatRemoveMention(mp.id)} />
      ))}
      {webSearchChip}
      {personaChip}
    </>
  );

  // ── Add menu ──────────────────────────────────────────────────────────────

  const addMenu = (
    <ChatAddMenu
      webSearchEnabled={webSearchEnabled}
      onWebSearchChange={setWebSearchEnabled}
      onAddFilesClick={handleAddFilesClick}
      selectedStyleId={selectedStyleId}
      onStyleChange={setSelectedStyleId}
      selectedFolders={selectedFolders}
      onFolderToggle={(folder) => setSelectedFolders(prev =>
        prev.some(f => f.id === folder.id) ? prev.filter(f => f.id !== folder.id) : [...prev, folder]
      )}
      selectedPersonaId={selectedPersona?.id ?? null}
      onPersonaChange={setSelectedPersona}
    />
  );

  // ── Model selector ────────────────────────────────────────────────────────

  const {
    models,
    selectedModel,
    selectModel,
    open: openModelSelector,
    museActive,
    museAdvanced,
    enableReasoning,
  } = useModelSelectorContext();

  // Keep a stable ref to selectModel so the effect below doesn't re-run every render
  // due to the context function being recreated on each render.
  const selectModelRef = useRef(selectModel)
  selectModelRef.current = selectModel

  useEffect(() => {
    if (!selectedPersona) return

    // Version data already cached — just apply model
    if (selectedPersona.systemPrompt !== null) {
      if (selectedPersona.modelId && models.length > 0) {
        const match = models.find(m => String(m.modelId ?? m.id) === String(selectedPersona.modelId))
        if (match) selectModelRef.current(match)
      }
      return
    }

    // No activeVersionId — apply model from list data if available, can't fetch prompt
    if (!selectedPersona.activeVersionId) {
      if (selectedPersona.modelId && models.length > 0) {
        const match = models.find(m => String(m.modelId ?? m.id) === String(selectedPersona.modelId))
        if (match) selectModelRef.current(match)
      }
      return
    }

    // Fetch active version to get systemPrompt, temperature, and authoritative modelId
    let cancelled = false
    getVersion(selectedPersona.id, selectedPersona.activeVersionId)
      .then(version => {
        if (cancelled) return
        if (version.model_id && models.length > 0) {
          const match = models.find(m => String(m.modelId ?? m.id) === version.model_id)
          if (match) selectModelRef.current(match)
        }
        setSelectedPersona(prev =>
          prev?.id === selectedPersona.id
            ? {
                ...prev,
                modelId:      version.model_id ?? prev.modelId,
                systemPrompt: version.prompt,
                temperature:  version.temperature,
              }
            : prev
        )
      })
      .catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- selectModel intentionally via ref
  }, [selectedPersona, models])

  // eslint-disable-next-line react-doctor/no-cascading-set-state -- React 18+ batches these; useReducer refactor tracked separately
  useEffect(() => {
    if (!personaChipOpen) return
    setLoadingChipPersonas(true)
    fetchPersonas()
      .then(list => setChipPersonas(list.map(p => ({ id: p.id, name: p.name, imageUrl: p.imageUrl, modelId: p.modelId, activeVersionId: p.activeVersionId, systemPrompt: null, temperature: null }))))
      .catch(() => setChipPersonas([]))
      .finally(() => setLoadingChipPersonas(false))
  }, [personaChipOpen])

  const modelButtonLabel = museActive
    ? museAdvanced
      ? "Souvenir AI Muse (Advanced)"
      : "Souvenir AI Muse (Basic)"
    : selectedModel?.modelName;

  const { renameLocal, addOptimistic, moveToTop, refreshChatTitle } = useChatHistoryContext();
  const { loadForChat: loadHighlightsForChat } = useHighlight();

  // Tracks a newly-created chat so handleChatMoveToTop can schedule a title refresh.
  const newlyCreatedChatIdRef = useRef<string | null>(null);

  // Load highlights whenever the URL chat ID changes — reads chatIdFromUrl directly
  // to avoid an effect chain (layoutEffect sets activeChatId → effect reacts to it).
  useEffect(() => {
    if (chatIdFromUrl) loadHighlightsForChat(chatIdFromUrl);
  }, [chatIdFromUrl, loadHighlightsForChat]);

  // Sync URL param into local state (e.g. sidebar navigation).
  // useLayoutEffect so the state update commits before the browser paints —
  // prevents a stale render of the old ChatInterface when navigating to new chat.
  // eslint-disable-next-line react-doctor/no-cascading-set-state -- React 18+ batches these; useReducer refactor tracked separately
  useLayoutEffect(() => {
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
    newlyCreatedChatIdRef.current = chatId;
    setActiveChatId(chatId);
    setHasMessages(true);
    replace(`/chat?id=${chatId}`, { scroll: false });
    addOptimistic({
      id: chatId,
      title: "New chat",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      starred: false,
    });
    // Register persona overlay for this chat. The backend's persona_id field
    // on /chats expects the persona's version id, not the repo id.
    if (selectedPersona?.activeVersionId) {
      personaChatIds.current.set(chatId, selectedPersona.activeVersionId);
    }
    saveChatSettings(chatId, { webSearch: webSearchEnabled, persona: selectedPersona });
  };

  const handleTitleUpdate = (chatId: string, title: string) => {
    // Update local state immediately - the backend already set the title via SSE,
    // so there's no need to call the rename API here.
    renameLocal(chatId, title);
  };

  const handleChatMoveToTop = (chatId: string) => {
    // Reorder the existing chat to the top — preserves its title.
    // (addOptimistic would reset the title to "New chat", overwriting the SSE-set title)
    moveToTop(chatId);
    // For a brand-new chat the backend generates the title asynchronously after the
    // stream ends.  Fetch it at 2.5 s and again at 5 s as a backstop in case the
    // first attempt races with the backend title-generation job.
    if (newlyCreatedChatIdRef.current === chatId) {
      const capturedId = chatId;
      newlyCreatedChatIdRef.current = null;
      setTimeout(() => refreshChatTitle(capturedId), 2500);
      setTimeout(() => refreshChatTitle(capturedId), 5000);
    }
  };

  // Capture typed message from new-chat landing → transition to ChatInterface
  const handleNewChatSend = (value: string) => {
    if (!value.trim()) return;
    const pendingFiles = newChatAttachments.map((a) => a.file);
    setAddMenuFiles(pendingFiles);
    setNewChatAttachments([]);
    setNewChatMentionedPins([]);
    const composed = selectedMode
      ? `${MODE_PROMPT_PREFIX[selectedMode]}: ${value.trim()}`
      : value.trim();
    setInitialPrompt(composed);
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
      {/* Hidden file input - triggered by "Add files or photos" in add menu */}
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
          <m.div
            key="new-chat"
            exit={{ opacity: 0, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } }}
            className="kaya-scrollbar"
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

            {/* Centering wrapper - allows vertical centering on tall screens, scrolling on short ones */}
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
                <m.div
                  exit={{ opacity: 0, y: -28, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
                >
                  <InitialPrompts />
                </m.div>

                {/* Input + action buttons + template cards exit downward */}
                <m.div
                  style={{ width: "100%", maxWidth: "640px", margin: "0 auto" }}
                  exit={{ opacity: 0, y: 36, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
                >
                  {/* Pin mention dropdown wrapper - position:relative anchor */}
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
                      modelMenu={<ModelMenu />}
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
                          opacity:    btn.disabled ? 0.4 : 1,
                          transition: "opacity 150ms",
                        }}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={btn.icon}
                          disabled={btn.disabled}
                          selected={selectedMode === btn.mode}
                          aria-pressed={selectedMode === btn.mode}
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
                      {TEMPLATE_CARDS.map((card) => (
                        <TemplateCard
                          key={card.label}
                          icon={card.icon}
                          label={card.label}
                          onClick={() => handleNewChatSend(card.prompt)}
                        />
                      ))}
                    </div>
                  </div>
                </m.div>
              </div>
            </div>
          </m.div>
        ) : (
          <m.div
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
              modelMenu={<ModelMenu />}
              initialPrompt={initialPrompt}
              webSearchEnabled={webSearchEnabled}
              enableReasoning={enableReasoning}
              addMenuFiles={addMenuFiles}
              onClearAddMenuFiles={clearAddMenuFiles}
              chips={chips}
              selectedFolders={selectedFolders}
              selectedStyleId={selectedStyleId}
              selectedPersonaId={selectedPersona?.activeVersionId ?? null}
              selectedPersonaSystemPrompt={selectedPersona?.systemPrompt ?? null}
              selectedPersonaTemperature={selectedPersona?.temperature ?? null}
              scrollToMessageId={msgFromUrl}
            />
          </m.div>
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
