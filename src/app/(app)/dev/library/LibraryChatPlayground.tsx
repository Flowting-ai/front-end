'use client'

import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/Dropdown'
import { ChatAddMenu } from '@/components/chat/AddMenu'
import { LibraryCitationChip } from '@/components/Library/chat/LibraryCitationChip'
import { ChatFilePanel } from '@/components/Library/chat/ChatFilePanel'
import { SourcesButton, SourcesPanel } from '@/components/Library/chat/SourcesPanel'
import { SentFileChip, SentFiles } from '@/components/Library/chat/SentFileChip'
import { AskSaveDialog } from '@/components/Library/chat/AskSaveDialog'
import { ComposerLibraryNotes, DontSaveMenuItem } from '@/components/Library/chat/ComposerNotes'
import { ChatOutputCard } from '@/components/Library/chat/ChatOutputCard'
import { DeleteChatWithFilesDialog } from '@/components/Library/chat/DeleteChatFiles'
import { useAddFromLibrary } from '@/components/Library/chat/useAddFromLibrary'
import { useFileRefs } from '@/components/Library/chat/useFileRefs'
import {
  RoutineAttachedFiles,
  RoutinePausedNote,
  RoutineRunHistory,
  RoutineRunOutputs,
  RoutineUnavailableNote,
  type RunEntry,
  type RunOutput,
} from '@/components/Library/routines/RoutineLibrarySections'
import { RoutineClarifyCard, RoutineCreatedCard } from '@/components/Library/routines/RoutineChatCards'
import { LIBRARY_ENABLED, LIBRARY_MOCK } from '@/lib/feature-flags'
import { displayFileName } from '@/lib/library/format'
import type { CiteLocator, LibraryFileRow } from '@/lib/library/schemas'
import {
  applySourceEvents,
  buildSourceRows,
  isOpenRef,
  saveOutcome,
  sourcesCount,
  toggleSourceOff,
  type AutoSaveMode,
  type FileRef,
  type OpenFileRef,
  type RoutineAttachment,
  type SourceEvent,
} from '@/lib/library/sources'
import { SCHEDULES_ROUTE } from '@/lib/routes'

const heading: React.CSSProperties = { margin: '0 0 8px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 15, color: 'var(--neutral-900)' }
const sub: React.CSSProperties = { margin: '16px 0 8px', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--neutral-500)' }
const note: React.CSSProperties = { margin: 0, fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)' }
const answer: React.CSSProperties = { margin: 0, fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: '26px', color: 'var(--neutral-900)' }
const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }
const frame: React.CSSProperties = { border: '1px solid var(--border-default)', borderRadius: 16, overflow: 'hidden', background: 'var(--card-bg)' }

// Mock sample ids (lib/library/mock/fixtures.ts): open PDF, sheet, audio, generated output, locked, gone.
const IDS = {
  policy: 'f_return_2026',
  rates: 'f_shipping_rates',
  brand: 'f_brand',
  call: 'f_call_acme',
  catalog: 'f_catalog',
  copy: 'f_copy_v3',
  lookbook: 'f_lookbook',
  gone: 'nope',
  oldPolicy: 'f_trash_policy',
} as const

const CITES: { id: string; locator: CiteLocator | null }[] = [
  { id: IDS.policy, locator: { type: 'page', value: '2' } },
  { id: IDS.catalog, locator: { type: 'row', value: '14' } },
  { id: IDS.call, locator: { type: 'time', value: '42000' } },
  { id: IDS.lookbook, locator: null },
  { id: IDS.gone, locator: null },
]

type Panel = { kind: 'file'; fileId: string; cite: CiteLocator | null } | { kind: 'sources' } | null

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} style={heading}>{title}</h2>
      {children}
    </section>
  )
}

/** Chat-, composer- and routine-side Library pieces on the mock. Rendered by LibraryPlayground. */
export function LibraryChatPlayground() {
  const ids = useMemo(() => Object.values(IDS), [])
  const { refs: loaded, loading } = useFileRefs(ids)
  const [events, setEvents] = useState<SourceEvent[]>([])
  const refs = useMemo(() => applySourceEvents(loaded, events), [loaded, events])
  const [panel, setPanel] = useState<Panel>(null)
  const [offIds, setOffIds] = useState<string[]>([])
  const open = (id: string): OpenFileRef | null => {
    const ref = refs[id]
    return isOpenRef(ref) ? ref : null
  }

  // Composer state
  const [attached, setAttached] = useState<LibraryFileRow[]>([])
  const picker = useAddFromLibrary({ excludeIds: attached.map((file) => file.id), onAdd: (files) => setAttached((current) => [...current, ...files]) })
  const [askFiles, setAskFiles] = useState<OpenFileRef[] | null>(null)
  const [dontSave, setDontSave] = useState(false)
  const [searchOff, setSearchOff] = useState(false)
  const [mode, setMode] = useState<AutoSaveMode>('always')
  const [forcedOff, setForcedOff] = useState(false)

  // Delete chat
  const [deleting, setDeleting] = useState<{ title: string; files: OpenFileRef[] } | null>(null)

  // Routine
  const [routineFiles, setRoutineFiles] = useState<RoutineAttachment[]>([
    { id: IDS.policy, state: 'ok', title: 'Return policy 2026', format: 'pdf' },
    { id: IDS.oldPolicy, state: 'trashed', title: 'Return policy 2025', format: 'pdf' },
    { id: 'f_removed', state: 'deleted' },
  ])
  const [paused, setPaused] = useState(true)
  const [messageOnly, setMessageOnly] = useState(false)
  const [owner, setOwner] = useState(true)
  const [withOutputs, setWithOutputs] = useState(true)
  const outputs: RunOutput[] = withOutputs
    ? [
        { id: 'f_run_oct6', title: 'Weekly sales report - Oct 6', format: 'sheet', runLabel: 'Run of Oct 6' },
        { id: 'f_run_sep29', title: 'Weekly sales report - Sep 29', format: 'sheet', runLabel: 'Run of Sep 29' },
        { id: 'f_test_run', title: 'Test run - product copy', format: 'document', runLabel: 'Run of Test run' },
        { id: 'f_extra', title: 'Hidden fourth output', format: 'sheet', runLabel: 'Run of Sep 22' },
      ]
    : []
  const history: RunEntry[] = [
    { id: 'h1', kind: 'fail', text: 'Slack #ops was unreachable. No file was saved.', at: 'Today, 9:00 AM' },
    { id: 'h2', kind: 'output', text: 'Weekly sales report - Oct 6', at: 'Oct 6, 9:00 AM' },
    { id: 'h3', kind: 'message', text: 'Posted to Slack #ops', at: 'Oct 2, 9:00 AM' },
    { id: 'h4', kind: 'test', text: 'Test run - product copy', at: 'Sep 30, 4:12 PM' },
  ]

  // Clarify card
  const [clarify, setClarify] = useState<{ attach: boolean | null; done: boolean }>({ attach: null, done: false })

  const sourceRows = buildSourceRows({
    scopeIds: [IDS.rates, IDS.brand, IDS.lookbook, IDS.gone],
    citedIds: [IDS.policy, IDS.call],
    attachedIds: [IDS.rates],
    offIds,
    refs,
  })

  const send = () => {
    const files = [open(IDS.policy), open(IDS.rates)].filter((file): file is OpenFileRef => file !== null)
    const outcome = saveOutcome({ mode, forcedOff, dontSaveChat: dontSave })
    if (outcome.action === 'ask') setAskFiles(files)
    else if (outcome.action === 'save') toast('Saved to Library')
    else if (outcome.message) toast(outcome.message)
  }

  if (!LIBRARY_ENABLED) return null

  return (
    <>
      <Section id="pg-citations" title="Citations in an answer">
        <p style={{ ...note, marginBottom: 12 }}>
          File name only, after the sentence. Audio adds the time. Locked opens the locked panel and offers Request access; deleted never shows the title.
          {loading ? ' Loading sample files…' : ''}
        </p>
        <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={answer}>
              Returns are accepted within 30 days.{' '}
              {refs[IDS.policy] && <LibraryCitationChip fileRef={refs[IDS.policy]} locator={CITES[0].locator} />}
              {' '}The Oslo rate is 42 NOK.{' '}
              {refs[IDS.catalog] && <LibraryCitationChip fileRef={refs[IDS.catalog]} locator={CITES[1].locator} onOpen={(fileId, locator) => setPanel({ kind: 'file', fileId, cite: locator ?? null })} />}
              {' '}Acme agreed to net 60 on the call.{' '}
              {refs[IDS.call] && <LibraryCitationChip fileRef={refs[IDS.call]} locator={CITES[2].locator} />}
              {' '}The autumn palette is warm.{' '}
              {refs[IDS.lookbook] && <LibraryCitationChip fileRef={refs[IDS.lookbook]} onOpenLocked={(fileId) => setPanel({ kind: 'file', fileId, cite: null })} />}
              {' '}An older note said otherwise.{' '}
              {refs[IDS.gone] && <LibraryCitationChip fileRef={refs[IDS.gone]} />}
            </p>
            <p style={{ ...note, marginTop: 8 }}>The sheet chip opens beside the chat (onOpen); the others link to the File page with ?cite=.</p>
            <div style={{ ...row, marginTop: 12 }}>
              <Button variant="secondary" size="sm" onClick={() => setEvents([{ fileId: IDS.policy, state: 'removed' }])}>Stream: Return policy removed</Button>
              <Button variant="secondary" size="sm" onClick={() => setEvents([{ fileId: IDS.call, state: 'locked' }])}>Stream: access to the call removed</Button>
              <Button variant="secondary" size="sm" onClick={() => setEvents([])}>Clear source events</Button>
            </div>
          </div>
          {panel?.kind === 'file' && (
            <div style={{ ...frame, height: 460, display: 'flex' }}>
              <ChatFilePanel fileId={panel.fileId} cite={panel.cite} onClose={() => setPanel(null)} />
            </div>
          )}
        </div>
      </Section>

      <Section id="pg-sources" title="Sources panel">
        <div style={{ ...row, marginBottom: 12 }}>
          <SourcesButton count={sourcesCount([IDS.rates, IDS.brand, IDS.lookbook, IDS.gone], [IDS.policy, IDS.call])} open={panel?.kind === 'sources'} onClick={() => setPanel(panel?.kind === 'sources' ? null : { kind: 'sources' })} />
          <span style={note}>Cited files read &quot;Cited in answer&quot;. Switch one off, then it reads &quot;Off for this chat&quot;.</span>
        </div>
        {panel?.kind === 'sources' && (
          <div style={{ ...frame, height: 420, display: 'flex', width: 340 }}>
            <SourcesPanel rows={sourceRows} onToggle={(fileId) => setOffIds((current) => toggleSourceOff(current, fileId))} onClose={() => setPanel(null)} />
          </div>
        )}
      </Section>

      <Section id="pg-sent" title="Sent files in a message">
        <SentFiles>
          {[IDS.policy, IDS.call, IDS.gone, IDS.lookbook].map((id) => (
            <SentFileChip key={id} fileId={id} fileRef={refs[id]} onOpen={(fileId) => setPanel({ kind: 'file', fileId, cite: null })} />
          ))}
          {isOpenRef(refs[IDS.rates]) && <SentFileChip fileId={IDS.rates} fileRef={{ ...refs[IDS.rates], phase: 'processing' } as FileRef} />}
        </SentFiles>
      </Section>

      <Section id="pg-composer" title="Composer: Add from Library, saving, notes">
        <p style={{ ...note, marginBottom: 12 }}>
          The + menu below is the real ChatAddMenu. &quot;Add from Library&quot; shows only with LIBRARY_ENABLED and LIBRARY_MOCK{LIBRARY_MOCK ? '' : ' (mock is off, so it is hidden)'}; the live ChatInput does not pass the handler yet.
        </p>
        <div style={{ ...row, alignItems: 'flex-start' }}>
          <ChatAddMenu
            webSearchEnabled={false}
            onWebSearchChange={() => undefined}
            onAddFilesClick={() => toast('The native file chooser opens here')}
            selectedStyleId={null}
            onStyleChange={() => undefined}
            selectedFolders={[]}
            onFolderToggle={() => undefined}
            selectedPersonaId={null}
            onPersonaChange={() => undefined}
            hidePersona
            hideStyle
            hidePinFolders
            onAddFromLibraryClick={picker.open}
          />
          <Dropdown style={{ width: 280 }} maxHeight={false}>
            <Dropdown.Section fluid>
              <DontSaveMenuItem checked={dontSave} onChange={setDontSave} />
            </Dropdown.Section>
          </Dropdown>
        </div>
        {picker.dialog}
        {attached.length > 0 && <p style={{ ...note, marginTop: 8 }}>Attached by reference: {attached.map(displayFileName).join(', ')}</p>}

        <h3 style={sub}>Send with two staged files</h3>
        <div style={row}>
          {(['always', 'ask', 'never'] as const).map((value) => (
            <Button key={value} variant="secondary" size="sm" active={mode === value} aria-pressed={mode === value} onClick={() => setMode(value)}>
              {value === 'always' ? 'Always' : value === 'ask' ? 'Ask each time' : 'Never'}
            </Button>
          ))}
          <Button variant="secondary" size="sm" active={forcedOff} aria-pressed={forcedOff} onClick={() => setForcedOff(!forcedOff)}>Admin force-off</Button>
          <Button variant="secondary" size="sm" active={searchOff} aria-pressed={searchOff} onClick={() => setSearchOff(!searchOff)}>Admin: Library search off</Button>
          <Button size="sm" onClick={send}>Send</Button>
        </div>
        <div style={{ ...frame, marginTop: 12, padding: '12px 0' }}>
          <p style={{ ...note, padding: '0 16px' }}>(composer)</p>
          <ComposerLibraryNotes librarySearchOff={searchOff} dontSave={dontSave} />
        </div>
        {askFiles && (
          <AskSaveDialog
            files={askFiles}
            onChoose={(save) => {
              setAskFiles(null)
              toast(save ? 'Saved to Library' : 'Not saved. It stays in this chat.')
            }}
          />
        )}
      </Section>

      <Section id="pg-output" title="Chat Output (AI-generated)">
        {open(IDS.copy) ? <ChatOutputCard file={open(IDS.copy)!} /> : <p style={note}>Loading…</p>}
      </Section>

      <Section id="pg-delete-chat" title="Delete chat with its saved files">
        <p style={{ ...note, marginBottom: 12 }}>
          Ticking &quot;Also delete these files&quot; moves them to Trash through the Library API (mock). Restore them from /library/trash. The live DeleteChatDialog is unchanged: there is no API yet that lists the files saved from a chat.
        </p>
        <div style={row}>
          <Button variant="secondary" size="sm" disabled={!open(IDS.copy)} onClick={() => setDeleting({ title: 'Product descriptions', files: [open(IDS.copy)!] })}>Product descriptions (1 saved file)</Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!open(IDS.copy) || !open(IDS.rates)}
            onClick={() => setDeleting({ title: 'Carrier comparison', files: [open(IDS.rates)!, open(IDS.copy)!] })}
          >
            Carrier comparison (2 saved files)
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setDeleting({ title: 'Quick question', files: [] })}>A chat with no saved files</Button>
        </div>
        {deleting && (
          <DeleteChatWithFilesDialog
            chatTitle={deleting.title}
            files={deleting.files}
            onDeleteChat={async () => undefined}
            onClose={() => setDeleting(null)}
          />
        )}
      </Section>

      <Section id="pg-routine" title="Routine pane: files and run outputs">
        <div style={{ ...row, marginBottom: 12 }}>
          <Button variant="secondary" size="sm" active={paused} aria-pressed={paused} onClick={() => setPaused(!paused)}>Paused</Button>
          <Button variant="secondary" size="sm" active={messageOnly} aria-pressed={messageOnly} onClick={() => setMessageOnly(!messageOnly)}>Message only</Button>
          <Button variant="secondary" size="sm" active={owner} aria-pressed={owner} onClick={() => setOwner(!owner)}>I own it</Button>
          <Button variant="secondary" size="sm" active={withOutputs} aria-pressed={withOutputs} onClick={() => setWithOutputs(!withOutputs)}>Has run outputs</Button>
        </div>
        <div style={{ ...frame, width: 380, padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ ...note, paddingTop: 8 }}>Weekly sales report · Every Monday at 9:00 · Slack #ops</p>
          {paused && <RoutinePausedNote canResume={owner} onResume={() => setPaused(false)} />}
          <RoutineUnavailableNote files={routineFiles} />
          <RoutineAttachedFiles
            routineTitle="Weekly sales report"
            files={routineFiles}
            canEdit={owner}
            onAdd={(files) => setRoutineFiles((current) => [...current, ...files.map((file): RoutineAttachment => ({ id: file.id, state: 'ok', title: file.title, format: file.format }))])}
            onRemove={(fileId) => setRoutineFiles((current) => current.filter((file) => file.id !== fileId))}
          />
          <RoutineRunOutputs outputs={outputs} messageOnly={messageOnly} />
          <RoutineRunHistory entries={history} />
        </div>
      </Section>

      <Section id="pg-routine-cards" title="Routine cards in a chat">
        <div style={{ ...row, marginBottom: 4 }}>
          <Button variant="secondary" size="sm" onClick={() => setClarify({ attach: null, done: false })}>Reset</Button>
        </div>
        <RoutineClarifyCard
          answers={[
            { question: 'What should it make?', answer: 'Product copy for new arrivals, in the brand voice' },
            { question: 'When should it run?', answer: 'Every Monday at 9:00' },
            { question: 'Where should it deliver?', answer: 'Slack #ops' },
          ]}
          attachQuestion="Attach the Return policy and Shipping rates?"
          attachNames="Return policy 2026 and Shipping rates"
          attach={clarify.attach}
          done={clarify.done}
          onAttach={(attach) => setClarify({ attach, done: false })}
          onCreate={() => setClarify((current) => ({ ...current, done: true }))}
        />
        {clarify.done && (
          <RoutineCreatedCard
            title="Weekly product copy"
            schedule="Every Monday at 9:00"
            deliversTo="Slack #ops"
            attachedNames={clarify.attach ? ['Return policy 2026', 'Shipping rates'] : []}
            routineHref={SCHEDULES_ROUTE}
          />
        )}
      </Section>
    </>
  )
}
