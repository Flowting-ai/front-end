'use client'

import React, { useRef, useState } from 'react'
import { ApiError } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { AttachmentStrip } from '@/components/Library/upload/AttachmentStrip'
import { LazyPickerDialog } from '@/components/Library/picker/LazyPickerDialog'
import { LIBRARY_MOCK } from '@/lib/feature-flags'
import { getLibraryApi } from '@/lib/library/api'
import { displayFileName } from '@/lib/library/format'
import type { LibraryFileRow } from '@/lib/library/schemas'
import type { MockLibraryApi } from '@/lib/library/mock/api.mock'
import { useLibraryUploads } from '@/lib/library/upload/use-library-uploads'
import { LibraryChatPlayground } from './LibraryChatPlayground'

const SAMPLES: { label: string; name: string; bytes: number; note: string }[] = [
  { label: 'Normal PDF', name: 'Price list.pdf', bytes: 1_500_000, note: 'uploads, processes, becomes ready' },
  { label: 'Large (3 parts)', name: 'Catalog.xlsx', bytes: 17_000_000, note: 'three 8 MB parts, shows progress' },
  { label: 'Slow processing', name: 'slow report.pdf', bytes: 800_000, note: 'flagged "taking longer than usual"' },
  { label: 'Password-protected', name: 'password locked.pdf', bytes: 400_000, note: 'refused with a message' },
  { label: 'Unsafe', name: 'virus.pdf', bytes: 400_000, note: 'blocked' },
  { label: 'Unreadable', name: 'corrupt.pdf', bytes: 400_000, note: 'refused with a message' },
  { label: 'Unsupported type', name: 'tool.exe', bytes: 1_000, note: 'refused before uploading' },
]

const heading: React.CSSProperties = { margin: '0 0 8px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 15, color: 'var(--neutral-900)' }
const note: React.CSSProperties = { margin: 0, fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)' }

function sampleFile(name: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type: 'application/octet-stream' })
}

/** Dev playground for the composer-side Library pieces. See page.tsx. */
export function LibraryPlayground() {
  const uploads = useLibraryUploads('playground')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [attached, setAttached] = useState<LibraryFileRow[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  const control = async (): Promise<MockLibraryApi['control'] | null> => {
    if (!LIBRARY_MOCK) return null
    return ((await getLibraryApi()) as MockLibraryApi).control
  }

  return (
    <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 880 }}>
      <header>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)' }}>Library playground</h1>
        <p style={note}>Dev only. {LIBRARY_MOCK ? 'Running on the mock: sample files, with failures chosen by file name.' : 'Running on the real Library API.'}</p>
      </header>

      <section aria-labelledby="pg-uploads">
        <h2 id="pg-uploads" style={heading}>Attachments in the composer</h2>
        <p style={{ ...note, marginBottom: 12 }}>Send is held until every attachment is Ready: <b>{uploads.canSend ? 'Send enabled' : `Send held (${uploads.blocking} in progress)`}</b></p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {SAMPLES.map((sample) => (
            <Button key={sample.name} variant="secondary" size="sm" title={sample.note} onClick={() => uploads.addFiles([sampleFile(sample.name, sample.bytes)])}>{sample.label}</Button>
          ))}
          <Button size="sm" onClick={() => fileInput.current?.click()}>Choose files</Button>
          <input ref={fileInput} type="file" multiple hidden onChange={(event) => { uploads.addFiles(Array.from(event.target.files ?? [])); event.target.value = '' }} />
        </div>
        <AttachmentStrip uploads={uploads} />
        {uploads.readyFileIds.length > 0 && (
          <p style={{ ...note, marginTop: 12 }}>
            Ready for the chat send: {uploads.readyFileIds.length} staged file{uploads.readyFileIds.length === 1 ? '' : 's'}.{' '}
            <button type="button" onClick={uploads.release} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', color: 'inherit', font: 'inherit' }}>Simulate sending (release the draft)</button>
          </p>
        )}
        <p style={{ ...note, marginTop: 12 }}>Go offline in the browser tools to see an upload pause and resume, and refuse a 13th file to see the per-message cap.</p>
      </section>

      <section aria-labelledby="pg-picker">
        <h2 id="pg-picker" style={heading}>Add from Library</h2>
        <Button variant="secondary" onClick={() => setPickerOpen(true)}>Open the picker</Button>
        {attached.length > 0 && (
          <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-700)' }}>
            {attached.map((file) => <li key={file.id}>{displayFileName(file)}</li>)}
          </ul>
        )}
        {pickerOpen && (
          <LazyPickerDialog
            excludeIds={attached.map((file) => file.id)}
            onClose={() => setPickerOpen(false)}
            onConfirm={(files) => setAttached((current) => [...current, ...files])}
          />
        )}
      </section>

      <LibraryChatPlayground />

      {LIBRARY_MOCK && (
        <section aria-labelledby="pg-mock">
          <h2 id="pg-mock" style={heading}>Mock switches</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={async () => (await control())?.failNext('listFiles', new ApiError(500, 'boom', 'Something went wrong'))}>Fail the next list</Button>
            <Button variant="secondary" size="sm" onClick={async () => (await control())?.failNext('getFile', new ApiError(500, 'boom', 'Something went wrong'))}>Fail the next file</Button>
            <Button variant="secondary" size="sm" onClick={async () => (await control())?.setFlags({ sharing: false })}>Turn sharing off</Button>
            <Button variant="secondary" size="sm" onClick={async () => (await control())?.setFlags({ sharing: true })}>Turn sharing on</Button>
            <Button variant="secondary" size="sm" onClick={async () => (await control())?.setMyRemoval(true)}>Ask me the transfer question</Button>
          </div>
          <p style={{ ...note, marginTop: 8 }}>The transfer question appears on Library settings. Open /library/files/f_lookbook for the locked state, /library/files/nope for the gone state.</p>
        </section>
      )}
    </div>
  )
}
