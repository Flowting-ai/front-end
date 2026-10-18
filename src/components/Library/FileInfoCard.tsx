'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { BubbleChatIcon, CalendarFoldIcon, CancelOneIcon, DeleteTwoIcon, DownloadOneIcon, FileTwoIcon, PenOneIcon, ViewOffSlashIcon } from '@strange-huge/icons'
import { Button, IconButton } from '@/components/ui/button'
import { Tooltip } from '@/components/Tooltip'
import { Skeleton } from '@/components/Skeleton'
import { ONLY_OWNER_TIP, personName } from '@/lib/library/access'
import { formatBytes, formatDateTime, formatLabel, sanitizeDisplayText } from '@/lib/library/format'
import { useFileAccess, useFileUsage } from '@/lib/library/queries'
import type { LibraryFileDetail } from '@/lib/library/file'
import { FILE_MESSAGES } from '@/lib/library/messages'
import { CHAT_ROUTE, LIBRARY_FILE_ROUTE, SCHEDULES_ROUTE } from '@/lib/routes'
import { AiGeneratedTag, GeneratedMark } from './FileMarks'
import { FormatGlyph } from './FormatGlyph'
import { PersonAvatar, WorkspaceAvatar } from './PersonAvatar'
import styles from './FileScreen.module.css'

const label: React.CSSProperties = { fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)' }
const value: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', overflowWrap: 'anywhere' }

function Pair({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '88px minmax(0, 1fr)', gap: 12, padding: '5px 0' }}>
      <dt style={label}>{name}</dt>
      <dd style={{ ...value, margin: 0 }}>{children}</dd>
    </div>
  )
}

// Long lists stay short in the card: the first few, then "Show all N". The share dialog has the full access list.
const USED_IN_PREVIEW = 5
const ACCESS_PREVIEW = 5

const PATH_LABEL = { all: 'Library / All files', shared: 'Library / Shared', trash: 'Library / Trash' } as const

const ROUTINE_ROUTE = (id: string) => `${SCHEDULES_ROUTE}/${encodeURIComponent(id)}`
const linkStyle: React.CSSProperties = { color: 'inherit', textDecoration: 'underline' }

/**
 * Where it came from, in the prototype's words: "Uploaded by Maya in Slack, <chat>", "Made by Souvenir in a
 * chat, <chat>", "Made by routine <routine>, run of Oct 6" or "..., test run". The chat is a link only for
 * someone who can open that chat; the routine links to its page.
 */
function OriginLine({ file, viewerId }: { file: LibraryFileDetail; viewerId: string | undefined }) {
  const { provenance } = file
  const label = sanitizeDisplayText(provenance.label)
  const canOpenChat = provenance.canOpenChat ?? file.access === 'owner'
  const chat = provenance.chatId && canOpenChat ? (
    <Link href={`${CHAT_ROUTE}?id=${encodeURIComponent(provenance.chatId)}`} style={linkStyle}>{label || 'Untitled chat'}</Link>
  ) : null

  if (provenance.kind === 'routine') {
    const routine = provenance.routineId ? <Link href={ROUTINE_ROUTE(provenance.routineId)} style={linkStyle}>{label || 'a routine'}</Link> : (label || 'a routine')
    if (provenance.isTestRun) return <>Made by routine {routine}, test run</>
    return <>Made by routine {routine}{provenance.runLabel ? <>, run of {sanitizeDisplayText(provenance.runLabel)}</> : null}</>
  }
  if (file.source === 'generated') return <>Made by Souvenir in a chat{chat ? <>, {chat}</> : null}</>
  const by = personName(provenance.by ?? file.owner, viewerId)
  return (
    <>
      Uploaded by {by}
      {provenance.kind === 'slack' || provenance.via === 'slack' ? ' in Slack' : null}
      {chat ? <>, {chat}</> : null}
    </>
  )
}

/** Run outputs: the files that run read. A deleted file or one the viewer can't open is never named. */
function RunInputs({ inputs }: { inputs: NonNullable<LibraryFileDetail['runInputs']> }) {
  return (
    <div className={styles.block}>
      <div className={styles.label}>{FILE_MESSAGES.filesThisRunUsed}</div>
      {inputs.map((input) =>
        input.state === 'open' ? (
          <Link key={input.id} href={LIBRARY_FILE_ROUTE(input.id)} className={styles.useRow}>
            {input.format ? <FormatGlyph format={input.format} size="xs" /> : <FileTwoIcon size={18} className={styles.useIcon} />}
            <span className={styles.grow}>{sanitizeDisplayText(input.title ?? '') || 'Untitled'}</span>
          </Link>
        ) : (
          <div key={input.id} className={`${styles.useRow} ${styles.useRowOff}`} aria-disabled="true">
            <ViewOffSlashIcon size={18} className={styles.useIcon} />
            <span className={styles.grow}>{input.state === 'deleted' ? FILE_MESSAGES.aDeletedFile : FILE_MESSAGES.aFileYouCantOpen}</span>
          </div>
        ),
      )}
    </div>
  )
}

export interface FileInfoCardProps {
  file: LibraryFileDetail
  viewerId: string | undefined
  onManageAccess: () => void
  onRename: () => void
  onClose: () => void
  onAsk: () => void
  /** Omitted when the viewer may not download the file. */
  onDownload?: () => void
  onDelete: () => void
}

/** File info card, laid out like the prototype: name and path, origin, details, used in, who has access, then actions. */
export function FileInfoCard({ file, viewerId, onManageAccess, onRename, onClose, onAsk, onDownload, onDelete }: FileInfoCardProps) {
  const usage = useFileUsage(file.id)
  const access = useFileAccess(file.id)
  const caps = file.caps
  const trashed = file.life === 'trashed'
  const path = trashed ? PATH_LABEL.trash : file.access === 'owner' ? PATH_LABEL.all : PATH_LABEL.shared
  const chats = usage.data?.chats ?? []
  const routines = usage.data?.routines ?? []
  const hidden = (usage.data?.hiddenChats ?? 0) + (usage.data?.hiddenRoutines ?? 0)
  const usedCount = chats.length + routines.length + hidden
  const chatTotal = chats.length + (usage.data?.hiddenChats ?? 0)
  const routineTotal = routines.length + (usage.data?.hiddenRoutines ?? 0)
  const usedSummary = usedCount
    ? `${chatTotal} ${chatTotal === 1 ? 'chat' : 'chats'}, ${routineTotal} ${routineTotal === 1 ? 'routine' : 'routines'}`
    : 'Not used yet'
  const uses = [
    ...chats.map((chat) => ({ kind: 'chat' as const, id: chat.id, title: chat.title })),
    ...routines.map((routine) => ({ kind: 'routine' as const, id: routine.id, title: routine.title })),
  ]
  const [allUses, setAllUses] = useState(false)
  const [allAccess, setAllAccess] = useState(false)
  const shownUses = allUses ? uses : uses.slice(0, USED_IN_PREVIEW)
  const entries = access.data?.entries ?? []
  const shownEntries = allAccess ? entries : entries.slice(0, ACCESS_PREVIEW)
  return (
    <aside aria-label="File info" className={styles.info}>
      <div className={styles.infoHead}>
        <h2>File info</h2>
        <Tooltip content="Close">
          <IconButton variant="ghost" size="sm" aria-label="Close file info" icon={<CancelOneIcon size={16} />} onClick={onClose} />
        </Tooltip>
      </div>

      <div className={`${styles.infoBody} kaya-scrollbar kaya-no-gutter`} data-info-scroll="">
      <div className={styles.block}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.35, color: 'var(--neutral-900)' }}>
          <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{file.name}</span>
          <Tooltip content={caps.rename ? 'Rename' : ONLY_OWNER_TIP}>
            <span>
              <IconButton variant="ghost" size="xs" aria-label="Rename" disabled={!caps.rename} icon={<PenOneIcon size={14} />} onClick={onRename} />
            </span>
          </Tooltip>
        </div>
        <p style={{ margin: '2px 0 0', ...label }}>{path}</p>
        <p style={{ margin: '8px 0 0', ...label, lineHeight: 1.55 }}>
          <OriginLine file={file} viewerId={viewerId} />
        </p>
        {/* Every file Souvenir made (a chat output or a run output) carries the AI-generated badge. */}
        {(file.source === 'generated' || file.titleIsAiGenerated) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
            {file.source === 'generated' && <GeneratedMark file={file} />}
            <AiGeneratedTag />
          </div>
        )}
      </div>

      <div className={styles.block}>
        <dl style={{ margin: 0 }}>
          <Pair name="Type">{formatLabel(file.format)}{file.extension ? ` · .${file.extension}` : ''}</Pair>
          <Pair name="Owner">{personName(file.owner, viewerId)}</Pair>
          <Pair name="Created">{formatDateTime(file.createdAt)}</Pair>
          <Pair name="Size">{formatBytes(file.sizeBytes)}</Pair>
        </dl>
      </div>

      {file.runInputs && file.runInputs.length > 0 && <RunInputs inputs={file.runInputs} />}

      <div className={styles.block}>
        <div className={styles.label}>
          Used in
          <span style={label}>{usedSummary}</span>
        </div>
        {usage.isPending ? (
          <Skeleton height={14} width={160} radius={6} />
        ) : (
          <>
            {shownUses.map((use) =>
              use.kind === 'chat' ? (
                <Link key={`c-${use.id}`} href={`${CHAT_ROUTE}?id=${encodeURIComponent(use.id)}`} className={styles.useRow}>
                  <BubbleChatIcon size={18} className={styles.useIcon} />
                  <span className={styles.grow}>{sanitizeDisplayText(use.title) || 'Untitled chat'}</span>
                </Link>
              ) : (
                <Link key={`r-${use.id}`} href={ROUTINE_ROUTE(use.id)} className={styles.useRow}>
                  <CalendarFoldIcon size={18} className={styles.useIcon} />
                  <span className={styles.grow}>{sanitizeDisplayText(use.title) || 'Untitled'}</span>
                </Link>
              ),
            )}
            {uses.length > USED_IN_PREVIEW && (
              <button type="button" className={styles.more} aria-expanded={allUses} onClick={() => setAllUses((open) => !open)}>
                {allUses ? 'Show fewer' : `Show all ${uses.length}`}
              </button>
            )}
            {hidden > 0 && <p style={{ margin: '4px 0 0', ...label }}>and {hidden} more you cannot see</p>}
          </>
        )}
      </div>

      <div className={styles.block}>
        <div className={styles.label}>
          Who has access
          <span style={label}>You: {file.accessLabel}</span>
        </div>
        {access.isPending ? (
          <Skeleton height={32} radius={10} />
        ) : (
          shownEntries.map((entry) => (
            <div key={entry.grantId} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
              {entry.person ? <PersonAvatar person={entry.person} size={32} /> : <WorkspaceAvatar size={32} />}
              <span style={{ flex: 1, minWidth: 0, ...value, lineHeight: '20px' }}>
                {entry.kind === 'workspace' ? 'Whole workspace' : entry.person ? personName(entry.person, viewerId) : 'Someone'}
                <small style={{ display: 'block', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-600)' }}>
                  {entry.via === 'owner' ? 'Owner' : entry.kind === 'workspace' ? FILE_MESSAGES.everyoneInSouvenir : entry.via === 'workspace' ? 'Through the workspace' : 'Shared directly'}
                </small>
              </span>
            </div>
          ))
        )}
        {access.isSuccess && entries.every((entry) => entry.via === 'owner') && (
          <p style={{ margin: '4px 0 0', ...label }}>{FILE_MESSAGES.privateFile}</p>
        )}
        {entries.length > ACCESS_PREVIEW && (
          <button type="button" className={styles.more} aria-expanded={allAccess} onClick={() => setAllAccess((open) => !open)}>
            {allAccess ? 'Show fewer' : `Show all ${entries.length}`}
          </button>
        )}
        {!trashed && (
          <div style={{ marginTop: 12 }}>
            <Tooltip content={ONLY_OWNER_TIP} disabled={caps.share}>
              <span style={{ display: 'block' }}>
                <Button variant="outline" size="sm" fluid disabled={!caps.share} onClick={onManageAccess}>Manage access</Button>
              </span>
            </Tooltip>
          </div>
        )}
      </div>

      </div>

      {/* Actions stay pinned at the bottom of the card; only the details above scroll. */}
      <div className={styles.infoFoot}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {/* Ask and Download need the file itself: hidden when the viewer cannot open it. */}
          {caps.open && (
            <Button variant="outline" size="sm" fluid leftIcon={<BubbleChatIcon size={14} />} disabled={trashed} onClick={onAsk}>
              Ask about this
            </Button>
          )}
          {caps.open && onDownload && <Button variant="outline" size="sm" fluid leftIcon={<DownloadOneIcon size={14} />} onClick={onDownload}>Download</Button>}
          {!trashed && (
            <Tooltip content={ONLY_OWNER_TIP} disabled={caps.delete}>
              <span style={{ gridColumn: '1 / -1' }}>
                <Button variant="danger" size="sm" fluid leftIcon={<DeleteTwoIcon size={14} />} disabled={!caps.delete} onClick={onDelete}>Delete</Button>
              </span>
            </Tooltip>
          )}
        </div>
      </div>
    </aside>
  )
}
