'use client'

import React, { useState, useMemo } from 'react'
import { LlmIcon } from '@strange-huge/icons/llm'
import { SearchOneIcon } from '@strange-huge/icons'
import { Switch } from '@/components/Switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { useAuth } from '@/context/auth-context'

// ── Model data ────────────────────────────────────────────────────────────────

type BadgeColor = 'blue' | 'neutral' | 'red' | 'green' | 'brown'

interface ModelDef {
  id:          string
  name:        string
  provider:    string
  llmIconId:   string
  description: string
  tierLabel:   string
  tierColor:   'blue' | 'neutral'
  contextLabel:string
  featureLabel:string
  enabledByDefault: boolean
}

const MODELS: ModelDef[] = [
  // OpenAI
  {
    id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', llmIconId: 'OpenAI',
    description: 'GPT-4o is OpenAI\'s most capable multimodal model, combining text and vision with best-in-class reasoning, instruction-following, and a 128k context window.',
    tierLabel: 'Starter', tierColor: 'neutral', contextLabel: '128k ctx', featureLabel: 'Best reasoning model',
    enabledByDefault: true,
  },
  {
    id: 'gpt-4o-mini', name: 'GPT-4o mini', provider: 'OpenAI', llmIconId: 'OpenAI',
    description: 'GPT-4o Mini is a compact version of GPT-4o, designed for lightweight reasoning tasks. It offers the same instruction-following quality at lower cost and latency.',
    tierLabel: 'Starter', tierColor: 'neutral', contextLabel: '128k ctx', featureLabel: 'Fast & affordable',
    enabledByDefault: true,
  },
  {
    id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI', llmIconId: 'OpenAI',
    description: 'GPT-4 Turbo is an optimized version of GPT-4 with an extended 128k context window, improved instruction following, and updated knowledge.',
    tierLabel: 'Pro', tierColor: 'blue', contextLabel: '128k ctx', featureLabel: 'Extended context',
    enabledByDefault: true,
  },
  // Anthropic
  {
    id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'Anthropic', llmIconId: 'Claude',
    description: 'Sonnet 4.6 is Anthropic\'s most capable Sonnet-class model yet, with frontier performance across coding, agents, and professional work. It excels at iterative development and complex codebase navigation.',
    tierLabel: 'Pro', tierColor: 'blue', contextLabel: '200k ctx', featureLabel: 'Best for coding',
    enabledByDefault: true,
  },
  {
    id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'Anthropic', llmIconId: 'Claude',
    description: 'Claude Haiku 4.5 is the fastest and most compact model in the Claude 4 family, ideal for high-throughput tasks that need near-instant responses.',
    tierLabel: 'Starter', tierColor: 'neutral', contextLabel: '200k ctx', featureLabel: 'Fastest response',
    enabledByDefault: false,
  },
  {
    id: 'claude-opus-4', name: 'Claude Opus 4', provider: 'Anthropic', llmIconId: 'Claude',
    description: 'Claude Opus 4 is Anthropic\'s most powerful model, designed for tasks that require deep analysis, nuanced judgement, and extended multi-turn research.',
    tierLabel: 'Pro', tierColor: 'blue', contextLabel: '200k ctx', featureLabel: 'Deepest reasoning',
    enabledByDefault: false,
  },
  // Google
  {
    id: 'gemini-2-5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', llmIconId: 'Gemini',
    description: 'Gemini 2.5 Pro is Google\'s state-of-the-art model designed for advanced reasoning, coding, mathematics, and scientific tasks. It employs "thinking" capabilities to reason through complex problems.',
    tierLabel: 'Starter', tierColor: 'neutral', contextLabel: '1M ctx', featureLabel: 'Largest context',
    enabledByDefault: true,
  },
  {
    id: 'gemini-2-5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', llmIconId: 'Gemini',
    description: 'Gemini 2.5 Flash is the lightweight sibling of 2.5 Pro, optimised for speed and efficiency while retaining the same multimodal and reasoning foundations.',
    tierLabel: 'Starter', tierColor: 'neutral', contextLabel: '1M ctx', featureLabel: 'Fast & efficient',
    enabledByDefault: true,
  },
  {
    id: 'gemini-1-5-pro', name: 'Gemini 1.5 Pro', provider: 'Google', llmIconId: 'Gemini',
    description: 'Gemini 1.5 Pro introduced Google\'s breakthrough million-token context window. It handles long documents, videos, and code repositories in a single prompt.',
    tierLabel: 'Pro', tierColor: 'blue', contextLabel: '1M ctx', featureLabel: 'Million token ctx',
    enabledByDefault: true,
  },
]

const PROVIDERS = ['OpenAI', 'Anthropic', 'Google'] as const

// ── Badge helpers ─────────────────────────────────────────────────────────────

const BADGE_STYLES: Record<BadgeColor, {
  bg: string; outerShadow: string; innerShadow: string; color: string
}> = {
  blue: {
    bg:          'var(--blue-100)',
    outerShadow: '0px 1px 1.5px 0px rgba(2,15,24,0.2), 0px 0px 0px 1px rgba(13,110,178,0.5)',
    innerShadow: 'inset 0px 1px 0px 0px rgba(231,244,253,0.7), inset 0px -1px 0px 0px rgba(13,110,178,0.1)',
    color:       'var(--blue-700)',
  },
  neutral: {
    bg:          'var(--neutral-100)',
    outerShadow: '0px 1px 1.5px 0px rgba(18,12,8,0.2), 0px 0px 0px 1px rgba(106,98,93,0.5)',
    innerShadow: 'inset 0px 1px 0px 0px rgba(247,242,237,0.7), inset 0px -1px 0px 0px rgba(106,98,93,0.1)',
    color:       'var(--neutral-700)',
  },
  red: {
    bg:          'var(--red-100)',
    outerShadow: '0px 1px 1.5px 0px rgba(24,2,2,0.2), 0px 0px 0px 1px rgba(159,38,35,0.5)',
    innerShadow: 'inset 0px 1px 0px 0px rgba(253,231,231,0.7), inset 0px -1px 0px 0px rgba(159,38,35,0.1)',
    color:       'var(--red-700)',
  },
  green: {
    bg:          'var(--green-50)',
    outerShadow: '0px 1px 1.5px 0px rgba(17,25,1,0.2), 0px 0px 0px 1px rgba(128,183,7,0.5)',
    innerShadow: 'inset 0px 1px 0px 0px rgba(247,254,230,0.7), inset 0px -1px 0px 0px rgba(128,183,7,0.1)',
    color:       'var(--green-800)',
  },
  brown: {
    bg:          'var(--brown-100)',
    outerShadow: '0px 1px 1.5px 0px rgba(20,12,5,0.2), 0px 0px 0px 1px rgba(126,84,53,0.5)',
    innerShadow: 'inset 0px 1px 0px 0px rgba(250,241,235,0.7), inset 0px -1px 0px 0px rgba(126,84,53,0.1)',
    color:       'var(--brown-700)',
  },
}

function MiniChip({ label, color }: { label: string; color: BadgeColor }) {
  const s = BADGE_STYLES[color]
  return (
    <span
      style={{
        position:        'relative',
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '2px',
        borderRadius:    6,
        boxShadow:       s.outerShadow,
        overflow:        'hidden',
        flexShrink:      0,
      }}
    >
      <span aria-hidden style={{
        position:        'absolute',
        inset:           0,
        borderRadius:    6,
        backgroundColor: s.bg,
        pointerEvents:   'none',
      }} />
      <span aria-hidden style={{
        position:     'absolute',
        inset:        0,
        borderRadius: 'inherit',
        boxShadow:    s.innerShadow,
        pointerEvents:'none',
      }} />
      <span style={{
        position:   'relative',
        padding:    '0 2px',
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        fontSize:   11,
        lineHeight: '16px',
        color:      s.color,
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    </span>
  )
}

// ── Model card ────────────────────────────────────────────────────────────────

function ModelCard({
  model,
  enabled,
  onToggle,
}: {
  model: ModelDef
  enabled: boolean
  onToggle: (id: string, next: boolean) => void
}) {
  return (
    <div
      style={{
        flex:            '1 0 0',
        minWidth:        0,
        display:         'flex',
        flexDirection:   'column',
        gap:             8,
        padding:         '12px 12px 16px',
        borderRadius:    16,
        backgroundColor: 'var(--neutral-white)',
        boxShadow:       '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
        overflow:        'hidden',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flex: '1 0 0', minWidth: 0, gap: 12, alignItems: 'flex-start' }}>
          {/* Icon wrapper */}
          <div style={{
            width:           44,
            height:          44,
            borderRadius:    10,
            backgroundColor: 'transparent',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            flexShrink:      0,
            overflow:        'hidden',
          }}>
            <LlmIcon id={model.llmIconId} size={24} />
          </div>

          {/* Name + provider */}
          <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignSelf: 'stretch' }}>
            <p style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   500,
              fontSize:     16,
              lineHeight:   '22px',
              color:        'var(--neutral-900)',
              margin:       0,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              {model.name}
            </p>
            <p style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   600,
              fontSize:     11,
              lineHeight:   '16px',
              color:        'var(--neutral-700)',
              margin:       0,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              {model.provider}
            </p>
          </div>
        </div>

        {/* Toggle */}
        <Switch
          checked={enabled}
          onCheckedChange={next => onToggle(model.id, next)}
        />
      </div>

      {/* Description */}
      <p style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 400,
        fontSize:   11,
        lineHeight: '16px',
        color:      'var(--neutral-500)',
        margin:     0,
        maxHeight:  48,
        overflow:   'hidden',
        display:    '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
      }}>
        {model.description}
      </p>

      {/* Labels row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', rowGap: 6, alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <MiniChip label={model.tierLabel} color={model.tierColor} />
          <MiniChip label={model.contextLabel} color="red" />
        </div>
        <MiniChip label={model.featureLabel} color="green" />
      </div>
    </div>
  )
}

// ── Provider section ──────────────────────────────────────────────────────────

function ProviderSection({
  provider,
  models,
  enabledIds,
  onToggle,
  divider,
}: {
  provider: string
  models: ModelDef[]
  enabledIds: Set<string>
  onToggle: (id: string, next: boolean) => void
  divider?: boolean
}) {
  const enabledCount = models.filter(m => enabledIds.has(m.id)).length

  return (
    <div
      style={{
        display:      'flex',
        flexDirection:'column',
        gap:          24,
        padding:      '12px 24px 24px',
        borderBottom: divider ? '1px solid var(--neutral-100)' : undefined,
      }}
    >
      {/* Provider label + count badge */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          fontSize:   14,
          lineHeight: '22px',
          color:      'var(--neutral-900)',
          margin:     0,
          whiteSpace: 'nowrap',
        }}>
          {provider}
        </p>
        <MiniChip label={`${enabledCount}/${models.length} enabled`} color="brown" />
      </div>

      {/* Model card grid */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        {models.map(model => (
          <ModelCard
            key={model.id}
            model={model}
            enabled={enabledIds.has(model.id)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AiModelsPage() {
  const { user } = useAuth()
  const planName = user?.planName ?? 'Starter'

  const [search,  setSearch]  = useState('')
  const [tab,     setTab]     = useState('all')
  const [enabled, setEnabled] = useState<Set<string>>(
    () => new Set(MODELS.filter(m => m.enabledByDefault).map(m => m.id))
  )

  const handleToggle = (id: string, next: boolean) => {
    setEnabled(prev => {
      const next2 = new Set(prev)
      next2[next ? 'add' : 'delete'](id)
      return next2
    })
  }

  const filteredModels = useMemo(() => {
    const q = search.toLowerCase().trim()
    return MODELS.filter(m => {
      if (tab === 'enabled'  && !enabled.has(m.id)) return false
      if (tab === 'disabled' &&  enabled.has(m.id)) return false
      if (q && !m.name.toLowerCase().includes(q) && !m.provider.toLowerCase().includes(q)) return false
      return true
    })
  }, [search, tab, enabled])

  const visibleProviders = useMemo(
    () => PROVIDERS.filter(p => filteredModels.some(m => m.provider === p)),
    [filteredModels],
  )

  const totalEnabled = enabled.size

  return (
    <div
      className="kaya-scrollbar"
      style={{
        flex:           '1 0 0',
        minHeight:      0,
        overflowY:      'auto',
        overflowX:      'hidden',
        display:        'flex',
        alignItems:     'flex-start',
        justifyContent: 'center',
        padding:        '96px 155px 48px',
      }}
    >
      <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* ── Page header ── */}
        <div style={{ paddingLeft: 4, marginBottom: 4 }}>
          <h1 style={{
            fontFamily:   'var(--font-title)',
            fontWeight:   400,
            fontSize:     24,
            lineHeight:   '32px',
            color:        'var(--neutral-900)',
            margin:       0,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            AI &amp; Models
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-500)',
            margin:     0,
          }}>
            Enable or disable the AI models available across chat, personas, and workflows.
          </p>
        </div>

        {/* ── Search + filter card ── */}
        <div
          style={{
            border:          '1px solid var(--neutral-200)',
            borderRadius:    16,
            boxShadow:       '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
            overflow:        'hidden',
            padding:         '12px 24px',
            display:         'flex',
            alignItems:      'center',
            gap:             24,
          }}
        >
          {/* Search input */}
          <div style={{
            flex:            '1 0 0',
            minWidth:        0,
            display:         'flex',
            alignItems:      'center',
            gap:             2,
            padding:         '7px 10px',
            borderRadius:    10,
            backgroundColor: 'var(--neutral-white)',
            boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
          }}>
            <SearchOneIcon size={16} color="var(--neutral-400)" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search models by name or provider..."
              style={{
                flex:            '1 0 0',
                minWidth:        0,
                border:          'none',
                outline:         'none',
                backgroundColor: 'transparent',
                fontFamily:      'var(--font-body)',
                fontWeight:      400,
                fontSize:        14,
                lineHeight:      '22px',
                color:           'var(--neutral-900)',
                padding:         '0 2px',
              }}
            />
          </div>

          {/* Tab filter */}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList size="small">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="enabled">Enabled</TabsTrigger>
              <TabsTrigger value="disabled">Disabled</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* ── Models card ── */}
        <div
          style={{
            border:        '1px solid var(--neutral-200)',
            borderRadius:  16,
            boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
            overflow:      'hidden',
            paddingTop:    12,
            paddingBottom: 12,
          }}
        >
          {/* Card header */}
          <div
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          4,
              padding:      '12px 24px 24px',
              borderBottom: '1px solid var(--neutral-100)',
            }}
          >
            <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', gap: 12, alignItems: 'center' }}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   16,
                lineHeight: '22px',
                color:      'var(--neutral-900)',
                margin:     0,
                whiteSpace: 'nowrap',
              }}>
                {MODELS.length}+ Models available
              </p>
              <MiniChip label={`${planName} · ${totalEnabled} enabled`} color="blue" />
            </div>

            {/* Filter icon button */}
            <button
              aria-label="Filter models"
              style={{
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                width:           32,
                height:          32,
                borderRadius:    8,
                border:          'none',
                backgroundColor: 'transparent',
                cursor:          'pointer',
                flexShrink:      0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 5h14M6 10h8M9 15h2" stroke="var(--neutral-500)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Provider sections */}
          {visibleProviders.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-500)',
                margin:     0,
              }}>
                No models match your search.
              </p>
            </div>
          ) : (
            visibleProviders.map((provider, i) => (
              <ProviderSection
                key={provider}
                provider={provider}
                models={filteredModels.filter(m => m.provider === provider)}
                enabledIds={enabled}
                onToggle={handleToggle}
                divider={i < visibleProviders.length - 1}
              />
            ))
          )}
        </div>

        {/* ── Info card ── */}
        <div
          style={{
            border:          '1px solid var(--neutral-200)',
            borderRadius:    16,
            boxShadow:       '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
            overflow:        'hidden',
            padding:         '12px 24px',
            backgroundColor: 'var(--neutral-50)',
          }}
        >
          <p style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   500,
            fontSize:     16,
            lineHeight:   '22px',
            color:        'var(--neutral-900)',
            margin:       '0 0 2px',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            Disabled models are excluded from auto-routing and per-task assignment
          </p>
          <p style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   400,
            fontSize:     14,
            lineHeight:   '22px',
            color:        'var(--neutral-500)',
            margin:       0,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            If a model assigned to a task category is disabled, Souvenir will fall back to the nearest equivalent within your routing preference.
          </p>
        </div>

      </div>
    </div>
  )
}
