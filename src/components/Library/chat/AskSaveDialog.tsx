'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CHAT_MESSAGES } from '@/lib/library/messages'
import type { Format } from '@/lib/library/schemas'
import { askSaveTitle } from '@/lib/library/sources'
import { FormatGlyph } from '../FormatGlyph'
import styles from './LibraryChat.module.css'

export interface AskSaveFile {
  key: string
  name: string
  format: Format | null
}

export interface AskSaveDialogProps {
  files: AskSaveFile[]
  /** Closing the dialog counts as Don't save: the files stay in the chat. */
  onChoose: (save: boolean) => void
}

/** "Ask each time": one question on send for that message's files. Save is the default (focused) choice. */
export function AskSaveDialog({ files, onChoose }: AskSaveDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onChoose(false) }}>
      <DialogContent size="sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{askSaveTitle(files.length)}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className={styles.usage}>
            {files.map((file) => (
              <div className={styles.usageRow} key={file.key}>
                {file.format && <FormatGlyph format={file.format} size="xs" />}
                <span className={styles.usageName}>{file.name}</span>
              </div>
            ))}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onChoose(false)}>{CHAT_MESSAGES.dontSave}</Button>
          <Button autoFocus onClick={() => onChoose(true)}>{CHAT_MESSAGES.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
