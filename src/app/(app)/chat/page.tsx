"use client";

import React, { Suspense, useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ChatInput } from "@/components/chat/ChatInput";
import { InitialPrompts } from "@/components/chat/InitialPrompts";
import { ModelSwitchDialog } from "@/components/chat/ModelSwitchDialog";
import { useModelSelectorContext } from "@/context/model-selector-context";
import { useChatHistoryContext } from "@/context/chat-history-context";
import { Dropdown } from "@/components/Dropdown";
import { Chip } from "@/components/Chip";
import {
  ArrowRightOneIcon,
  FolderAddIcon,
  FolderOneIcon,
  GlobalSearchIcon,
  QuillWriteTwoIcon,
  UserIcon,
} from "@strange-huge/icons";
import type { AIModel } from "@/types/ai-model";

// ── File upload config ─────────────────────────────────────────────────────────

const FILE_ACCEPT = [
  ".pdf", "application/pdf",
  ".doc", ".docx", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".ppt", ".pptx", "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".csv", "text/csv",
  ".xls", ".xlsx", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt", "text/plain",
  "image/*",
].join(",")

const MAX_ADD_FILES = 10

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

  const [activeChatId, setActiveChatId] = useState<string | undefined>(
    chatIdFromUrl,
  );
  const [pendingModelSwitch, setPendingModelSwitch] = useState<AIModel | null>(
    null,
  );
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  const [hasMessages, setHasMessages] = useState(!!chatIdFromUrl);
  const [newChatInput, setNewChatInput] = useState("");

  // ── Add-menu feature state ────────────────────────────────────────────────
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [addMenuFiles, setAddMenuFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddFilesClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const incoming = Array.from(e.target.files);
      setAddMenuFiles((prev) => [...prev, ...incoming].slice(0, MAX_ADD_FILES));
      e.target.value = "";
    }
  };

  const clearAddMenuFiles = () => setAddMenuFiles([]);

  // ── Chips ─────────────────────────────────────────────────────────────────
  // Web search → Medium chip: icon at rest, ChipButton (×) appears on hover.
  const chipItems: React.ReactNode[] = [
    webSearchEnabled && (
      <Chip
        key="web-search"
        size="Medium"
        icon={<GlobalSearchIcon size={20} color="var(--chip-text)" />}
        label="Web search"
        onRemove={() => setWebSearchEnabled(false)}
      />
    ),
  ].filter(Boolean);

  const chips = chipItems.length > 0 ? chipItems : undefined;

  // ── Add menu (memoised by state so re-renders only when state changes) ────
  const addMenu = (
    <AddMenu
      webSearchEnabled={webSearchEnabled}
      onWebSearchChange={setWebSearchEnabled}
      onAddFilesClick={handleAddFilesClick}
    />
  );

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
  const { rename: renameChat, addOptimistic } = useChatHistoryContext();

  // Sync URL param changes into local state (e.g. sidebar navigation)
  useEffect(() => {
    if (chatIdFromUrl !== activeChatId) {
      setActiveChatId(chatIdFromUrl);
      setHasMessages(!!chatIdFromUrl);
      setInitialPrompt(null);
    }
  }, [chatIdFromUrl]);

  const isNewChat = !activeChatId && !hasMessages && !initialPrompt;

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
    renameChat(chatId, title);
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

  // New-chat landing page: capture typed message, transition to ChatInterface
  const handleNewChatSend = (value: string) => {
    if (!value.trim()) return;
    setInitialPrompt(value.trim());
    setNewChatInput("");
    setHasMessages(true);
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
              position:       "absolute",
              inset:          0,
              display:        "flex",
              flexDirection:  "column",
              alignItems:     "center",
              justifyContent: "center",
              padding:        "24px 16px",
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

              {/* Input exits downward — suggests moving to bottom position */}
              <motion.div
                style={{ width: "100%", maxWidth: "640px", margin: "0 auto" }}
                exit={{ opacity: 0, y: 36, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
              >
                <ChatInput
                  value={newChatInput}
                  onChange={setNewChatInput}
                  onSend={handleNewChatSend}
                  modelName={modelButtonLabel}
                  onModelClick={handleModelClick}
                  addMenu={addMenu}
                  modelMenu={<DefaultModelMenu />}
                  chips={chips}
                  placeholder="How can I help you today?"
                />
              </motion.div>
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

      {/* Switch confirmation — shown when pendingModelSwitch is set */}
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
