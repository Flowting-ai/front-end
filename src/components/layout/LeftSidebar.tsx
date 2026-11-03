"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useGuardedRouter, useNavGuard } from "@/context/nav-guard-context";
import { FolderLibraryIcon, FolderThreeIcon } from "@strange-huge/icons";
import { IconWithFallback } from "@/components/IconWithFallback";
import { Sidebar, SidebarMenuSkeleton, FlatSidebar, FlatSidebarProfileRow } from "@/components/ui";
import { AccountMenu } from "@/components/AccountMenu";
import { useAuth } from "@/context/auth-context";
import { useChatHistoryContext } from "@/context/chat-history-context";
import { useProjects } from "@/context/projects-context";
import { emitSidebarNewChat } from "@/hooks/use-sidebar-events";
import { SidebarDestinationsSkeleton, SidebarProfileSkeleton, SidebarProjectsSkeleton, SidebarRecentsSkeleton } from "./SidebarChromeSkeleton";
import { useSearch } from "@/context/search-context";
import { useOrg } from "@/context/org-context";
import { getOrgSlackStatus } from "@/lib/api/slack";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { STALE_DEFAULT_MS } from "@/lib/query-policy";
import { RoleBadge } from "@/components/RoleBadge";
import type { WorkspaceRole } from "@/components/RoleBadge";
import { Tooltip } from "@/components/Tooltip";
import { toast } from "sonner";
import { SIDEBAR_SLACK_ROW_HINT_KEY } from "@/lib/storage-keys";
import { useMobile } from "@/hooks/use-mobile";
import {
  PROJECTS_ROUTE,
  ORG_PLANS_ROUTE,
  ORG_GENERAL_ROUTE,
  ORG_SOUVENIR_SLACK_ROUTE,
  AGENTS_ROUTE,
  CHAT_ROUTE,
  CHATS_ROUTE,
  SETTINGS_ROUTE,
  SETTINGS_USAGE_ROUTE,
  SETTINGS_HELP_ROUTE,
  AUTH_LOGIN_ROUTE,
} from "@/lib/routes";
import { ReportBugModal } from "@/components/ReportBugModal";
import { NotificationBell } from "@/components/NotificationBell";
import { NOTIFICATIONS_OPEN_EVENT } from "@/context/notifications-context";
import type { SectionProps } from "./sidebar/section-motion";
import { orgDisplayName } from "./sidebar/sidebar-helpers";
import { ADMIN_SECTION_ROUTES, ADMIN_SECTION_COMING_SOON, ORG_ADMIN_GROUPS } from "./sidebar/admin-nav";
import { StarredSection } from "./sidebar/StarredSection";
import { RecentsSection } from "./sidebar/RecentsSection";
import { ProjectsSection, TeamsSidebarContent } from "./sidebar/ProjectsSection";
import { PersonasSectionIndividual } from "./sidebar/PersonasSectionIndividual";
import { RecentAgentChatsSection } from "./sidebar/RecentAgentChatsSection";
import { FlatPinnedSection } from "./sidebar/FlatPinnedSection";
import { FlatRecentsSection } from "./sidebar/FlatRecentsSection";
import { FlatProjectsSection, FlatTeamsSidebarContent } from "./sidebar/FlatProjectsSection";
import { FlatDestinations } from "./sidebar/FlatDestinations";
import { useSidebarCollapse } from "./sidebar/use-sidebar-collapse";
import { useChatCreatedMirror } from "./sidebar/use-chat-created-mirror";
import { useAccountMenuModel } from "./sidebar/use-account-menu-model";

// Notifications bell in the account-menu row is switched off; flip to true to restore it.
const SHOW_NOTIFICATION_BELL = false;

// -- LeftSidebar ---------------------------------------------------------------
// The sections, rows, helpers and hooks live in ./sidebar/; this file is the
// container that wires them to routing, auth/org context and the two shells
// (FlatSidebar everywhere, the tabbed Sidebar on /org admin pages).

interface LeftSidebarProps {
  activeChatId?: string;
  onSelectChat?: (id: string) => void;
  onNewChat?: () => void;
  /** Initial collapsed state, from the `sidebar_collapsed` cookie read on the
   *  server (see src/app/(app)/layout.tsx). Only read on mount. */
  defaultCollapsed?: boolean;
}

function LeftSidebarImpl({
  activeChatId,
  onSelectChat,
  onNewChat,
  defaultCollapsed = false,
}: LeftSidebarProps) {
  const { push } = useGuardedRouter();
  const { push: rawPush } = useRouter();
  const { guardedNavigate } = useNavGuard();
  const pathname = usePathname();
  const chatSearchParams = useSearchParams();
  const { user, logout, isAuthenticated } = useAuth();
  const chatHistory = useChatHistoryContext();
  const { chats: projectChats } = useProjects();
  const { orgId, org, plan, orgRole, currentUserRole, orgPlanSettled, orgReady } = useOrg();

  // The Slack row's state (Add vs connected) for admins.
  const showsSlackRow = !!orgId && currentUserRole === 'admin';
  const slackStatusQ = useQuery({
    queryKey: queryKeys.orgs.slackStatus(orgId ?? ''),
    queryFn: () => getOrgSlackStatus(orgId!),
    enabled: showsSlackRow,
    staleTime: STALE_DEFAULT_MS,
    retry: false,
  });
  const slackConnected = slackStatusQ.data?.connected ?? false;

  // Everything in the sidebar except the chat lists appears in one frame: the
  // destinations (whose Slack row depends on the role and the Slack status),
  // the Projects and Recent Chats headers, and the profile row (which needs the
  // user and, for a workspace, its plan). Until all of that is known the whole
  // sidebar shows skeletons, instead of rows popping in one by one over a few
  // seconds. Chat rows keep their own loading state after the reveal.
  const chromeReady = !!user && orgReady && orgPlanSettled && (!showsSlackRow || !slackStatusQ.isPending);

  // -- Global search ---------------------------------------------------------
  const { searchOpen, openSearch } = useSearch();

  // -- Account menu: Report a bug modal ---------------------------------------
  const [reportBugOpen, setReportBugOpen] = useState(false);
  // The flat sidebar's profile row carries both the account menu and the
  // notification bell — both controlled here so opening one closes the other
  // (the bell sits inside the account trigger, so outside-click alone can't).
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const isPersonaPage = pathname?.startsWith("/agents");
  // All 5 Agent Configure tabs (Instructions/Profile/Knowledge/Connectors/
  // Sharing) are a deliberately full-width editing surface — the sidebar
  // stays collapsed and its toggle disabled so it can't be re-expanded.
  const isSlackPage = pathname?.startsWith(ORG_SOUVENIR_SLACK_ROUTE) ?? false;
  const isMobile = useMobile();
  // Trailing slash matters: bare "/project" also prefix-matches "/projects"
  // and "/projects/new" (the listing pages), which must NOT be treated as a
  // project detail page here (unlike AppLayout's own, intentionally broader
  // isAnyProjectPage check).
  const isProjectPage = pathname?.startsWith("/project/") ?? false;
  const isAdminPage   = pathname?.startsWith("/org") ?? false;
  const isNewChatPage = pathname === CHAT_ROUTE && !chatSearchParams.get('id');
  // Map the current /org/* path to its admin-section item id so the sidebar
  // can highlight the correct row on initial mount / page refresh. Connectors
  // and Souvenir-in-Slack moved to their own top-level routes (no longer under
  // /org/*), so everything actually left here is a transient redirect stub —
  // this id only needs a harmless fallback while that stub briefly renders.
  const adminItemId = !isAdminPage ? undefined
    : 'general'

  // Determines which Sidebar key to use (triggers remount on section change).
  // Admin pages use a per-item key so the sidebar remounts on each admin page
  // navigation, allowing defaultSelectedItem to pre-highlight the right row.
  const sidebarSectionKey = isPersonaPage ? 'persona'
    : isProjectPage ? 'projects'
    : isAdminPage   ? `admin-${adminItemId}`
    : isNewChatPage ? 'new-chat'
    : 'chat-board';

  const computedDefaultBodySection = (
    isPersonaPage ? 'agents'
    : isProjectPage ? 'projects'
    : isAdminPage ? 'admin'
    : isNewChatPage ? 'new-chat'
    : 'chats'
  ) as 'chats' | 'agents' | 'admin' | 'new-chat' | 'projects';

  const { collapsedRef, handleCollapse } = useSidebarCollapse(defaultCollapsed);

  // Exclude project chats from the Recents/Starred lists - they are already
  // shown inside the Projects section and would be confusing duplicates.
  const projectChatIdSet = useMemo(
    () => new Set(projectChats.map(c => c.id)),
    [projectChats],
  );
  // Recent Chats is a personal, cross-workspace list: it always shows the
  // user's own recent chats regardless of which team/personal context the
  // team switcher currently points at (unlike Projects, which does split by
  // workspace). Only project-linked chats are excluded, since those already
  // surface inside the Projects section.
  const filteredChatHistory = useMemo(() => {
    const chats = chatHistory.chats.filter(c => !projectChatIdSet.has(c.id) && c.visibility !== 'archived');
    return { ...chatHistory, chats };
  }, [chatHistory, projectChatIdSet]);

  useChatCreatedMirror(chatHistory.addOptimistic);

  const resolvedActiveChatId = activeChatId ?? chatSearchParams.get("id") ?? undefined;

  const handleNewChat = () => {
    // NOTE: previously short-circuited to push(AGENTS_ROUTE) when isPersonaPage —
    // that matched the old tabbed Sidebar, where this handler was never actually
    // invoked while on the Agents tab (it had its own separate onNewAgentChat).
    // The new flat sidebar's "New" row calls this unconditionally from every
    // page, so that branch just made "New" a no-op on /agents and any
    // /agents/[id]/chat page — removed; "New" now always opens a blank chat.
    // The whole action (reset event + navigation) runs inside one guard check:
    // the event resets the page immediately, so it must not fire while the
    // unsaved-changes dialog is still holding the navigation back. rawPush,
    // not the guarded push, since this wrapper already is the guard.
    guardedNavigate(() => {
      toast.info("Opening new chat", { id: 'nav' });
      if (onNewChat) {
        onNewChat();
      } else if (pathname === CHAT_ROUTE) {
        // Already mounted on the chat page (viewing an existing chat) — URL
        // navigation alone isn't reliably picked up by the page's own
        // reactive id-change detection, so the page resets itself directly
        // off this event instead. Still push the URL too, so it correctly
        // reflects the reset (history/bookmarking).
        emitSidebarNewChat();
        rawPush(CHAT_ROUTE);
      } else {
        rawPush(CHAT_ROUTE);
      }
    });
  };

  const handleSelectChat = (id: string) => {
    if (onSelectChat) {
      onSelectChat(id);
    } else {
      push(`${CHAT_ROUTE}?id=${id}`);
    }
  };

  const {
    displayName, displayRole, orgBadgeSublabel, orgBadgeChipColor, isTeamUser,
    planLabel, planWarning, planTypeLabel, planStatusVariant, accountCredits,
  } = useAccountMenuModel();

  const isClient = useIsClient()
  // Whether the skeleton includes the Slack row: known once the role resolves;
  // before that, what this viewer saw last time (read only after hydration).
  const slackRowHint = (() => {
    if (!isClient) return false
    try { return window.localStorage.getItem(SIDEBAR_SLACK_ROW_HINT_KEY) === '1' } catch { return false }
  })()
  const skeletonHasSlackRow = orgReady ? showsSlackRow : slackRowHint
  useEffect(() => {
    if (!chromeReady) return
    try { window.localStorage.setItem(SIDEBAR_SLACK_ROW_HINT_KEY, showsSlackRow ? '1' : '0') } catch { /* storage unavailable */ }
  }, [chromeReady, showsSlackRow])

  const sectionProps: SectionProps = {
    activeChatId: resolvedActiveChatId,
    onSelectChat: handleSelectChat,
    chatHistory: filteredChatHistory,
  };

  // Souvenir V1.5: Admin pages keep the old tabbed Sidebar completely
  // unchanged (see docs/features/sidebar-current-state-audit.md and the
  // migration plan for why).
  const useFlatSidebar = !isAdminPage;

  // "N new notifications" toast → Open: only the flat sidebar has the bell, so
  // only it claims the event (marks it handled); otherwise the provider falls
  // back to navigating straight to the newest item.
  useEffect(() => {
    if (!useFlatSidebar) return;
    const onOpen = (e: Event) => {
      if (e instanceof CustomEvent && e.detail && typeof e.detail === "object") (e.detail as { handled?: boolean }).handled = true;
      setAccountMenuOpen(false);
      setNotificationsOpen(true);
    };
    window.addEventListener(NOTIFICATIONS_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(NOTIFICATIONS_OPEN_EVENT, onOpen);
  }, [useFlatSidebar]);

  if (useFlatSidebar) {
    return (
      <>
        <FlatSidebar
          onSearch={openSearch}
          searchActive={searchOpen}
          onCollapse={handleCollapse}
          defaultCollapsed={collapsedRef.current}
          forceCollapsed={isSlackPage && isMobile}
          destinationsItems={(collapsed) => chromeReady
            ? <FlatDestinations onNewChat={handleNewChat} newChatSelected={isNewChatPage} collapsed={collapsed} slackConnected={slackConnected} />
            : <SidebarDestinationsSkeleton withSlack={skeletonHasSlackRow} collapsed={collapsed} />}
          projectItems={!chromeReady ? (
            <SidebarProjectsSkeleton />
          ) : orgId ? (
            <FlatTeamsSidebarContent role={currentUserRole} />
          ) : (
            <FlatProjectsSection
              label="Projects"
              headerIcon={
                <IconWithFallback
                  icon={<FolderLibraryIcon size={16} animated />}
                  fallback={<FolderThreeIcon size={16} animated />}
                />
              }
            />
          )}
          recentItems={
            !chromeReady ? (
              <SidebarRecentsSkeleton />
            ) : (
              <>
                <FlatPinnedSection {...sectionProps} />
                <FlatRecentsSection {...sectionProps} onNewChat={handleNewChat} />
              </>
            )
          }
          accountMenu={(collapsed) => {
            // Wait for the org's own plan fetch too, not just `user` — for a
            // team user, `isTeamUser` can go true (via user?.orgId) before
            // org-context's `plan`/`org.creditPool` load, and planWarning's
            // `!orgHasPlan` branch reads org-context state. Rendering early
            // showed "No Plan Selected" for a beat, then flipped to the real
            // plan tag once org data caught up.
            if (!chromeReady || !user || (isTeamUser && !orgPlanSettled)) {
              return <SidebarProfileSkeleton collapsed={collapsed} />
            }
            return (
              <AccountMenu
                name={displayName || "Account"}
                plan={planLabel}
                planWarning={planWarning}
                planType={planTypeLabel}
                credits={accountCredits}
                showUpgradePlan={!orgId || orgRole === 'admin'}
                viewPlanOnly={plan?.isEnterprise ?? false}
                email={user?.email ?? undefined}
                roleLabel={orgId && displayRole ? displayRole.charAt(0).toUpperCase() + displayRole.slice(1) : undefined}
                planStatusVariant={planStatusVariant}
                avatarSrc={user?.profilePicture ?? undefined}
                collapsed={collapsed}
                panelWidth={274}
                roleBadge={orgId && displayRole ? (
                  <Tooltip content={orgBadgeSublabel} side="top" delayDuration={300}>
                    <span style={{ display: 'inline-flex' }}>
                      <RoleBadge role={displayRole as WorkspaceRole} showLabel={false} mode="solar" />
                    </span>
                  </Tooltip>
                ) : undefined}
                placement="top-start"
                open={accountMenuOpen}
                onOpenChange={(next) => {
                  setAccountMenuOpen(next);
                  if (next) setNotificationsOpen(false);
                }}
                renderTrigger={({ onOpenSettingsClick }) => (
                  <FlatSidebarProfileRow
                    name={displayName || "Account"}
                    sublabel={planLabel}
                    avatarSrc={user?.profilePicture ?? undefined}
                    planLabel={!orgId && user?.planType ? user.planType.charAt(0).toUpperCase() + user.planType.slice(1) : undefined}
                    onOpenSettingsClick={onOpenSettingsClick}
                    collapsed={collapsed}
                    trailing={
                      SHOW_NOTIFICATION_BELL ? (
                        <NotificationBell
                          open={notificationsOpen}
                          onOpenChange={(next) => {
                            setNotificationsOpen(next);
                            if (next) setAccountMenuOpen(false);
                          }}
                        />
                      ) : undefined
                    }
                  />
                )}
                onUsage={() => push(SETTINGS_USAGE_ROUTE)}
                onUpgradePlan={() => push(ORG_PLANS_ROUTE)}
                onSettings={() => push(SETTINGS_ROUTE)}
                onOrganization={(orgId && orgRole === 'admin') ? () => push(ORG_GENERAL_ROUTE) : undefined}
                onHelp={() => push(SETTINGS_HELP_ROUTE)}
                onReportBug={() => setReportBugOpen(true)}
                onLogOut={() => guardedNavigate(() => { if (isAuthenticated) { void logout() } else { push(AUTH_LOGIN_ROUTE) } })}
              />
            )
          }}
        />
        {reportBugOpen && <ReportBugModal onClose={() => setReportBugOpen(false)} />}
      </>
    );
  }

  return (
    <>
    <Sidebar
      key={sidebarSectionKey}
      recents={[]}
      defaultCollapsed={collapsedRef.current}
      defaultBodySection={computedDefaultBodySection}
      defaultSelectedItem={adminItemId}
      searchActive={searchOpen}
      onCollapse={handleCollapse}
      onNewChat={handleNewChat}
      newChatButtonSelected={
        isPersonaPage ? pathname === AGENTS_ROUTE
        : isNewChatPage
      }
      onSearch={openSearch}
      onChatTabClick={isPersonaPage ? () => push(CHAT_ROUTE) : handleNewChat}
      onChatsClick={() => { toast.info("Opening Chat Board", { id: 'nav' }); push(CHATS_ROUTE) }}
      onChatboardClick={() => { toast.info("Opening Chat Board", { id: 'nav' }); push(CHATS_ROUTE) }}
      onProjectsClick={() => { toast.info("Opening Projects", { id: 'nav' }); push(PROJECTS_ROUTE) }}
      onPersonasClick={() => { toast.info("Opening Agents", { id: 'nav' }); push(AGENTS_ROUTE) }}
      onNewAgentChat={() => push(AGENTS_ROUTE)}
      // Shared/team-agent UI hidden app-wide — always the private-only listing
      // now, regardless of project/org context. `PersonasSectionAll` (the
      // team-shared variant) stays defined, just unused from this call site,
      // so it isn't rebuilt from scratch if this is ever re-shown.
      agentItems={<PersonasSectionIndividual />}
      onAllAgentsClick={() => { toast.info("Opening Agents", { id: 'nav' }); push(AGENTS_ROUTE) }}
      // Clicking the admin tab switches the sidebar body to admin AND navigates
      // to General — always landing on General regardless of prior admin page.
      onOrganisationClick={() => push(ORG_GENERAL_ROUTE)}
      // "Manage <org>" row (and its collapsed-rail twin) land on the same org
      // management entry point as the header org badge.
      onManageOrg={() => push(ORG_GENERAL_ROUTE)}
      // adminGroups is intentionally NOT overridden — the Sidebar's default
      // groups (Organization / Models) are the canonical content.
      // We only wire behaviour: navigate where a page exists, else "coming soon".
      adminGroups={isAdminPage ? ORG_ADMIN_GROUPS : undefined}
      onAdminSectionClick={(id) => {
        const href = ADMIN_SECTION_ROUTES[id]
        if (href) { push(href); return }
        const label = ADMIN_SECTION_COMING_SOON[id] ?? id
        toast.info(`${label} — coming soon`, { id: 'nav' })
      }}
      orgName={orgId ? orgDisplayName(org?.name ?? '') : undefined}
      orgId={orgId ?? undefined}
      showAdmin={Boolean(orgId) && orgRole === 'admin'}
      orgBadgeSublabel={orgBadgeSublabel}
      orgBadgeChipColor={orgBadgeChipColor}
      accountMenu={(collapsed) => {
        // See the matching comment on the FlatSidebar accountMenu above —
        // isTeamUser can resolve true before org-context's own plan fetch
        // settles, which otherwise flashes "No Plan Selected" briefly.
        if (!user || (isTeamUser && !orgPlanSettled)) {
          return collapsed ? (
            <div style={{ padding: '12px 8px', display: 'flex', justifyContent: 'center' }}>
              <div className="kaya-skeleton" style={{ width: 32, height: 32, borderRadius: 8 }} />
            </div>
          ) : (
            <div style={{ padding: '8px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="kaya-skeleton" style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
              <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div className="kaya-skeleton" style={{ height: 14, width: '60%', borderRadius: 4 }} />
                <div className="kaya-skeleton" style={{ height: 11, width: '42%', borderRadius: 4 }} />
              </div>
            </div>
          )
        }
        return (
          <AccountMenu
            name={displayName || "Account"}
            plan={planLabel}
            planWarning={planWarning}
            planType={planTypeLabel}
            credits={accountCredits}
            showUpgradePlan={!orgId || orgRole === 'admin'}
            viewPlanOnly={plan?.isEnterprise ?? false}
            email={user?.email ?? undefined}
            roleLabel={orgId && displayRole ? displayRole.charAt(0).toUpperCase() + displayRole.slice(1) : undefined}
            planStatusVariant={planStatusVariant}
            avatarSrc={user?.profilePicture ?? undefined}
            collapsed={collapsed}
            panelWidth={274}
            roleBadge={orgId && displayRole ? (
              <Tooltip content={orgBadgeSublabel} side="top" delayDuration={300}>
                <span style={{ display: 'inline-flex' }}>
                  <RoleBadge role={displayRole as WorkspaceRole} showLabel={false} mode="solar" />
                </span>
              </Tooltip>
            ) : undefined}
            placement="top-start"
            onUsage={() => push(SETTINGS_USAGE_ROUTE)}
            onUpgradePlan={() => push(ORG_PLANS_ROUTE)}
            onSettings={() => push(SETTINGS_ROUTE)}
            onOrganization={(orgId && orgRole === 'admin') ? () => push(ORG_GENERAL_ROUTE) : undefined}
            onHelp={() => push(SETTINGS_HELP_ROUTE)}
            onReportBug={() => setReportBugOpen(true)}
            onLogOut={() => guardedNavigate(() => { if (isAuthenticated) { void logout() } else { push(AUTH_LOGIN_ROUTE) } })}
          />
        )
      }}
      projectItems={orgId ? (
        <TeamsSidebarContent role={currentUserRole} />
      ) : (
        <ProjectsSection label="Projects" />
      )}
      recentItems={
        !user ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 0' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <SidebarMenuSkeleton key={i} index={i} fluid />
            ))}
          </div>
        ) : isPersonaPage ? (
          // Both accounts: persona list is in agentItems; recent agent chats go here as a second layer
          <RecentAgentChatsSection />
        ) : (
          // Both sections share sectionProps; StarredSection self-hides when empty.
          // Rendered on every other page — including project pages, whose own
          // "projects" body-section tab is separate from this "chats" one — so
          // Recent Chats is never silently hidden behind a disconnected placeholder.
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <StarredSection {...sectionProps} />
            <RecentsSection {...sectionProps} />
          </div>
        )
      }
    />
    {reportBugOpen && <ReportBugModal onClose={() => setReportBugOpen(false)} />}
    </>
  );
}

export function LeftSidebar(props: LeftSidebarProps) {
  return (
    <Suspense fallback={null}>
      <LeftSidebarImpl {...props} />
    </Suspense>
  );
}
