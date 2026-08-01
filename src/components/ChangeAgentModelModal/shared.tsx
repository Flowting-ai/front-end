'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { m, AnimatePresence } from 'framer-motion'
import { useMounted } from '@/hooks/use-mounted'
import { stableKey } from '@/hooks/use-model-selection'
import { Badge } from '@/components/Badge'
import { ModelSelectItem } from '@/components/ModelSelectItem'
import { SouvenirModelIcon } from '@/components/SouvenirModelIcon'
import { fetchModelsWithCache, sortModelsByTier } from '@/lib/ai-models'
import type { AIModel } from '@/types/ai-model'

// ── Shadows ───────────────────────────────────────────────────────────────────

export const SHADOW_MODAL = '0px 8px 32px 0px rgba(82,75,71,0.18), 0px 0px 0px 1px var(--neutral-100)'

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Why an agent's configured model can't be used right now.
 * 'blocked'  — still in the catalog, but turned off for this account.
 * 'retired'  — gone from the catalog entirely (deprecated by the provider).
 * The two need different copy: only one of them is something the user did.
 */
export type ModelUnavailableReason = 'retired' | 'blocked'

// ── useModelCatalog ───────────────────────────────────────────────────────────

const EMPTY_MODELS: AIModel[] = []

/**
 * Loads the model catalog while `open` is true.
 *
 * `all` is the raw catalog — `fetchModelsWithCache` deliberately includes
 * blocked models so name lookups still resolve for an agent pinned to one.
 * `available` is the only list safe to *offer*: models the backend currently
 * serves and this account hasn't turned off. Offering a blocked model here
 * would just swap one unusable model for another.
 *
 * Forces a fresh fetch on every open — the whole point of these modals is
 * recovering from a stale model assignment, so a cached catalog is exactly
 * the wrong input. A previously loaded list is kept on screen while that
 * fetch is in flight, so only the very first open ever shows a spinner.
 */
export function useModelCatalog(open: boolean) {
  // null means "never loaded", which is the only true loading state.
  const [all, setAll] = useState<AIModel[] | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetchModelsWithCache({ force: true })
      .then(list => { if (!cancelled) setAll(list) })
      .catch(() => { if (!cancelled) setAll(prev => prev ?? EMPTY_MODELS) })
    return () => { cancelled = true }
  }, [open])

  // Advanced → Standard → Basic, same fixed order as every other model
  // selector in the app (chat switcher, Instructions tab).
  const available = useMemo(
    () => sortModelsByTier((all ?? EMPTY_MODELS).filter(model => !model.blocked && !!stableKey(model))),
    [all],
  )

  return { all: all ?? EMPTY_MODELS, available, loading: all === null }
}

// ── ModalShell ────────────────────────────────────────────────────────────────

export interface ModalShellProps {
  open: boolean
  /** Called on backdrop click and Escape. Guard it yourself while saving. */
  onClose: () => void
  ariaLabel: string
  width?: number
  children: React.ReactNode
}

/** Portal + backdrop + centered dialog, with Escape-to-close and initial focus. */
export function ModalShell({ open, onClose, ariaLabel, width = 420, children }: ModalShellProps) {
  const mounted   = useMounted()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  // Move focus into the dialog so Escape and Tab land here rather than on
  // whatever card was behind it.
  useEffect(() => {
    if (open) dialogRef.current?.focus()
  }, [open])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <m.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{
              position:        'fixed',
              inset:           0,
              backgroundColor: 'rgba(0,0,0,0.28)',
              backdropFilter:  'blur(2px)',
              zIndex:          60,
            }}
          />

          <div
            style={{
              position:       'fixed',
              inset:          0,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              zIndex:         61,
              pointerEvents:  'none',
              padding:        16,
            }}
          >
            <m.div
              key="modal"
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label={ariaLabel}
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{
                pointerEvents:   'auto',
                width,
                maxWidth:        '100%',
                maxHeight:       'calc(100vh - 32px)',
                borderRadius:    16,
                backgroundColor: 'var(--neutral-white)',
                boxShadow:       SHADOW_MODAL,
                overflow:        'hidden',
                display:         'flex',
                flexDirection:   'column',
                outline:         'none',
              }}
            >
              {children}
            </m.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// ── ModalHeader ───────────────────────────────────────────────────────────────

export function ModalHeader({ title, subtitle, left, right }: {
  title:     string
  subtitle?: React.ReactNode
  /** Slot before the title (e.g. a back button in the picker step). */
  left?:     React.ReactNode
  /** Slot pinned to the top-right (e.g. the close button). */
  right?:    React.ReactNode
}) {
  return (
    <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--neutral-100)', position: 'relative', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 32 }}>
        {left}
        <p style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 400, lineHeight: '2rem', color: 'var(--neutral-900)' }}>
          {title}
        </p>
      </div>
      {subtitle && (
        <p style={{ margin: '3px 0 0', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', fontWeight: 400, lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-400)' }}>
          {subtitle}
        </p>
      )}
      {right && <div style={{ position: 'absolute', top: 14, right: 14 }}>{right}</div>}
    </div>
  )
}

// ── ModelPickerList ───────────────────────────────────────────────────────────

export interface ModelPickerListProps {
  /** Selectable models — pass `available` from `useModelCatalog`, never `all`. */
  models:        AIModel[]
  loading:       boolean
  selectedId:    string | null
  /** Stable id of the model to tag "Recommended" (from `pickReplacementModel`). */
  recommendedId?: string | null
  onSelect:      (modelId: string) => void
  maxHeight?:    number
}

export function ModelPickerList({
  models,
  loading,
  selectedId,
  recommendedId,
  onSelect,
  maxHeight = 320,
}: ModelPickerListProps) {
  const message = loading
    ? 'Loading models…'
    : models.length === 0
      ? 'No models are available right now. Try again in a moment.'
      : null

  return (
    <div
      className="kaya-scrollbar"
      style={{
        display:             'flex',
        flexDirection:       'column',
        gap:                 '4px',
        margin:              '16px 16px 0',
        padding:             '2px',
        maxHeight,
        overflowY:           'auto',
        overscrollBehaviorY: 'contain',
      }}
    >
      {message ? (
        <p style={{ margin: '20px 0', textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', color: 'var(--neutral-400)' }}>
          {message}
        </p>
      ) : (
        models.map(model => {
          const key = stableKey(model)
          if (!key) return null
          return (
            <ModelSelectItem
              key={key}
              role="button"
              tabIndex={0}
              aria-pressed={key === selectedId}
              image={<SouvenirModelIcon size={18} />}
              label={model.modelName}
              selected={key === selectedId}
              icons={key === recommendedId ? <Badge label="Recommended" color="Green" /> : undefined}
              onClick={() => onSelect(key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(key)
                }
              }}
            />
          )
        })
      )}
    </div>
  )
}
