'use client'

import React from 'react'
import type { DraftUploads } from '@/lib/library/upload/use-library-uploads'
import { AttachmentCard } from './AttachmentCard'
import { UploadNotices } from './UploadNotices'

/**
 * The composer's attachment row: one card per file that is still part of the draft (failed ones leave
 * with a message above), plus the notices. The composer owns the `uploads` object (useLibraryUploads)
 * so it also reads `canSend` from it to hold Send until every attachment is ready.
 */
export function AttachmentStrip({ uploads }: { uploads: DraftUploads }) {
  const { items, cancel, forget } = uploads
  const visible = items.filter((item) => item.status !== 'failed' && item.status !== 'cancelled')
  if (items.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <UploadNotices items={items} onDismiss={forget} />
      {visible.length > 0 && (
        <div role="list" aria-label="Attachments" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {visible.map((item) => (
            <div role="listitem" key={item.id}>
              <AttachmentCard item={item} onCancel={cancel} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
