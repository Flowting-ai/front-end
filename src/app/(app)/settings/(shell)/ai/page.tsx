'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { LlmIcon } from '@strange-huge/icons/llm'
import { SearchOneIcon } from '@strange-huge/icons'
import { Switch } from '@/components/Switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { useAuth } from '@/context/auth-context'
import { fetchAllModels, toggleBlockModel, type LLMModel } from '@/lib/api/models'
import { bustModelsCache } from '@/lib/ai-models'
import { toast } from 'sonner'

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLlmIconId(provider: string): string {
  const p = provider.toLowerCase()
  if (p.includes('anthropic') || p.includes('claude')) return 'Claude'
  if (p.includes('openai') || p.includes('gpt'))       return 'OpenAI'
  if (p.includes('gemini'))                             return 'Gemini'
  if (p.includes('google'))                             return 'Google'
  if (p.includes('meta') || p.includes('llama'))        return 'Meta'
  if (p.includes('mistral'))                            return 'Mistral'
  if (p.includes('groq'))                               return 'Groq'
  if (p.includes('deepseek'))                           return 'DeepSeek'
  if (p.includes('xai'))                                return 'XAI'
  if (p.includes('grok'))                               return 'Grok'
  if (p.includes('cohere'))                             return 'Cohere'
  if (p.includes('perplexity'))                         return 'Perplexity'
  if (p.includes('aws') || p.includes('bedrock'))       return 'Bedrock'
  return 'OpenAI'
}

type PlanTier = 'standard' | 'pro' | 'power'
type BadgeColor = 'blue' | 'neutral' | 'red' | 'green' | 'brown' | 'purple'

const TAG_PALETTE_AI: BadgeColor[] = ['green', 'blue', 'purple', 'brown', 'neutral']
function aiTagColor(tag: string): BadgeColor {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0
  return TAG_PALETTE_AI[h % TAG_PALETTE_AI.length]
}

const PLAN_LABEL: Record<string, string> = {
  standard: 'Standard',
  pro:      'Pro',
  power:    'Power',
}

const PLAN_COLOR: Record<string, BadgeColor> = {
  standard: 'neutral',
  pro:      'blue',
  power:    'brown',
}

function formatContext(n: number | null | undefined): string | null {
  if (!n || n <= 0) return null
  if (n >= 1_000_000) return `${n / 1_000_000}M ctx`
  if (n >= 1_000)     return `${Math.round(n / 1_000)}k ctx`
  return `${n} ctx`
}

function featureLabel(model: LLMModel): string | null {
  const inputs  = model.model_inputs  ?? []
  const outputs = model.model_outputs ?? []
  const name    = model.model_name.toLowerCase()
  if (outputs.some(o => o.toLowerCase().includes('image'))) return 'Image gen'
  if (inputs.some(i  => i.toLowerCase().includes('image') || i.toLowerCase().includes('vision'))) return 'Vision'
  if (name.includes('code'))    return 'Code'
  if (name.includes('embed'))   return 'Embeddings'
  if (name.includes('whisper') || name.includes('audio')) return 'Audio'
  const ctx = model.model_context_window ?? 0
  if (ctx >= 1_000_000) return '1M+ context'
  return null
}

// ── Badge ─────────────────────────────────────────────────────────────────────

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
  purple: {
    bg:          'var(--purple-100, #f3f0ff)',
    outerShadow: '0px 1px 1.5px 0px rgba(10,2,24,0.2), 0px 0px 0px 1px rgba(109,40,217,0.5)',
    innerShadow: 'inset 0px 1px 0px 0px rgba(237,233,254,0.7), inset 0px -1px 0px 0px rgba(109,40,217,0.1)',
    color:       'var(--purple-700, #6d28d9)',
  },
}

function MiniChip({ label, color }: { label: string; color: BadgeColor }) {
  const s = BADGE_STYLES[color]
  return (
    <span
      style={{
        position:       'relative',
        display:        'inline-flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '2px',
        borderRadius:   6,
        boxShadow:      s.outerShadow,
        overflow:       'hidden',
        flexShrink:     0,
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
        padding:    '0 4px',
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        fontSize: 12,
        lineHeight: '16px',
        color:      s.color,
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    </span>
  )
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      flex:            '1 0 0',
      minWidth:        220,
      maxWidth:        340,
      display:         'flex',
      flexDirection:   'column',
      gap:             10,
      padding:         '12px 12px 16px',
      borderRadius:    16,
      backgroundColor: 'var(--neutral-white)',
      boxShadow:       '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: 'var(--neutral-100)', animation: 'pulse 0.9s ease-in-out infinite', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ height: 16, width: '60%', borderRadius: 6, backgroundColor: 'var(--neutral-100)', animation: 'pulse 0.9s ease-in-out infinite' }} />
          <div style={{ height: 12, width: '40%', borderRadius: 6, backgroundColor: 'var(--neutral-100)', animation: 'pulse 0.9s ease-in-out infinite' }} />
        </div>
        <div style={{ width: 40, height: 24, borderRadius: 12, backgroundColor: 'var(--neutral-100)', animation: 'pulse 0.9s ease-in-out infinite', flexShrink: 0 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ height: 11, borderRadius: 4, backgroundColor: 'var(--neutral-100)', animation: 'pulse 0.9s ease-in-out infinite' }} />
        <div style={{ height: 11, borderRadius: 4, backgroundColor: 'var(--neutral-100)', animation: 'pulse 0.9s ease-in-out infinite', width: '80%' }} />
      </div>
      <div style={{ display: 'flex', gap: 6, paddingTop: 8 }}>
        <div style={{ height: 20, width: 56, borderRadius: 6, backgroundColor: 'var(--neutral-100)', animation: 'pulse 0.9s ease-in-out infinite' }} />
        <div style={{ height: 20, width: 56, borderRadius: 6, backgroundColor: 'var(--neutral-100)', animation: 'pulse 0.9s ease-in-out infinite' }} />
      </div>
    </div>
  )
}

function SkeletonSection({ cardCount = 3 }: { cardCount?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '12px 24px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
      <div style={{ height: 22, width: 100, borderRadius: 6, backgroundColor: 'var(--neutral-100)', animation: 'pulse 0.9s ease-in-out infinite' }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {Array.from({ length: cardCount }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  )
}

// ── Model card ────────────────────────────────────────────────────────────────

interface ModelCardProps {
  model:     LLMModel
  toggling:  boolean
  onToggle:  (model: LLMModel) => void
}

function ModelCard({ model, toggling, onToggle }: ModelCardProps) {
  const tierKey  = (model.model_plan_type ?? 'standard').toLowerCase() as PlanTier
  const tierLbl  = PLAN_LABEL[tierKey] ?? model.model_plan_type ?? 'Standard'
  const tierClr  = (PLAN_COLOR[tierKey] ?? 'neutral') as BadgeColor
  const ctxLbl   = formatContext(model.model_context_window)
  const featLbl  = featureLabel(model)
  const iconId   = toLlmIconId(model.model_provider)

  return (
    <div
      style={{
        flex:            '1 0 0',
        minWidth:        220,
        maxWidth:        340,
        display:         'flex',
        flexDirection:   'column',
        gap:             8,
        padding:         '12px 12px 16px',
        borderRadius:    16,
        backgroundColor: 'var(--neutral-white)',
        boxShadow:       model.blocked
          ? '0px 2px 2.8px 0px rgba(82,75,71,0.06), 0px 0px 0px 1px var(--neutral-100)'
          : '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
        opacity:         model.blocked ? 0.7 : 1,
        transition:      'opacity 200ms, box-shadow 200ms',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flex: '1 0 0', minWidth: 0, gap: 12, alignItems: 'flex-start' }}>
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
            <LlmIcon id={iconId} variant="color" size={24} />
          </div>
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
              {model.model_name}
            </p>
            <p style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   600,
              fontSize: 12,
              lineHeight:   '16px',
              color:        'var(--neutral-500)',
              margin:       0,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              {model.model_provider}
            </p>
          </div>
        </div>
        <Switch
          checked={!model.blocked}
          onCheckedChange={() => onToggle(model)}
          disabled={toggling}
        />
      </div>

      {/* Description */}
      {model.model_description && (
        <p style={{
          fontFamily:       'var(--font-body)',
          fontWeight:       400,
          fontSize: 12,
          lineHeight:       '16px',
          color:            'var(--neutral-500)',
          margin:           0,
          overflow:         'hidden',
          display:          '-webkit-box',
          WebkitLineClamp:  3,
          WebkitBoxOrient:  'vertical',
        }}>
          {model.model_description}
        </p>
      )}

      {/* Labels */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', paddingTop: 8 }}>
        <MiniChip label={tierLbl} color={tierClr} />
        {ctxLbl && <MiniChip label={ctxLbl} color="red" />}
        {featLbl && <MiniChip label={featLbl} color="green" />}
        {model.model_thinking_efforts?.map((e) => (
          <MiniChip key={`effort-${e}`} label={e} color="purple" />
        ))}
        {model.model_tags?.map((tag) => (
          <MiniChip key={tag} label={tag} color={aiTagColor(tag)} />
        ))}
      </div>
    </div>
  )
}

// ── Provider section ──────────────────────────────────────────────────────────

function ProviderSection({
  provider,
  displayModels,
  allProviderModels,
  togglingId,
  onToggle,
  divider,
}: {
  provider:          string
  displayModels:     LLMModel[]
  allProviderModels: LLMModel[]
  togglingId:        string | null
  onToggle:          (model: LLMModel) => void
  divider?:          boolean
}) {
  const enabledCount = allProviderModels.filter(m => !m.blocked).length
  const totalCount   = allProviderModels.length

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      gap:           24,
      padding:       '12px 24px 24px',
      borderBottom:  divider ? '1px solid var(--neutral-100)' : undefined,
    }}>
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
        <MiniChip label={`${enabledCount}/${totalCount} enabled`} color="brown" />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'stretch' }}>
        {displayModels.map(model => (
          <ModelCard
            key={model.model_id}
            model={model}
            toggling={togglingId === model.model_id}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AiModelsPage() {
  const { user }   = useAuth()
  const planName   = user?.planName ?? 'Starter'

  const [models,     setModels]     = useState<LLMModel[]>([])
  const [isLoading,  setIsLoading]  = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [search,     setSearch]     = useState('')
  const [tab,        setTab]        = useState('all')

  // Fetch on mount
  useEffect(() => {
    let alive = true
    setIsLoading(true)
    fetchAllModels()
      .then(data => { if (alive) setModels(data) })
      .catch(() => { if (alive) setModels([]) })
      .finally(() => { if (alive) setIsLoading(false) })
    return () => { alive = false }
  }, [])

  // Toggle handler — optimistic update + rollback on failure
  const handleToggle = useCallback(async (model: LLMModel) => {
    if (togglingId) return
    setTogglingId(model.model_id)
    const nextBlocked = !model.blocked
    // Optimistic
    setModels(prev => prev.map(m =>
      m.model_id === model.model_id ? { ...m, blocked: nextBlocked } : m,
    ))
    try {
      const result = await toggleBlockModel(model.model_id)
      // Reconcile with backend response
      setModels(prev => prev.map(m =>
        m.model_id === model.model_id ? { ...m, blocked: result.blocked } : m,
      ))
      // Bust the shared model cache so selectors elsewhere pick up the change immediately
      bustModelsCache()
    } catch {
      // Rollback
      setModels(prev => prev.map(m =>
        m.model_id === model.model_id ? { ...m, blocked: model.blocked } : m,
      ))
      toast.error(`Failed to update ${model.model_name}`)
    } finally {
      setTogglingId(null)
    }
  }, [togglingId])

  // All unique providers (preserving order from API)
  const allProviders = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const m of models) {
      if (!seen.has(m.model_provider)) {
        seen.add(m.model_provider)
        out.push(m.model_provider)
      }
    }
    return out
  }, [models])

  // Filtered models (tab + search)
  const filteredModels = useMemo(() => {
    const q = search.toLowerCase().trim()
    return models.filter(m => {
      if (tab === 'enabled'  &&  m.blocked) return false
      if (tab === 'disabled' && !m.blocked) return false
      if (q && !m.model_name.toLowerCase().includes(q) && !m.model_provider.toLowerCase().includes(q)) return false
      return true
    })
  }, [models, search, tab])

  // Providers that have at least one visible model after filtering
  const visibleProviders = useMemo(
    () => allProviders.filter(p => filteredModels.some(m => m.model_provider === p)),
    [allProviders, filteredModels],
  )

  const totalEnabled = models.filter(m => !m.blocked).length

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
        padding:        '64px 24px 48px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* ── Header ── */}
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

        {/* ── Search + filter ── */}
        <div style={{
          border:        '1px solid var(--neutral-200)',
          borderRadius:  16,
          boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
          overflow:      'hidden',
          padding:       '12px 24px',
          display:       'flex',
          alignItems:    'center',
          gap:           24,
        }}>
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
              placeholder="Search models by name or provider…"
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
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList size="small">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="enabled">Enabled</TabsTrigger>
              <TabsTrigger value="disabled">Disabled</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* ── Models card ── */}
        <div style={{
          border:        '1px solid var(--neutral-200)',
          borderRadius:  16,
          boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
          overflow:      'hidden',
          paddingTop:    12,
          paddingBottom: 12,
        }}>
          {/* Card header */}
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          4,
            padding:      '12px 24px 24px',
            borderBottom: '1px solid var(--neutral-100)',
          }}>
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
                {isLoading ? 'Loading models…' : `${models.length} models available`}
              </p>
              {!isLoading && (
                <MiniChip label={`${planName} · ${totalEnabled} enabled`} color="blue" />
              )}
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <>
              <SkeletonSection cardCount={3} />
              <SkeletonSection cardCount={3} />
              <SkeletonSection cardCount={2} />
            </>
          ) : visibleProviders.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-400)',
                margin:     0,
              }}>
                {models.length === 0
                  ? 'No models found. Please check your connection and try again.'
                  : 'No models match your search.'}
              </p>
            </div>
          ) : (
            visibleProviders.map((provider, i) => (
              <ProviderSection
                key={provider}
                provider={provider}
                displayModels={filteredModels.filter(m => m.model_provider === provider)}
                allProviderModels={models.filter(m => m.model_provider === provider)}
                togglingId={togglingId}
                onToggle={handleToggle}
                divider={i < visibleProviders.length - 1}
              />
            ))
          )}
        </div>

        {/* ── Info card ── */}
        <div style={{
          border:          '1px solid var(--neutral-200)',
          borderRadius:    16,
          boxShadow:       '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
          overflow:        'hidden',
          padding:         '12px 24px',
          backgroundColor: 'var(--neutral-50)',
        }}>
          <p style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   500,
            fontSize:     16,
            lineHeight:   '22px',
            color:        'var(--neutral-900)',
            margin:       '0 0 2px',
          }}>
            Disabled models are excluded from auto-routing and per-task assignment
          </p>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-500)',
            margin:     0,
          }}>
            If a model assigned to a task category is disabled, Souvenir will fall back to the nearest equivalent within your routing preference.
          </p>
        </div>

      </div>
    </div>
  )
}
