'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import {
  PlusSignIcon,
  MicTwoIcon,
  ArrowDownOneIcon,
  StopCircleIcon,
  ArrowUpTwoIcon,
  ArrowRightOneIcon,
  FileAddIcon,
  FolderOneIcon,
  GlobalSearchIcon,
  QuillWriteTwoIcon,
  UserAddOneIcon,
} from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Button } from '@/components/Button'
import { Chip } from '@/components/Chip'
import { Dropdown } from '@/components/Dropdown'
import { cn } from '@/lib/utils'
import Image from 'next/image'

// ── Canonical default menu contents ───────────────────────────────────────────
// The Add menu (Figma 3219:33599) and Model menu (Figma 3208:32989 + 3142:36710)
// live INSIDE ChatInput so every consumer renders the same five-item add menu
// (including the 12-row Use Style submenu, Figma 3424:1892) and three-item
// model menu by default. Consumers override by passing a custom node into
// `addMenu` / `modelMenu`; pass `null` to opt out and use the bare-button +
// `onAdd` / `onModelClick` callbacks instead.
//
// Folder icon: `<FolderOneIcon variant="static" animated />`. The icon is
// otherwise reserved for Sidebar surfaces (see CLAUDE.md "Folder Icon -
// Sidebar Only Rule"); the Pin-folders row inside the Add menu is the
// declared exception, mandated by the user. Don't generalise.

// Persona submenu thresholds (Figma 3430:39723 + 3436:1591).
// The compact rows-only variant ships up to and including 10 personas.
// Past that, the menu adds a sticky search input at the top so the user
// can filter by name. Both variants share the same row template - 24×24
// avatar (rounded-6) + Body/Medium 14 label.
const PERSONA_SEARCH_THRESHOLD = 10

export interface ChatInputPersona {
  /** Stable identifier - used for keyed list rendering and onSelect callbacks. */
  id: string
  /** Persona display name. */
  name: string
  /** Avatar image URL. Rendered inside a 24×24 rounded-6 frame, `object-fit: cover`. */
  avatarSrc: string
}

// Pin folder shape - mirrors `PinboardExpandedFolder` (project ↔ pinboard
// folder sync rule). Consumers should pass the SAME `personalFolders` /
// `projectFolders` arrays into `ChatInput`, `Pinboard`, and
// `PinboardExpanded` so all three surfaces stay in sync.
export interface ChatInputFolder {
  id:    string
  label: string
}

// Placeholder personas used when ChatInput consumers haven't passed a
// `personas` prop yet. Eight short names so the canonical ChatBoard
// preview shows the compact (≤10) variant by default. Avatars come from
// `i.pravatar.cc` - a stable test-image service used elsewhere in KDS
// stories (ModelSelectItem, etc.). Override via the `personas` prop.
const DEFAULT_PERSONAL_FOLDERS: ChatInputFolder[] = [
  { id: 'personal-1', label: 'Personal 1' },
  { id: 'personal-2', label: 'Personal 2' },
  { id: 'personal-3', label: 'Personal 3' },
]

const DEFAULT_PROJECT_FOLDERS: ChatInputFolder[] = [
  { id: 'project-a', label: 'Project A' },
  { id: 'project-c', label: 'Project C' },
  { id: 'project-b', label: 'Project B' },
]

// Personas are AGENT TYPES, not people - the labels describe the agent's
// role / voice (Researcher, Editor, Strategist, …). Eight entries so the
// canonical ChatBoard preview shows the compact (≤10) variant by default.
// Avatars use `i.pravatar.cc` purely as neutral 96 px stand-ins so the
// 24×24 rounded-6 slot has visible content; consumers should swap them
// for their own agent-icon imagery via the `personas` prop.
const DEFAULT_PERSONAS: ChatInputPersona[] = [
  { id: 'researcher',   name: 'Researcher',   avatarSrc: 'https://i.pravatar.cc/96?img=1'  },
  { id: 'editor',       name: 'Editor',       avatarSrc: 'https://i.pravatar.cc/96?img=5'  },
  { id: 'coach',        name: 'Coach',        avatarSrc: 'https://i.pravatar.cc/96?img=10' },
  { id: 'tutor',        name: 'Tutor',        avatarSrc: 'https://i.pravatar.cc/96?img=12' },
  { id: 'strategist',   name: 'Strategist',   avatarSrc: 'https://i.pravatar.cc/96?img=14' },
  { id: 'critic',       name: 'Critic',       avatarSrc: 'https://i.pravatar.cc/96?img=20' },
  { id: 'brainstormer', name: 'Brainstormer', avatarSrc: 'https://i.pravatar.cc/96?img=25' },
  { id: 'analyst',      name: 'Analyst',      avatarSrc: 'https://i.pravatar.cc/96?img=32' },
]

const USE_STYLE_OPTIONS = [
  { id: 'none',         label: 'None',         subLabel: 'Default AI behavior' },
  { id: 'professional', label: 'Professional', subLabel: 'Polished, structured, business-ready' },
  { id: 'balanced',     label: 'Balanced',     subLabel: 'Friendly yet professional' },
  { id: 'casual',       label: 'Casual',       subLabel: 'Relaxed and conversational' },
  { id: 'witty',        label: 'Witty',        subLabel: 'Sharp, clever, playful' },
  { id: 'concise',      label: 'Concise',      subLabel: 'Short, direct, no fluff' },
  { id: 'executive',    label: 'Executive',    subLabel: 'Strategic, decision-oriented' },
  { id: 'academic',     label: 'Academic',     subLabel: 'Scholarly, precise, well-cited' },
  { id: 'creative',     label: 'Creative',     subLabel: 'Imaginative and unconventional' },
  { id: 'teaching',     label: 'Teaching',     subLabel: 'Step-by-step, builds understanding' },
  { id: 'socratic',     label: 'Socratic',     subLabel: 'Guides through questions' },
  { id: 'empathetic',   label: 'Empathetic',   subLabel: 'Warm, supportive, emotionally aware' },
] as const

// ── Persona submenu ───────────────────────────────────────────────────────────
// Two visual variants, switched by `personas.length`:
//   • ≤ 10 personas → compact row list (Figma 3430:39723).
//   • > 10 personas → sticky search input above filtered rows (Figma 3436:1591).
// The search input is a plain `<input>` styled to match the Figma frame
// exactly (white bg, 10 px radius, the standard KDS field shadow stack -
// `0 1px 1.5px 0 rgba(82,75,71,0.12), 0 0 0 1px var(--neutral-100)`,
// `padding: 7px 10px`). It lives in the Popover's `header` slot so it
// sits above the scroll viewport and never scrolls away with the items.

function PersonaSearchInput({
  value,
  onChange,
  inputId,
}: {
  value: string
  onChange: (next: string) => void
  inputId: string
}) {
  return (
    <div style={{ padding: 8 }}>
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search your agent..."
        autoComplete="off"
        spellCheck={false}
        style={{
          width:           '100%',
          padding:         '7px 10px',
          borderRadius:    10,
          border:          'none',
          outline:         'none',
          background:      'var(--neutral-white)',
          boxShadow:
            '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
          fontFamily:      'var(--font-body)',
          fontWeight:      'var(--font-weight-regular)',
          fontSize:        'var(--font-size-body)',
          lineHeight:      'var(--line-height-body)',
          color:           'var(--neutral-700)',
        }}
        // Stop key events from bubbling up to the parent dropdown's
        // ArrowUp/ArrowDown/Home/End handlers - typing here should NOT
        // navigate the menu list. Enter on the input is reserved for a
        // future "submit search" handler; for now it's a no-op.
        onKeyDown={(e) => { e.stopPropagation() }}
      />
    </div>
  )
}

function PersonaSubmenu({
  personas,
  selectedId,
  onSelect,
}: {
  personas:   ChatInputPersona[]
  selectedId: string | null
  onSelect:   (id: string) => void
}) {
  const [query, setQuery] = React.useState('')
  const inputId = React.useId()

  const showSearch = personas.length > PERSONA_SEARCH_THRESHOLD

  const filtered = React.useMemo(() => {
    if (!showSearch || !query.trim()) return personas
    const q = query.trim().toLowerCase()
    return personas.filter((p) => p.name.toLowerCase().includes(q))
  }, [personas, query, showSearch])

  return (
    <Dropdown
      header={
        showSearch ? (
          <PersonaSearchInput value={query} onChange={setQuery} inputId={inputId} />
        ) : undefined
      }
      style={{ width: 240 }}
    >
      <Dropdown.Section fluid>
        {filtered.map((p) => (
          <Dropdown.Item
            key={p.id}
            label={p.name}
            avatar={
              <Image
                src={p.avatarSrc}
                alt=""
                fill
                sizes="24px"
                unoptimized
                style={{ objectFit: 'cover' }}
              />
            }
            selected={selectedId === p.id}
            onClick={() => onSelect(p.id)}
            fluid
          />
        ))}
      </Dropdown.Section>
    </Dropdown>
  )
}

// ── Pin folders submenu ───────────────────────────────────────────────────────
// Two sections, mirroring the Pinboard view-filter dropdown and the
// PinboardExpanded sidebar (project ↔ pinboard folder sync rule):
//   • "Your folders"    - personal user-created folders
//   • "Project folders" - derived from Sidebar projects
// Each row uses `<FolderOneIcon variant="static" animated />`. The folder
// icon is otherwise sidebar-only; this submenu (alongside the parent
// "Pin folders" row) is the declared exception per CLAUDE.md.

function PinFoldersSubmenu({
  personalFolders,
  projectFolders,
}: {
  personalFolders: ChatInputFolder[]
  projectFolders:  ChatInputFolder[]
}) {
  const [activeId, setActiveId] = React.useState<string | null>(null)
  return (
    <Dropdown size="md" maxHeight="min(200px, calc(100dvh - 120px))">
      {personalFolders.length > 0 && (
        <Dropdown.Section label="Your folders" fluid>
          {personalFolders.map((f) => (
            <Dropdown.Item
              key={f.id}
              label={f.label}
              icon={<FolderOneIcon variant="static" animated />}
              selected={activeId === f.id}
              onClick={() => setActiveId(f.id)}
              fluid
            />
          ))}
        </Dropdown.Section>
      )}
      {projectFolders.length > 0 && (
        <Dropdown.Section label="Project folders" divider={personalFolders.length > 0} fluid>
          {projectFolders.map((f) => (
            <Dropdown.Item
              key={f.id}
              label={f.label}
              icon={<FolderOneIcon variant="static" animated />}
              selected={activeId === f.id}
              onClick={() => setActiveId(f.id)}
              fluid
            />
          ))}
        </Dropdown.Section>
      )}
    </Dropdown>
  )
}

interface DefaultAddMenuProps {
  personas?:           ChatInputPersona[]
  personalFolders?:    ChatInputFolder[]
  projectFolders?:     ChatInputFolder[]
  // ── Controlled state (lifted from ChatInput so chips stay in sync) ──────
  webSearch:             boolean
  onWebSearchChange:     (next: boolean) => void
  selectedStyleId:       string | null
  onSelectedStyleChange: (next: string | null) => void
  selectedPersonaId:     string | null
  onSelectedPersonaChange: (next: string | null) => void
}

function DefaultAddMenu({
  personas        = DEFAULT_PERSONAS,
  personalFolders = DEFAULT_PERSONAL_FOLDERS,
  projectFolders  = DEFAULT_PROJECT_FOLDERS,
  webSearch,
  onWebSearchChange,
  selectedStyleId,
  onSelectedStyleChange,
  selectedPersonaId,
  onSelectedPersonaChange,
}: DefaultAddMenuProps) {
  return (
    <Dropdown style={{ width: 200 }}>
      <Dropdown.Section fluid>
        <Dropdown.Item label="Add files or photos" icon={<FileAddIcon />} fluid />
        <Dropdown.Item
          label="Web search"
          icon={<GlobalSearchIcon />}
          showSwitch
          switchChecked={webSearch}
          onSwitchChange={onWebSearchChange}
          fluid
        />
        <Dropdown.Submenu
          trigger={
            <Dropdown.Item
              label="Use style"
              icon={<QuillWriteTwoIcon />}
              rightIcon={<ArrowRightOneIcon />}
              fluid
            />
          }
        >
          {/* Use Style submenu - Figma 3424:1892. Twelve sublabel rows ⇒
              hits the popover max-height cap (380 px ≈ 7 rows). The remaining
              5 rows are reachable via internal scroll, with the scroll-edge
              fade signaling more content below.

              Hover-triggered, top-aligned with the trigger row by default;
              auto-flips to bottom-aligned when the submenu would overflow
              the viewport (e.g. when ChatInput sits at the bottom of the
              screen, as in the canonical layout). */}
          <Dropdown size="md">
            <Dropdown.Section fluid>
              {USE_STYLE_OPTIONS.map((opt) => (
                <Dropdown.Item
                  key={opt.id}
                  label={opt.label}
                  subLabel={opt.subLabel}
                  selected={opt.id === 'none' ? selectedStyleId === null : selectedStyleId === opt.id}
                  onClick={() => onSelectedStyleChange(opt.id === 'none' ? null : opt.id)}
                  fluid
                />
              ))}
            </Dropdown.Section>
          </Dropdown>
        </Dropdown.Submenu>
        <Dropdown.Submenu
          trigger={
            <Dropdown.Item
              label="Add persona"
              icon={<UserAddOneIcon />}
              rightIcon={<ArrowRightOneIcon />}
              fluid
            />
          }
        >
          <PersonaSubmenu
            personas={personas}
            selectedId={selectedPersonaId}
            onSelect={onSelectedPersonaChange}
          />
        </Dropdown.Submenu>
        <Dropdown.Submenu
          trigger={
            <Dropdown.Item
              label="Pin folders"
              icon={<FolderOneIcon variant="static" animated />}
              rightIcon={<ArrowRightOneIcon />}
              fluid
            />
          }
        >
          {/* Pin folders submenu - same structure as the Pinboard view-filter
              dropdown: "Your folders" (personal) + "Project folders" (derived
              from Sidebar projects), separated by a divider. */}
          <PinFoldersSubmenu
            personalFolders={personalFolders}
            projectFolders={projectFolders}
          />
        </Dropdown.Submenu>
      </Dropdown.Section>
    </Dropdown>
  )
}

const DEFAULT_MOST_USED_MODELS = [
  { id: 'claude',   llm: 'Claude',   label: 'Claude Opus 4.5' },
  { id: 'gpt5',     llm: 'OpenAI',   label: 'GPT-5' },
  { id: 'gemini',   llm: 'Gemini',   label: 'Gemini 2.5 Pro' },
  { id: 'deepseek', llm: 'DeepSeek', label: 'DeepSeek V3' },
  { id: 'grok',     llm: 'Grok',     label: 'Grok 4' },
] as const

const DEFAULT_RECENT_MODELS = [
  { id: 'sonnet',    llm: 'Claude',  label: 'Claude Sonnet 4.5' },
  { id: 'haiku',     llm: 'Claude',  label: 'Claude Haiku 4.5' },
  { id: 'gpt5-mini', llm: 'OpenAI',  label: 'GPT-5 Mini' },
  { id: 'mistral',   llm: 'Mistral', label: 'Mistral Large' },
  { id: 'qwen',      llm: 'Qwen',    label: 'Qwen 3 Max' },
] as const

function DefaultModelMenu() {
  return (
    <Dropdown size="md">
      <Dropdown.Section fluid>
        <Dropdown.Item
          label="Souvenir : Advance"
          subLabel="Most capable for ambitious work"
          showSwitch
          defaultSwitchChecked={false}
          fluid
        />
        <Dropdown.Item
          label="Adaptive thinking"
          subLabel="Most capable for ambitious work"
          showSwitch
          defaultSwitchChecked={false}
          fluid
        />
        {/* More models hidden */}
      </Dropdown.Section>
    </Dropdown>
  )
}

// ── Shadow tokens ──────────────────────────────────────────────────────────────

const SHADOW_DEFAULT = 'var(--shadow-chat-input)'
const SHADOW_HOVER   = 'var(--shadow-chat-input-hover)'
const SHADOW_FOCUS   = 'var(--shadow-chat-input-focus)'

// ── Audio-reactive waveform ────────────────────────────────────────────────────
// Mirrors the AudioWaveOneIcon shape (7 bars, same x positions and default heights)
// but animates bar heights in real time from a live AnalyserNode.

const BAR_X       = [3, 6, 9, 12, 15, 18, 21]
const BAR_DEFAULT = [2, 10, 18, 12, 6, 10, 2]  // heights at rest (matches icon)
const CENTER_Y    = 12
const LERP        = 0.35  // smoothing factor (higher = snappier)

function AudioWaveDisplay({ analyser, color = 'currentColor', size = 20 }: {
  analyser: AnalyserNode | null
  color?: string
  size?: number
}) {
  const pathRefs  = useRef<(SVGPathElement | null)[]>([])
  const heightsRef = useRef<number[]>([...BAR_DEFAULT])
  const rafRef     = useRef<number>(0)

  // Direct DOM mutation - no setState, no re-renders.
  // RAF-driven setState inside Framer Motion's composited subtree gets batched/dropped.
  const updatePaths = (heights: number[]) => {
    heights.forEach((h, i) => {
      const el = pathRefs.current[i]
      if (el) el.setAttribute('d', `M${BAR_X[i]} ${(CENTER_Y - h / 2).toFixed(2)}V${(CENTER_Y + h / 2).toFixed(2)}`)
    })
  }

  useEffect(() => {
    cancelAnimationFrame(rafRef.current)

    if (!analyser) {
      // Decay back to resting heights
      const decay = () => {
        const next = heightsRef.current.map((h, i) => h + (BAR_DEFAULT[i] - h) * LERP)
        heightsRef.current = next
        updatePaths(next)
        // eslint-disable-next-line react-doctor/js-length-check-first -- length check is the leading condition via ||
        if (next.length !== BAR_DEFAULT.length || !next.every((h, i) => Math.abs(h - BAR_DEFAULT[i]) < 0.1))
          rafRef.current = requestAnimationFrame(decay)
      }
      rafRef.current = requestAnimationFrame(decay)
      return () => cancelAnimationFrame(rafRef.current)
    }

    const bufferLength = analyser.frequencyBinCount
    const dataArray    = new Uint8Array(bufferLength)
    const voiceBins    = Math.floor(bufferLength * 0.4)
    const binPerBar    = Math.floor(voiceBins / BAR_X.length)

    const tick = () => {
      analyser.getByteFrequencyData(dataArray)

      const targets = BAR_X.map((_, i) => {
        const start = 1 + i * binPerBar
        const end   = start + binPerBar
        let sum = 0
        for (let j = start; j < end; j++) sum += dataArray[j] ?? 0
        return 2 + (sum / binPerBar / 255) * 18
      })

      const next = heightsRef.current.map((h, i) => h + (targets[i] - h) * LERP)
      heightsRef.current = next
      updatePaths(next)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser])

  const p = {
    stroke:         color,
    strokeWidth:    1.5,
    strokeLinecap:  'round' as const,
    strokeLinejoin: 'round' as const,
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {BAR_X.map((x, i) => {
        const h  = BAR_DEFAULT[i]
        const y1 = CENTER_Y - h / 2
        const y2 = CENTER_Y + h / 2
        return (
          <path
            key={x}
            ref={el => { pathRefs.current[i] = el }}
            d={`M${x} ${y1.toFixed(2)}V${y2.toFixed(2)}`}
            {...p}
          />
        )
      })}
    </svg>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatInputProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Textarea placeholder text */
  placeholder?: string
  /**
   * Accessible label for the textarea. Required for screen reader users -
   * the animated placeholder is aria-hidden and not a valid label.
   * @example "Message Souvenir"
   */
  textareaLabel?: string
  /** Controlled value */
  value?: string
  /** Called on every keystroke with the current value */
  onChange?: (value: string) => void
  /** Called when the message is sent (Enter key or send button). Receives the current text value. */
  onSend?: (value: string) => void
  /** Called when the + (add) button is clicked */
  onAdd?: () => void
  /** Model name shown in the selector button */
  modelName?: string
  /** Called when the model selector button is clicked */
  onModelClick?: React.MouseEventHandler<HTMLButtonElement>
  /**
   * Contents of the model-selector dropdown (Figma 3208:32989). Defaults to
   * the canonical KDS model menu - `Souvenir : Advance` (switch),
   * `Adaptive thinking` (switch), `More models` (submenu with "Most used"
   * + "Recents" sections). Pass a custom `<Dropdown>` to override, or
   * `null` to opt out and use the legacy bare-button + `onModelClick`.
   */
  modelMenu?: React.ReactNode | null
  /**
   * Contents of the leading `+` add-attachment dropdown (Figma 3219:33599).
   * Defaults to the canonical KDS add menu - `Add files or photos`,
   * `Web search` (switch), `Use style` (12-row submenu, Figma 3424:1892),
   * `Add persona`, `Pin folders`. Pass a custom `<Dropdown>` to override,
   * or `null` to opt out and use the legacy bare-button + `onAdd`.
   */
  addMenu?: React.ReactNode | null
  /**
   * Persona list rendered in the Add menu's "Add persona" submenu. The
   * submenu picks its variant from `personas.length`:
   *  - `≤ 10` → compact rows-only (Figma 3430:39723).
   *  - `> 10` → adds a sticky search input above filtered rows (Figma 3436:1591).
   * Pass an empty array to render no personas. Defaults to a small
   * placeholder set so the canonical preview shows the compact variant.
   * Ignored when `addMenu` is overridden with a custom node.
   */
  personas?: ChatInputPersona[]
  /**
   * Personal pin folders - user-created folders rendered in the Add menu's
   * "Pin folders" submenu under a "Your folders" section header. Same
   * shape as `PinboardExpandedFolder` so a single source-of-truth array
   * can be passed into `ChatInput`, `Pinboard`, and `PinboardExpanded`
   * (project ↔ pinboard folder sync rule). Ignored when `addMenu` is
   * overridden with a custom node.
   */
  personalFolders?: ChatInputFolder[]
  /**
   * Project pin folders - derived from the user's Sidebar projects.
   * Rendered in the Add menu's "Pin folders" submenu under a "Project
   * folders" section header. See `specs/patterns/project-pinboard-folder-sync.md`
   * for the canonical mapping. Ignored when `addMenu` is overridden.
   */
  projectFolders?: ChatInputFolder[]
  // ── Auto-chip state (uncontrolled / controlled) ─────────────────────────
  // ChatInput owns the active state of `webSearch`, `selectedStyleId`, and
  // `selectedPersonaId` so the Add menu's switches/items and the auto-chips
  // rendered in the chips slot stay in sync. Each pair below is the
  // standard React controlled-or-uncontrolled pattern: omit both for
  // uncontrolled (internal state); pass both for controlled.
  /** Web-search toggle state. Pair with `onWebSearchChange`. */
  webSearch?: boolean
  defaultWebSearch?: boolean
  onWebSearchChange?: (next: boolean) => void
  /** Selected writing-style id (or `null` for none). Pair with `onSelectedStyleChange`. */
  selectedStyleId?: string | null
  defaultSelectedStyleId?: string | null
  onSelectedStyleChange?: (next: string | null) => void
  /** Selected persona id (or `null` for none). Pair with `onSelectedPersonaChange`. */
  selectedPersonaId?: string | null
  defaultSelectedPersonaId?: string | null
  onSelectedPersonaChange?: (next: string | null) => void
  /**
   * Chip(s) to display in the left footer slot, between the add button and
   * the model selector. Accepts any ReactNode - typically one or more `<Chip>`
   * components.
   */
  chips?: React.ReactNode
  /**
   * Attachment cards rendered inside the ChatInput above the textarea.
   * Accepts one or more `<ChatThumbnail>` elements - shown as a horizontal
   * row of 120×120px cards so the user can see what is attached.
   */
  pinCards?: React.ReactNode
  /**
   * Rendered inside the input box above the textarea.
   * Intended for the AttachmentManager chip strip.
   */
  attachmentsSlot?: React.ReactNode
  /** When true, hides the model-selector button entirely. */
  hideModelSelector?: boolean
  /**
   * Props forwarded directly to the internal `<textarea>` element.
   * Use this to wire ARIA combobox attributes when a pin-picker dropdown
   * is open: `role`, `aria-expanded`, `aria-haspopup`, `aria-controls`,
   * `aria-autocomplete`, `aria-activedescendant`.
   */
  textareaProps?: React.TextareaHTMLAttributes<HTMLTextAreaElement>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatInput({
      ref,
      placeholder = 'How can I help you today?',
      textareaLabel = 'Message',
      value: controlledValue,
      onChange,
      onSend,
      onAdd,
      modelName = 'Souvenir',
      onModelClick,
      modelMenu: modelMenuProp,
      personas         = DEFAULT_PERSONAS,
      personalFolders  = DEFAULT_PERSONAL_FOLDERS,
      projectFolders   = DEFAULT_PROJECT_FOLDERS,
      addMenu: addMenuProp,
      webSearch:               webSearchProp,
      defaultWebSearch         = false,
      onWebSearchChange,
      selectedStyleId:         selectedStyleIdProp,
      defaultSelectedStyleId   = null,
      onSelectedStyleChange,
      selectedPersonaId:       selectedPersonaIdProp,
      defaultSelectedPersonaId = null,
      onSelectedPersonaChange,
      attachmentsSlot,
      hideModelSelector = false,
      chips,
      pinCards,
      textareaProps,
      className,
      onMouseEnter: externalMouseEnter,
      onMouseLeave: externalMouseLeave,
      ...props
    // eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
    }: ChatInputProps & { ref?: React.Ref<HTMLDivElement> }) {
    const isControlled = controlledValue !== undefined
    const [internalValue, setInternalValue] = useState('')
    const value = isControlled ? controlledValue : internalValue

    // ── Auto-chip state ────────────────────────────────────────────────────
    // Three controlled-or-uncontrolled pairs. The Add menu's switches/items
    // and the chips slot's auto-chips share these state cells, so toggling
    // a switch in the menu instantly reflects in the chip row, and removing
    // a chip via × instantly clears the corresponding menu state.
    const isWebSearchControlled       = webSearchProp         !== undefined
    const isSelectedStyleControlled   = selectedStyleIdProp   !== undefined
    const isSelectedPersonaControlled = selectedPersonaIdProp !== undefined
    // eslint-disable-next-line react-doctor/no-derived-useState -- intentional draft-state pattern; reset handled by key prop or effect
    const [internalWebSearch,       setInternalWebSearch]       = useState(defaultWebSearch)
    // eslint-disable-next-line react-doctor/no-derived-useState -- intentional draft-state pattern; reset handled by key prop or effect
    const [internalSelectedStyle,   setInternalSelectedStyle]   = useState<string | null>(defaultSelectedStyleId)
    // eslint-disable-next-line react-doctor/no-derived-useState -- intentional draft-state pattern; reset handled by key prop or effect
    const [internalSelectedPersona, setInternalSelectedPersona] = useState<string | null>(defaultSelectedPersonaId)
    const webSearch         = isWebSearchControlled       ? !!webSearchProp         : internalWebSearch
    const selectedStyleId   = isSelectedStyleControlled   ? selectedStyleIdProp   ?? null : internalSelectedStyle
    const selectedPersonaId = isSelectedPersonaControlled ? selectedPersonaIdProp ?? null : internalSelectedPersona
    const setWebSearch = React.useCallback((next: boolean) => {
      if (!isWebSearchControlled) setInternalWebSearch(next)
      onWebSearchChange?.(next)
    }, [isWebSearchControlled, onWebSearchChange])
    const setSelectedStyle = React.useCallback((next: string | null) => {
      if (!isSelectedStyleControlled) setInternalSelectedStyle(next)
      onSelectedStyleChange?.(next)
    }, [isSelectedStyleControlled, onSelectedStyleChange])
    const setSelectedPersona = React.useCallback((next: string | null) => {
      if (!isSelectedPersonaControlled) setInternalSelectedPersona(next)
      onSelectedPersonaChange?.(next)
    }, [isSelectedPersonaControlled, onSelectedPersonaChange])

    // ── Default Add menu (component-level, not a story-level helper) ───────
    // `DefaultAddMenu` reads from the lifted state so toggling Web search,
    // selecting a style, or selecting a persona all flow into the chips
    // slot's auto-rendered chips. Consumers can still override the entire
    // menu by passing a custom `addMenu` node, or pass `null` to fall back
    // to the legacy bare-button + `onAdd` flow.
    const addMenu = addMenuProp === undefined ? (
      <DefaultAddMenu
        personas={personas}
        personalFolders={personalFolders}
        projectFolders={projectFolders}
        webSearch={webSearch}
        onWebSearchChange={setWebSearch}
        selectedStyleId={selectedStyleId}
        onSelectedStyleChange={setSelectedStyle}
        selectedPersonaId={selectedPersonaId}
        onSelectedPersonaChange={setSelectedPersona}
      />
    ) : addMenuProp

    const modelMenu = modelMenuProp === undefined ? <DefaultModelMenu /> : modelMenuProp

    // ── Auto-chips ─────────────────────────────────────────────────────────
    // Rendered above any consumer-provided `chips` so user-supplied chips
    // (file attachments, custom badges, etc.) appear AFTER the auto-chips.
    // Click on the persona/style chip body opens a `Dropdown.Float` picker
    // anchored to the chip; the × removes the selection (and the
    // corresponding menu state). The web-search chip has no picker - it's
    // a status indicator only; × turns it off.
    const activeStyle   = USE_STYLE_OPTIONS.find((s) => s.id === selectedStyleId) ?? null
    const activePersona = personas.find((p) => p.id === selectedPersonaId) ?? null
    const [styleChipOpen,   setStyleChipOpen]   = useState(false)
    const [personaChipOpen, setPersonaChipOpen] = useState(false)
    const autoChips = (
      <>
        {webSearch && (
          <Chip
            label="Web search"
            icon={<GlobalSearchIcon size={20} color="var(--chip-text)" />}
            onRemove={() => setWebSearch(false)}
          />
        )}
        {activeStyle && (
          <Dropdown.Float
            open={styleChipOpen}
            onOpenChange={setStyleChipOpen}
            placement="top-start"
            trigger={
              <Chip
                label={activeStyle.label}
                icon={<QuillWriteTwoIcon size={20} color="var(--chip-text)" />}
                onRemove={() => setSelectedStyle(null)}
                onExpand={() => setStyleChipOpen((v) => !v)}
              />
            }
          >
            <Dropdown size="md">
              <Dropdown.Section fluid>
                {USE_STYLE_OPTIONS.map((opt) => (
                  <Dropdown.Item
                    key={opt.id}
                    label={opt.label}
                    subLabel={opt.subLabel}
                    selected={opt.id === 'none' ? selectedStyleId === null : selectedStyleId === opt.id}
                    onClick={() => { setSelectedStyle(opt.id === 'none' ? null : opt.id); setStyleChipOpen(false) }}
                    fluid
                  />
                ))}
              </Dropdown.Section>
            </Dropdown>
          </Dropdown.Float>
        )}
        {activePersona && (
          <Dropdown.Float
            open={personaChipOpen}
            onOpenChange={setPersonaChipOpen}
            placement="top-start"
            trigger={
              <Chip
                label={activePersona.name}
                personaImage={activePersona.avatarSrc}
                onRemove={() => setSelectedPersona(null)}
                onExpand={() => setPersonaChipOpen((v) => !v)}
              />
            }
          >
            <PersonaSubmenu
              personas={personas}
              selectedId={selectedPersonaId}
              onSelect={(id) => { setSelectedPersona(id); setPersonaChipOpen(false) }}
            />
          </Dropdown.Float>
        )}
      </>
    )

    const [isFocused,    setIsFocused]    = useState(false)
    const [isHovered,    setIsHovered]    = useState(false)
    const [isRecording,  setIsRecording]  = useState(false)
    const [analyser,     setAnalyser]     = useState<AnalyserNode | null>(null)
    const [isMicHovered, setIsMicHovered] = useState(false)
    // Open state for the model-selector dropdown (Figma 3208:32989). Only
    // used when `modelMenu` is passed; otherwise the trigger Button fires
    // the legacy `onModelClick` callback and this state stays unused.
    const [modelMenuOpen, setModelMenuOpen] = useState(false)
    // Open state for the leading `+` add-menu dropdown (Figma 3219:33599).
    // Only used when `addMenu` is passed.
    const [addMenuOpen, setAddMenuOpen] = useState(false)

    const audioCtxRef = useRef<AudioContext | null>(null)
    const streamRef   = useRef<MediaStream | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // ── Cleanup on unmount ───────────────────────────────────────────────────
    useEffect(() => {
      return () => {
        streamRef.current?.getTracks().forEach(t => t.stop())
        audioCtxRef.current?.close()
      }
    }, [])

    // ── Auto-grow textarea ───────────────────────────────────────────────────
    useEffect(() => {
      const el = textareaRef.current
      if (!el) return
      el.style.height = 'auto'
      // eslint-disable-next-line react-doctor/js-batch-dom-css -- forced reflow: must read scrollHeight after resetting to auto
      el.style.height = `${el.scrollHeight}px`
    }, [value])

    // ── Recording toggle ─────────────────────────────────────────────────────
    const startRecording = async () => {
      // Set recording state immediately for instant UI feedback (icon + placeholder).
      setIsRecording(true)

      // Create AudioContext synchronously while still inside the user-gesture call
      // stack. If created after an `await`, Chrome starts it suspended and
      // getByteFrequencyData returns all zeros.
      const ctx = new AudioContext()
      audioCtxRef.current = ctx

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream

        // Resume in case the context was auto-suspended (e.g. tab in background)
        if (ctx.state === 'suspended') await ctx.resume()

        const source       = ctx.createMediaStreamSource(stream)
        const analyserNode = ctx.createAnalyser()
        analyserNode.fftSize               = 256
        analyserNode.smoothingTimeConstant = 0.75
        source.connect(analyserNode)

        setAnalyser(analyserNode)
      } catch {
        // Mic permission denied or unavailable - revert
        ctx.close()
        audioCtxRef.current = null
        setIsRecording(false)
      }
    }

    const stopRecording = () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      audioCtxRef.current?.close()
      streamRef.current  = null
      audioCtxRef.current = null
      setAnalyser(null)
      setIsRecording(false)
      onSend?.('')
    }

    const handleMicClick = () => {
      if (isRecording) stopRecording()
      else if (value) handleSend()
      else startRecording()
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!isControlled) setInternalValue(e.target.value)
      onChange?.(e.target.value)
    }

    const handleSend = () => {
      if (!value) return
      const text = value
      // Clear the textarea
      if (!isControlled) setInternalValue('')
      onChange?.('')
      // Reset height manually since auto-grow won't fire until next render
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      onSend?.(text)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && value) {
        e.preventDefault()
        handleSend()
      }
    }

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
      setIsHovered(true)
      externalMouseEnter?.(e)
    }

    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      setIsHovered(false)
      externalMouseLeave?.(e)
    }

    const shadow = isFocused ? SHADOW_FOCUS : isHovered ? SHADOW_HOVER : SHADOW_DEFAULT

    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{
          position:        'relative',
          display:         'flex',
          flexDirection:   'column',
          gap:             '24px',
          width:           '100%',
          maxWidth:        '754px',
          padding:         '20px',
          borderRadius:    '24px',
          backgroundColor: 'var(--chat-input-bg)',
          boxShadow:       shadow,
          transition:      'box-shadow 150ms',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >

        {/* ── Recording state announcer (screen readers only) ── */}
        <span
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: 'absolute',
            width: 1, height: 1,
            padding: 0, margin: -1,
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          {isRecording ? 'Recording started. Listening.' : ''}
        </span>

        {/* ── Attachments slot — chip strip above textarea ── */}
        {attachmentsSlot}

        {/* ── Pin context cards - appear above textarea when pins are inserted ──
             12 px gap (KDS override of the Figma spec sheet's 24 - chosen for
             tighter row density). The `kaya-pin-cards-row` class sets
             descending `z-index` on each child via `:nth-child` so the FIRST
             thumbnail's × button sits on top of subsequent thumbnails -
             without this, later siblings render above earlier ones (DOM-order
             default) and the × overlap looks broken. */}
        {pinCards && (
          <div
            className="kaya-pin-cards-row"
            style={{
              display:       'flex',
              flexWrap:      'wrap',
              gap:           '12px',
              paddingBottom: '8px',
            }}
          >
            {pinCards}
          </div>
        )}

        {/* ── Main content - textarea + animated placeholder ── */}
        <div style={{ position: 'relative' }}>
          {/* Custom animated placeholder - fades out when user starts typing */}
          <AnimatePresence initial={false}>
            {!value && (
              <m.div
                key="placeholder"
                aria-hidden
                initial={{ opacity: 0, filter: 'blur(2px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)', transition: { duration: 0.2 } }}
                exit={{ opacity: 0, filter: 'blur(2px)', transition: { duration: 0.15 } }}
                style={{
                  position:      'absolute',
                  top:           0,
                  left:          0,
                  right:         0,
                  pointerEvents: 'none',
                  fontFamily:    'var(--font-body)',
                  fontWeight:    'var(--font-weight-regular)',
                  fontSize:      'var(--font-size-body-lg)',
                  lineHeight:    'var(--line-height-body-lg)',
                  color:         'var(--chat-input-placeholder)',
                }}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <m.span
                    key={isRecording ? 'listening' : 'default'}
                    initial={{ scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                    animate={{ scale: 1,    opacity: 1, filter: 'blur(0px)' }}
                    exit={{    scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    style={{ display: 'block', transformOrigin: 'left center' }}
                  >
                    {isRecording ? 'Listening...' : placeholder}
                  </m.span>
                </AnimatePresence>
              </m.div>
            )}
          </AnimatePresence>

          <textarea
            ref={textareaRef}
            className="kaya-chat-textarea"
            rows={1}
            value={value}
            onChange={handleInputChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            {...textareaProps}
            aria-label={textareaLabel}
            aria-multiline="true"
            style={{
              width:               '100%',
              maxHeight:           '396px', // 18 lines × 22px line-height
              background:          'transparent',
              border:              'none',
              // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
              outline:             'none',
              resize:              'none',
              overflowY:           'auto',
              overscrollBehaviorY: 'none',
              fontFamily:          'var(--font-body)',
              fontWeight:          'var(--font-weight-regular)',
              fontSize:            'var(--font-size-body-lg)',
              lineHeight:          'var(--line-height-body-lg)',
              color:               'var(--chat-input-text)',
              caretColor:          'var(--focus-ring)',
            }}
          />
        </div>

        {/* ── Footer bar ── */}
        {/* Fixed 36 px height. Every direct child of the footer (+ IconButton,
            chips slot, model Button, mic / send IconButton) is also 36 px
            tall so the row never grows or shrinks. Adding / removing chips
            (web-search, persona, style) leaves the chat-input height
            unchanged because the slot height is already accounted for at
            this level. */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            width:          '100%',
            height:         36,
            flexShrink:     0,
          }}
        >
          {/* Left: attach button + chips slot */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {addMenu != null ? (
              // Inline Dropdown - opens above the trigger with its left
              // edge aligned to the button's left edge (top-start). Figma
              // 3219:33599.
              <Dropdown.Float
                open={addMenuOpen}
                onOpenChange={setAddMenuOpen}
                placement="top-start"
                trigger={
                  <IconButton
                    variant="ghost"
                    size="md"
                    icon={<PlusSignIcon size={20} />}
                    aria-label="Add attachment"
                  />
                }
              >
                {/* eslint-disable-next-line react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions -- click-only wrapper; keyboard users select items directly */}
                <div onClick={() => setAddMenuOpen(false)}>{addMenu}</div>
              </Dropdown.Float>
            ) : (
              <IconButton
                variant="ghost"
                size="md"
                icon={<PlusSignIcon size={20} />}
                aria-label="Add attachment"
                onClick={onAdd}
              />
            )}
            {(webSearch || activeStyle || activePersona || chips) && (
              <div
                // Chips slot (Figma 3427:27842 - web-search / persona / style /
                // consumer chips). Single row, 8 px gap between chips, no wrap
                // (a long chip row pushes the model selector but never wraps
                // to a second line - matches the reference composer's overflow
                // behaviour). Auto-chips render BEFORE consumer-provided
                // chips so file-attachment / custom badges appear after.
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {autoChips}
                {chips}
              </div>
            )}
          </div>

          {/* Right: model selector + mic/send button */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {!hideModelSelector && (modelMenu != null ? (
              // Inline Dropdown - opens above the trigger (top-start) since
              // ChatInput typically lives at the bottom of its scroll
              // container. Figma 3208:32989.
              <Dropdown.Float
                open={modelMenuOpen}
                onOpenChange={setModelMenuOpen}
                placement="top-end"
                trigger={
                  <Button
                    variant="ghost"
                    size="md"
                    rightIcon={<ArrowDownOneIcon size={16} />}
                  >
                    {modelName}
                  </Button>
                }
              >
                {modelMenu}
              </Dropdown.Float>
            ) : (
              <Button
                variant="ghost"
                size="md"
                rightIcon={<ArrowDownOneIcon size={16} />}
                onClick={onModelClick}
              >
                {modelName}
              </Button>
            ))}

            <span
              onMouseEnter={() => setIsMicHovered(true)}
              onMouseLeave={() => setIsMicHovered(false)}
              style={{ display: 'inline-flex' }}
            >
              <IconButton
                variant="default"
                size="md"
                aria-label={isRecording ? 'Stop recording' : value ? 'Send message' : 'Start recording'}
                icon={
                  <AnimatePresence mode="popLayout" initial={false}>
                    {(() => {
                      const iconKey = isRecording
                        ? (isMicHovered ? 'stop' : 'wave')
                        : value ? 'send' : 'mic'
                      const isWave = iconKey === 'wave'
                      // Wave state: no filter on enter - any filter creates a GPU compositing
                      // layer that kills SVG path updates inside AudioWaveDisplay.
                      return (
                        <m.span
                          key={iconKey}
                          initial={isWave ? { scale: 0.5, opacity: 0 }               : { scale: 0.5, opacity: 0, filter: 'blur(4px)' }}
                          animate={isWave ? { scale: 1,   opacity: 1 }               : { scale: 1,   opacity: 1, filter: 'blur(0px)' }}
                          exit={{           scale: 0.5, opacity: 0, filter: 'blur(4px)' }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {isRecording
                            ? isMicHovered
                              ? <StopCircleIcon size={20} />
                              : <AudioWaveDisplay analyser={analyser} size={20} />
                            : value
                              ? <ArrowUpTwoIcon size={20} animated triggered={isMicHovered} />
                              : <MicTwoIcon size={20} />
                          }
                        </m.span>
                      )
                    })()}
                  </AnimatePresence>
                }
                onClick={handleMicClick}
              />
            </span>
          </div>
        </div>

      </div>
    )
}

ChatInput.displayName = 'ChatInput'

export default ChatInput
