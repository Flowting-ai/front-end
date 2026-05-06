'use client'

import React, { useState } from 'react'
import { InputField } from '@/components/InputField'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { ModelFeaturedCard } from '@/components/ModelFeaturedCard'
import {
  StarIcon,
  TextIcon,
  SourceCodeSquareIcon,
  AiVisionRecognitionIcon,
  ImageTwoIcon,
  AudioWaveOneIcon,
  GlobalSearchIcon,
  SearchOneIcon,
} from '@strange-huge/icons'
import { cn } from '@/lib/utils'


// ── Hardcoded data ────────────────────────────────────────────────────────────

const TIER_TABS = [
  { value: 'all',  label: 'All'  },
  { value: 'free', label: 'Free' },
  { value: 'pro',  label: 'Pro'  },
]

const CATEGORY_TABS = [
  { value: 'favorites', label: 'Favorites', icon: <StarIcon             size={16} /> },
  { value: 'text',      label: 'Text',      icon: <TextIcon             size={16} /> },
  { value: 'code',      label: 'Code',      icon: <SourceCodeSquareIcon size={16} /> },
  { value: 'vision',    label: 'Vision',    icon: <AiVisionRecognitionIcon size={16} /> },
  { value: 'image',     label: 'Image',     icon: <ImageTwoIcon         size={16} /> },
  { value: 'audio',     label: 'Audio',     icon: <AudioWaveOneIcon     size={16} /> },
  { value: 'search',    label: 'Search',    icon: <GlobalSearchIcon     size={16} /> },
]

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PresetModelSelectorProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /**
   * Model list rows — typically `<ModelSelectItem>` components.
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

// ── Component ─────────────────────────────────────────────────────────────────

export const PresetModelSelector = React.forwardRef<HTMLDivElement, PresetModelSelectorProps>(
  function PresetModelSelector(
    {
      children,
      className,
      style,
      ...props
    },
    ref,
  ) {
    const [search,    setSearch]    = useState('')
    const [tier,      setTier]      = useState('all')
    const [category,  setCategory]  = useState('favorites')
    const [atTop,    setAtTop]    = useState(true)
    const [atBottom, setAtBottom] = useState(false)

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
          padding: '8px',
          ...style,
        }}
        {...props}
      >
        {/* ── Inner container ── */}
        <div style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           '16px',
          height:        '440px',
          maxHeight:     '440px',
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

          {/* ── Featured model card — Muse ── */}
          {/* Figma 1115:1338 → ContentSection includes the "Pro switch" cluster
             (Advanced label + Switch) at the right of the title row. */}
          <ModelFeaturedCard
            title="Muse"
            description="Knows the work before you ask. Each task finds its way to the right mind, without you lifting a setting."
            learnMoreHref="#"
            proSwitch
          />

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
                {/* Section header — outside scroll so mask doesn't affect it.
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
                      {children}
                    </div>
                  </div>

                  {/* ── Top edge — progressive blur (2→6px, behind) + color fade (in front) ── */}
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

                  {/* ── Bottom edge — progressive blur (2→6px, behind) + color fade (in front) ── */}
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
  },
)

PresetModelSelector.displayName = 'PresetModelSelector'

export default PresetModelSelector
