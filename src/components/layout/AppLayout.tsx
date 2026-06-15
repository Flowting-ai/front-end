"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { HighlightSidebar } from "./HighlightSidebar";
import { TopBar } from "./TopBar";
import { AppDialogs } from "./AppDialogs";
import { FloatingPanel } from "./FloatingPanel";
import { usePinboard } from "@/context/pinboard-context";
import { useHighlight } from "@/context/highlight-context";
import { useOrg } from "@/context/org-context";
import { WorkspaceStatusBanner, type TokenStatus } from "@/components/WorkspaceStatusBanner";

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
  const { isOpen: pinboardOpen, close: closePinboard } = usePinboard()
  const { isOpen: highlightOpen, close: closeHighlight } = useHighlight()
  const { plan, currentUserRole } = useOrg()
  const pathname = usePathname()
  const router = useRouter()

  const WORKSPACE_BANNER_STATUSES = new Set<string>(['warning_95', 'grace', 'locked'])
  const workspaceBannerStatus = (plan?.poolStatus && WORKSPACE_BANNER_STATUSES.has(plan.poolStatus))
    ? plan.poolStatus as TokenStatus
    : null
  const isAnyProjectPage = pathname.startsWith('/project')
  // Suppress FloatingPanel on project listing / detail pages, but NOT on
  // project chat pages - those use the same global FloatingPanel as regular chats.
  const isProjectPage    = isAnyProjectPage && !pathname.includes('/chat/')
  // Only the projects listing page has no panel support at all.
  const isProjectsListPage = pathname === '/projects'

  // Force-close both panels only on the projects listing page.
  useEffect(() => {
    if (isProjectsListPage) {
      closePinboard()
      closeHighlight()
    }
  }, [isProjectsListPage, closePinboard, closeHighlight])
  const isPersonaPage    = pathname.startsWith('/agents') || pathname.startsWith('/agent')
  // Persona chat pages manage their own scroll — disable the outer scrollable wrapper
  const isPersonaChatPage = /^\/agents\/[^\/]+\/chat/.test(pathname)
  const isSettingsPage = pathname.startsWith('/settings')
  const isAdminPage    = pathname.startsWith('/org')
  // Brain pages use BrainShell which supplies its own full-screen layout (sidebar + center + context rail).
  const isBrainPage = pathname.startsWith('/brain')

  // Settings and Brain pages manage their own layout — bypass global chrome.
  if (isSettingsPage || isBrainPage) {
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
            onAdminAction={() => router.push('/org/plans')}
          />
        )}

        {/* Content area with original 10px spacing */}
        <div
          style={{
            flex:      "1 0 0",
            minHeight: 0,
            display:   "flex",
            padding:   (pinboardOpen || highlightOpen) ? "10px 0" : "10px 10px 10px 0",
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
              overflow-clip, isolate for FloatingPanel z-index scoping. */
          <div
            style={{
              position:        "relative",
              flex:            "1 0 0",
              minHeight:       0,
              display:         "flex",
              flexDirection:   "column",
              alignItems:      "flex-start",
              gap:             "2px",
              padding:         "12px",
              borderRadius:    "22px",
              border:          "1px solid var(--neutral-200)",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              overflow:        "hidden",
              isolation:       "isolate",
            }}
          >
            {/* ── TopBar - absolute, overlaps the 1px border on three sides ── */}
            {!isAdminPage && (
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
            {!isAdminPage && !isProjectPage && !isPersonaChatPage && (
              <Suspense fallback={null}>
                <FloatingPanel />
              </Suspense>
            )}
          </div>
        )}
        </div>
      </div>

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
