'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CHAT_MESSAGES } from '@/lib/library/messages'
import { askSaveTitle, type OpenFileRef } from '@/lib/library/sources'
import { FormatGlyph } from '../FormatGlyph'
import styles from './LibraryChat.module.css'

export interface AskSaveDialogProps {
  /** The files on the sent message (from the stream's `ask_save` event). */
  files: OpenFileRef[]
  /** Save true: `POST /library/uploads/resolve {messageId, save: true}`. Closing counts as Don't save. */
  onChoose: (save: boolean) => void
  busy?: boolean
}

/** "Ask each time": after a send, one question for that message's files. Don't save keeps them in the chat. */
export function AskSaveDialog({ files, onChoose, busy = false }: AskSaveDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onChoose(false) }}>
      <DialogContent size="sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{askSaveTitle(files.length)}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className={styles.usage}>
            {files.map((file) => (
              <div className={styles.usageRow} key={file.id}>
                <FormatGlyph format={file.format} size="xs" />
                <span className={styles.usageName}>{file.title}</span>
              </div>
            ))}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" disabled={busy} onClick={() => onChoose(false)}>{CHAT_MESSAGES.dontSave}</Button>
          <Button loading={busy} onClick={() => onChoose(true)}>{CHAT_MESSAGES.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
