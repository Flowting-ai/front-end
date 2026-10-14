'use client'

import React, { useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { validateTitle } from '@/lib/library/forms'
import { useRenameFile } from '@/lib/library/mutations'
import type { LibraryFile } from '@/lib/library/file'
import { sanitizeDisplayText } from '@/lib/library/format'

/** Rename: one field, validated with the shared schema, saved optimistically. Only the owner can open it. */
export function RenameDialog({ file, onClose }: { file: LibraryFile; onClose: () => void }) {
  const [title, setTitle] = useState(file.title)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const errorId = useId()
  const rename = useRenameFile()

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const result = validateTitle(title)
    if (!result.ok) {
      setError(result.error)
      inputRef.current?.focus()
      return
    }
    if (result.title === file.title) {
      onClose()
      return
    }
    rename.mutate(
      { id: file.id, title: result.title, previousTitle: file.title, previousAi: file.titleIsAiGenerated },
      // On failure the mutation already toasted and rolled the title back; the dialog stays open to try again.
      { onSuccess: () => onClose() },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !rename.isPending) onClose() }}>
      <DialogContent size="sm" onOpenAutoFocus={(event) => { event.preventDefault(); inputRef.current?.select() }}>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Rename file</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <label htmlFor={`${errorId}-input`} style={{ display: 'block', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)', marginBottom: 6 }}>
              Name
            </label>
            <input
              ref={inputRef}
              id={`${errorId}-input`}
              value={title}
              onChange={(event) => { setTitle(event.target.value); if (error) setError(null) }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              autoComplete="off"
              spellCheck={false}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 10, border: 'none', outline: 'none',
                background: 'var(--text-field-bg)', color: 'var(--neutral-900)', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px',
                boxShadow: error ? '0 0 0 1.5px var(--color-tag-Red-text)' : '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--text-field-ring)',
              }}
            />
            {error && (
              <p id={errorId} role="alert" style={{ margin: '6px 0 0', fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--color-tag-Red-text)' }}>
                {error}
              </p>
            )}
            <p style={{ margin: '8px 0 0', fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '18px', color: 'var(--neutral-500)' }}>
              Currently &ldquo;{sanitizeDisplayText(file.title)}&rdquo;. The file type stays .{file.extension || 'as is'}.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={rename.isPending} onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={rename.isPending}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
