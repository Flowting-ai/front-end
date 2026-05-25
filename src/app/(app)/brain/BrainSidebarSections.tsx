'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { m } from 'framer-motion'
import { CalendarThreeIcon, FolderAddIcon } from '@strange-huge/icons'
import { SidebarMenuItem } from '@/components/SidebarMenuItem'
import { SidebarMenuSkeleton } from '@/components/SidebarMenuSkeleton'
import { SidebarProjectsSection } from '@/components/SidebarProjectsSection'
import { useProjects } from '@/context/projects-context'
import { listBrainChats, type BrainChatListItem } from '@/lib/api/brain'

// Section height collapse animation — matches LeftSidebar pattern
const sectionHeightVariants = {
  open: {
    height: 'auto' as const,
    transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] as const },
  },
  closed: {
    height: 0,
    transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as const, delay: 0.14 },
  },
}

// ── Brain Projects ────────────────────────────────────────────────────────────

function BrainProjectsSection() {
  const { push }   = useRouter()
  const pathname   = usePathname()
  const { projects, getChats } = useProjects()

  const [shown,       setShown]       = useState(true)
  const [overflow,    setOverflow]    = useState<'visible' | 'hidden'>('visible')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string, expanded: boolean) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      expanded ? next.add(id) : next.delete(id)
      return next
    })
  }

  return (
    <>
      <SidebarMenuItem
        fluid
        variant="header"
        label="Brain Projects"
        shown={shown}
        onShowClick={() => setShown(s => !s)}
      />
      <m.div
        animate={shown ? 'open' : 'closed'}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === 'closed') setOverflow('hidden') }}
        onAnimationComplete={(def) => { if (def === 'open') setOverflow('visible') }}
      >
        <div style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <SidebarMenuItem
            fluid
            variant="default"
            label="New project"
            icon={<FolderAddIcon size={20} />}
            onClick={() => push('/projects/new')}
          />

          {projects.length === 0 && (
            <div style={{
              padding:    '8px 6px',
              fontFamily: 'var(--font-body)',
              fontSize:   'var(--font-size-caption)',
              color:      'var(--neutral-400)',
            }}>
              No projects yet
            </div>
          )}

          {projects.slice(0, 5).map(project => {
            const isActive   = pathname.startsWith(`/project/${project.id}`)
            const isExpanded = expandedIds.has(project.id)
            const chats      = getChats(project.id)

            return (
              <SidebarProjectsSection
                key={project.id}
                fluid
                label={project.name}
                active={isActive}
                expanded={isExpanded}
                onClick={() => push(`/project/${project.id}`)}
                onExpandedChange={(v) => toggleExpand(project.id, v)}
              >
                {chats.slice(0, 5).map(chat => (
                  <SidebarMenuItem
                    key={chat.id}
                    fluid
                    variant="chat-item"
                    label={chat.title || 'Untitled'}
                    selected={false}
                    onClick={() => push(`/project/${project.id}/chat/${chat.id}`)}
                  />
                ))}
              </SidebarProjectsSection>
            )
          })}
        </div>
      </m.div>
    </>
  )
}

// ── Schedules ─────────────────────────────────────────────────────────────────

function BrainSchedulesSection({ isActive }: { isActive: boolean }) {
  const { push }  = useRouter()
  const [shown,    setShown]    = useState(true)
  const [overflow, setOverflow] = useState<'visible' | 'hidden'>('visible')

  return (
    <>
      <SidebarMenuItem
        fluid
        variant="header"
        label="Schedules"
        shown={shown}
        onShowClick={() => setShown(s => !s)}
      />
      <m.div
        animate={shown ? 'open' : 'closed'}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === 'closed') setOverflow('hidden') }}
        onAnimationComplete={(def) => { if (def === 'open') setOverflow('visible') }}
      >
        <div style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <SidebarMenuItem
            fluid
            variant="default"
            label="View schedules"
            icon={<CalendarThreeIcon size={20} />}
            selected={isActive}
            onClick={() => push('/brain/schedules')}
          />
        </div>
      </m.div>
    </>
  )
}

// ── Threads ───────────────────────────────────────────────────────────────────

interface BrainThreadsSectionProps {
  activeChatId:  string | null
  onThreadClick: (id: string) => void
}

function BrainThreadsSection({ activeChatId, onThreadClick }: BrainThreadsSectionProps) {
  const [shown,     setShown]     = useState(true)
  const [overflow,  setOverflow]  = useState<'visible' | 'hidden'>('visible')
  const [threads,   setThreads]   = useState<BrainChatListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    listBrainChats()
      .then(setThreads)
      .catch(() => setThreads([]))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <>
      <SidebarMenuItem
        fluid
        variant="header"
        label="Threads"
        shown={shown}
        onShowClick={() => setShown(s => !s)}
      />
      <m.div
        animate={shown ? 'open' : 'closed'}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === 'closed') setOverflow('hidden') }}
        onAnimationComplete={(def) => { if (def === 'open') setOverflow('visible') }}
      >
        <div style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {isLoading && Array.from({ length: 3 }).map((_, i) => (
            <SidebarMenuSkeleton key={i} fluid />
          ))}

          {!isLoading && threads.length === 0 && (
            <div style={{
              padding:    '8px 6px',
              fontFamily: 'var(--font-body)',
              fontSize:   'var(--font-size-caption)',
              color:      'var(--neutral-400)',
            }}>
              No threads yet
            </div>
          )}

          {!isLoading && threads.map(thread => (
            <SidebarMenuItem
              key={thread.id}
              fluid
              variant="chat-item"
              label={thread.chat_title || 'Untitled'}
              selected={thread.id === activeChatId}
              onClick={() => onThreadClick(thread.id)}
            />
          ))}
        </div>
      </m.div>
    </>
  )
}

// ── Combined export ───────────────────────────────────────────────────────────

export interface BrainSidebarSectionsProps {
  activeChatId:    string | null
  isSchedulesPage: boolean
  onThreadClick:   (id: string) => void
}

export function BrainSidebarSections({
  activeChatId,
  isSchedulesPage,
  onThreadClick,
}: BrainSidebarSectionsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <BrainProjectsSection />
      <BrainSchedulesSection isActive={isSchedulesPage} />
      <BrainThreadsSection activeChatId={activeChatId} onThreadClick={onThreadClick} />
    </div>
  )
}
