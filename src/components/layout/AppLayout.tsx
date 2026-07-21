"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
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
import { useOrg } from "@/context/org-context";
import { WorkspaceStatusBanner, type TokenStatus } from "@/components/WorkspaceStatusBanner";
import {
  ORG_PLANS_ROUTE,
  PROJECT_BASE_ROUTE,
  PROJECTS_ROUTE,
  AGENTS_ROUTE,
  AGENT_BASE_ROUTE,
  SETTINGS_ROUTE,
  ORG_BASE_ROUTE,
  TEAMS_BASE_ROUTE,
  BRAIN_ROUTE,
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
  const { plan, currentUserRole } = useOrg()
  const pathname = usePathname()
  const router = useRouter()

  const WORKSPACE_BANNER_STATUSES = new Set<string>(['warning_95', 'grace', 'locked'])
  const workspaceBannerStatus = (plan?.poolStatus && WORKSPACE_BANNER_STATUSES.has(plan.poolStatus))
    ? plan.poolStatus as TokenStatus
    : null
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
  const isBrainPage = pathname.startsWith(BRAIN_ROUTE)

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
        {/* Workspace credit status banner — only shown when pool is low, in grace, or locked */}
        {workspaceBannerStatus && (
          <WorkspaceStatusBanner
            tokenStatus={workspaceBannerStatus}
            isAdmin={currentUserRole === 'admin'}
            onAdminAction={() => router.push(ORG_PLANS_ROUTE)}
          />
        )}

        {/* Content area — right padding removed (was 10px when no side panel
            was open): that, plus the rounded container's own 12px, plus each
            page's own inner scroll padding, was stacking into a much bigger
            scrollbar-to-edge gap than intended. Each page's own inner content
            now owns its exact edge spacing instead. */}
        <div
          style={{
            flex:      "1 0 0",
            minHeight: 0,
            display:   "flex",
            padding:   "10px 0",
          }}
        >
        {isPersonaPage && !isPersonaChatPage ? (
          /* ── Non-chat persona pages (list, configure): plain main, no container ── */
          <main
            className="kaya-scrollbar"
            style={{
              flex:                "1 0 0",
              minHeight:           0,
              width:               "100%",
              overflowY:           "auto",
              overflowX:           "hidden",
              overscrollBehaviorY: "contain",
              display:             "flex",
              flexDirection:       "column",
            }}
          >
            {children}
          </main>
        ) : (
          /* ── Inner rounded container (Figma 3220:33871) ──
              border 1px neutral-200, rounded-22px, bg rgba(255,255,255,0.2),
              overflow-clip, isolate for FloatingPanel z-index scoping.
              Right padding removed — it was stacking with the content area's
              own padding and each page's inner scroll padding into a much
              bigger scrollbar-to-edge gap than intended. Each page's own
              inner content now owns its exact right-edge spacing instead. */
          <div
            style={{
              position:        "relative",
              flex:            "1 0 0",
              minHeight:       0,
              display:         "flex",
              flexDirection:   "column",
              alignItems:      "flex-start",
              gap:             "2px",
              paddingTop:      "12px",
              paddingBottom:   "12px",
              paddingLeft:     "12px",
              borderRadius:    "22px",
              border:          "1px solid var(--neutral-200)",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              overflow:        "hidden",
              isolation:       "isolate",
            }}
          >
            {/* ── TopBar - absolute, overlaps the 1px border on three sides ── */}
            {!isAdminPage && !isTeamPage && (
              <TopBar
                showCitationsToggle={showCitationsToggle}
                citationsOpen={citationsOpen}
                onCitationsToggle={onCitationsToggle}
              />
            )}

            {/* ── Main content - fills remaining height ── */}
            <main
              className={isPersonaChatPage ? undefined : "kaya-scrollbar"}
              style={{
                flex:                "1 0 0",
                minHeight:           0,
                width:               "100%",
                overflowY:           isPersonaChatPage ? "hidden" : "auto",
                overflowX:           "hidden",
                overscrollBehaviorY: isPersonaChatPage ? undefined : "contain",
                display:             "flex",
                flexDirection:       "column",
              }}
            >
              {children}
            </main>

            {/* ── Floating action panel - mid-right of rounded container ── */}
            {!isAdminPage && !isTeamPage && !isProjectPage && !isPersonaChatPage && (
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
          <div style={{ padding: "14px 24px 24px", boxSizing: "border-box" }}>
            {panel?.content}
          </div>
        </div>
      </div>
    </m.div>
  );
}
