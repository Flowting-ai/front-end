"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { m } from "framer-motion";
import { CancelOneIcon } from "@strange-huge/icons";
import { LeftSidebar } from "./LeftSidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RightSidebar } from "./RightSidebar";
import { HighlightSidebar } from "./HighlightSidebar";
import { TopBar } from "./TopBar";
import { TopBarSlotsProvider } from "./TopBarSlots";
import { AppDialogs } from "./AppDialogs";
import { FloatingPanel } from "./FloatingPanel";
import { IconButton } from "@/components/ui/button";
import { Tooltip } from "@/components/Tooltip";
import { usePinboard } from "@/context/pinboard-context";
import { useAuth } from "@/context/auth-context";
import { warmRecommendations } from "@/hooks/use-recommendations";
import { featuredAppsQuery } from "@/lib/connectors/connector-queries";
import { getQueryClient } from "@/lib/query-client";
import { useHighlight } from "@/context/highlight-context";
import { useProjectPanel } from "@/context/project-panel-context";
import { useMobile } from "@/hooks/use-mobile";
import { PINS_ENABLED, HIGHLIGHTS_ENABLED } from "@/lib/feature-flags";
import {
  PROJECT_BASE_ROUTE,
  PROJECTS_ROUTE,
  AGENTS_ROUTE,
  AGENT_BASE_ROUTE,
  SETTINGS_ROUTE,
  ORG_BASE_ROUTE,
  TEAMS_BASE_ROUTE,
  SCHEDULES_ROUTE,
  ORG_CONNECTORS_ROUTE,
  ORG_SOUVENIR_SLACK_ROUTE,
  CHAT_ROUTE,
  CHATS_ROUTE,
  TEMPLATE_BASE_ROUTE,
} from "@/lib/routes";

interface AppLayoutProps {
  children: React.ReactNode;
  activeChatId?: string;
  showCitationsToggle?: boolean;
  citationsOpen?: boolean;
  onCitationsToggle?: () => void;
  onSelectChat?: (id: string) => void;
  onNewChat?: () => void;
  /** Initial LeftSidebar collapsed state, read from its cookie on the server. */
  defaultSidebarCollapsed?: boolean;
}

export function AppLayout({
  children,
  activeChatId,
  showCitationsToggle,
  citationsOpen,
  onCitationsToggle,
  onSelectChat,
  onNewChat,
  defaultSidebarCollapsed,
}: AppLayoutProps) {
  const { close: closePinboard } = usePinboard()
  const { close: closeHighlight } = useHighlight()
  const pathname = usePathname()
  const { user } = useAuth()
  const userKey = String(user?.auth0Id ?? user?.id ?? '')

  // Warm what the new-chat screen needs (starter suggestions + the Connect-an-app list) only on the
  // screens that show it; every other page skips ~7 requests it would never use.
  const wantsChatWarmup = pathname === '/chat' || pathname.startsWith('/project/')
  useEffect(() => {
    if (!userKey || !wantsChatWarmup) return
    const run = () => { warmRecommendations(userKey); void getQueryClient().prefetchQuery(featuredAppsQuery()) }
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 3000 })
      return () => window.cancelIdleCallback(id)
    }
    const t = setTimeout(run, 1500)
    return () => clearTimeout(t)
  }, [userKey, wantsChatWarmup])

  const isAnyProjectPage = pathname.startsWith(PROJECT_BASE_ROUTE)
  // Suppress FloatingPanel on project listing / detail pages, but NOT on
  // project chat pages - those use the same global FloatingPanel as regular chats.
  const isProjectPage    = isAnyProjectPage && !pathname.includes('/chat/')
  // Only the projects listing page has no panel support at all.
  const isProjectsListPage = pathname === PROJECTS_ROUTE
  const isChatsListPage = pathname.startsWith(CHATS_ROUTE)

  // Close the highlight panel on every page transition.
  useEffect(() => {
    closeHighlight()
  }, [pathname, closeHighlight])

  // Force-close both panels on the projects listing page, project detail
  // pages, and the /chats library — none of these have the floating toggle
  // to close it themselves (highlight already auto-closes on every
  // navigation via the effect above).
  useEffect(() => {
    if (isProjectsListPage || isProjectPage || isChatsListPage) {
      closePinboard()
    }
  }, [isProjectsListPage, isProjectPage, isChatsListPage, closePinboard])
  const isPersonaPage    = pathname.startsWith(AGENTS_ROUTE) || pathname.startsWith(AGENT_BASE_ROUTE)
  // Persona chat pages manage their own scroll — disable the outer scrollable wrapper
  const isPersonaChatPage = /^\/agents\/[^\/]+\/chat/.test(pathname)
  const isSettingsPage = pathname.startsWith(SETTINGS_ROUTE)
  const isAdminPage    = pathname.startsWith(ORG_BASE_ROUTE)
  // The editor team page (/teams/[teamId]) is a settings-style page, not a chat
  // surface — strip the TopBar/model-selector and floating chat tools like /org.
  const isTeamPage     = pathname.startsWith(TEAMS_BASE_ROUTE)
  // A stored template is a full-bleed document viewer: its own header, then an
  // iframe that must own the rest of the height. The default branch below lays
  // the TopBar over the top of the content, which would sit on the document's
  // title, and the model selector means nothing here — there is no chat.
  const isTemplatePage = pathname.startsWith(TEMPLATE_BASE_ROUTE)
  // Schedules builds its own glass card, so it takes the same bare shell.
  const isSchedulesPage = pathname.startsWith(SCHEDULES_ROUTE)
  // Connectors / Souvenir-in-Slack are settings-style pages too (moved off
  // /org/* to their own top-level routes) — same TopBar/FloatingPanel strip
  // as /org and /teams/[teamId] above.
  const isSlackPage = pathname.startsWith(ORG_SOUVENIR_SLACK_ROUTE)
  const isConnectorsOrSlackPage = pathname.startsWith(ORG_CONNECTORS_ROUTE) || isSlackPage
  // Chat surfaces (/chat, /project/[id]/chat/[chatId]) manage their own message-
  // list scrolling (ChatInterface's own kaya-scrollbar div) — same reasoning as
  // isConnectorsOrSlackPage below: give them the tight 3px card padding too, so
  // their scrollbar sits close to the rounded border instead of 12px inset.
  const isChatPage = pathname === CHAT_ROUTE || (isAnyProjectPage && pathname.includes('/chat/'))
  // On phones the chat's floating tool column (FloatingPanel) would sit on top of
  // the messages, so the chat main keeps a right gutter for it.
  const isMobile = useMobile()
  const reserveChatToolsGutter = isMobile && isChatPage
  const isChatSharesPage = pathname.startsWith('/chat-shares')
  // A file page fills the card edge to edge and owns its scrolling, like /agents.
  const isLibraryFilePage = pathname.startsWith('/library/files/')
  // Every route below already owns a full-height inner scroll container that
  // does the real scrolling (projects list/new, project detail, the team
  // settings shell, chat shares) — same reasoning as isConnectorsOrSlackPage/
  // isChatPage: this shared main must not ALSO reserve a scrollbar-gutter, and
  // the card padding should match the tight 3px these already use, or the
  // page's own scrollbar sits inset by an extra, pointless gap.
  const usesTightCard = isConnectorsOrSlackPage || isChatPage || isProjectPage || isTeamPage || isChatsListPage || isChatSharesPage || isLibraryFilePage

  // Settings pages manage their own full layout — bypass global chrome entirely.
  // No ErrorBoundary wrap here: `children` is the settings shell (its own
  // persistent SettingsSidebar + the active page), and the shell owns its own
  // boundary around just the page slot (settings/(shell)/layout.tsx) so a
  // caught error — or the pathname-keyed remount that resets it — can't also
  // tear down and replay the sidebar's entrance animation on every settings
  // navigation.
  if (isSettingsPage) {
    return (
      <div
        style={{
          display:         'flex',
          alignItems:      'stretch',
          width:           '100%',
          height:          '100svh',
          backgroundColor: 'var(--neutral-white)',
        }}
      >
        {children}
        <AppDialogs />
      </div>
    )
  }

  // The shared LeftSidebar, then the page itself full-height, with no TopBar
  // or floating chat tools.
  if (isTemplatePage || isSchedulesPage) {
    return (
      <div
        style={{
          display:         'flex',
          alignItems:      'stretch',
          width:           '100%',
          height:          '100svh',
          backgroundColor: 'var(--neutral-white)',
        }}
      >
        <ErrorBoundary variant="region" label="Sidebar">
          <Suspense fallback={null}>
            <LeftSidebar
              activeChatId={activeChatId}
              onSelectChat={onSelectChat}
              onNewChat={onNewChat}
              defaultCollapsed={defaultSidebarCollapsed}
              />
          </Suspense>
        </ErrorBoundary>
        {/* The page's landmark — every other branch wraps the page in a <main> too. */}
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
        <AppDialogs />
      </div>
    )
  }

  return (
    <div
      style={{
        display:         "flex",
        alignItems:      "stretch",
        width:           "100%",
        height:          "100svh",
        backgroundColor: "var(--neutral-white)",
      }}
    >
      {/* ── Left sidebar ── */}
      <ErrorBoundary variant="region" label="Sidebar">
        <Suspense fallback={null}>
          <LeftSidebar
            activeChatId={activeChatId}
            onSelectChat={onSelectChat}
            onNewChat={onNewChat}
            defaultCollapsed={defaultSidebarCollapsed}
            />
        </Suspense>
      </ErrorBoundary>

      {/* ── Center column - neutral-50 bg, flex-column so credit banner sits above content ── */}
      <div
        style={{
          flex:            "1 0 0",
          minWidth:        0,
          display:         "flex",
          flexDirection:   "column",
          backgroundColor: "var(--neutral-50)",
        }}
      >
        {/* Content area — right padding keeps the gap to the viewport's right edge. */}
        <div
          style={{
            flex:      "1 0 0",
            minHeight: 0,
            display:   "flex",
            padding:   isSlackPage ? 0 : "10px 10px 10px 0",
          }}
        >
        {(isPersonaPage && !isPersonaChatPage) || isSlackPage ? (
          /* Non-chat persona pages and Slack: plain main, no outer glass card.
             Every page under this branch brings its own inner .kaya-scrollbar
             element that does the real scrolling —
             this main never overflows on its own, so it must NOT also carry
             .kaya-scrollbar (scrollbar-gutter: stable): that reserved a second,
             always-on gutter stacked on top of the page's own, doubling the gap
             on the right edge for no reason. This is a plain flex passthrough. */
          <main
            style={{
              flex:          "1 0 0",
              minHeight:     0,
              width:         "100%",
              display:       "flex",
              flexDirection: "column",
            }}
          >
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        ) : (
          /* ── Inner rounded container (Figma 3220:33871) ──
              border 1px neutral-200, rounded-22px, bg rgba(255,255,255,0.2),
              overflow-clip, isolate for FloatingPanel z-index scoping.
              Uniform 12px padding.
              Connectors/Souvenir-in-Slack and chat surfaces use the same tight
              3px padding the agents list's own self-built card uses, so their
              scrollbar sits the same distance from this border as /agents. */
          <div
            style={{
              position:        "relative",
              flex:            "1 0 0",
              minHeight:       0,
              display:         "flex",
              flexDirection:   "column",
              alignItems:      "flex-start",
              gap:             "2px",
              padding:         usesTightCard ? "3px" : "12px",
              borderRadius:    "var(--layout-radius)",
              border:          "1px solid var(--border-default)",
              backgroundColor: "var(--color-surface-container)",
              overflow:        "hidden",
              isolation:       "isolate",
            }}
          >
            {/* Pages put their back button / actions into the TopBar through these slots. */}
            <TopBarSlotsProvider>
            {/* ── TopBar - a defined bar along the top of the card, edge to edge, hairline below ── */}
            {!isAdminPage && !isTeamPage && !isConnectorsOrSlackPage && (
              <TopBar
                edgeInset={usesTightCard ? 3 : 12}
                showCitationsToggle={showCitationsToggle}
                citationsOpen={citationsOpen}
                onCitationsToggle={onCitationsToggle}
              />
            )}

            {/* ── Main content - fills remaining height ──
                Every route in the isPersonaChatPage/usesTightCard set manages its
                own message-list/page scrolling — this main must NOT also carry
                .kaya-scrollbar (scrollbar-gutter: stable reserves its own gutter
                unconditionally, stacking with the page's own and pushing its
                scrollbar further from the border than intended). */}
            <main
              className={(isPersonaChatPage || usesTightCard) ? undefined : "kaya-scrollbar"}
              style={{
                flex:                "1 0 0",
                minHeight:           0,
                width:               "100%",
                overflowY:           (isPersonaChatPage || usesTightCard) ? "hidden" : "auto",
                overflowX:           "hidden",
                overscrollBehaviorY: (isPersonaChatPage || usesTightCard) ? undefined : "contain",
                display:             "flex",
                flexDirection:       "column",
                paddingRight:        reserveChatToolsGutter ? 40 : undefined,
                boxSizing:           "border-box",
              }}
            >
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>

            {/* ── Floating action panel - mid-right of rounded container ── */}
            {!isAdminPage && !isTeamPage && !isConnectorsOrSlackPage && !isProjectPage && !isPersonaChatPage && !isChatsListPage && (
              <Suspense fallback={null}>
                <FloatingPanel />
              </Suspense>
            )}
            </TopBarSlotsProvider>
          </div>
        )}
        </div>
      </div>

      {/* ── Project panel (Instructions/Files/Team) - same treatment as Pinboard ── */}
      <Suspense fallback={null}>
        <ProjectPanelSidebar />
      </Suspense>

      {/* ── Right sidebar (Pinboard) ── */}
      {PINS_ENABLED && (
        <ErrorBoundary variant="region" label="Pinboard">
          <Suspense fallback={null}>
            <RightSidebar />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* ── Highlight sidebar ── */}
      {HIGHLIGHTS_ENABLED && (
        <Suspense fallback={null}>
          <HighlightSidebar />
        </Suspense>
      )}

      {/* ── Global dialogs ── */}
      <AppDialogs />
    </div>
  );
}

// A full-height flex sibling next to RightSidebar (Pinboard) rather than a
// panel squeezed inside the page's own rounded content border. The project
// page hands its Instructions/Files/Team JSX to the shared context; this
// provides the animated shell plus the same neutral-50 background + titled
// header/close-button chrome as Pinboard (see PinboardHeader), so the two
// side panels read as one consistent system.
const PANEL_SIDE_PADDING = 8;

function ProjectPanelSidebar() {
  const { panel: livePanel, isOpen } = useProjectPanel();
  // Mounting or unmounting the panel's body is the expensive part, so it never happens while the
  // panel slides: on open the shell slides in with its header and the body mounts once it has
  // settled; on close the last panel stays rendered until the slide-out finishes.
  const [shownPanel, setShownPanel] = useState(livePanel);
  const [settled, setSettled] = useState(false);
  if (livePanel && livePanel !== shownPanel) setShownPanel(livePanel);
  if (!isOpen && settled) setSettled(false);
  const panel = livePanel ?? shownPanel;
  // One inset for every panel (header title and content share a left edge): the 8px Pinboard uses.
  const sidePadding = PANEL_SIDE_PADDING;

  return (
    <m.div
      animate={isOpen ? { width: 356, opacity: 1 } : { width: 0, opacity: 0 }}
      initial={{ width: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 32, mass: 0.9 }}
      onAnimationComplete={() => {
        if (isOpen) setSettled(true);
        else setShownPanel(null);
      }}
      style={{
        height:        "100%",
        flexShrink:    0,
        overflow:      "hidden",
        pointerEvents: isOpen ? undefined : "none",
      }}
      aria-hidden={!isOpen || undefined}
    >
      <div
        style={{
          width:          356,
          height:         "100%",
          flexShrink:     0,
          display:        "flex",
          flexDirection:  "column",
          background:     "var(--neutral-50)",
          boxSizing:      "border-box",
        }}
      >
        {/* ── Header - title + close, matches PinboardHeader's shape ── */}
        <div
          style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            gap:            8,
            // The panel starts at the window's top (the card starts 11px lower), so 19px of padding puts
            // its title and close button on the TopBar's 19–51px band, as the left sidebar's header is.
            minHeight:      51,
            padding:        `19px 16px 0 ${sidePadding}px`,
            flexShrink:     0,
          }}
        >
          <p
            style={{
              margin:     0,
              fontFamily: "var(--font-title)",
              fontWeight: "var(--font-weight-regular)",
              fontSize:   "var(--font-size-heading)",
              lineHeight: "var(--line-height-heading)",
              color:      "var(--neutral-700)",
              whiteSpace: "nowrap",
              overflow:   "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {panel?.title}
          </p>
          <Tooltip content={`Close ${panel?.title ?? "panel"}`}>
            <IconButton
              variant="ghost"
              size="sm"
              icon={<CancelOneIcon size={20} />}
              aria-label={`Close ${panel?.title ?? "panel"}`}
              onClick={panel?.onClose}
            />
          </Tooltip>
        </div>

        {/* ── Content ── */}
        <div
          className="kaya-scrollbar"
          style={{ flex: "1 1 0", minHeight: 0, overflowY: "auto", overflowX: "hidden", boxSizing: "border-box" }}
        >
          <div style={{ padding: `14px ${sidePadding}px ${sidePadding}px`, boxSizing: "border-box", height: "100%" }}>
            {(settled || !isOpen) && panel?.content}
          </div>
        </div>
      </div>
    </m.div>
  );
}
