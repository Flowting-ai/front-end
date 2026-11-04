"use client";

import { usePathname } from "next/navigation";
import { useGuardedRouter } from "@/context/nav-guard-context";
import { CalendarThreeIcon, FolderLibraryIcon, LinkSixIcon, QuillWriteTwoIcon, UserAiIcon } from "@strange-huge/icons";
import { House, LayoutDashboard } from "lucide-react";
import { FlatSidebarRow, FlatSidebarSlackConnector } from "@/components/ui";
import { useOrg } from "@/context/org-context";
import { DASHBOARD_ROUTE, HOME_ROUTE, ORG_SOUVENIR_SLACK_ROUTE, AGENTS_ROUTE, SCHEDULES_ROUTE, LIBRARY_ROUTE, ORG_CONNECTORS_ROUTE } from "@/lib/routes";

// -- FlatDestinations — Home / Dashboard / New / Agents / Schedules / Connectors / Slack ---------
// Plain nav rows per the Figma scan (no expand arrows) — Agents/Schedules
// navigate straight to their pages rather than expanding an inline tree; see
// the open question in docs/features/sidebar-current-state-audit.md and the
// migration plan about confirming this against design before this ships.

interface FlatDestinationsProps {
  onNewChat: () => void
  newChatSelected: boolean
  collapsed?: boolean
  /** From the sidebar's Slack status query (read in LeftSidebarImpl so the reveal can wait for it). */
  slackConnected: boolean
}

export function FlatDestinations({ onNewChat, newChatSelected, collapsed = false, slackConnected }: FlatDestinationsProps) {
  const { push } = useGuardedRouter()
  const pathname = usePathname()
  const { currentUserRole } = useOrg()

  return (
    <>
      <FlatSidebarRow
        collapsed={collapsed} variant="default" icon={<House size={20} strokeWidth={1.75} aria-hidden />} label="Home"
        selected={pathname === HOME_ROUTE} href={HOME_ROUTE} onClick={() => push(HOME_ROUTE)}
      />
      <FlatSidebarRow
        collapsed={collapsed} variant="default" icon={<LayoutDashboard size={20} strokeWidth={1.75} aria-hidden />} label="Dashboard"
        selected={pathname.startsWith(DASHBOARD_ROUTE)} href={DASHBOARD_ROUTE} onClick={() => push(DASHBOARD_ROUTE)}
      />
      <FlatSidebarRow collapsed={collapsed} variant="default" icon={<QuillWriteTwoIcon size={20} animated />} label="New" selected={newChatSelected} onClick={onNewChat} />
      <FlatSidebarRow
        collapsed={collapsed} variant="default" icon={<UserAiIcon size={20} />} label="Agents"
        selected={pathname.startsWith(AGENTS_ROUTE)}
        href={AGENTS_ROUTE} onClick={() => push(AGENTS_ROUTE)}
      />
      <FlatSidebarRow
        collapsed={collapsed} variant="default" icon={<CalendarThreeIcon size={20} animated />} label="Schedules"
        selected={pathname.startsWith(SCHEDULES_ROUTE)} href={SCHEDULES_ROUTE} onClick={() => push(SCHEDULES_ROUTE)}
      />
      {/* Library: files uploaded to or made by Souvenir. */}
      <FlatSidebarRow
        collapsed={collapsed} variant="default" icon={<FolderLibraryIcon size={20} />} label="Library"
        selected={pathname.startsWith(LIBRARY_ROUTE)} href={LIBRARY_ROUTE} onClick={() => push(LIBRARY_ROUTE)}
      />
      <FlatSidebarRow
        collapsed={collapsed} variant="default" icon={<LinkSixIcon size={20} animated />} label="Connectors"
        selected={pathname.startsWith(ORG_CONNECTORS_ROUTE)}
        href={ORG_CONNECTORS_ROUTE} onClick={() => push(ORG_CONNECTORS_ROUTE)}
      />
      {/* "Souvenir in Slack" — own dedicated top-level page (moved from
          /org/souvenir-slack to /souvenir-slack). */}
      {/* Admin-only, matching the route guard in app/(app)/souvenir-slack/layout.tsx. */}
      {currentUserRole === 'admin' && (
        <FlatSidebarSlackConnector
          collapsed={collapsed}
          connected={slackConnected}
          selected={pathname.startsWith(ORG_SOUVENIR_SLACK_ROUTE)}
          onAdd={() => push(ORG_SOUVENIR_SLACK_ROUTE)}
          onClick={() => push(ORG_SOUVENIR_SLACK_ROUTE)}
        />
      )}
    </>
  )
}
