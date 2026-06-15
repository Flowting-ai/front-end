'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { InputField } from '@/components/InputField'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { ModelFeaturedCard } from '@/components/ModelFeaturedCard'
import {
  AtomTwoIcon,
  BookmarkTwoIcon,
  TextIcon,
  SourceCodeSquareIcon,
  ImageTwoIcon,
  SearchOneIcon,
} from '@strange-huge/icons'
import { LlmIcon } from '@strange-huge/icons/llm'
import { cn } from '@/lib/utils'
import { fetchModelsWithCache } from '@/lib/ai-models'
import { getModelLlmId } from '@/lib/model-icons'
import type { AIModel } from '@/types/ai-model'


// ── Hardcoded data ────────────────────────────────────────────────────────────

const TIER_TABS = [
  { value: 'free', label: 'Free' },
  { value: 'pro',  label: 'Pro'  },
]

const CATEGORY_TABS = [
  { value: 'all',        label: 'All',        icon: <AtomTwoIcon          size={16} /> },
  { value: 'favorites',  label: 'Favorites',  icon: <BookmarkTwoIcon      size={16} /> },
  { value: 'text',       label: 'Text',       icon: <TextIcon             size={16} /> },
  { value: 'code',       label: 'Code',       icon: <SourceCodeSquareIcon size={16} /> },
  { value: 'image',      label: 'Image',      icon: <ImageTwoIcon         size={16} /> },
  { value: 'web-search', label: 'Web Search', icon: <SearchOneIcon        size={16} /> },
]

// ── Context ───────────────────────────────────────────────────────────────────
// Lets descendants (e.g. ModelSelectItem) react to the active category without
// the consumer having to thread props. Used to suppress the per-row bookmark
// IconButton when the Favorites category is active - the whole list IS the
// favorites set, so the per-row toggle would be redundant.

export const ModelSelectorContext = React.createContext<{ category: string; provider: string; tier: string; search: string } | null>(null)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ModelSelectorProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /**
   * Model list rows - typically `<ModelSelectItem>` components.
   * Rendered in a scrollable list below the section header.
   */
  children?: React.ReactNode
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

const captionStyle: React.CSSProperties = {
  fontFamily:  'var(--font-body)',
  fontWeight:  'var(--font-weight-medium)',
  fontSize:    'var(--font-size-caption)',
  lineHeight:  'var(--line-height-caption)',
  color:       'var(--neutral-500)',
  whiteSpace:  'nowrap',
}

// ── Featured-mode row (Muse / Advanced) ───────────────────────────────────────
// Two ModelFeaturedCards side-by-side, behaving as a radio pair. Per Figma
// 3457:19624: gap 8px, each card flex: 1 0 0, Muse starts in the Selected
// variant. Selecting one deselects the other.

type FeaturedMode = 'muse' | 'advanced'

function FeaturedModeRow() {
  const [mode, setMode] = useState<FeaturedMode>('muse')

  return (
    <div style={{
      display:    'flex',
      gap:        '8px',
      alignItems: 'flex-start',
      width:      '100%',
      flexShrink: 0,
    }}>
      <div style={{ flex: '1 0 0', minWidth: 0 }}>
        <ModelFeaturedCard
          title="Muse"
          description="Cost-efficient routing for everyday tasks. Fast, smart, and easy on your credits."
          selected={mode === 'muse'}
          onSelectedChange={(next) => { if (next) setMode('muse') }}
        />
      </div>
      <div style={{ flex: '1 0 0', minWidth: 0 }}>
        <ModelFeaturedCard
          title="Advanced"
          description="Top-tier models for your most demanding work. Maximum quality, no compromises."
          selected={mode === 'advanced'}
          onSelectedChange={(next) => { if (next) setMode('advanced') }}
        />
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ModelSelector({
    ref,
    children,
    className,
    style,
    ...props
  // eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
  }: ModelSelectorProps & { ref?: React.Ref<HTMLDivElement> }) {
    const [search,    setSearch]    = useState('')
    const [tier,      setTier]      = useState('free')
    const [category,  setCategory]  = useState('all')
    const [provider,  setProvider]  = useState('all')
    const [atTop,    setAtTop]    = useState(true)
    const [atBottom, setAtBottom] = useState(false)
    const [allModels, setAllModels] = useState<AIModel[]>([])

    // Fetch models once to build the provider tab list
    useEffect(() => {
      fetchModelsWithCache().then(setAllModels).catch(() => {})
    }, [])

    // Derive sorted company list (most models first), same logic as CompareModels
    const companies = useMemo(() => {
      const counts: Record<string, number> = {}
      for (const m of allModels) counts[m.companyName] = (counts[m.companyName] ?? 0) + 1
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c]) => c)
    }, [allModels])

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget
      setAtTop(el.scrollTop < 34)
      setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8)
    }

    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{
          padding:       '8px',
          height:        '456px',
          display:       'flex',
          flexDirection: 'column',
          ...style,
        }}
        {...props}
      >
        {/* ── Inner container ── */}
        <div style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           '16px',
          flex:          '1 0 0',
          minHeight:     0,
        }}>

          {/* ── Header: search + tier tabs ── */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', width: '100%', flexShrink: 0 }}>
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <InputField
                size="small"
                showLabel={false}
                label="Search models"
                showSubtitle={false}
                leftIcon={<SearchOneIcon size={16} />}
                placeholder="Look up your model…"
                value={search}
                onChange={setSearch}
                fluid
              />
            </div>

            {/* Tier filter tabs */}
            <Tabs value={tier} onValueChange={setTier}>
              <TabsList size="small">
                {TIER_TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value}>
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* ── Featured model row: Muse + Advanced - Figma 3457:19624 ── */}
          {/* Two ModelFeaturedCards side-by-side (gap 8px), each flex: 1 0 0.
             Muse defaults to the Selected variant; Advanced to Default. They
             behave as a radio pair - selecting one deselects the other. */}
          <FeaturedModeRow />

          {/* ── Provider filter tabs (below Muse buttons) ── */}
          {companies.length > 0 && (
            <div style={{ flexShrink: 0 }}>
              <Tabs value={provider} onValueChange={setProvider}>
                <TabsList size="small" scrollable>
                  <TabsTrigger value="all" icon={<AtomTwoIcon size={16} />}>
                    All
                  </TabsTrigger>
                  {companies.map((company) => {
                    const rep   = allModels.find(m => m.companyName === company)
                    const llmId = rep ? (getModelLlmId(rep.companyName, rep.modelName) ?? '') : ''
                    return (
                      <TabsTrigger
                        key={company}
                        value={company}
                        icon={llmId ? <LlmIcon id={llmId} variant="color" size={16} /> : undefined}
                      >
                        {company}
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </Tabs>
            </div>
          )}

          {/* ── Models: category tabs + list ── */}
          <div style={{
            display:       'flex',
            flexDirection: 'column',
            gap:           '8px',
            flex:          '1 0 0',
            minHeight:     0,
            width:         '100%',
          }}>

            {/* Category tabs */}
            <div style={{ flexShrink: 0 }}>
              <Tabs value={category} onValueChange={setCategory}>
                <TabsList size="small" scrollable>
                  {CATEGORY_TABS.map((t) => (
                    <TabsTrigger key={t.value} value={t.value} icon={t.icon}>
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {/* Model list */}
            {children && (
              <div style={{ flex: '1 0 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {/* Section header - outside scroll so mask doesn't affect it.
                   Figma 1115:1338 → pt-4 pr-38 pb-2 pl-34. Right padding aligns
                   the "Input" caption over the row's right-edge icon column
                   (input-type indicator), not the bookmark slot. */}
                <div style={{
                  display:    'flex',
                  gap:        '8px',
                  alignItems: 'center',
                  padding:    '4px 38px 2px 34px',
                  flexShrink: 0,
                }}>
                  <span style={{ ...captionStyle, flex: '1 0 0' }}>Top Models</span>
                  <span style={{ ...captionStyle, flexShrink: 0 }}>Input</span>
                </div>

                {/* Scroll area + gradient overlays */}
                <div style={{ position: 'relative', flex: '1 0 0', minHeight: 0 }}>

                  <div
                    className="kaya-scrollbar"
                    onScroll={handleScroll}
                    style={{
                      position:            'absolute',
                      inset:               0,
                      overflowY:           'auto',
                      overscrollBehaviorY: 'contain',
                      padding:             '2px',
                      paddingRight:        '8px',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginRight: '-6px' }}>
                      <ModelSelectorContext.Provider value={{ category, provider, tier, search }}>
                        {children}
                      </ModelSelectorContext.Provider>
                    </div>
                  </div>

                  {/* ── Top edge - progressive blur (2→6px, behind) + color fade (in front) ── */}
                  {[
                    { height: 40, blur: 2 },
                    { height: 28, blur: 3 },
                    { height: 18, blur: 5 },
                    { height: 10, blur: 6 },
                  ].map(({ height, blur }) => (
                    <div key={blur} aria-hidden style={{
                      position:            'absolute',
                      top: 0, left: 0, right: 0,
                      height:              `${height}px`,
                      backdropFilter:      `blur(${blur}px)`,
                      WebkitBackdropFilter:`blur(${blur}px)`,
                      maskImage:           'linear-gradient(to bottom, black 0%, transparent 100%)',
                      WebkitMaskImage:     'linear-gradient(to bottom, black 0%, transparent 100%)',
                      pointerEvents:       'none',
                      zIndex:              10,
                      opacity:             atTop ? 0 : 1,
                      transition:          'opacity 150ms ease',
                    }} />
                  ))}
                  <div aria-hidden style={{
                    position:      'absolute',
                    top:           0, left: 0, right: 0,
                    height:        '40px',
                    background:    'linear-gradient(to bottom, white 0%, transparent 100%)',
                    pointerEvents: 'none',
                    zIndex:        11,
                    opacity:       atTop ? 0 : 1,
                    transition:    'opacity 150ms ease',
                  }} />

                  {/* ── Bottom edge - progressive blur (2→6px, behind) + color fade (in front) ── */}
                  {[
                    { height: 40, blur: 2 },
                    { height: 28, blur: 3 },
                    { height: 18, blur: 5 },
                    { height: 10, blur: 6 },
                  ].map(({ height, blur }) => (
                    <div key={blur} aria-hidden style={{
                      position:            'absolute',
                      bottom: 0, left: 0, right: 0,
                      height:              `${height}px`,
                      backdropFilter:      `blur(${blur}px)`,
                      WebkitBackdropFilter:`blur(${blur}px)`,
                      maskImage:           'linear-gradient(to top, black 0%, transparent 100%)',
                      WebkitMaskImage:     'linear-gradient(to top, black 0%, transparent 100%)',
                      pointerEvents:       'none',
                      zIndex:              10,
                      opacity:             atBottom ? 0 : 1,
                      transition:          'opacity 150ms ease',
                    }} />
                  ))}
                  <div aria-hidden style={{
                    position:      'absolute',
                    bottom:        0, left: 0, right: 0,
                    height:        '40px',
                    background:    'linear-gradient(to top, white 0%, transparent 100%)',
                    pointerEvents: 'none',
                    zIndex:        11,
                    opacity:       atBottom ? 0 : 1,
                    transition:    'opacity 150ms ease',
                  }} />

                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    )
}

ModelSelector.displayName = 'ModelSelector'

export default ModelSelector
