'use client'

import React from 'react'
import Link from 'next/link'
import { formatLabel } from '@/lib/library/format'
import { LIBRARY_FILE_ROUTE } from '@/lib/routes'
import type { OpenFileRef } from '@/lib/library/sources'
import { AiGeneratedTag } from '../FileMarks'
import { FormatGlyph } from '../FormatGlyph'
import styles from './LibraryChat.module.css'

/**
 * A file Souvenir made in this chat (a chat Output), as a card in the answer. It is marked AI-generated
 * (PRD; the prototype marks chat outputs with the same badge on the File page) and opens its File page.
 */
export function ChatOutputCard({ file }: { file: OpenFileRef }) {
  return (
    <Link className={styles.output} href={LIBRARY_FILE_ROUTE(file.id)}>
      <FormatGlyph format={file.format} size="md" />
      <span className={styles.grow}>
        <span>{file.title}</span>
        <small>{formatLabel(file.format)}{file.extension ? ` · .${file.extension}` : ''}</small>
      </span>
      <AiGeneratedTag />
    </Link>
  )
}
