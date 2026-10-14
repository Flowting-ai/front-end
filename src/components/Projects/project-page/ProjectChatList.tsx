'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircleIcon, InformationCircleIcon } from '@strange-huge/icons'
import { openDeleteChatDialog } from '@/components/layout/AppDialogs'
import { teamChatsLoadingRows, withDividers } from '@/components/ProjectChatListSkeleton'
import { ProjectChatEmptyRow, ProjectChatRow } from '@/components/ProjectChatRow'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/Tabs'
import { Tooltip } from '@/components/Tooltip'
import { IconButton } from '@/components/ui/button'
import { useChatHistoryContext } from '@/context/chat-history-context'
import { usePinboard } from '@/context/pinboard-context'
import { useProjects, type Project } from '@/context/projects-context'
import type { ApiProjectChat } from '@/lib/api/projects'
import { PINS_ENABLED } from '@/lib/feature-flags'
import { PROJECT_CHAT_ROUTE } from '@/lib/routes'
import { formatRelativeTime } from '@/lib/utils/format-utils'
import type { OrgMember } from '@/types/teams'
import type { useProjectTeamChats } from './use-project-team-chats'

type TeamTab = 'personal' | 'publish'

// A line between the tooltip's two entries, light on its dark background (--tooltip-bg-*).
const tooltipDividerStyle: React.CSSProperties = { height: 1, backgroundColor: 'rgba(var(--surface-rgb), 0.15)' }
const tabPanelStyle: React.CSSProperties = { flex: '1 1 0', minHeight: 0, overflowY: 'auto', paddingTop: 24 }
const listStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 0, padding: 3 }

/**
 * The project's chats. Workspace and Shared projects get two tabs: "Your chats" (your own plus
 * everything published here, marked with a badge) and the published subset. Personal projects get a
 * flat list from useProjects(). Pin counts come from the pinboard, not the chat list endpoint.
 */
export function ProjectChatList({ project, viewerId, members, canPublish, team }: {
  project: Project
  viewerId: string | undefined
  members: OrgMember[]
  canPublish: boolean
  team: ReturnType<typeof useProjectTeamChats>
}) {
  const { push } = useRouter()
  const { getChats, renameChat, removeChat } = useProjects()
  const { pins, isLoading: pinsLoading, toggle: togglePinboard } = usePinboard()
  const chatHistory = useChatHistoryContext()
  const [activeTab, setActiveTab] = useState<TeamTab>('personal')
  const projectId = project.id
  const pinCount = (chatId: string) => (pinsLoading ? null : pins.filter(p => p.chatId === chatId).length)
  const onPinsClick = PINS_ENABLED ? () => togglePinboard() : undefined

  if (project.visibility === 'personal') {
    const chats = getChats(projectId)
    return (
      <div className="kaya-scrollbar" style={{ width: '100%', maxWidth: '679px', display: 'flex', flexDirection: 'column', gap: 0, flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: 3 }}>
        {chats.length === 0 ? <ProjectChatEmptyRow /> : withDividers(chats.map((chat) => (
          <ProjectChatRow
            key={chat.id}
            title={chat.title}
            timestamp={formatRelativeTime(chat.updatedAt)}
            pinCount={pinCount(chat.id)}
            onChatClick={() => push(PROJECT_CHAT_ROUTE(projectId, chat.id))}
            onPinsClick={onPinsClick}
            onRename={chat.canEdit ? (newTitle) => { renameChat(projectId, chat.id, newTitle); void chatHistory.rename(chat.id, newTitle) } : undefined}
            onDelete={chat.canEdit ? () => openDeleteChatDialog({ chatId: chat.id, chatTitle: chat.title, onConfirm: async () => { await removeChat(projectId, chat.id) } }) : undefined}
          />
        )))}
      </div>
    )
  }

  // "Shared chats" on a Shared project, "Workspace chats" on a Workspace one, and who sees them.
  const publishedTabLabel = project.visibility === 'workspace' ? 'Workspace chats' : 'Shared chats'
  const publishedAudienceLabel = project.visibility === 'workspace' ? 'all workspace members' : 'the members of this project'
  const publishedChats = team.teamChats.filter(c => c.visibility === 'team')

  // Other members' chats show who wrote them.
  const teamChatRow = (chat: ApiProjectChat) => (
    <ProjectChatRow
      key={chat.id}
      title={chat.chatTitle}
      timestamp={formatRelativeTime(chat.updatedAt)}
      pinCount={pinCount(chat.id)}
      author={chat.ownerUserId === viewerId ? undefined : (members.find(m => m.id === chat.ownerUserId)?.name ?? undefined)}
      canPublish={canPublish}
      published={chat.visibility === 'team'}
      onPublishToggle={(next) => { void team.publish(chat.id, next, publishedTabLabel).then(ok => { if (ok) setActiveTab('publish') }) }}
      onChatClick={() => push(PROJECT_CHAT_ROUTE(projectId, chat.id))}
      onPinsClick={onPinsClick}
      onRename={chat.canEdit ? (newTitle) => { void chatHistory.rename(chat.id, newTitle); team.rename(chat.id, newTitle) } : undefined}
      onDelete={chat.canEdit ? () => openDeleteChatDialog({
        chatId: chat.id,
        chatTitle: chat.chatTitle,
        onConfirm: async () => { await removeChat(projectId, chat.id); team.remove(chat.id) },
      }) : undefined}
    />
  )

  return (
    <div style={{ width: '100%', maxWidth: '679px', flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as TeamTab)} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0 }}>
        {/* Tabs centred: a 32px spacer balances the info button on the right. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px', justifyContent: 'center' }}>
          <div style={{ width: 32, flexShrink: 0 }} aria-hidden />
          <TabsList size="small">
            <TabsTrigger value="personal">Your chats</TabsTrigger>
            <TabsTrigger value="publish">
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {publishedTabLabel}
                {publishedChats.length > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px', backgroundColor: 'var(--blue-100)', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 9, color: 'var(--blue-700)', flexShrink: 0 }}>
                    {publishedChats.length}
                  </span>
                )}
              </span>
            </TabsTrigger>
          </TabsList>
          <Tooltip
            side="left"
            maxWidth={280}
            content={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div><b>Your chats</b> — your own chats here, plus what&apos;s published to {publishedAudienceLabel}.</div>
                <div style={tooltipDividerStyle} />
                <div><b>{publishedTabLabel}</b> — chats published here are visible to {publishedAudienceLabel}.</div>
              </div>
            }
          >
            <IconButton variant="ghost" size="sm" icon={<InformationCircleIcon size={18} />} aria-label="About these tabs" />
          </Tooltip>
        </div>

        <TabsContent value="personal" className="kaya-scrollbar" style={tabPanelStyle}>
          <div style={listStyle}>
            {team.loading ? teamChatsLoadingRows() : team.teamChats.length === 0 ? <ProjectChatEmptyRow /> : withDividers(team.teamChats.map(teamChatRow))}
          </div>
        </TabsContent>

        <TabsContent value="publish" className="kaya-scrollbar" style={tabPanelStyle}>
          <div style={listStyle}>
            {team.loading ? teamChatsLoadingRows() : publishedChats.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 4px', color: 'var(--neutral-500)' }}>
                <AlertCircleIcon size={16} />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 14 }}>
                  {canPublish ? `Hover a chat under “Your chats” to publish it to ${publishedAudienceLabel}.` : `No chats have been published to ${publishedAudienceLabel} yet.`}
                </span>
              </div>
            ) : withDividers(publishedChats.map(teamChatRow))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
