'use client'

import React, { Suspense, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { AnimatePresence, m } from 'framer-motion'
import { useRouter, usePathname } from 'next/navigation'
import { QuestionCard } from '@/components/QuestionCard'
import {
  UserAiIcon,
  AiIdeaIcon,
  FolderLibraryIcon,
  CancelOneIcon,
  ExpandIcon,
  ArrowShrinkTwoIcon,
} from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Button } from '@/components/Button'
import { FloatingMenu } from '@/components/FloatingMenu'
import { FloatingMenuItem } from '@/components/FloatingMenuItem'
import { Badge } from '@/components/Badge'
import { InformationCircleIcon } from '@strange-huge/icons'
import { ChatInput } from '@/components/ChatInput'
import { ChatAddMenu } from '@/components/chat/AddMenu'
import { AttachmentManager } from '@/components/chat/AttachmentManager'
import { ConnectPromptCard, PermissionPromptCard } from '@/components/chat/ConnectorPrompts'
import { ActivitiesSection } from '@/components/chat/ActivityRow'
import { BreathingDot } from '@/components/BreathingDot'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { MessageBubble } from '@/components/MessageBubble'
import { StreamingMessageBubble } from '@/templates/Brain/StreamingMessageBubble'
import { PersonaConfigureProvider, usePersonaConfigure } from './context'
import { getAllVersionTags } from '@/lib/version-tags'
import { deleteVersion } from '@/lib/api/personas'
import { respondToChatPrompt } from '@/lib/api/chat'
import { toast } from 'sonner'

// ── Tag color map (matches Chip/Pinboard design tokens) ──────────────────────

const TAG_COLORS: Record<string, { bg: string; text: string; shadow: string }> = {
  Instructions: { bg: 'var(--color-tag-Blue-bg)',    text: 'var(--color-tag-Blue-text)',    shadow: 'var(--color-tag-Blue-shadow)' },
  Model:        { bg: 'var(--color-tag-Purple-bg)',  text: 'var(--color-tag-Purple-text)',  shadow: 'var(--color-tag-Purple-shadow)' },
  Profile:      { bg: 'var(--color-tag-Green-bg-soft)', text: 'var(--color-tag-Green-text)', shadow: 'var(--color-tag-Green-shadow)' },
  Knowledge:    { bg: 'var(--color-tag-Yellow-bg)',  text: 'var(--color-tag-Yellow-text)',  shadow: 'var(--color-tag-Yellow-shadow)' },
  Connectors:   { bg: 'var(--color-tag-Brown-bg)',   text: 'var(--color-tag-Brown-text)',   shadow: 'var(--color-tag-Brown-shadow)' },
  Sharing:      { bg: 'var(--color-tag-Red-bg)',     text: 'var(--color-tag-Red-text)',     shadow: 'var(--color-tag-Red-shadow)' },
}
const DEFAULT_TAG_COLOR = { bg: 'var(--color-tag-Neutral-bg)', text: 'var(--color-tag-Neutral-text)', shadow: 'var(--color-tag-Neutral-shadow)' }

// ── Per-tab help content ──────────────────────────────────────────────────────

type HelpItem = { heading: string; description: string; isRequired?: boolean; highlightId?: string }

// Floating panel items are available on all 5 configure tabs
const PANEL_ITEMS: HelpItem[] = [
  { heading: 'Test Chat',      description: 'Open a live chat to test your agent before publishing. See exactly how it responds to real questions in real time.',           highlightId: 'help-test-chat'      },
  { heading: 'AI Suggestions', description: 'Ask AI for tips on improving your system instruction, tone, or coverage. The AI reads your current draft before advising.',   highlightId: 'help-ai-suggestions' },
  { heading: 'Versions',       description: 'Browse all saved versions of this agent and restore any previous state with one click. Versions are created via Save Version.', highlightId: 'help-versions'       },
]

const TAB_HELP: Record<string, { title: string; items: HelpItem[] }> = {
  instructions: {
    title: 'Instructions',
    // Order mirrors the on-page layout: model dropdown → instruction → temperature → examples → action buttons
    items: [
      { heading: 'Model',                description: 'Choose the AI engine that powers this agent. Different models suit different tasks — some excel at reasoning, others at writing or speed.',              isRequired: false, highlightId: 'help-model'        },
      { heading: 'System Instruction',   description: 'Tell the agent who it is and how to behave. Describe its role, tone, expertise, and any limits. The more specific you are, the better it performs.',   isRequired: true,  highlightId: 'help-instruction'  },
      { heading: 'Creativity Level',     description: 'Controls how varied the responses are. Low = precise and consistent. High = imaginative and varied. 0.5 is a good starting point for most agents.',    isRequired: false, highlightId: 'help-temperature'  },
      { heading: 'Example Conversations',description: 'Add sample exchanges to show the agent exactly how it should respond. Even 2–3 good examples dramatically improve response quality.',                   isRequired: false, highlightId: 'help-examples'     },
      { heading: 'Save Version',         description: 'Creates a named checkpoint of your current instruction, model, and settings. Restore any version at any time from the Versions panel on the right.',   highlightId: 'help-save-version'  },
      { heading: 'Publish',              description: 'Makes this agent live for your team. Once published, teammates can add it from the library or mention it in any conversation.',                         highlightId: 'help-publish'       },
    ],
  },
  profile: {
    title: 'Profile',
    // Order mirrors the on-page layout: avatar → name → handle → description → tags
    items: [
      { heading: 'Avatar',      description: 'Upload an image to give the agent a distinct look. If no image is uploaded, the agent shows its initials as a fallback.',                                isRequired: false, highlightId: 'help-profile-avatar'      },
      { heading: 'Name',        description: 'How the agent appears in the library, search, and at the top of chats. Use a clear, role-specific name like "HR Policy Assistant" or "Code Reviewer".', isRequired: true,  highlightId: 'help-profile-name'        },
      { heading: 'Handle',      description: 'A unique @username for the agent. Used to reference or mention it directly in conversations.',                                                           isRequired: false, highlightId: 'help-profile-handle'      },
      { heading: 'Description', description: "A short summary shown on the agent's library card. One sentence explaining what it does and who it is for.",                                             isRequired: false, highlightId: 'help-profile-description' },
      { heading: 'Tags',        description: "Help teammates discover this agent when filtering or browsing the library. Add tags that reflect the agent's role or domain.",                            isRequired: false, highlightId: 'help-profile-tags'        },
    ],
  },
  knowledge: {
    title: 'Knowledge',
    items: [
      { heading: 'Uploaded Files',  description: 'Add documents, PDFs, spreadsheets, or images the agent should know about. It references this content when answering questions.', isRequired: false, highlightId: 'help-knowledge-upload' },
      { heading: 'Add a URL',       description: 'Paste a webpage address to import its content as knowledge. Useful for documentation pages, FAQs, or product info.',             isRequired: false, highlightId: 'help-knowledge-url'    },
      { heading: 'File Limits',     description: 'Up to 30 MB per file and 300 MB total. Remove files you no longer need to free up space.' },
      { heading: 'Supported Types', description: 'PDF, Word, Excel, PowerPoint, CSV, plain text, Markdown, images, and more — the same file types supported in chat.' },
      { heading: 'Version-specific', description: 'Knowledge is tied to the current version. Each saved version can have its own distinct set of files.' },
    ],
  },
  connectors: {
    title: 'Connectors',
    items: [
      { heading: 'Enabled for this Persona',  description: 'All connectors active in Settings are enabled for this persona by default. Toggling one off disables it only for this persona — your account connection stays intact.', isRequired: false, highlightId: 'help-connectors-enabled'  },
      { heading: 'Disabled for this Persona', description: 'Connectors you have turned off for this persona appear here. Toggle them back on at any time to re-enable them.',                                                         isRequired: false, highlightId: 'help-connectors-disabled' },
      { heading: 'Connect New Tools',         description: 'Use "Manage in Settings" to link accounts like Gmail, Slack, or HubSpot. Once connected they are automatically enabled for all personas.' },
      { heading: 'How Agents Use Connectors', description: 'When the agent needs to take action — send an email, update a task — it uses the enabled connectors automatically during the conversation.' },
      { heading: 'Per-Agent Isolation',       description: 'Each agent has its own connector settings. Disabling a tool for one persona does not affect any other persona or your account.' },
    ],
  },
  sharing: {
    title: 'Sharing',
    items: [
      { heading: 'Visibility Level', description: 'Controls who can discover and access this agent — private (only you), team (workspace members), or public (anyone with the link). Set this before sharing.', isRequired: false, highlightId: 'help-sharing-visibility' },
      { heading: 'Super Link',       description: 'A shareable URL anyone can use to chat with this agent without an account. Ideal for external users, clients, or public-facing tools.',                      isRequired: false, highlightId: 'help-sharing-superlink' },
      { heading: 'Credit Limit (for Super Link)', description: 'Caps how many credits each Super Link user can consume. Set a limit to prevent unexpected overuse. Super Link must be enabled first.', isRequired: false, highlightId: 'help-sharing-token'     },
      { heading: 'Email Invite',     description: 'Send a personalised link to a specific email address. Only that recipient can access the agent via this link.',                                               isRequired: false, highlightId: 'help-sharing-email'     },
      { heading: 'Revoking Access',  description: 'Disable any Super Link or email invite from this tab at any time. Access is cut off immediately.' },
      { heading: 'Publish First',    description: 'The agent must be published before sharing works. Hit Publish on the Instructions tab to make it live, then return here to share.', highlightId: 'help-publish' },
    ],
  },
}

// ── Help button + info panel ──────────────────────────────────────────────────

// ── Shared help logic hook ────────────────────────────────────────────────────

const ALL_CONFIGURE_TABS   = ['instructions', 'profile', 'knowledge', 'connectors', 'sharing'] as const
const ALL_CONFIGURE_LABELS = ['Instructions', 'Profile', 'Knowledge', 'Connectors', 'Sharing']
const PANEL_IDS            = new Set(PANEL_ITEMS.map(it => it.highlightId))

function useHelpState(pathname: string) {
  const { helpOpen, setHelpOpen, helpActiveId, setHelpActiveId } = usePersonaConfigure()

  const tabKey   = pathname.split('/configure/')[1]?.split('?')[0] ?? 'instructions'
  const tabIndex = ALL_CONFIGURE_TABS.indexOf(tabKey as typeof ALL_CONFIGURE_TABS[number])
  const helpData = TAB_HELP[tabKey] ?? TAB_HELP.instructions
  const tabItemIds = helpData.items.map((it, i) => it.highlightId ?? `${tabKey}-item-${i}`)

  const isPanelActive = PANEL_IDS.has(helpActiveId)

  // Reset on tab switch
  useEffect(() => {
    setHelpOpen(false)
    const nd = TAB_HELP[tabKey] ?? TAB_HELP.instructions
    setHelpActiveId(nd.items[0]?.highlightId ?? `${tabKey}-item-0`)
  }, [tabKey, setHelpOpen, setHelpActiveId])

  // Scroll to highlighted element
  useEffect(() => {
    if (!helpOpen || !helpActiveId) return
    const el = document.querySelector(`[data-help-id="${helpActiveId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [helpActiveId, helpOpen])

  const titleBadge = tabKey === 'instructions'
    ? { label: 'Required', color: 'Blue'    as const }
    : { label: 'Optional', color: 'Neutral' as const }

  return { helpOpen, setHelpOpen, helpActiveId, setHelpActiveId, tabKey, tabIndex, helpData, tabItemIds, isPanelActive, titleBadge }
}

// ── Help trigger button + main tab info card (bottom-left) ────────────────────

function PersonaHelpButton() {
  const pathname = usePathname()
  const { helpOpen, setHelpOpen, helpActiveId, setHelpActiveId, tabKey, tabIndex, helpData, tabItemIds, isPanelActive, titleBadge } = useHelpState(pathname)
  const { setTestChatOpen, setAiSuggestOpen, setVersionsOpen } = usePersonaConfigure()

  const [activeInfoTab, setActiveInfoTab] = useState<'main' | 'panels'>('main')
  // Remembers whether the sidebar was open when help opened so we can restore it on close.
  const sidebarWasOpenRef = useRef(false)

  // Collapse sidebar on open, restore on close.
  // LeftSidebar persists state in localStorage and listens for Ctrl+B on document.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isCollapsed = () => localStorage.getItem('sidebar_collapsed') === 'true'

    if (helpOpen) {
      setActiveInfoTab('main')
      sidebarWasOpenRef.current = !isCollapsed()
      if (sidebarWasOpenRef.current) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true, cancelable: true }))
      }
    } else {
      // Restore sidebar only if it was open before we collapsed it
      if (sidebarWasOpenRef.current && isCollapsed()) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true, cancelable: true }))
      }
    }
  }, [helpOpen])

  function openPanelById(id: string) {
    setTestChatOpen(id === 'help-test-chat')
    setAiSuggestOpen(id === 'help-ai-suggestions')
    setVersionsOpen(id === 'help-versions')
  }

  function handleTabChange(tab: string) {
    const t = tab as 'main' | 'panels'
    setActiveInfoTab(t)
    if (t === 'panels') {
      const firstId = PANEL_ITEMS[0].highlightId!
      setHelpActiveId(firstId)
      openPanelById(firstId)
    } else {
      setHelpActiveId(tabItemIds[0])
    }
  }

  const isMain = activeInfoTab === 'main'

  const cardOptions = isMain
    ? helpData.items.map((it, i) => ({ id: tabItemIds[i], label: it.heading, description: it.description }))
    : PANEL_ITEMS.map(it => ({ id: it.highlightId!, label: it.heading, description: it.description }))

  const cardQuestion    = isMain ? helpData.title : 'Panels'
  const cardTitleBadge  = isMain ? titleBadge : undefined
  const cardTabProgress = isMain
    ? { tabs: ALL_CONFIGURE_LABELS, currentIndex: tabIndex >= 0 ? tabIndex : 0 }
    : undefined

  function handleSelect(id: string) {
    setHelpActiveId(id)
    if (!isMain) openPanelById(id)
  }

  const tabSwitcher = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Tabs value={activeInfoTab} onValueChange={handleTabChange}>
        <TabsList size="small">
          <TabsTrigger value="main">Main</TabsTrigger>
          <TabsTrigger value="panels">Panels</TabsTrigger>
        </TabsList>
      </Tabs>
      <IconButton
        size="xs"
        variant="ghost"
        aria-label="Close help"
        icon={<CancelOneIcon size={18} />}
        onClick={() => setHelpOpen(false)}
      />
    </div>
  )

  return (
    <div style={{ position: 'absolute', bottom: 20, left: 16, zIndex: 20 }}>
      {/* Highlight active element + elevate it above the overlay */}
      {helpOpen && helpActiveId && (
        <style>{`
          [data-help-id="${helpActiveId}"] {
            outline: 2.5px solid rgba(110,152,203,0.85) !important;
            outline-offset: ${isPanelActive ? '0px' : '5px'} !important;
            background-color: white !important;
            border-radius: 5px !important;
            box-shadow: 0 0 0 ${isPanelActive ? '0px' : '5px'} white !important;
            ${!isPanelActive ? 'position: relative !important; z-index: 18 !important;' : ''}
          }
          ${isPanelActive ? '[data-panel-container] { z-index: 19 !important; }' : ''}
          ${isPanelActive ? `[data-help-panel="${helpActiveId}"] { position: relative !important; z-index: 18 !important; outline: 2.5px solid rgba(110,152,203,0.85) !important; outline-offset: 0px !important; border-radius: 16px !important; }` : ''}
        `}</style>
      )}

      {/* Dark spotlight overlay — dims everything except the highlighted element */}
      {helpOpen && helpActiveId && typeof document !== 'undefined' && createPortal(
        <div
          aria-hidden
          style={{
            position:        'fixed',
            inset:           0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            zIndex:          17,
            pointerEvents:   'none',
          }}
        />,
        document.body,
      )}

      <AnimatePresence>
        {helpOpen && (
          <m.div
            key="help-main-card"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } }}
            exit={{ opacity: 0, y: 6, scale: 0.97, transition: { duration: 0.12, ease: 'easeIn' } }}
            style={{ position: 'absolute', bottom: 48, left: 0, width: 320, maxWidth: 'calc(50vw - 32px)' }}
          >
            <QuestionCard
              question={cardQuestion}
              type="info"
              options={cardOptions}
              selected={helpActiveId}
              onSelect={handleSelect}
              titleBadge={cardTitleBadge}
              tabProgress={cardTabProgress}
              topSlot={tabSwitcher}
              onClose={() => setHelpOpen(false)}
              style={{ maxWidth: '100%' }}
            />
          </m.div>
        )}
      </AnimatePresence>

      <span style={{ backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', borderRadius: 10, display: 'inline-flex' }}>
        <IconButton
          variant="outline"
          size="md"
          aria-label={helpOpen ? 'Close help' : `Help — ${helpData.title}`}
          aria-expanded={helpOpen}
          icon={<InformationCircleIcon size={20} animated />}
          onClick={() => setHelpOpen(!helpOpen)}
        />
      </span>
    </div>
  )
}

// ── Panels island (anchored to the left of the floating menu) ─────────────────

function PersonaPanelIsland() {
  const pathname = usePathname()
  const { toggleTestChat, toggleAiSuggest, toggleVersions } = usePersonaConfigure()
  const { helpOpen, helpActiveId, setHelpActiveId, tabKey } = useHelpState(pathname)

  // Keep island in sync when tab changes (helpOpen is already reset in useHelpState)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- effect runs via useHelpState
  if (!helpOpen) return null

  return (
    /* Outer div owns the absolute position + translateY so Framer Motion
       doesn't conflict with the centering transform on the m.div below. */
    <div style={{ position: 'absolute', right: 74, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
    <AnimatePresence>
      <m.div
        key={`panel-island-${tabKey}`}
        initial={{ opacity: 0, x: 8, scale: 0.97 }}
        animate={{ opacity: 1, x: 0, scale: 1, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } }}
        exit={{ opacity: 0, x: 8, scale: 0.97, transition: { duration: 0.12, ease: 'easeIn' } }}
        style={{
          backgroundColor: 'var(--neutral-white)',
          borderRadius:    16,
          padding:         '10px 10px',
          boxShadow:       '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(59,54,50,0.1)',
          display:         'flex',
          flexDirection:   'column',
          gap:             2,
          width:           260,
        }}
      >
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 10, lineHeight: '14px', color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px 6px' }}>
          Panels
        </p>
        {PANEL_ITEMS.map((it, i) => {
          const isActive = helpActiveId === it.highlightId
          function handlePanelClick() {
            setHelpActiveId(it.highlightId!)
            if      (it.highlightId === 'help-test-chat')       toggleTestChat()
            else if (it.highlightId === 'help-ai-suggestions')  toggleAiSuggest()
            else if (it.highlightId === 'help-versions')        toggleVersions()
          }
          return (
            <button
              key={it.highlightId}
              type="button"
              onClick={handlePanelClick}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 8px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left', backgroundColor: isActive ? 'rgba(110,152,203,0.08)' : 'transparent', boxShadow: isActive ? '0 0 0 1.5px rgba(110,152,203,0.35)' : 'none', transition: 'background-color 150ms, box-shadow 150ms', width: '100%' }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--neutral-50)' }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
            >
              <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isActive ? '#6e98cb' : 'var(--neutral-100)', boxShadow: isActive ? '0 0 0 1px rgba(110,152,203,0.5)' : '0 0 0 1px var(--neutral-200)', marginTop: 1, transition: 'background-color 150ms' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 11, lineHeight: '11px', display: 'block', textAlign: 'center', color: isActive ? 'white' : 'var(--neutral-500)', userSelect: 'none' }}>
                  {i + 1}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
                <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, lineHeight: '18px', color: isActive ? '#3b6fa8' : 'var(--neutral-900)', transition: 'color 150ms' }}>{it.heading}</span>
                <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '17px', color: 'var(--neutral-600)' }}>{it.description}</span>
              </div>
            </button>
          )
        })}
      </m.div>
    </AnimatePresence>
    </div>
  )
}

// ── Configure progress indicator (A) ─────────────────────────────────────────

function ConfigureProgress() {
  const { personaInfo, knowledgeFileCount, hasShareLink } = usePersonaConfigure()

  const required: { label: string; done: boolean }[] = [
    { label: 'Instructions', done: personaInfo.guidePrompt.trim().length > 0 },
  ]

  const optional: { label: string; done: boolean }[] = [
    { label: 'Profile',    done: personaInfo.imageUrl !== null },
    { label: 'Knowledge',  done: knowledgeFileCount > 0 },
    { label: 'Connectors', done: personaInfo.connectorSlugs.length > 0 },
    { label: 'Sharing',    done: hasShareLink },
  ]

  const anyDone = required.some(s => s.done) || optional.some(s => s.done)
  if (!anyDone) return null

  const dotStyle = (done: boolean): React.CSSProperties => ({
    width:           7,
    height:          7,
    borderRadius:    '50%',
    backgroundColor: done ? '#6e98cb' : 'var(--neutral-300)',
    flexShrink:      0,
    transition:      'background-color 400ms',
  })

  const labelStyle = (done: boolean): React.CSSProperties => ({
    fontFamily: 'var(--font-body)',
    fontSize:   11,
    lineHeight: '16px',
    fontWeight: done ? 500 : 400,
    color:      done ? '#6e98cb' : 'var(--neutral-400)',
    whiteSpace: 'nowrap',
    transition: 'color 400ms',
  })

  const connectorStyle = (done: boolean): React.CSSProperties => ({
    width:           16,
    height:          1,
    backgroundColor: done ? 'rgba(110,152,203,0.4)' : 'var(--neutral-200)',
    flexShrink:      0,
    transition:      'background-color 400ms',
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '2px 12px', flexShrink: 0 }}>

      {/* Required group */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Badge color="Blue" label="Required" />
        {required.map(step => (
          <React.Fragment key={step.label}>
            <div style={connectorStyle(step.done)} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={dotStyle(step.done)} />
              <span style={labelStyle(step.done)}>{step.label}</span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 14, backgroundColor: 'var(--neutral-200)', flexShrink: 0 }} />

      {/* Optional group */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Badge color="Neutral" label="Optional" />
        {optional.map((step, i) => (
          <React.Fragment key={step.label}>
            {i >= 0 && <div style={connectorStyle(step.done)} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={dotStyle(step.done)} />
              <span style={labelStyle(step.done)}>{step.label}</span>
            </div>
          </React.Fragment>
        ))}
      </div>

    </div>
  )
}

// ── Floating menu ─────────────────────────────────────────────────────────────

function PersonaFloatingMenu() {
  const { testChatOpen, toggleTestChat, aiSuggestOpen, toggleAiSuggest, versionsOpen, toggleVersions } = usePersonaConfigure()
  return (
    <FloatingMenu aria-label="Configure actions">
      <FloatingMenuItem
        icon={<UserAiIcon size={20} animated />}
        label="Test Chat"
        active={testChatOpen}
        onClick={toggleTestChat}
        data-help-id="help-test-chat"
      />
      <FloatingMenuItem
        icon={<AiIdeaIcon size={20} animated />}
        label="AI Suggestions"
        active={aiSuggestOpen}
        onClick={toggleAiSuggest}
        data-help-id="help-ai-suggestions"
      />
      <FloatingMenuItem
        icon={<FolderLibraryIcon size={20} animated />}
        label="Versions"
        active={versionsOpen}
        onClick={toggleVersions}
        data-help-id="help-versions"
      />
    </FloatingMenu>
  )
}

// ── Test chat panel ───────────────────────────────────────────────────────────

function formatVersionDate(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

function nameInitials(name: string) {
  return (name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function TestChatPanelContent({ expanded }: { expanded: boolean }) {
  const {
    personaInfo, setTestChatExpanded, setTestChatOpen,
    chatMessages, isStreaming, chatScrollRef, handleTestChatSend,
    testChatWebSearch, setTestChatWebSearch, testChatStyleId, setTestChatStyleId,
    testChatFolders, setTestChatFolders, testChatPersonaId, setTestChatPersonaId,
    testChatAttachments, setTestChatAttachments, handleTestChatAddFiles, handleTestChatFileChange,
    testChatFileInputRef, FILE_ACCEPT,
    versions,
  } = usePersonaConfigure()
  const { repoId, versionId, personaName, imageUrl, guideModelName } = personaInfo
  const hasSavedVersion = versions.length > 0

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: '1 1 0', minWidth: 0, overflow: 'hidden' }}>
          <div style={{ position: 'relative', width: 36, height: 36, borderRadius: 10, flexShrink: 0, backgroundColor: 'var(--neutral-100)', boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)', overflow: 'hidden' }}>
            {imageUrl && <Image src={imageUrl} alt="" fill sizes="36px" style={{ objectFit: 'cover' }} unoptimized />}
          </div>
          <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {personaName || 'Name'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {expanded
            ? <IconButton variant="outline" size="md" icon={<ArrowShrinkTwoIcon size={20} />} aria-label="Collapse test chat" onClick={() => setTestChatExpanded(false)} />
            : <IconButton variant="outline" size="md" icon={<ExpandIcon size={20} />} aria-label="Expand test chat" onClick={() => setTestChatExpanded(true)} />
          }
          <IconButton variant="outline" size="md" icon={<CancelOneIcon size={20} />} aria-label="Close test chat" onClick={() => { setTestChatOpen(false); setTestChatExpanded(false) }} />
        </div>
      </div>

      {/* Messages */}
      <div ref={chatScrollRef} className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 8px' }}>
        {chatMessages.length === 0 ? (
          !hasSavedVersion ? (
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-400)', margin: 0 }}>
              Save a version first to test your agent here.
            </p>
          ) : (
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-600)', margin: 0 }}>
              Hi! I&apos;m your agent. Test me here while you configure.
            </p>
          )
        ) : (
          chatMessages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.role === 'assistant' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                  {msg.activities && msg.activities.length > 0 && <ActivitiesSection activities={msg.activities} />}
                  {msg.isStreaming && !msg.text && (
                    <BreathingDot size="md" style={{ marginLeft: 4, backgroundColor: 'var(--neutral-400)' }} />
                  )}
                  {msg.text && <StreamingMessageBubble content={msg.text} isComplete={!msg.isStreaming} />}
                  {msg.connectPrompts?.map(p => <ConnectPromptCard key={p.request_id} prompt={p} />)}
                  {msg.permissionPrompts?.map(p => (
                    <PermissionPromptCard
                      key={p.request_id}
                      prompt={p}
                      skipSave
                      onDecided={(policy) => { respondToChatPrompt(p.request_id, policy, p.respond_url).catch(() => {}) }}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                      {msg.attachments.map((att, i) => (
                        <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 8, backgroundColor: 'rgba(59,54,50,0.07)', border: '1px solid rgba(59,54,50,0.10)', maxWidth: 200 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--neutral-500)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            {att.mime_type.startsWith('image/') ? (
                              <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>
                            ) : (
                              <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>
                            )}
                          </svg>
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500, color: 'var(--neutral-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {att.file_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <MessageBubble role={msg.role} content={msg.text} maxWidth="85%" hideActions />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0 }}>
        <input
          ref={testChatFileInputRef}
          type="file"
          multiple
          accept={FILE_ACCEPT}
          onChange={handleTestChatFileChange}
          style={{ display: 'none' }}
          aria-hidden="true"
        />
        <ChatInput
          placeholder="Test your agent..."
          textareaLabel="Test message"
          modelName={guideModelName}
          hideModelSelector
          webSearch={testChatWebSearch}
          onWebSearchChange={setTestChatWebSearch}
          addMenu={
            <ChatAddMenu
              webSearchEnabled={testChatWebSearch}
              onWebSearchChange={setTestChatWebSearch}
              onAddFilesClick={handleTestChatAddFiles}
              selectedStyleId={testChatStyleId}
              onStyleChange={setTestChatStyleId}
              selectedFolders={testChatFolders}
              onFolderToggle={(folder) => setTestChatFolders(prev =>
                prev.some(f => f.id === folder.id) ? prev.filter(f => f.id !== folder.id) : [...prev, folder]
              )}
              selectedPersonaId={testChatPersonaId}
              onPersonaChange={(p) => setTestChatPersonaId(p?.id ?? null)}
            />
          }
          attachmentsSlot={
            <AttachmentManager
              attachments={testChatAttachments}
              onAttachmentsChange={setTestChatAttachments}
            />
          }
          onSend={handleTestChatSend}
        />
      </div>
    </>
  )
}

// ── AI suggestions panel content ──────────────────────────────────────────────

function AiSuggestPanelContent({ expanded }: { expanded: boolean }) {
  const {
    personaInfo, setGuideExpanded, setAiSuggestOpen,
    guideMessages, guideIsStreaming, guideScrollRef, handleGuideSend,
  } = usePersonaConfigure()

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: '1 1 0', minWidth: 0, overflow: 'hidden' }}>
          <AiIdeaIcon size={20} color="var(--neutral-700)" animated />
          <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>AI suggestions</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {expanded
            ? <IconButton variant="outline" size="md" icon={<ArrowShrinkTwoIcon size={20} />} aria-label="Collapse AI suggestions" onClick={() => setGuideExpanded(false)} />
            : <IconButton variant="outline" size="md" icon={<ExpandIcon size={20} />} aria-label="Expand AI suggestions" onClick={() => setGuideExpanded(true)} />
          }
          <IconButton variant="outline" size="md" icon={<CancelOneIcon size={20} />} aria-label="Close AI suggestions" onClick={() => { setAiSuggestOpen(false); setGuideExpanded(false) }} />
        </div>
      </div>
      <div ref={guideScrollRef} className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 8px' }}>
        {guideMessages.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
            Ask me anything about improving your agent — I&apos;ll review your current draft and give you tailored advice.
          </p>
        ) : (
          guideMessages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.role === 'assistant' ? (
                <StreamingMessageBubble content={msg.text} isComplete={!msg.isStreaming} />
              ) : (
                <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: 12, backgroundColor: 'var(--neutral-100)', fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', wordBreak: 'break-word' }}>
                  {msg.text}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <div style={{ flexShrink: 0 }}>
        <ChatInput
          placeholder="Ask for guidance…"
          textareaLabel="Ask for AI guidance"
          modelName={personaInfo.guideModelName}
          hideModelSelector
          onSend={handleGuideSend}
        />
      </div>
    </>
  )
}

// ── Versions panel ────────────────────────────────────────────────────────────

function VersionsPanel() {
  const {
    personaInfo, setVersionsOpen,
    versions, versionsLoading, restoringId, handleRestoreVersion,
    pendingChangeTags, refreshVersions,
  } = usePersonaConfigure()
  const { versionId, personaName, repoId } = personaInfo
  // Read all version tags from localStorage (client-only)
  const allVersionTags = typeof window !== 'undefined' ? getAllVersionTags() : {}
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  async function handleDeleteVersion(id: string) {
    if (!repoId || deletingId) return
    setDeletingId(id)
    try {
      await deleteVersion(repoId, id)
      toast.success('Version deleted')
      refreshVersions()
    } catch (err) {
      console.error('[VersionsPanel] delete error:', err)
      toast.error('Failed to delete version')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <m.div
      key="versions-panel"
      data-help-panel="help-versions"
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 400, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 32, mass: 0.9 }}
      style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', paddingLeft: 5, paddingRight: 5, paddingTop: 12, paddingBottom: 12, overflow: 'hidden', backgroundColor: 'var(--neutral-white)', borderRadius: 16 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
            <FolderLibraryIcon size={20} color="var(--neutral-700)" animated />
          </div>
          <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0, whiteSpace: 'nowrap' }}>
            Versions
          </p>
        </div>
        <IconButton variant="outline" size="md" icon={<CancelOneIcon size={20} />} aria-label="Close versions" onClick={() => setVersionsOpen(false)} />
      </div>

      {/* ── Pending changes indicator ── */}
      {pendingChangeTags.length > 0 && (
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', borderRadius: 12, backgroundColor: 'var(--blue-50, #eff6ff)', border: '1px solid var(--blue-200, #bfdbfe)' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', color: 'var(--blue-600, #2563eb)', margin: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Unsaved changes</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {pendingChangeTags.map(tag => {
              const c = TAG_COLORS[tag] ?? DEFAULT_TAG_COLOR
              return (
                <span
                  key={tag}
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '2px 8px', borderRadius: 6,
                    fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px',
                    color: c.text,
                    backgroundColor: c.bg,
                    boxShadow: c.shadow,
                  }}
                >
                  {tag}
                </span>
              )
            })}
          </div>
        </div>
      )}

      <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: 3 }}>
        {versionsLoading ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', margin: 0 }}>Loading…</p>
        ) : versions.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', margin: '24px 0', textAlign: 'center' }}>
            No versions yet. Use &ldquo;Save version&rdquo; to create one.
          </p>
        ) : versions.map((v, i) => {
          const isCurrent = v.id === versionId
          const vNum      = versions.length - i
          const vLabel    = `v${String(vNum).padStart(3, '0')}`
          const handle    = v.handler ? `@${v.handler}\u00b7${vLabel}` : vLabel
          const dateStr   = formatVersionDate(v.created_at)
          const initials  = nameInitials(v.name || personaName)
          const changeTags = allVersionTags[v.id] ?? []
          return (
            <div
              key={v.id}
              style={{
                display: 'flex', flexDirection: 'column', gap: 9, padding: 12, borderRadius: 16, flexShrink: 0,
                backgroundColor: isCurrent ? 'var(--neutral-white)' : 'var(--neutral-50)',
                border:          isCurrent ? 'none' : '1px dashed var(--neutral-300)',
                boxShadow:       isCurrent ? '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)' : 'none',
              }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%' }}>
                <div style={{ width: 37, height: 37, borderRadius: 8, flexShrink: 0, backgroundColor: 'var(--neutral-100)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 1.091px 1.09px 0px rgba(59,54,50,0.05), 0px 1.455px 1px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--neutral-600)', lineHeight: 1 }}>{initials}</span>
                </div>
                <div style={{ flex: '1 0 0', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', whiteSpace: 'nowrap', width: '100%', gap: 8 }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '55%' }}>
                      {v.name || personaName}
                    </p>
                    <p style={{ fontFamily: 'monospace', fontWeight: 400, fontSize: 13, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0, flexShrink: 0 }}>
                      {dateStr}
                    </p>
                  </div>
                  <p style={{ fontFamily: 'monospace', fontWeight: 400, fontSize: 13, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {handle}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%', gap: 8 }}>
                {/* Change tags */}
                {changeTags.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 0', minWidth: 0 }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, lineHeight: '16px', color: 'var(--neutral-400)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Changes</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {changeTags.map(tag => {
                        const c = TAG_COLORS[tag] ?? DEFAULT_TAG_COLOR
                        return (
                          <span
                            key={tag}
                            style={{
                              display: 'inline-flex', alignItems: 'center',
                              padding: '2px 7px', borderRadius: 6,
                              fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px',
                              color: c.text,
                              backgroundColor: c.bg,
                              boxShadow: c.shadow,
                            }}
                          >
                            {tag}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                ) : <div style={{ flex: '1 1 0' }} />}
                {isCurrent ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px 6px', borderRadius: 8, flexShrink: 0, cursor: 'default', background: 'linear-gradient(180deg, #524b47 0%, #26211e 100%)', boxShadow: '0px 0px 0px 1px black, 0px 1.091px 1.091px 0px rgba(59,54,50,0.1), 0px 1.455px 3.127px 0px rgba(59,54,50,0.4)', position: 'relative' }}>
                    <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', boxShadow: 'inset 0px 1px 0.364px 0px rgba(247,242,237,0.3), inset 0px -2.182px 0.364px 0px #120c08, inset 0px -2.545px 4px -2.182px rgba(247,242,237,0.5)' }} />
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: '#f7f2ed', whiteSpace: 'nowrap', textShadow: '0px -0.727px 0.364px rgba(0,0,0,0.25), 0px 0.364px 0.364px rgba(255,255,255,0.25)' }}>Current</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      onClick={() => handleDeleteVersion(v.id)}
                      disabled={!!deletingId || !!restoringId}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '5px 8px', borderRadius: 8, border: 'none', flexShrink: 0, cursor: (deletingId || restoringId) ? 'not-allowed' : 'pointer', backgroundColor: 'transparent', boxShadow: '0px 0px 0px 1px rgba(220,38,38,0.4)', opacity: (deletingId || restoringId) ? 0.5 : 1, transition: 'opacity 150ms' }}
                    >
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--red-600, #dc2626)', whiteSpace: 'nowrap' }}>
                        {deletingId === v.id ? 'Deleting…' : 'Delete'}
                      </span>
                    </button>
                    <button
                      onClick={() => handleRestoreVersion(v.id)}
                      disabled={!!restoringId || !!deletingId}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '5px 8px', borderRadius: 8, border: 'none', flexShrink: 0, cursor: (restoringId || deletingId) ? 'not-allowed' : 'pointer', backgroundColor: 'transparent', boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)', opacity: (restoringId || deletingId) ? 0.5 : 1, transition: 'opacity 150ms' }}
                    >
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)', whiteSpace: 'nowrap' }}>
                        {restoringId === v.id ? 'Restoring…' : 'Restore'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </m.div>
  )
}

// ── Expanded overlays ─────────────────────────────────────────────────────────

function TestChatExpandedOverlay() {
  const { setTestChatExpanded } = usePersonaConfigure()
  return (
    <m.div
      key="test-chat-expanded"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
      style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', padding: 3 }}
      onClick={(e) => { if (e.target === e.currentTarget) setTestChatExpanded(false) }}
    >
      <m.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.7, delay: 0.04 }}
        style={{ width: 'min(780px, 90vw)', height: 'min(680px, 85vh)', display: 'flex', flexDirection: 'column', gap: 16, backgroundColor: 'var(--neutral-white)', border: '1px solid var(--neutral-200)', borderRadius: 20, padding: 16, overflow: 'hidden', boxShadow: '0px 24px 48px rgba(0,0,0,0.18), 0px 0px 0px 1px rgba(59,54,50,0.08)' }}
      >
        <TestChatPanelContent expanded />
      </m.div>
    </m.div>
  )
}

function AiSuggestExpandedOverlay() {
  const { setGuideExpanded } = usePersonaConfigure()
  return (
    <m.div
      key="ai-suggest-expanded"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
      style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', padding: 3 }}
      onClick={(e) => { if (e.target === e.currentTarget) setGuideExpanded(false) }}
    >
      <m.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.7, delay: 0.04 }}
        style={{ width: 'min(780px, 90vw)', height: 'min(680px, 85vh)', display: 'flex', flexDirection: 'column', gap: 16, backgroundColor: 'var(--neutral-white)', border: '1px solid var(--neutral-200)', borderRadius: 20, padding: 16, overflow: 'hidden', boxShadow: '0px 24px 48px rgba(0,0,0,0.18), 0px 0px 0px 1px rgba(59,54,50,0.08)' }}
      >
        <AiSuggestPanelContent expanded />
      </m.div>
    </m.div>
  )
}

// ── Shell (renders panels + FloatingMenu overlay) ─────────────────────────────

function PersonaConfigureShell({ children }: { children: React.ReactNode }) {
  const {
    testChatOpen, testChatExpanded,
    aiSuggestOpen, guideExpanded,
    versionsOpen,
    leaveConfirmHref, setLeaveConfirmHref,
  } = usePersonaConfigure()
  const { push, back } = useRouter()

  return (
    <div
      style={{
        display: 'flex', gap: 7, alignItems: 'stretch',
        width: '100%', height: '100%', position: 'relative',
      }}
    >
      {/* Left configure panel (page content) with FloatingMenu + help overlays */}
      <div style={{ flex: '1 0 0', minWidth: 0, position: 'relative' }}>
        {children}
        {/* Floating action menu — right-centre */}
        <div data-panel-container style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
          <PersonaFloatingMenu />
        </div>
        {/* Help trigger + main tab info card — bottom-left */}
        <PersonaHelpButton />
      </div>

      {/* ── Test chat panel (collapsed) ────────────────────────────────────── */}
      <AnimatePresence>
        {testChatOpen && !testChatExpanded && (
          <m.div
            key="test-chat"
            data-help-panel="help-test-chat"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 448, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 32, mass: 0.9 }}
            style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, margin: 3, backgroundColor: 'var(--neutral-white)', border: '1px solid var(--neutral-200)', borderRadius: 16, padding: 15, overflow: 'hidden' }}
          >
            <TestChatPanelContent expanded={false} />
          </m.div>
        )}
      </AnimatePresence>

      {/* ── Test chat expanded overlay ──────────────────────────────────────── */}
      <AnimatePresence>
        {testChatOpen && testChatExpanded && <TestChatExpandedOverlay />}
      </AnimatePresence>

      {/* ── AI suggestions panel (collapsed) ───────────────────────────────── */}
      <AnimatePresence>
        {aiSuggestOpen && !guideExpanded && (
          <m.div
            key="ai-suggest-panel"
            data-help-panel="help-ai-suggestions"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 400, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 32, mass: 0.9 }}
            style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, margin: 3, backgroundColor: 'var(--neutral-white)', border: '1px solid var(--neutral-200)', borderRadius: 16, padding: 15, overflow: 'hidden' }}
          >
            <AiSuggestPanelContent expanded={false} />
          </m.div>
        )}
      </AnimatePresence>

      {/* ── AI suggestions expanded overlay ────────────────────────────────── */}
      <AnimatePresence>
        {aiSuggestOpen && guideExpanded && <AiSuggestExpandedOverlay />}
      </AnimatePresence>

      {/* ── Versions panel ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {versionsOpen && <VersionsPanel />}
      </AnimatePresence>

      {/* ── Leave-confirm dialog — shown when exiting with unpublished changes ── */}
      {leaveConfirmHref && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Unpublished changes"
          onClick={() => setLeaveConfirmHref(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: 'var(--neutral-white)', borderRadius: 16, padding: 24, maxWidth: 380, width: '90%', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0px 8px 24px rgba(0,0,0,0.15)' }}
          >
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 500, fontSize: 18, lineHeight: '24px', color: 'var(--neutral-900)', margin: 0 }}>
              This persona isn&apos;t published yet
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '20px', color: 'var(--neutral-600)', margin: 0 }}>
              Your changes haven&apos;t been published. If you leave now, they won&apos;t be available to use until you publish.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setLeaveConfirmHref(null)}>
                Stay
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  const href = leaveConfirmHref
                  setLeaveConfirmHref(null)
                  if (href === '__back__') back()
                  else push(href)
                }}
              >
                Leave
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Layout export ─────────────────────────────────────────────────────────────

export default function PersonaConfigureLayout({ children }: { children: React.ReactNode }) {
  return (
    <PersonaConfigureProvider>
      <Suspense>
        <PersonaConfigureShell>{children}</PersonaConfigureShell>
      </Suspense>
    </PersonaConfigureProvider>
  )
}
