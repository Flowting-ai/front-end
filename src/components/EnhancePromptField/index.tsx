'use client'

import React, { useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { AnimatePresence, m } from 'framer-motion'
import { LaurelWreathOneIcon } from '@strange-huge/icons'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EnhanceScanningState } from '@/components/EnhanceScanningState'
import type { EnhanceMode } from '@/enhance'
import { BlockErrorBoundary } from '@/components/chat/BlockErrorBoundary'
import { cn } from '@/lib/utils'
import { useEnhanceFlow } from './use-enhance-flow'

// The open-state views (Q&A, diff, markdown preview) load on the first open, not with the editor.
const EnhancePanel = dynamic(() => import('./EnhancePanel'), { ssr: false, loading: () => <EnhanceScanningState /> })

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnhancePromptFieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Current system prompt value (controlled). */
  value:            string
  /** Fires whenever the prompt text changes (typing OR an Apply commit). */
  onChange:         (next: string) => void
  /** Textarea placeholder when empty. */
  placeholder?:     string
  /** Optional label for screen readers. */
  ariaLabel?:       string
  /**
   * Forces a specific mode regardless of scan results. Useful for stories /
   * documentation; production should let `scanPrompt` decide.
   */
  forceMode?:       EnhanceMode
  /**
   * Visible field label rendered above the container (matches the Figma
   * "System Instruction" label). Pass `null` to omit the label entirely.
   * Defaults to "System Instruction".
   */
  label?:           React.ReactNode
  /**
   * Optional content rendered in the bottom-left of the idle footer, opposite
   * the Enhance button. Use for undo/redo controls or similar adornments. Not
   * rendered while the field is in an open Enhance state.
   */
  footerLeft?:      React.ReactNode
}

// Max textarea height before internal scroll kicks in (container max = 534, minus 24px padding, 25px gap, 36px footer)
const TEXTAREA_MAX_H = 449

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * The agent editor's system prompt field with Enhance. This file is the shell (textarea, container,
 * error boundary, animation); the flow lives in use-enhance-flow.ts and lib/enhance/enhance-flow.ts,
 * and the open views in EnhancePanel.tsx.
 */
export function EnhancePromptField(
  {
    value,
    onChange,
    placeholder = "Describe your agent's goals, expertise, tone, and responsibilities. Example: 'You are a senior UX researcher who specializes in…'",
    ariaLabel = 'System prompt',
    forceMode,
    label = 'System Instruction',
    footerLeft,
    className,
    style,
    ref,
    ...props
  }: EnhancePromptFieldProps & { ref?: React.Ref<HTMLDivElement> },
) {
    const flow = useEnhanceFlow({
      value,
      forceMode,
      // Applying replaces the whole prompt, so it can be taken back from the toast.
      onApply: (draft, previous) => {
        onChange(draft)
        toast('Prompt enhanced', { action: { label: 'Undo', onClick: () => onChange(previous) } })
      },
    })
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const isOpen = flow.state.phase !== 'idle'

    useEffect(() => {
      const ta = textareaRef.current
      if (!ta || isOpen) return
      ta.style.height = 'auto'
      const newH = Math.min(ta.scrollHeight, TEXTAREA_MAX_H)
      ta.style.height = `${newH}px`
      ta.style.overflowY = ta.scrollHeight > TEXTAREA_MAX_H ? 'auto' : 'hidden'
    }, [value, isOpen])

    const containerStateStyle: React.CSSProperties = isOpen ? {
      backgroundColor: 'var(--color-enhance-surface-open)',
      borderColor:     'var(--color-enhance-border-open)',
      borderWidth:     1.5,
    } : {
      backgroundColor: 'var(--field-surface)',
      borderColor:     'var(--border-default)',
      borderWidth:     1,
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           8,
          width:         '100%',
          ...style,
        }}
      >
        {/* Field label - Figma "System Instruction" sits above the container */}
        {label && (
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 'var(--font-weight-regular)',
              fontSize:   'var(--font-size-body)',
              lineHeight: 'var(--line-height-body)',
              color:      'var(--neutral-900)',
            }}
          >
            {label}
          </span>
        )}

        <div
          role={isOpen ? 'dialog' : undefined}
          aria-label={isOpen ? 'Enhance your system prompt' : undefined}
          style={{
            position:        'relative',
            width:           '100%',
            borderRadius:    18,
            borderStyle:     'solid',
            overflow:        'hidden',
            ...(isOpen ? { height: 534 } : { minHeight: 120 }),
            transition:      'background-color 200ms ease, border-color 200ms ease, border-width 200ms ease',
            ...containerStateStyle,
          }}
          {...props}
          onKeyDown={(e) => {
            props.onKeyDown?.(e)
            if (e.key === 'Escape' && isOpen && !e.defaultPrevented) {
              e.preventDefault()
              flow.close()
            }
          }}
        >
        {/* Idle: textarea fills, footer pinned in flex flow at bottom — matches Figma node I848:53731;1677:7723 */}
        {!isOpen && (
          <div
            style={{
              display:       'flex',
              flexDirection: 'column',
              gap:           25,
              padding:       12,
              boxSizing:     'border-box',
            }}
          >
            <textarea
              ref={textareaRef}
              aria-label={ariaLabel}
              className="kaya-enhance-textarea kaya-scrollbar"
              placeholder={placeholder}
              value={value}
              onChange={e => onChange(e.target.value)}
              style={{
                width:      '100%',
                minHeight:  100,
                padding:    0,
                border:     'none',
                background: 'transparent',
                resize:     'none',
                overflow:   'hidden',
                outline:    'none',
                fontFamily: 'Inter, var(--font-body)',
                fontWeight: 400,
                fontSize:   14,
                lineHeight: 1.29,
                color:      'var(--neutral-700)',
              }}
            />
            <div
              style={{
                flexShrink:     0,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                gap:            8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {footerLeft}
              </div>
              <Button
                size="md"
                variant="default"
                onClick={flow.open}
                leftIcon={<LaurelWreathOneIcon />}
              >
                Enhance
              </Button>
            </div>
          </div>
        )}

        {/* Open: EnhanceBox replaces the textarea. A crash in the diff/preview
            returns to the idle textarea instead of losing the editor. */}
        <BlockErrorBoundary
          label="enhance panel"
          resetKey={flow.state.phase}
          fallback={
            <div role="alert" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 }}>
              <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-700)', textAlign: 'center' }}>
                Enhance hit a problem. Your prompt is unchanged.
              </p>
              <Button size="md" variant="secondary" onClick={flow.close}>Back to editing</Button>
            </div>
          }
        >
        <AnimatePresence initial={false}>
          {isOpen && (
            <m.div
              key={flow.state.phase}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position:      'absolute',
                inset:         0,
                padding:       '20px 20px 16px',
                display:       'flex',
                flexDirection: 'column',
                gap:           16,
                minHeight:     0,
                borderRadius:  18,
              }}
            >
              <EnhancePanel flow={flow} value={value} />
            </m.div>
          )}
        </AnimatePresence>
        </BlockErrorBoundary>
        </div>
      </div>
    )
}

EnhancePromptField.displayName = 'EnhancePromptField'

export default EnhancePromptField

