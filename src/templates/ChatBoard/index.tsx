'use client'

import React from 'react'
import {
  ArrowDownOneIcon,
  AtomOneIcon,
  BubbleChatTemporaryIcon,
  PinIcon,
  QuillWriteOneIcon,
  ShareOneIcon,
} from '@strange-huge/icons'
import { Sidebar, type SidebarProps, type SidebarProject, type SidebarRecentItem } from '@/components/Sidebar'
import { Pinboard, type PinboardProps, type PinboardPin } from '@/components/Pinboard'
import type { PinboardExpandedFolder } from '@/components/PinboardExpanded'
import { ChatInput, type ChatInputProps } from '@/components/ChatInput'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { FloatingMenu } from '@/components/FloatingMenu'
import { FloatingMenuItem } from '@/components/FloatingMenuItem'
import { Dropdown } from '@/components/Dropdown'
import { Tooltip } from '@/components/Tooltip'
import { Popover } from '@/components/Popover'
import { ModelSelector } from '@/components/ModelSelector'
import { ModelSelectItem } from '@/components/ModelSelectItem'
import { NeuralNetworkIcon } from '@strange-huge/icons'
import { ViewIcon } from '@/components/ViewIcon'

// ── Top-bar preset model selector ─────────────────────────────────────────────
// The "Souvenir AI · Muse" CTA opens this panel — same `ModelSelector`
// surface used by the model picker organism story. Mounted inside the
// `Dropdown.Float` at `bottom-start` (8 px gap, slide+fade enter/exit).

const PRESET_MODELS: Array<{
  llm:      string
  label:    string
  info:     string
  icons:    React.ReactNode
  selected?: boolean
}> = [
  { llm: 'Claude',     label: 'Claude 3.5 Sonnet', info: 'Anthropic · 200K context · vision + tool use',  icons: <NeuralNetworkIcon size={16} />, selected: true },
  { llm: 'Claude',     label: 'Claude 3 Opus',     info: 'Anthropic · 200K context · top-tier reasoning', icons: <NeuralNetworkIcon size={16} /> },
  { llm: 'Claude',     label: 'Claude 3 Haiku',    info: 'Anthropic · 200K context · fast + cheap',       icons: <NeuralNetworkIcon size={16} /> },
  { llm: 'OpenAI',     label: 'GPT-4o',            info: 'OpenAI · 128K context · vision + tool use',     icons: <><NeuralNetworkIcon size={16} /><ViewIcon size={16} variant="visible" /></> },
  { llm: 'OpenAI',     label: 'GPT-4o Mini',       info: 'OpenAI · 128K context · cheapest GPT-4 class',  icons: <NeuralNetworkIcon size={16} /> },
  { llm: 'OpenAI',     label: 'o1 Preview',        info: 'OpenAI · reasoning model · slow + thorough',    icons: <NeuralNetworkIcon size={16} /> },
  { llm: 'Gemini',     label: 'Gemini 1.5 Pro',    info: 'Google · 2M context · vision',                  icons: <><NeuralNetworkIcon size={16} /><ViewIcon size={16} variant="visible" /></> },
  { llm: 'Gemini',     label: 'Gemini 1.5 Flash',  info: 'Google · 1M context · fast',                    icons: <NeuralNetworkIcon size={16} /> },
  { llm: 'Mistral',    label: 'Mistral Large',     info: 'Mistral · 128K context · open weights',         icons: <NeuralNetworkIcon size={16} /> },
  { llm: 'Mistral',    label: 'Mistral Nemo',      info: 'Mistral · 128K context · efficient',            icons: <NeuralNetworkIcon size={16} /> },
  { llm: 'Meta',       label: 'Llama 3.1 405B',    info: 'Meta · open weights · frontier scale',          icons: <NeuralNetworkIcon size={16} /> },
  { llm: 'Meta',       label: 'Llama 3.1 70B',     info: 'Meta · open weights · production sweet-spot',   icons: <NeuralNetworkIcon size={16} /> },
  { llm: 'Perplexity', label: 'Perplexity Sonar',  info: 'Perplexity · web-grounded answers',             icons: <><NeuralNetworkIcon size={16} /><ViewIcon size={16} variant="visible" /></> },
]

function TopBarModelSelector() {
  return (
    <Popover variant="dropdown" style={{ width: 432 }} maxHeight={false}>
      <ModelSelector>
        {PRESET_MODELS.map((m) => (
          <ModelSelectItem
            key={m.label}
            llm={m.llm}
            label={m.label}
            icons={m.icons}
            info={m.info}
            bookmark
            selected={m.selected}
          />
        ))}
      </ModelSelector>
    </Popover>
  )
}

// ── Placeholder content ───────────────────────────────────────────────────────
//
// The Add menu (Figma 3219:33599) and Model menu (Figma 3208:32989 +
// 3142:36710) are owned by `ChatInput` and rendered by default — the template
// does not pass `addMenu` / `modelMenu`. Consumers who need different menus
// can pass them via `chatInputProps`.

const PLACEHOLDER_PINS: PinboardPin[] = [
  {
    id:       'pin-replicants',
    category: 'Research',
    pinTitle: 'Replicants and the philosophy of authentic experience',
    description:
      'The key distinction is that replicants possess implanted memories, making their emotional responses genuine even if their origins are artificial. Empathy remains the defining boundary — the Voigt-Kampff test measures involuntary empathic response.',
    labels: [
      { color: 'Neutral', text: 'Blade Runner' },
      { color: 'Neutral', text: 'Memory'       },
      { color: 'Neutral', text: 'Empathy'      },
    ],
    chatName: 'Sci-fi philosophy',
  },
  {
    id:       'pin-roman',
    category: 'Research',
    pinTitle: 'Decline of the Roman Empire — economic factors',
    description:
      'Currency debasement under the Severan dynasty triggered runaway inflation. Combined with shrinking tax revenues from contracting borders, the empire could no longer fund the legions that had defended it.',
    labels: [
      { color: 'Neutral', text: 'History'  },
      { color: 'Neutral', text: 'Economics'},
      { color: 'Neutral', text: 'Rome'     },
    ],
    chatName: 'Roman history',
  },
  {
    id:       'pin-react-server',
    category: 'Code',
    pinTitle: 'React Server Components: when they actually help',
    description:
      'RSCs shine when most of the tree is static data fetching with little interactivity. The cost is added complexity around serialisation boundaries and client/server prop discipline — not free.',
    labels: [
      { color: 'Neutral', text: 'React'  },
      { color: 'Neutral', text: 'RSC'    },
      { color: 'Neutral', text: 'Next.js'},
    ],
    chatName: 'Frontend architecture',
  },
  {
    id:       'pin-launch',
    category: 'Planning',
    pinTitle: 'Launch checklist — Souvenir AI v1',
    description:
      'Pin board, Chat board, Persona, and Workflow all need a final accessibility pass before the v1 cut. Marketing site assets are blocked on the hero illustration handoff from design.',
    labels: [
      { color: 'Neutral', text: 'Launch'  },
      { color: 'Neutral', text: 'v1'      },
      { color: 'Neutral', text: 'Q2 2026' },
    ],
    chatName: 'Launch planning',
  },
  {
    id:       'pin-onboarding',
    category: 'Tasks',
    pinTitle: 'Onboarding flow — first-time-user moments to instrument',
    description:
      'Track time-to-first-pin, time-to-first-chat, and abandonment after the model picker opens. The model picker is the riskiest step — most users still don’t know which one to pick.',
    labels: [
      { color: 'Neutral', text: 'Onboarding'},
      { color: 'Neutral', text: 'Analytics' },
    ],
    chatName: 'Activation metrics',
  },
  {
    id:       'pin-mythology',
    category: 'Creative',
    pinTitle: 'Story seed: a god who forgets every dawn',
    description:
      'Each sunrise resets the deity’s memory of the world it created. Mortals leave votive offerings shaped like memories — small carved scenes meant to remind the god what existed yesterday.',
    labels: [
      { color: 'Neutral', text: 'Mythology' },
      { color: 'Neutral', text: 'Worldbuild'},
      { color: 'Neutral', text: 'Draft'     },
    ],
    chatName: 'Story drafts',
  },
  {
    id:       'pin-quote',
    category: 'Quote',
    pinTitle: 'Borges on labyrinths',
    description:
      '"I have always imagined that Paradise will be a kind of library." — Jorge Luis Borges. Worth keeping near anything we write about long-term knowledge.',
    labels: [
      { color: 'Neutral', text: 'Borges'    },
      { color: 'Neutral', text: 'Reference' },
    ],
    chatName: 'Quotes & references',
  },
]

const PLACEHOLDER_PROJECTS: SidebarProject[] = [
  {
    id:        'proj-souvenir',
    label:     'Souvenir launch',
    chatItems: [
      { id: 'proj-souvenir-c0', label: 'Marketing site copy' },
      { id: 'proj-souvenir-c1', label: 'Pricing page hero'   },
      { id: 'proj-souvenir-c2', label: 'Launch announcement' },
    ],
  },
  {
    id:        'proj-research',
    label:     'Research notes',
    chatItems: [
      { id: 'proj-research-c0', label: 'Roman history'      },
      { id: 'proj-research-c1', label: 'Sci-fi philosophy'  },
      { id: 'proj-research-c2', label: 'Cognitive science'  },
    ],
  },
  {
    id:        'proj-fiction',
    label:     'Fiction drafts',
    chatItems: [
      { id: 'proj-fiction-c0', label: 'Forgotten god seed' },
      { id: 'proj-fiction-c1', label: 'Mara and the river' },
    ],
  },
]

const PLACEHOLDER_RECENTS: SidebarRecentItem[] = [
  { id: 'recent-frontend',   label: 'Frontend architecture' },
  { id: 'recent-launch',     label: 'Launch planning'       },
  { id: 'recent-activation', label: 'Activation metrics'    },
  { id: 'recent-philosophy', label: 'Sci-fi philosophy'     },
  { id: 'recent-roman',      label: 'Roman history'         },
]

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatBoardProps {
  /** Slot for the chat thread — left empty by the template; the consumer fills this. */
  children?: React.ReactNode
  /** Label for the model/framework Button in the top bar. */
  topBarLabel?: string
  /** Disclaimer shown beneath the ChatInput. */
  disclaimer?: string
  /** Props forwarded to the left Sidebar. */
  sidebarProps?: Partial<SidebarProps>
  /** Props forwarded to the right Pinboard. */
  pinboardProps?: Partial<PinboardProps>
  /** Props forwarded to the ChatInput. */
  chatInputProps?: Partial<ChatInputProps>
  /** Click handler for the "new temporary chat" icon (Figma 3220:33875, BubbleChatTemporaryIcon). */
  onTemporaryChat?: React.MouseEventHandler<HTMLButtonElement>
  /** Click handler for the "share chat" icon (Figma 3220:33876, ShareOneIcon). */
  onShare?: React.MouseEventHandler<HTMLButtonElement>
}

// ── Template ──────────────────────────────────────────────────────────────────

/**
 * ChatBoard — top-level layout template (Figma 3220:33867).
 *
 * Composes the three KDS organisms exactly as they ship:
 *   Sidebar (left)  ·  Main Chat Container (center)  ·  Pinboard (right)
 *
 * The center column houses the framework Button + share/right-rail icon
 * buttons in a floating top bar, an empty Chat Thread region (filled by the
 * consumer via `children`), the `ChatInput` (max-width 754px, centered),
 * and a vertical `FloatingMenu` pinned to the right edge.
 *
 * The Chat Thread is intentionally empty — the rendering of message
 * bubbles, threading, streaming state etc. is left to the application
 * developer.
 */
export function ChatBoard({
  children,
  topBarLabel = 'Souvenir AI · Muse',
  disclaimer = 'AI can make mistakes. Please double-check responses.',
  sidebarProps,
  pinboardProps,
  chatInputProps,
  onTemporaryChat,
  onShare,
}: ChatBoardProps) {
  // Project ↔ Pinboard folder sync (project-pinboard-folder-sync rule).
  // Each project the user has in the Sidebar auto-creates a corresponding
  // folder in the Pinboard view dropdown AND in the PinboardExpanded
  // "Project folders" sidebar group.
  const sidebarProjects   = sidebarProps?.projects ?? PLACEHOLDER_PROJECTS
  const pinboardProjectFolders: PinboardExpandedFolder[] = sidebarProjects.map(
    (p) => ({ id: `project-${p.id}`, label: p.label })
  )

  // Pinboard visibility — the X in the PinboardHeader hides the right rail;
  // the FloatingMenu's Pinboard item brings it back. There is no top-bar
  // sidebar-toggle in the Figma design — the top-right cluster is
  // `[ BubbleChatTemporaryIcon | ShareOneIcon ]`, neither of which controls
  // the rail.
  const [pinboardOpen, setPinboardOpen] = React.useState(true)
  const handlePinboardClose = () => setPinboardOpen(false)

  // Top-bar model selector — clicking the framework Button opens the
  // canonical model menu at `bottom-start`. Same animation as every other
  // KDS dropdown (Dropdown.Float owns it).
  const [topBarMenuOpen, setTopBarMenuOpen] = React.useState(false)

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
      {/* Left — Sidebar
          Recents intentionally uses the Sidebar's built-in default content so
          the "Recents" header, show/hide toggle, double-click rename, and
          stagger animations all stay owned by Sidebar — no duplication. */}
      <Sidebar
        userName="Uttkarsh"
        userEmail="uttkarsh@cca.edu"
        projects={PLACEHOLDER_PROJECTS}
        recents={PLACEHOLDER_RECENTS}
        {...sidebarProps}
      />

      {/* Center — main chat container */}
      <div
        style={{
          position:        'relative',
          flex:            '1 0 0',
          minWidth:        0,
          display:         'flex',
          flexDirection:   'column',
          backgroundColor: 'var(--neutral-50)',
          // Figma 3220:33870 — `py-[10px]` only (no horizontal padding).
          padding:         '10px 0',
        }}
      >
        {/* Inner translucent container — Figma 3220:33871.
            flex-[1_0_0] flex-col gap-[2px] items-start, p-[12px] all sides,
            border 1 px neutral-200, rounded-[22px], bg rgba(255,255,255,0.2),
            overflow-clip. The top bar is absolutely positioned with negative
            top/left so it overlaps the 1 px border line — that's why the
            content area below doesn't need any top padding to clear it
            (`justify-end` pushes content to the bottom of the flex column,
            and the top bar only paints over what would otherwise be empty
            negative space at the top of the chat thread). */}
        <div
          style={{
            position:        'relative',
            flex:            '1 0 0',
            minHeight:       0,
            display:         'flex',
            flexDirection:   'column',
            alignItems:      'flex-start',
            gap:             '2px',
            padding:         '12px',
            borderRadius:    '22px',
            border:          '1px solid var(--neutral-200)',
            backgroundColor: 'var(--color-surface-glass)',
            overflow:        'hidden',
            isolation:       'isolate',                   // scope FloatingMenu z-index
          }}
        >
          {/* Top bar — Figma 3220:33872.
              absolute, top:-1 / left:-1 / right:-1 so it overlaps the 1 px
              neutral-200 border on three sides. pt-[12px] px-[12px], bg
              rgba(255,255,255,0.1) (subtle fill that lets the chat thread
              show through). */}
          <div
            style={{
              position:        'absolute',
              top:             -1,
              left:            -1,
              right:           -1,
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'space-between',
              paddingTop:      '12px',
              paddingLeft:     '12px',
              paddingRight:    '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              zIndex:          1,
            }}
          >
            <Dropdown.Float
              open={topBarMenuOpen}
              onOpenChange={setTopBarMenuOpen}
              placement="bottom-start"
              trigger={
                <Button
                  variant="default"
                  size="sm"
                  rightIcon={<ArrowDownOneIcon />}
                >
                  {topBarLabel}
                </Button>
              }
            >
              <TopBarModelSelector />
            </Dropdown.Float>
            {/* Icon Button Container — Figma 3220:33874.
                gap-[4px], two ghost icon buttons. Order matches Figma:
                temporary-chat (3220:33875) on the left, share (3220:33876)
                on the right. Icon component names supplied by the user:
                bubble-chat-temporary# → BubbleChatTemporaryIcon,
                share-01# → ShareOneIcon. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <IconButton
                variant="ghost"
                aria-label="New temporary chat"
                icon={<BubbleChatTemporaryIcon />}
                onClick={onTemporaryChat}
              />
              <Tooltip content="Share" side="bottom">
                <IconButton
                  variant="ghost"
                  aria-label="Share chat"
                  icon={<ShareOneIcon animated />}
                  onClick={onShare}
                />
              </Tooltip>
            </div>
          </div>

          {/* Content Area — Figma 3220:33877.
              flex-[1_0_0] flex-col gap-[12px] items-center justify-end
              min-h-px **px-[28px]** w-full. The 28 px horizontal padding
              lives here (NOT on the Inner Container) — it's the breathing
              room around the 754 px chat thread / chat input column. */}
          <div
            style={{
              display:         'flex',
              flex:            '1 0 0',
              minHeight:       0,
              flexDirection:   'column',
              alignItems:      'center',
              justifyContent:  'flex-end',
              gap:             '12px',
              width:           '100%',
              paddingLeft:     '28px',
              paddingRight:    '28px',
            }}
          >
            {/* Chat Thread — empty by template; the consumer fills it */}
            <div
              data-slot="chat-thread"
              style={{
                flex:      '1 0 0',
                minHeight: 0,
                width:     '100%',
                maxWidth:  '754px',
              }}
            >
              {children}
            </div>

            <ChatInput
              projectFolders={pinboardProjectFolders}
              {...chatInputProps}
            />

            <p
              style={{
                margin:     0,
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-caption)',
                lineHeight: 'var(--line-height-caption)',
                color:      'var(--neutral-600)',
                whiteSpace: 'nowrap',
              }}
            >
              {disclaimer}
            </p>
          </div>

          {/* Floating menu — Figma 3220:33911.
              absolute, right-[11px], top-[calc(50%-0.5px)], -translate-y-1/2.
              The half-pixel offset is Figma's vertical-centering trick for
              odd-height containers — keep it. */}
          <div
            style={{
              position:  'absolute',
              top:       'calc(50% - 0.5px)',
              right:     '21px',
              transform: 'translateY(-50%)',
              zIndex:    1,
            }}
          >
            <FloatingMenu aria-label="Chat actions">
              <FloatingMenuItem
                icon={<PinIcon size={20} />}
                label="Pinboard"
                active={pinboardOpen}
                onClick={() => setPinboardOpen((v) => !v)}
              />
              <FloatingMenuItem icon={<AtomOneIcon size={20} />}       label="Compare LLMs" />
              <FloatingMenuItem icon={<QuillWriteOneIcon size={20} />} label="Highlights"   />
            </FloatingMenu>
          </div>
        </div>
      </div>

      {/* Right — Pinboard. The rail is always mounted; the `data-open`
          attribute drives the CSS panel-slide-x transition (see
          `.kds-pinboard-rail` in globals.css). On close: flex-basis
          332 → 0 (column collapse), translateX 0 → 166, opacity 1 → 0,
          blur 0 → 2 px — all sharing the same 350 ms ease-out curve, so the
          motion reads as one gesture. `prefers-reduced-motion: reduce` at
          the OS level disables every transition.

          The X inside `PinboardHeader` (onClose), the top-bar
          SidebarRightIcon, and the floating-menu Pinboard item all toggle
          `pinboardOpen`. Project folders flow from the Sidebar's `projects`
          prop via the project-pinboard folder-sync rule
          (specs/patterns/project-pinboard-folder-sync.md). */}
      <div className="kds-pinboard-rail" data-open={pinboardOpen}>
        <div className="kds-pinboard-rail-inner">
          <Pinboard
            pins={PLACEHOLDER_PINS}
            projectFolders={pinboardProjectFolders}
            onClose={handlePinboardClose}
            {...pinboardProps}
          />
        </div>
      </div>

      {/* Right-rail gutter — only present when the pinboard is closed.
          Width animates 0 ↔ 10 px with the same duration/ease as the rail's
          panel-slide so the rail's collapse and the gutter's reveal read as
          one continuous gesture. Background matches the Pinboard bg
          (`var(--neutral-50)` = #f7f2ed) so the closed state looks like a
          thin sliver of the same surface. */}
      <div
        aria-hidden
        style={{
          flexShrink:      0,
          width:           pinboardOpen ? 0 : 10,
          backgroundColor: 'var(--neutral-50)',
          transition:      'width 350ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </div>
  )
}

ChatBoard.displayName = 'ChatBoard'

export default ChatBoard
