"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useProjects } from "@/context/projects-context";
import { useChatHistoryContext } from "@/context/chat-history-context";
import { Button } from "@/components/ui/button";
import { useTopBarHasSlotContent, useTopBarSlotRef } from "./TopBarSlots";
// ModelIcon only renders here when a persona/model tag is actually shown (see the
// `personaModel || persona?.modelId` guard below) — most pages never hit that branch,
// so it is deferred rather than loaded with every page's TopBar.
const ModelIcon = dynamic(
  () => import("@/components/ModelIcon").then((m) => ({ default: m.ModelIcon })),
  { ssr: false, loading: () => null },
);
import { ArrowLeftOneIcon, PenOneIcon, FolderOneIcon, FolderLibraryIcon, PinIcon, DeleteTwoIcon, ShareOneIcon } from "@strange-huge/icons";
import { ChatBreadcrumb, type ChatBreadcrumbMenuContext } from "./ChatBreadcrumb";
import { Dropdown } from "@/components/Dropdown";
import { Divider } from "@/components/Divider";
import { DontSaveChatItem } from "@/components/Library/chat/DontSaveChatItem";
import { openDeleteChatDialog } from "./AppDialogs";
import { MoveToProjectModal } from "@/components/Projects/lazy-modals";
import { addChatToProject } from "@/lib/api/projects";
import { toast } from "sonner";
import { getPersona } from "@/lib/api/personas";
import type { Persona } from "@/lib/api/personas";
import { useQuery } from "@tanstack/react-query";
import { fetchModelsWithCache, modelsQuery, normalizeModels } from "@/lib/ai-models";
import { fetchAllModels } from "@/lib/api/models";
import { AGENT_EDIT_ROUTE, CHATS_ROUTE, CHAT_ROUTE, PROJECT_ROUTE } from "@/lib/routes";
import type { AIModel } from "@/types/ai-model";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TopBarProps {
  /** The app card's padding: the bar pulls out by this much so it runs edge to edge under the border. */
  edgeInset?: number;
  showCitationsToggle?: boolean;
  citationsOpen?: boolean;
  onCitationsToggle?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

function TopBarImpl({ edgeInset = 0, showCitationsToggle: _showCitationsToggle, citationsOpen: _citationsOpen, onCitationsToggle: _onCitationsToggle }: TopBarProps) {
  const {
    getProject,
    getChats,
    projects,
    addChat: addProjectChat,
    renameChat: renameProjectChat,
    removeChat: removeProjectChat,
    moveChatOutOfProject,
  } = useProjects();
  const pathname = usePathname();
  const router   = useRouter();
  const searchParams = useSearchParams();
  const {
    chats: chatHistoryChats,
    rename: renameHistoryChat,
    remove: removeHistoryChat,
    star:   starHistoryChat,
    archive: archiveHistoryChat,
    removeLocal: removeHistoryChatLocal,
  } = useChatHistoryContext();
  // "Move to project" from the breadcrumb menu — same flow as the sidebar row's.
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [isMoving,      setIsMoving]      = useState(false);
  const [isMovingOut,   setIsMovingOut]   = useState(false);
  const [isStarring,    setIsStarring]    = useState(false);
  const [isArchiving,   setIsArchiving]   = useState(false);
  const leftSlotRef = useTopBarSlotRef("left");
  const rightSlotRef = useTopBarSlotRef("right");

  // Track the real browser pathname — may differ from Next.js pathname when
  // window.history.replaceState is used (e.g. project chat new→real chatId).
  const [actualPathname,   setActualPathname]   = useState(pathname);
  // Read inside the title-update listener below — that listener is
  // registered once (mount-only effect) so a plain closure over
  // `actualPathname` would go stale the moment the user navigates; the ref
  // always has the latest value without re-subscribing the listener.
  const actualPathnameRef = useRef(actualPathname);
  useEffect(() => { actualPathnameRef.current = actualPathname; }, [actualPathname]);
  // Track the AI-generated chat title directly via event, independent of
  // the projects-context getChats lookup (which can be reset by loadProjectChats).
  const [dynamicChatTitle, setDynamicChatTitle] = useState<string | null>(null);
  useEffect(() => {
    setActualPathname(window.location.pathname);
    const urlHandler = () => {
      setActualPathname(window.location.pathname);
      setDynamicChatTitle(null); // reset when a new chat is created
    };
    const titleHandler = (e: Event) => {
      // The backend's auto-generated title arrives asynchronously (an SSE
      // event well after send) — the user may have already navigated to a
      // different project/chat by the time this fires. TopBar is mounted
      // once at the app-layout level and never remounts across navigation,
      // so without this check a late title from a chat the user has left
      // would overwrite whatever chat is currently displayed (e.g. showing
      // an unrelated previous chat's "Greeting" title next to the CURRENT
      // project's name).
      const detail = (e as CustomEvent<{ projectId?: string; chatId?: string; title: string }>).detail;
      const match = actualPathnameRef.current.match(/^\/project\/([^/]+)\/chat\/([^/]+)$/);
      if (!match || match[1] !== detail.projectId || match[2] !== detail.chatId) return;
      setDynamicChatTitle(detail.title);
    };
    window.addEventListener('chat-url-updated',            urlHandler);
    window.addEventListener('project:chat-title-updated',  titleHandler);
    return () => {
      window.removeEventListener('chat-url-updated',            urlHandler);
      window.removeEventListener('project:chat-title-updated',  titleHandler);
    };
  }, []);
  // Reset on real Next.js navigation — adjusted during render, not in an effect.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setActualPathname(pathname);
    setDynamicChatTitle(null);
  }

  // Detect page type from pathname
  const projectChatMatch    = actualPathname.match(/^\/project\/([^/]+)\/chat\/([^/]+)$/);
  const isProjectChatPage   = !!projectChatMatch;
  const isProjectDetailPage = actualPathname.startsWith('/project') && !isProjectChatPage;
  const isChatsPage         = actualPathname === '/chats';
  const personaChatMatch      = actualPathname.match(/^\/agents\/([^/]+)\/chat/);
  const isPersonaChatPage     = !!personaChatMatch;
  const personaId             = personaChatMatch?.[1] ?? null;
  // Plain /chat?id=… page only — project/persona chats use their own
  // ownership model, not the /chats library's can_edit/visibility fields.
  const isPlainChatPage = !isProjectChatPage && !isProjectDetailPage && !isChatsPage && !isPersonaChatPage;
  const activeChatIdFromUrl = isPlainChatPage ? (searchParams.get('id') ?? undefined) : undefined;
  const activeChatFromUrl = activeChatIdFromUrl ? chatHistoryChats.find(c => c.id === activeChatIdFromUrl) : undefined;
  const isArchivedChat = activeChatFromUrl?.visibility === 'archived';
  // The bar only shows when it has something to show: its own chat name / agent tag, or anything a
  // page placed in its slots (a back button, Share, the side panel toggle). Hidden, it keeps its
  // slots mounted so a page can still fill them.
  const hasSlotContent = useTopBarHasSlotContent();
  // A chat name on the left earns the hairline under the bar; a bar with only buttons has none
  // (the border stays, transparent, so the bar keeps its height).
  const hasTitle = isProjectChatPage || !!activeChatFromUrl?.title;
  const visible = hasSlotContent || isProjectChatPage || isPersonaChatPage || !!activeChatFromUrl?.title || isArchivedChat;

  // Fetch persona data + resolve full model object for the top-bar tag on persona chat pages
  const [persona,      setPersona]      = useState<Persona | null>(null);
  const [personaModel, setPersonaModel] = useState<AIModel | null>(null);
  // Re-resolve when the catalogue refetches (a model blocked/unblocked in
  // /settings/ai, in this tab or another) without needing a reload.
  const catalogUpdatedAt = useQuery(modelsQuery()).dataUpdatedAt;
  useEffect(() => {
    if (!personaId) { setPersona(null); setPersonaModel(null); return; }
    let cancelled = false;

    function resolve() {
      Promise.all([getPersona(personaId!), fetchModelsWithCache()])
        .then(([p, models]) => {
          if (cancelled) return;
          setPersona(p);
          const matched = p.modelId
            ? models.find(m => String(m.modelId ?? m.id) === p.modelId) ?? null
            : null;
          if (matched || !p.modelId) { setPersonaModel(matched); return; }
          // Not in the selectable (non-blocked) list — could be disabled in
          // Settings or fully retired. Look it up in the full catalog so the
          // tag still shows a real name instead of falling back to the raw id.
          fetchAllModels()
            .then(all => {
              if (cancelled) return;
              const found = all.find(m => m.model_id === p.modelId);
              setPersonaModel(found ? normalizeModels([found])[0] : null);
            })
            .catch(() => { if (!cancelled) setPersonaModel(null); });
        })
        .catch(console.error);
    }

    resolve();
    return () => { cancelled = true; };
  }, [personaId, catalogUpdatedAt]);

  // The primary (TopBar) model selector button has been removed — ChatInput's
  // own embedded ModelMenu (the "secondary" selector) now covers the same 3
  // models everywhere a composer exists, so keeping a second, redundant
  // trigger up here just duplicated it. See docs v1.5/dropdown-scrollbar-gutter-fix.md
  // for the ModelMenu changes that made this the single source of truth.

  // Archived chats have no model to select (the composer is disabled — see
  // ChatInterface's `archived` prop) — the model-selector slot becomes a
  // back button to the Archived tab on /chats instead of a dead/toast-only
  // button.
  const backToArchivedButton = (
    <Button
      variant="default"
      size="sm"
      leftIcon={<ArrowLeftOneIcon />}
      onClick={() => router.push(`${CHATS_ROUTE}?tab=archived`)}
    >
      Back to Archived
    </Button>
  );

  // ── Breadcrumb data + its actions menu ──────────────────────────────────────
  // The name in the bar is a pill breadcrumb (project › chat on a project chat,
  // just the chat on a plain one) with a caret at the right end of the name that
  // opens the same actions the sidebar row offers.

  const projectId    = projectChatMatch?.[1] ?? null;
  const projectChatId = projectChatMatch?.[2] ?? null;
  const projectChat  = projectId && projectChatId
    ? getChats(projectId).find(c => c.id === projectChatId)
    : undefined;
  const projectChatName = dynamicChatTitle ?? projectChat?.title ?? "";

  const handleMoveToProject = async (targetProjectId: string) => {
    const chatId = activeChatIdFromUrl;
    if (!chatId) return;
    setIsMoving(true);
    try {
      await addChatToProject(targetProjectId, chatId);
      addProjectChat(targetProjectId, chatId, activeChatFromUrl?.title ?? "", { skipLink: true });
      removeHistoryChatLocal(chatId);
      toast.success(`Moved to "${projects.find(p => p.id === targetProjectId)?.name ?? "project"}"`);
      setMoveModalOpen(false);
      router.push(`${PROJECT_ROUTE(targetProjectId)}/chat/${chatId}`);
    } catch {
      toast.error("Failed to move chat — please try again.");
    } finally {
      setIsMoving(false);
    }
  };

  /** The sidebar chat row's menu, for a project chat. Same rows, same order. */
  const renderProjectChatMenu = ({ close, startRename }: ChatBreadcrumbMenuContext) => (
    <Dropdown maxHeight={false}>
      <Dropdown.Section fluid>
        <Dropdown.Item fluid icon={<ShareOneIcon color="var(--neutral-600)" />} label="Share"
          onClick={() => { close(); router.push(`${CHAT_ROUTE}?id=${projectChatId}&share=1`); }} />
        <Dropdown.Item fluid icon={<PenOneIcon animated color="var(--neutral-600)" />} label="Rename"
          onClick={() => { close(); startRename(); }} />
        {/* A project chat is already in a project — the move is out of it, back into Recent Chats. */}
        <Dropdown.Item fluid icon={<FolderOneIcon color="var(--neutral-600)" variant="static" />} label="Remove from project"
          loading={isMovingOut}
          onClick={() => {
            close();
            if (!projectId || !projectChatId) return;
            setIsMovingOut(true);
            void moveChatOutOfProject(projectId, projectChatId)
              .then(() => router.push(`${CHAT_ROUTE}?id=${projectChatId}`))
              .catch(() => {})
              .finally(() => setIsMovingOut(false));
          }} />
        <DontSaveChatItem chatId={projectChatId ?? ""} />
        <Divider decorative />
        <Dropdown.Item fluid variant="danger" icon={<DeleteTwoIcon color="var(--red-500)" />} label="Delete"
          onClick={() => {
            close();
            if (!projectId || !projectChatId) return;
            openDeleteChatDialog({
              chatId: projectChatId,
              chatTitle: projectChatName,
              onConfirm: async () => {
                const ok = await removeProjectChat(projectId, projectChatId);
                if (ok) router.push(PROJECT_ROUTE(projectId));
              },
            });
          }} />
      </Dropdown.Section>
    </Dropdown>
  );

  /** The sidebar chat row's menu, verbatim, for a plain chat. */
  const renderPlainChatMenu = ({ close, startRename }: ChatBreadcrumbMenuContext) => (
    <Dropdown maxHeight={false}>
      <Dropdown.Section fluid>
        <Dropdown.Item fluid icon={<ShareOneIcon color="var(--neutral-600)" />} label="Share"
          onClick={() => { close(); router.push(`${CHAT_ROUTE}?id=${activeChatIdFromUrl}&share=1`); }} />
        <Dropdown.Item fluid icon={<PenOneIcon animated color="var(--neutral-600)" />} label="Rename"
          onClick={() => { close(); startRename(); }} />
        {/* User-facing "Pin chat"/"Unpin chat" — the underlying field/API stays `starred`. */}
        <Dropdown.Item fluid icon={<PinIcon animated color="var(--neutral-600)" />}
          label={activeChatFromUrl?.starred ? "Unpin chat" : "Pin chat"}
          loading={isStarring}
          onClick={() => {
            close();
            if (!activeChatIdFromUrl) return;
            setIsStarring(true);
            void starHistoryChat(activeChatIdFromUrl).finally(() => setIsStarring(false));
          }} />
        <Dropdown.Item fluid icon={<FolderOneIcon color="var(--neutral-600)" variant="static" />} label="Move to project"
          onClick={() => { close(); setMoveModalOpen(true); }} />
        {!isArchivedChat && (
          <Dropdown.Item fluid icon={<FolderLibraryIcon color="var(--neutral-600)" />} label="Archive"
            loading={isArchiving}
            onClick={() => {
              close();
              if (!activeChatIdFromUrl) return;
              setIsArchiving(true);
              void archiveHistoryChat(activeChatIdFromUrl).finally(() => setIsArchiving(false));
            }} />
        )}
        <DontSaveChatItem chatId={activeChatIdFromUrl ?? ""} />
        <Divider decorative />
        <Dropdown.Item fluid variant="danger" icon={<DeleteTwoIcon color="var(--red-500)" />} label="Delete"
          onClick={() => {
            close();
            if (!activeChatIdFromUrl || !activeChatFromUrl) return;
            openDeleteChatDialog({
              chatId: activeChatIdFromUrl,
              chatTitle: activeChatFromUrl.title,
              onConfirm: async () => {
                const ok = await removeHistoryChat(activeChatIdFromUrl);
                if (ok) router.push(CHAT_ROUTE);
              },
            });
          }} />
      </Dropdown.Section>
    </Dropdown>
  );


  return (
    // A defined, compact bar, edge to edge across the card with a hairline along the bottom: 49px
    // (48 + the border) puts its 32px items 8px from the top, bottom and ends, on the same 19–51px
    // band as the sidebar header's logo and buttons and the right panel's close button. Left: the page's back
    // button (slot) and the chat name; right: the page's actions (slot).
    <>
    <div
      style={{
        flexShrink:     0,
        alignSelf:      "stretch",
        boxSizing:      "border-box",
        height:         49,
        display:        visible ? "flex" : "none",
        margin:         `-${edgeInset}px -${edgeInset}px 0`,
        alignItems:     "center",
        gap:            8,
        padding:        "0 8px",
        borderBottom:   hasTitle ? "1px solid var(--border-default)" : "1px solid transparent",
        zIndex:         1,
      }}
    >
      {/* empty:hidden so an empty slot takes no room (or flex gap) and the chat name sits 12px in. */}
      <div ref={leftSlotRef} className="flex empty:hidden" style={{ alignItems: "center", gap: 4, flexShrink: 0 }} />
      {isProjectChatPage && projectChatMatch ? (
        <>
          {/* ── Left: project › chat as a pill breadcrumb, with the actions menu
              at the right end of the chat name. The model selector lives in the
              composer itself now (ChatInput's own ModelMenu). ── */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: "1 1 0" }}>
            <ChatBreadcrumb
              crumbs={[{ label: getProject(projectChatMatch[1])?.name ?? "", href: PROJECT_ROUTE(projectChatMatch[1]) }]}
              current={projectChatName || "New chat"}
              onRename={projectChatName && projectChat?.canEdit !== false
                ? (title) => {
                    renameProjectChat(projectChatMatch[1], projectChatMatch[2], title);
                    void renameHistoryChat(projectChatMatch[2], title);
                  }
                : undefined}
              renderMenu={projectChatName && projectChat?.canEdit !== false ? renderProjectChatMenu : undefined}
            />
          </div>
        </>
      ) : isPersonaChatPage ? (
        <>
          {/* ── Persona chat: non-interactive model tag + Edit button ── */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>

            {/* Model tag — same visual as model selector button, no arrow, not interactive */}
            {(personaModel || persona?.modelId) && (() => {
              const modelName = personaModel?.modelName ?? "Model unavailable";
              return (
                <Button
                  variant="default"
                  size="sm"
                  disabled
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {personaModel && (
                      <span
                        style={{
                          width:          "16px",
                          height:         "16px",
                          borderRadius:   "4px",
                          overflow:       "hidden",
                          flexShrink:     0,
                          display:        "flex",
                          alignItems:     "center",
                          justifyContent: "center",
                        }}
                      >
                        <ModelIcon model={personaModel.companyName ?? personaModel.modelName} size={16} variant="light" />
                      </span>
                    )}
                    {modelName}
                  </span>
                </Button>
              );
            })()}

            {/* Edit button — only for owned agents, never for received/shared ones */}
            {persona && persona.sourceShareId === null && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<PenOneIcon animated />}
                onClick={() =>
                  router.push(AGENT_EDIT_ROUTE(personaId!))
                }
              >
                Edit
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          {/* ── Left: current chat name as a pill breadcrumb — sourced from the
              shared ChatHistoryContext, so a rename or the backend's async
              auto-title (via listChats) from ANY surface (sidebar, /chats) is
              reflected here immediately, same live state, no extra event wiring
              needed. The caret at the right end of the name opens the chat's
              actions (rename, star, move, archive, delete). ── */}
          <div style={{ display: "flex", alignItems: "center", minWidth: 0, flex: "1 1 0" }}>
            {activeChatFromUrl?.title && (
              <ChatBreadcrumb
                current={activeChatFromUrl.title}
                onRename={activeChatFromUrl.can_edit === false
                  ? undefined
                  : (title) => { void renameHistoryChat(activeChatIdFromUrl!, title); }}
                renderMenu={activeChatFromUrl.can_edit === false ? undefined : renderPlainChatMenu}
              />
            )}
          </div>

          {/* ── Right: back-to-Archived button on an archived chat. The model
              selector itself no longer shows here — ChatInput's own ModelMenu
              (in the composer) covers the same 3 models everywhere this
              TopBar's button used to. ── */}
          {!isProjectDetailPage && !isChatsPage && isArchivedChat && backToArchivedButton}
        </>
      )}
      <div ref={rightSlotRef} className="flex empty:hidden" style={{ alignItems: "center", gap: 8, flexShrink: 0, marginLeft: "auto" }} />
    </div>

    {/* "Move to project" from the breadcrumb menu on a plain chat. */}
    <MoveToProjectModal
      open={moveModalOpen}
      loading={isMoving}
      onClose={() => setMoveModalOpen(false)}
      onConfirm={handleMoveToProject}
      projects={projects.map((p) => ({ id: p.id, name: p.name, description: p.description }))}
      chatCount={1}
    />
    </>
  );
}

// useSearchParams() (added for the archived-chat check above) requires a
// Suspense boundary — same wrapping pattern as FloatingPanel's own
// FloatingPanelImpl split (src/components/layout/FloatingPanel.tsx).
export function TopBar(props: TopBarProps) {
  return (
    <Suspense fallback={null}>
      <TopBarImpl {...props} />
    </Suspense>
  );
}
