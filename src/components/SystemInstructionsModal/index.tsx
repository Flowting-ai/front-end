'use client'

import React, { useEffect, useRef, useState } from 'react'
import { PenOneIcon, CancelOneIcon } from '@strange-huge/icons'
import { toast } from 'sonner'
import { IconButton, Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SystemInstructionsModalProps {
  open:          boolean
  projectName?:  string
  value:         string
  onSave:        (text: string) => void | Promise<void>
  onClose:       () => void
  maxLength?:    number
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SystemInstructionsModal({
  open,
  projectName,
  value,
  onSave,
  onClose,
  maxLength = 2000,
}: SystemInstructionsModalProps) {
  const [draft,   setDraft]   = useState(value ?? '')
  // Which button triggered the in-flight save, so only that one shows a
  // spinner — Save and Clear both call onSave, but sharing one boolean made
  // clicking Clear also flip Save's label/spinner.
  const [savingAction, setSavingAction] = useState<'save' | 'clear' | null>(null)
  const saving = savingAction !== null
  const prevOpenRef = useRef(false)

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setDraft(value ?? '')
    }
    prevOpenRef.current = open
  }, [open, value])

  async function handleSave() {
    setSavingAction('save')
    try {
      await onSave(draft.trim())
      toast.success('System instructions saved')
      onClose()
    } catch {
      // error toast already shown by the caller
    } finally {
      setSavingAction(null)
    }
  }

  async function handleClear() {
    setDraft('')
    setSavingAction('clear')
    try {
      await onSave('')
      toast.success('System instructions cleared')
      onClose()
    } catch {
      // error toast already shown by the caller
    } finally {
      setSavingAction(null)
    }
  }

  const muted = 'm-0 font-[family-name:var(--font-body)] font-[var(--font-weight-regular)]'

  return (
    <Dialog open={open} onOpenChange={next => { if (!next) onClose() }}>
      <DialogContent
        hideClose
        // A save in flight keeps the modal up so its result lands here.
        onEscapeKeyDown={e => { if (saving) e.preventDefault() }}
        onInteractOutside={e => { if (saving) e.preventDefault() }}
        style={{
          width:        560,
          minHeight:    580,
          maxHeight:    'calc(100vh - 64px)',
          borderRadius: 20,
          boxShadow:    '0px 8px 32px 0px rgba(26,23,20,0.24), 0px 0px 0px 1px rgba(59,54,50,0.12)',
        }}
      >
        {/* ── Header ── */}
        <div className="flex shrink-0 items-center gap-3 px-5 pb-4 pt-5">
          {/* Icon badge */}
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--neutral-50)] shadow-[0px_1px_1.5px_0px_rgba(82,75,71,0.12),0px_0px_0px_1px_var(--neutral-100)]">
            <PenOneIcon size={18} animated />
          </div>

          {/* Title + subtitle */}
          <div className="min-w-0 flex-[1_0_0]">
            {/* style={undefined} drops the shell's default title type so these classes apply. */}
            <DialogTitle style={undefined} className="m-0 truncate font-[family-name:var(--font-title)] font-[var(--font-weight-regular)] text-2xl leading-8 text-[var(--legacy-1a1714)]">
              System Instructions
            </DialogTitle>
            {projectName && (
              <p className={`${muted} truncate text-xs leading-[18px] text-[var(--neutral-400)]`}>{projectName}</p>
            )}
          </div>

          <DialogClose asChild>
            <IconButton variant="ghost" size="xs" icon={<CancelOneIcon />} aria-label="Close" />
          </DialogClose>
        </div>

        {/* Divider */}
        <div className="h-px shrink-0 bg-[var(--neutral-100)]" />

        {/* ── Body ── */}
        <div className="kaya-scrollbar flex min-h-0 flex-[1_1_0] flex-col overflow-y-auto py-5">
          {/* Horizontal padding lives on this inner wrapper, not the
              scrolling element above — keeps the scrollbar flush with the
              modal's edge. Stretches to fill the scroll container so the
              textarea below can in turn flex to fill this. */}
          <div className="flex min-h-0 flex-[1_1_0] flex-col gap-3.5 px-5">
            <DialogDescription style={undefined} className={`${muted} text-[13px] leading-5 text-[var(--neutral-500)]`}>
              Set context for every chat in this project.
            </DialogDescription>

            <div className="flex min-h-0 flex-[1_1_0] flex-col gap-1.5">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, maxLength))}
                maxLength={maxLength}
                placeholder="e.g. Always respond in British English. Format all code in TypeScript. Be concise and avoid filler phrases..."
                autoFocus
                disabled={saving}
                className={`kaya-scrollbar ${muted.replace('m-0 ', '')} box-border min-h-[220px] w-full flex-[1_1_0] resize-none rounded-xl border border-[var(--border-default)] bg-[var(--field-surface)] px-3.5 py-3 text-sm leading-[22px] text-[var(--legacy-1a1714)] shadow-[0px_1px_1.5px_0px_rgba(82,75,71,0.08)] outline-none focus:border-[var(--blue-400)] focus:shadow-[0px_0px_0px_3px_rgba(74,131,191,0.25),0px_1px_1.5px_0px_rgba(82,75,71,0.12)]`}
              />
              <p className={`${muted} text-right text-xs leading-4 text-[var(--neutral-400)]`}>
                {draft.length} / {maxLength}
              </p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px shrink-0 bg-[var(--neutral-100)]" />

        {/* ── Footer ── */}
        <div className="flex shrink-0 items-center justify-end gap-2 px-5 py-4">
          <Button variant="cancel" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="secondary" onClick={handleClear} loading={savingAction === 'clear'} disabled={!value || saving}>Clear</Button>
          <Button variant="save" onClick={handleSave} loading={savingAction === 'save'} disabled={saving}>Save instructions</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default SystemInstructionsModal
