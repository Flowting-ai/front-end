'use client'

import React from 'react'
import { InformationCircleIcon } from '@strange-huge/icons'
import { Dropdown } from '@/components/Dropdown'
import { CHAT_MESSAGES } from '@/lib/library/messages'
import styles from './LibraryChat.module.css'

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className={styles.note}>
      <InformationCircleIcon size={14} />
      {children}
    </p>
  )
}

export interface ComposerLibraryNotesProps {
  /** The Admin turned off AI use of Library (`aiReferenceAllowed: false`). Attaching still works. */
  librarySearchOff: boolean
  /** "Don't save files from this chat" is on. */
  dontSave: boolean
}

/** One quiet line each under the composer, as in the prototype. Renders nothing when neither applies. */
export function ComposerLibraryNotes({ librarySearchOff, dontSave }: ComposerLibraryNotesProps) {
  if (!librarySearchOff && !dontSave) return null
  return (
    <>
      {librarySearchOff && <Note>{CHAT_MESSAGES.librarySearchOffNote}</Note>}
      {dontSave && <Note>{CHAT_MESSAGES.dontSaveNote}</Note>}
    </>
  )
}

/** The chat's More menu item: "Don't save files from this chat", with "They stay in this chat" under it. */
export function DontSaveMenuItem({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <Dropdown.Item
      label={CHAT_MESSAGES.dontSaveFromChat}
      subLabel={CHAT_MESSAGES.dontSaveFromChatHint}
      fluid
      showCheckbox
      checkboxChecked={checked}
      onCheckboxChange={onChange}
    />
  )
}
