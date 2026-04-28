"use client";
import React, {
  Suspense,
  useState,
  createContext,
  useEffect,
  useRef,
} from "react";
import { LeftSidebar } from "./left-sidebar";
import { RightSidebar, type PinType } from "./right-sidebar";
import { RightSidebarCollapsed } from "./right-sidebar-collapsed";
import { Topbar } from "./top-bar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
import { Button } from "../ui/button";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message, MessageSource } from "../chat/chat-message";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import type { AIModel } from "@/types/ai-model";
import {
  useChatHistory,
  type EnsureChatOptions,
  type EnsureChatResult,
} from "@/hooks/use-chat-history";
import { useModelSelection } from "@/hooks/use-model-selection";
import { usePinOperations } from "@/hooks/use-pin-operations";
import { useActivePersonas } from "@/hooks/useActivePersonas";
import { DeleteChatDialog } from "./DeleteChatDialog";
import { AppDialogs } from "./AppDialogs";

interface AppLayoutProps {
  children: React.ReactElement;
}

export type Persona = {
  id: string;
  name: string;
  avatar: string | null;
  prompt: string;
  modelId: string | number | null;
  modelName: string | null;
  providerName: string | null;
  status: "active" | "paused";
};

export type ChatMetadata = {
  messageCount?: number | null;
  lastMessageAt?: string | null;
  pinCount?: number | null;
  starred?: boolean | null;
  starMessageId?: string | number | null;
};

export type ChatBoardType = "chat" | "persona" | "workflow";

export type ChatBoard = {
  id: string;
  name: string;
  time: string;
  isStarred: boolean;
  pinCount: number;
  type?: ChatBoardType;
  metadata?: ChatMetadata;
};

export type RightSidebarPanel = "pinboard" | "files" | "personas" | "compare" | "references";

// Re-export from the hook so existing consumers of app-layout exports still work.
export type { EnsureChatOptions, EnsureChatResult } from "@/hooks/use-chat-history";

export interface AppLayoutContextType {
  chatBoards: ChatBoard[];
  setChatBoards: React.Dispatch<React.SetStateAction<ChatBoard[]>>;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  pins: PinType[];
  onPinMessage: (pin: PinType) => Promise<void>;
  onUnpinMessage: (pinId: string) => Promise<void>;
  handleAddChat: (typeOverride?: ChatBoardType | null) => void;
  ensureChatOnServer: (
    options: EnsureChatOptions
  ) => Promise<EnsureChatResult | null>;
  selectedModel: AIModel | null;
  moveChatToTop: (chatId: string) => void;
  setSelectedModel: React.Dispatch<React.SetStateAction<AIModel | null>>;
  useFramework: boolean;
  setUseFramework: React.Dispatch<React.SetStateAction<boolean>>;
  frameworkType: "starter" | "pro";
  setFrameworkType: React.Dispatch<React.SetStateAction<"starter" | "pro">>;
  memoryPercentage: number;
  setMemoryPercentage: React.Dispatch<React.SetStateAction<number>>;
  // Selected pins from model switch dialog to include with next message
  selectedPinIdsForNextMessage: string[];
  setSelectedPinIdsForNextMessage: React.Dispatch<React.SetStateAction<string[]>>;
  // References panel (sources/citations from chat)
  referencesSources: MessageSource[];
  setReferencesSources: React.Dispatch<React.SetStateAction<MessageSource[]>>;
  /** Open the right sidebar with the References (Sources) panel. Called from Sources button on AI messages. */
  openReferencesPanel: () => void;
  /** Update a chat board title with typewriter animation effect */
  updateChatTitleWithAnimation: (chatId: string, newTitle: string) => void;
  /** Get the currently animating title for a chat (if any) */
  getAnimatingTitle: (chatId: string) => { targetTitle: string; timestamp: number } | null;
  /** Re-fetch a single chat from the backend and update its title (used after async title generation) */
  refreshChatTitle: (chatId: string) => void;
  // Active personas (fetched once and shared across components)
  activePersonas: Persona[];
  setActivePersonas: React.Dispatch<React.SetStateAction<Persona[]>>;
}

export const AppLayoutContext = createContext<AppLayoutContextType | null>(
  null
);

export default function AppLayout({ children }: AppLayoutProps) {
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('leftSidebarCollapsed');
    if (stored === 'true') {
      setIsLeftSidebarCollapsed(true);
    }
  }, []);
  const [activeRightSidebarPanel, setActiveRightSidebarPanel] =
    useState<RightSidebarPanel | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const isAuthenticatedRef = useRef(isAuthenticated);

  const [activePersonas, setActivePersonas] = useActivePersonas(user);
  isAuthenticatedRef.current = isAuthenticated;

  // These two refs break the circular dependency between useChatHistory and
  // usePinOperations. Both hooks are called sequentially below; after both
  // complete the refs are populated so they always point to the latest fns.
  const loadPinsForChatRef = useRef<
    ((chatId: string | null) => Promise<void>) | null
  >(null);
  const onChatDeletedRef = useRef<(chatId: string) => void>(() => {});

  const {
    chatBoards,
    setChatBoards,
    activeChatId,
    setActiveChatId,
    chatHistory,
    setChatHistory,
    animatingTitles,
    chatToDelete,
    setChatToDelete,
    renamingChatId,
    setRenamingChatId,
    renamingText,
    setRenamingText,
    isDeletingChatBoard,
    isRenamingChatBoard,
    starUpdatingChatId,
    renameInputRef,
    hasFetchedChats,
    loadChatBoards,
    loadMessagesForChat,
    setMessagesForActiveChat,
    handleAddChat,
    ensureChatOnServer,
    moveChatToTop,
    updateChatTitleWithAnimation,
    refreshChatTitle,
    getAnimatingTitle,
    resetRenameState,
    handleRenameCancel,
    handleRenameConfirm,
    handleDeleteClick,
    confirmDelete,
    handleToggleStar,
  } = useChatHistory({
    isAuthenticated,
    user,
    pathname,
    router,
    loadPinsForChatRef,
    // Delegate to the ref so usePinOperations' handleChatDeleted is always
    // called, even though useChatHistory is initialised first.
    onChatDeleted: (chatId) => onChatDeletedRef.current(chatId),
  });

  const {
    selectedModel,
    setSelectedModel,
    useFramework,
    setUseFramework,
    frameworkType,
    setFrameworkType,
    memoryPercentage,
    setMemoryPercentage,
    isCompareModalOpen,
    setIsCompareModalOpen,
    pendingModelFromCompare,
    isModelSwitchConfirmOpen,
    setIsModelSwitchConfirmOpen,
    handleModelSelectFromCompare,
    handleConfirmModelSwitch,
    selectedPinIdsForNextMessage,
    setSelectedPinIdsForNextMessage,
    referencesSources,
    setReferencesSources,
  } = useModelSelection({
    activeChatMessages: activeChatId ? (chatHistory[activeChatId] ?? []) : [],
    userPlanType: user?.planType,
  });

  // Persist left sidebar collapsed state
  useEffect(() => {
    localStorage.setItem("leftSidebarCollapsed", isLeftSidebarCollapsed.toString());
  }, [isLeftSidebarCollapsed]);

  // Drop legacy per-browser pins cache (shown after logout / account switch)
  useEffect(() => {
    try {
      localStorage.removeItem("chat-pins-cache");
    } catch {
      /* ignore */
    }
  }, []);

  const isMobile = useIsMobile();
  const isChatRoute = pathname === "/";
  const isPersonasRoute =
    pathname?.startsWith("/personas") || pathname?.startsWith("/personas/admin");
  const isWorkflowChatRoute = !!pathname?.match(/^\/workflows\/[^/]+\/chat/);
  const isWorkflowAdminOverviewRoute = pathname === "/workflows/admin";
  const isPersonaChatRoute = !!pathname?.match(/^\/personas\/[^/]+\/chat/);
  const isSettingsSectionRoute = pathname?.startsWith("/settings");

  const {
    pins,
    setPins,
    showPinUpgradeDialog,
    setShowPinUpgradeDialog,
    loadPinsForChat,
    handlePinMessage,
    handleUnpinMessage,
    handleChatDeleted,
  } = usePinOperations({
    isAuthenticated,
    isAuthenticatedRef,
    user,
    activeChatId,
    isChatRoute,
    chatHistory,
    setChatBoards,
    onPinSuccess: () => setActiveRightSidebarPanel("pinboard"),
  });

  // Wire the cross-hook refs after both useChatHistory and usePinOperations
  // have been called so each always invokes the latest function.
  loadPinsForChatRef.current = loadPinsForChat;
  onChatDeletedRef.current = handleChatDeleted;


  const isRightSidebarVisible =
    !isPersonasRoute &&
    !isWorkflowChatRoute &&
    !isPersonaChatRoute &&
    !isSettingsSectionRoute &&
    !isWorkflowAdminOverviewRoute &&
    activeRightSidebarPanel !== null;

  const setIsRightSidebarVisible = (value: React.SetStateAction<boolean>) => {
    if (
      isPersonasRoute ||
      isWorkflowChatRoute ||
      isPersonaChatRoute ||
      isSettingsSectionRoute ||
      isWorkflowAdminOverviewRoute
    ) {
      return;
    }
    setActiveRightSidebarPanel((prev) => {
      const current = prev !== null;
      const nextVisible = typeof value === "function" ? value(current) : value;
      if (nextVisible) {
        return prev ?? "pinboard";
      }
      return null;
    });
  };

  const handleRightSidebarSelect = (panel: RightSidebarPanel) => {
    if (
      isPersonasRoute ||
      isWorkflowChatRoute ||
      isPersonaChatRoute ||
      isSettingsSectionRoute ||
      isWorkflowAdminOverviewRoute
    ) {
      return;
    }
    setActiveRightSidebarPanel((prev) => (prev === panel ? null : panel));
  };

  const contextValue: AppLayoutContextType = {
    chatBoards,
    setChatBoards,
    activeChatId,
    setActiveChatId,
    pins,
    onPinMessage: handlePinMessage,
    onUnpinMessage: handleUnpinMessage,
    handleAddChat,
    ensureChatOnServer,
    selectedModel,
    setSelectedModel,
    useFramework,
    setUseFramework,
    frameworkType,
    setFrameworkType,
    memoryPercentage,
    setMemoryPercentage,
    moveChatToTop,
    selectedPinIdsForNextMessage,
    setSelectedPinIdsForNextMessage,
    referencesSources,
    setReferencesSources,
    openReferencesPanel: () => {
      if (
        !isPersonasRoute &&
        !isWorkflowChatRoute &&
        !isPersonaChatRoute &&
        !isWorkflowAdminOverviewRoute
      )
        setActiveRightSidebarPanel("references");
    },
    updateChatTitleWithAnimation,
    getAnimatingTitle,
    refreshChatTitle,
    activePersonas,
    setActivePersonas,
  };

  const pageContentProps = {
    onPinMessage: handlePinMessage,
    onUnpinMessage: handleUnpinMessage,
    messages: activeChatId ? chatHistory[activeChatId] || [] : [],
    setMessages: setMessagesForActiveChat,
    selectedModel: selectedModel,
    setIsRightSidebarVisible,
    isRightSidebarVisible,
  };

  // Only inject chat props on the main chat route.
  const pageContent = !isChatRoute || isPersonasRoute
    ? children
    : React.cloneElement(children, {
        key: activeChatId ?? "no-chat",
        ...pageContentProps,
      });

  const sidebarProps = {
    isCollapsed: isLeftSidebarCollapsed,
    onToggle: () => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed),
    chatBoards: chatBoards,
    activeChatId: activeChatId,
    setActiveChatId: setActiveChatId,
    onAddChat: handleAddChat,
    renamingChatId: renamingChatId,
    setRenamingChatId: setRenamingChatId,
    renamingText: renamingText,
    setRenamingText: setRenamingText,
    renameInputRef: renameInputRef,
    handleDeleteClick: handleDeleteClick,
    onRenameConfirm: handleRenameConfirm,
    onRenameCancel: handleRenameCancel,
    isRenamingPending: isRenamingChatBoard,
    onToggleStar: handleToggleStar,
    starUpdatingChatId: starUpdatingChatId,
  };

  useEffect(() => {
    if (isPersonasRoute) {
      setActiveRightSidebarPanel(null);
    }
  }, [isPersonasRoute]);

  if (isMobile) {
    return (
      <AppLayoutContext.Provider value={contextValue}>
        <div className="chat-layout-mobile-shell--full">
          <div className="chat-layout-mobile-container">
            {!isSettingsSectionRoute && (
              <Topbar
                selectedModel={selectedModel}
                onModelSelect={setSelectedModel}
                useFramework={useFramework}
                onFrameworkChange={setUseFramework}
                chatBoards={chatBoards}
                activeChatId={activeChatId}
                hasMessages={
                  activeChatId
                    ? (chatHistory[activeChatId]?.length || 0) > 0
                    : false
                }
                messageCount={
                  activeChatId ? (chatHistory[activeChatId]?.length || 0) : 0
                }
                pins={pins}
                onPinsSelect={setSelectedPinIdsForNextMessage}
              >
                <Sheet
                  open={isMobileMenuOpen}
                  onOpenChange={setIsMobileMenuOpen}
                >
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="left"
                    className="chat-layout-mobile-sheet"
                  >
                    <Suspense fallback={null}>
                      <LeftSidebar {...sidebarProps} isCollapsed={false} />
                    </Suspense>
                  </SheetContent>
                </Sheet>
              </Topbar>
            )}
            {isSettingsSectionRoute && (
              <div className="w-full h-full flex">
                <Suspense fallback={null}>
                  <LeftSidebar {...sidebarProps} isCollapsed={false} />
                </Suspense>
                <main className="flex-1 h-full" />
              </div>
            )}
            {!isSettingsSectionRoute && (
              <main className="chat-layout-mobile-main">{pageContent}</main>
            )}
          </div>
        </div>
        <DeleteChatDialog
          chatToDelete={chatToDelete}
          isDeletingChatBoard={isDeletingChatBoard}
          onOpenChange={(open) => !open && setChatToDelete(null)}
          onCancel={() => setChatToDelete(null)}
          onConfirm={confirmDelete}
        />
      </AppLayoutContext.Provider>
    );
  }

  return (
    <AppLayoutContext.Provider value={contextValue}>
      <div className="chat-layout-shell--full">
        <Suspense fallback={null}>
          <LeftSidebar {...sidebarProps} />
        </Suspense>
        <div className="chat-layout-sidebar-area">
          {!isSettingsSectionRoute && (
            <Topbar
              selectedModel={selectedModel}
              onModelSelect={setSelectedModel}
              useFramework={useFramework}
              onFrameworkChange={setUseFramework}
              frameworkType={frameworkType}
              onFrameworkTypeChange={setFrameworkType}
              chatBoards={chatBoards}
              activeChatId={activeChatId}
              hasMessages={
                activeChatId
                  ? (chatHistory[activeChatId]?.length || 0) > 0
                  : false
              }
              messageCount={
                activeChatId ? (chatHistory[activeChatId]?.length || 0) : 0
              }
              pins={pins}
              onPinsSelect={setSelectedPinIdsForNextMessage}
            />
          )}
          <div className="chat-layout-main-wrapper">
            <div className="chat-layout-content-panel">
              <main className="chat-layout-main">
                {/* chat-layout-window--max960 */}
                <div className={cn("chat-layout-window", isPersonasRoute ? "max-w-full" : "max-w-full")}>
                  {pageContent}
                </div>
              </main>
            </div>
            {!isPersonasRoute &&
              !isWorkflowChatRoute &&
              !isPersonaChatRoute &&
                !isSettingsSectionRoute &&
                !isWorkflowAdminOverviewRoute && (
              <div className="hidden h-full lg:flex items-stretch">
                <RightSidebar
                  isOpen={isRightSidebarVisible}
                  activePanel={activeRightSidebarPanel}
                  onClose={() => setActiveRightSidebarPanel(null)}
                  pins={pins}
                  setPins={setPins}
                  chatBoards={chatBoards}
                  referencesSources={referencesSources}
                  className="order1"
                />
                <RightSidebarCollapsed
                  activePanel={activeRightSidebarPanel}
                  onSelect={handleRightSidebarSelect}
                  isCompareActive={isCompareModalOpen}
                  onCompareClick={() => setIsCompareModalOpen(!isCompareModalOpen)}
                  className="order2"
                />
              </div>
            )}
          </div>
        </div>
      </div>
      <DeleteChatDialog
        chatToDelete={chatToDelete}
        isDeletingChatBoard={isDeletingChatBoard}
        onOpenChange={(open) => !open && setChatToDelete(null)}
        onCancel={() => setChatToDelete(null)}
        onConfirm={confirmDelete}
      />
      <AppDialogs
        isCompareModalOpen={isCompareModalOpen}
        setIsCompareModalOpen={setIsCompareModalOpen}
        selectedModel={selectedModel}
        onModelSelectFromCompare={handleModelSelectFromCompare}
        isModelSwitchConfirmOpen={isModelSwitchConfirmOpen}
        setIsModelSwitchConfirmOpen={setIsModelSwitchConfirmOpen}
        pendingModelFromCompare={pendingModelFromCompare}
        onConfirmModelSwitch={handleConfirmModelSwitch}
        chatBoards={chatBoards}
        showPinUpgradeDialog={showPinUpgradeDialog}
        setShowPinUpgradeDialog={setShowPinUpgradeDialog}
        userPlanType={user?.planType ?? undefined}
        pinsCount={pins.length}
      />
    </AppLayoutContext.Provider>
  );
}
