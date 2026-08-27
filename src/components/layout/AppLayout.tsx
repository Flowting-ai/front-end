"use client";

import { Suspense, useEffect } from "react";
import { usePathname } from "next/navigation";
import { m } from "framer-motion";
import { CancelOneIcon } from "@strange-huge/icons";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { HighlightSidebar } from "./HighlightSidebar";
import { TopBar } from "./TopBar";
import { AppDialogs } from "./AppDialogs";
import { FloatingPanel } from "./FloatingPanel";
import { IconButton } from "@/components/IconButton";
import { Tooltip } from "@/components/Tooltip";
import { usePinboard } from "@/context/pinboard-context";
import { useHighlight } from "@/context/highlight-context";
import { useProjectPanel } from "@/context/project-panel-context";
import {
  PROJECT_BASE_ROUTE,
  PROJECTS_ROUTE,
  AGENTS_ROUTE,
  AGENT_BASE_ROUTE,
  SETTINGS_ROUTE,
  ORG_BASE_ROUTE,
  TEAMS_BASE_ROUTE,
  BRAIN_ROUTE,
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
}

export function AppLayout({
  children,
  activeChatId,
  showCitationsToggle,
  citationsOpen,
  onCitationsToggle,
  onSelectChat,
  onNewChat,
}: AppLayoutProps) {
  const { close: closePinboard } = usePinboard()
  const { close: closeHighlight } = useHighlight()
  const pathname = usePathname()

  const isAnyProjectPage = pathname.startsWith(PROJECT_BASE_ROUTE)
  // Suppress FloatingPanel on project listing / detail pages, but NOT on
  // project chat pages - those use the same global FloatingPanel as regular chats.
  const isProjectPage    = isAnyProjectPage && !pathname.includes('/chat/')
  // Only the projects listing page has no panel support at all.
  const isProjectsListPage = pathname === PROJECTS_ROUTE

  // Close the highlight panel on every page transition.
  useEffect(() => {
    closeHighlight()
  }, [pathname, closeHighlight])

  // Force-close both panels on the projects listing page and project detail pages.
  useEffect(() => {
    if (isProjectsListPage || isProjectPage) {
      closePinboard()
    }
  }, [isProjectsListPage, isProjectPage, closePinboard])
  const isPersonaPage    = pathname.startsWith(AGENTS_ROUTE) || pathname.startsWith(AGENT_BASE_ROUTE)
  // Persona chat pages manage their own scroll — disable the outer scrollable wrapper
  const isPersonaChatPage = /^\/agents\/[^\/]+\/chat/.test(pathname)
  const isSettingsPage = pathname.startsWith(SETTINGS_ROUTE)
  const isAdminPage    = pathname.startsWith(ORG_BASE_ROUTE)
  // The editor team page (/teams/[teamId]) is a settings-style page, not a chat
  // surface — strip the TopBar/model-selector and floating chat tools like /org.
  const isTeamPage     = pathname.startsWith(TEAMS_BASE_ROUTE)
  // Brain pages use BrainShell which supplies its own full-screen layout (sidebar + center + context rail).
  // A stored template is a full-bleed document viewer: its own header, then an
  // iframe that must own the rest of the height. The default branch below lays
  // the TopBar over the top of the content, which would sit on the document's
  // title, and the model selector means nothing here — there is no chat.
  const isTemplatePage = pathname.startsWith(TEMPLATE_BASE_ROUTE)
  const isBrainPage = pathname.startsWith(BRAIN_ROUTE)
  // Connectors / Souvenir-in-Slack are settings-style pages too (moved off
  // /org/* to their own top-level routes) — same TopBar/FloatingPanel strip
  // as /org and /teams/[teamId] above.
  const isConnectorsOrSlackPage = pathname.startsWith(ORG_CONNECTORS_ROUTE) || pathname.startsWith(ORG_SOUVENIR_SLACK_ROUTE)
  // Chat surfaces (/chat, /project/[id]/chat/[chatId]) manage their own message-
  // list scrolling (ChatInterface's own kaya-scrollbar div) — same reasoning as
  // isConnectorsOrSlackPage below: give them the tight 3px card padding too, so
  // their scrollbar sits close to the rounded border instead of 12px inset.
  const isChatPage = pathname === CHAT_ROUTE || (isAnyProjectPage && pathname.includes('/chat/'))
  const isChatsListPage = pathname.startsWith(CHATS_ROUTE)
  const isChatSharesPage = pathname.startsWith('/chat-shares')
  // Every route below already owns a full-height inner scroll container that
  // does the real scrolling (projects list/new, project detail, the team
  // settings shell, chat shares) — same reasoning as isConnectorsOrSlackPage/
  // isChatPage: this shared main must not ALSO reserve a scrollbar-gutter, and
  // the card padding should match the tight 3px these already use, or the
  // page's own scrollbar sits inset by an extra, pointless gap.
  const usesTightCard = isConnectorsOrSlackPage || isChatPage || isProjectPage || isTeamPage || isChatsListPage || isChatSharesPage

  // Settings pages manage their own full layout — bypass global chrome entirely.
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

  // Same shape as the Brain branch: the shared LeftSidebar, then the page
  // itself full-height, with no TopBar or floating chat tools.
  if (isTemplatePage) {
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
        <Suspense fallback={null}>
          <LeftSidebar
            activeChatId={activeChatId}
            onSelectChat={onSelectChat}
            onNewChat={onNewChat}
          />
        </Suspense>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
        <AppDialogs />
      </div>
    )
  }

  // Brain pages render the SAME shared LeftSidebar as Chats / Agents (one instance,
  // no duplicate). BrainShell supplies its own center column + ContextRail, so we
  // skip the standard TopBar / glass-card center wrapper here.
  if (isBrainPage) {
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
        <Suspense fallback={null}>
          <LeftSidebar
            activeChatId={activeChatId}
            onSelectChat={onSelectChat}
            onNewChat={onNewChat}
          />
        </Suspense>
        {children}
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
      <Suspense fallback={null}>
        <LeftSidebar
          activeChatId={activeChatId}
          onSelectChat={onSelectChat}
          onNewChat={onNewChat}
        />
      </Suspense>

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
        {/* Content area — right padding restored to match BrainShell's own
            center container (src/templates/Brain/index.tsx: padding '10px
            10px 10px 0') so /chat and friends get the same gap to the
            viewport's right edge that Brain already has. */}
        <div
          style={{
            flex:      "1 0 0",
            minHeight: 0,
            display:   "flex",
            padding:   "10px 10px 10px 0",
          }}
        >
        {isPersonaPage && !isPersonaChatPage ? (
          /* Non-chat persona pages (list, configure): plain main, no container.
             Every page under this branch (agents list, agent/configure/*) brings
             its own inner .kaya-scrollbar element that does the real scrolling —
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
            {children}
          </main>
        ) : (
          /* ── Inner rounded container (Figma 3220:33871) ──
              border 1px neutral-200, rounded-22px, bg rgba(255,255,255,0.2),
              overflow-clip, isolate for FloatingPanel z-index scoping.
              Uniform 12px padding — matches BrainShell's own glass card
              (src/templates/Brain/index.tsx: padding '12px' on all sides).
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
              borderRadius:    "22px",
              border:          "1px solid var(--neutral-200)",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              overflow:        "hidden",
              isolation:       "isolate",
            }}
          >
            {/* ── TopBar - absolute, overlaps the 1px border on three sides ── */}
            {!isAdminPage && !isTeamPage && !isConnectorsOrSlackPage && (
              <TopBar
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
              }}
            >
              {children}
            </main>

            {/* ── Floating action panel - mid-right of rounded container ── */}
            {!isAdminPage && !isTeamPage && !isConnectorsOrSlackPage && !isProjectPage && !isPersonaChatPage && (
              <Suspense fallback={null}>
                <FloatingPanel />
              </Suspense>
            )}
          </div>
        )}
        </div>
      </div>

      {/* ── Project panel (Instructions/Files/Team) - same treatment as Pinboard ── */}
      <Suspense fallback={null}>
        <ProjectPanelSidebar />
      </Suspense>

      {/* ── Right sidebar (Pinboard) ── */}
      <Suspense fallback={null}>
        <RightSidebar />
      </Suspense>

      {/* ── Highlight sidebar ── */}
      <Suspense fallback={null}>
        <HighlightSidebar />
      </Suspense>

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
function ProjectPanelSidebar() {
  const { panel, isOpen } = useProjectPanel();

  return (
    <m.div
      animate={isOpen ? { width: 356, opacity: 1 } : { width: 0, opacity: 0 }}
      initial={{ width: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 32, mass: 0.9 }}
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
            minHeight:      58,
            padding:        "22px 16px 0 24px",
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
          <div style={{ padding: "14px 24px 24px", boxSizing: "border-box", height: "100%" }}>
            {panel?.content}
          </div>
        </div>
      </div>
    </m.div>
  );
}
