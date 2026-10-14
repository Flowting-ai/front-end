'use client'

import React, { useId, useState } from 'react'
import { toast } from 'sonner'
import { CancelOneIcon, LinkSixIcon, UserAddOneIcon } from '@strange-huge/icons'
import { Button, IconButton } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/Skeleton'
import { Tooltip } from '@/components/Tooltip'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { personName } from '@/lib/library/access'
import type { GrantTarget } from '@/lib/library/api'
import { FILE_MESSAGES, MESSAGES } from '@/lib/library/messages'
import { useRevokeGrant, useShareFile } from '@/lib/library/mutations'
import { useFileAccess, useLibraryPeople } from '@/lib/library/queries'
import type { AccessEntry, Person } from '@/lib/library/schemas'
import type { LibraryFile } from '@/lib/library/file'
import { useLibraryViewer } from '@/lib/library/viewer'
import { LIBRARY_FILE_ROUTE } from '@/lib/routes'
import { PersonAvatar, WorkspaceAvatar } from '../PersonAvatar'
import styles from './ShareDialog.module.css'

const WAY_LABEL: Record<AccessEntry['via'], string> = { owner: 'Owner', direct: 'Shared directly', workspace: 'Whole workspace' }

const cx = (...names: (string | undefined | false)[]) => names.filter(Boolean).join(' ')

/** Someone staged in the dialog, not shared with yet. */
type Staged = { key: string; target: GrantTarget; label: string; toastLabel: string; person?: Person }

const WORKSPACE: Staged = { key: 'workspace', target: { kind: 'workspace' }, label: FILE_MESSAGES.wholeWorkspace, toastLabel: 'everyone' }

/** The confirm before removing someone, in place of the Share dialog (Cancel goes back to it). */
function RevokeConfirm({ file, entry, entries, viewerId, onBack }: { file: LibraryFile; entry: AccessEntry; entries: AccessEntry[]; viewerId: string | undefined; onBack: () => void }) {
  const revoke = useRevokeGrant()
  const workspace = entry.kind === 'workspace'
  const name = workspace ? 'the whole workspace' : entry.person ? personName(entry.person, viewerId) : 'Someone'
  const stillVia = !workspace && entries.some((other) => other.kind === 'workspace')
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !revoke.isPending) onBack() }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Remove {name}?</DialogTitle>
        </DialogHeader>
        <DialogBody className={styles.confirmBody}>
          {/* The dialog primitives style themselves inline, so their overrides go through `style`. */}
          <DialogDescription style={{ color: 'var(--neutral-900)' }}>
            {FILE_MESSAGES.revokeLine(workspace ? 'People with access only through the workspace' : name, workspace)}
          </DialogDescription>
          {stillVia && <p className={styles.quiet}>{FILE_MESSAGES.stillViaWorkspace(name)}</p>}
          <p className={styles.quiet}>{FILE_MESSAGES.revokeAnswersLine}</p>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" disabled={revoke.isPending} onClick={onBack}>Cancel</Button>
          <Button
            type="button"
            variant="danger"
            loading={revoke.isPending}
            onClick={() => revoke.mutate({ id: file.id, grantId: entry.grantId, label: workspace ? 'Workspace' : name }, { onSuccess: onBack })}
          >
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** A picked person or the workspace, as a removable chip inside the field. */
function StagedChip({ item, onRemove }: { item: Staged; onRemove: () => void }) {
  return (
    <span className={styles.chip}>
      {item.person ? <PersonAvatar person={item.person} size={22} /> : <WorkspaceAvatar size={22} />}
      <span className={cx(styles.name, styles.chipLabel, styles.truncate)}>{item.label}</span>
      <IconButton variant="ghost" size="xs" aria-label={FILE_MESSAGES.dontAdd(item.label)} icon={<CancelOneIcon size={10} />} onClick={onRemove} />
    </span>
  )
}

/**
 * Share one file, like the prototype: pick people or the whole workspace from the list, stage them as chips
 * in the field, then Share. Everyone is a Viewer. Who has access lists every way in; removing someone asks
 * first. Sharing is never optimistic: the server decides what a grant adds.
 *
 * Keyboard: the list opens on typing, a click or Arrow Down (not on the dialog's autofocus); arrows move,
 * Enter picks, Backspace in an empty field drops the last chip, and Enter with the list closed shares.
 */
export function ShareDialog({ file, onClose }: { file: LibraryFile; onClose: () => void }) {
  const { viewerId } = useLibraryViewer()
  const inputId = useId()
  const listId = useId()
  const focusField = () => document.getElementById(inputId)?.focus()
  const [query, setQuery] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [staged, setStaged] = useState<Staged[]>([])
  const [removing, setRemoving] = useState<AccessEntry | null>(null)
  const debounced = useDebouncedValue(query.trim(), 250)
  const access = useFileAccess(file.id)
  const people = useLibraryPeople(debounced, listOpen)
  const share = useShareFile()
  const name = file.name

  const entries = access.data?.entries ?? []
  const present = new Set(entries.map((entry) => entry.person?.id).filter((id): id is string => Boolean(id)))
  const hasWorkspace = entries.some((entry) => entry.kind === 'workspace')
  const isStaged = (key: string) => staged.some((item) => item.key === key)
  const needle = query.trim().toLowerCase()
  const options: Staged[] = [
    ...(people.data ?? [])
      .filter((person) => person.id !== file.owner.id && !present.has(person.id) && !isStaged(person.id))
      .slice(0, 6)
      .map((person) => ({ key: person.id, target: { kind: 'user' as const, personId: person.id }, label: personName(person, viewerId), toastLabel: personName(person, viewerId), person })),
    ...(!hasWorkspace && !isStaged(WORKSPACE.key) && access.data && WORKSPACE.label.toLowerCase().includes(needle) ? [WORKSPACE] : []),
  ]

  if (removing) {
    return <RevokeConfirm file={file} entry={removing} entries={entries} viewerId={viewerId} onBack={() => setRemoving(null)} />
  }

  const stage = (option: Staged) => {
    setStaged((items) => [...items, option])
    setQuery('')
    setActive(0)
    // Keep typing: focus stays in the field and the list stays open for the next person.
    focusField()
  }

  const unstage = (key: string) => {
    setStaged((items) => items.filter((other) => other.key !== key))
    focusField()
  }

  const submit = () => {
    if (staged.length === 0 || share.isPending) return
    share.mutate(
      { id: file.id, targets: staged.map((item) => ({ target: item.target, label: item.toastLabel })) },
      { onSuccess: () => setStaged([]) },
    )
  }

  const showList = listOpen
  const activeIndex = Math.min(active, Math.max(options.length - 1, 0))
  const optionId = (index: number) => `${listId}-opt-${index}`

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!listOpen) { setListOpen(true); return }
      if (options.length === 0) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((activeIndex + step + options.length) % options.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (showList && options[activeIndex]) stage(options[activeIndex])
      else submit()
    } else if (event.key === 'Backspace' && query === '' && staged.length > 0) {
      setStaged((items) => items.slice(0, -1))
    }
  }

  const copyLink = () => {
    const url = `${window.location.origin}${LIBRARY_FILE_ROUTE(file.id)}`
    Promise.resolve(navigator.clipboard?.writeText(url))
      .then(() => toast(FILE_MESSAGES.linkCopied))
      .catch(() => toast.error(MESSAGES.genericFailure))
  }

  const entryLabel = (entry: AccessEntry) =>
    entry.kind === 'workspace' ? FILE_MESSAGES.wholeWorkspace : entry.person ? personName(entry.person, viewerId) : 'Someone'

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !share.isPending) onClose() }}>
      <DialogContent
        size="lg"
        aria-describedby={undefined}
        // Radix listens for Escape on the document, so the field's own handler can't stop it: with the list
        // open, Escape closes the list only and keeps the dialog (and anyone picked) in place.
        onEscapeKeyDown={(event) => { if (listOpen) { event.preventDefault(); setListOpen(false) } }}
      >
        <DialogHeader>
          <DialogTitle className={styles.title}>
            <span className={styles.titlePrefix}>Share&nbsp;</span>
            <span title={name} className={cx(styles.titleName, styles.truncate)}>{name}</span>
          </DialogTitle>
        </DialogHeader>
        <DialogBody className={styles.mainBody}>
          <div className={styles.picker}>
            {/* The field: picked people as chips, then the text box. Clicking anywhere in it focuses the box. */}
            <div
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) { event.preventDefault(); focusField(); setListOpen(true) }
              }}
              className={styles.field}
              data-has-chips={staged.length > 0}
            >
              {staged.map((item) => <StagedChip key={item.key} item={item} onRemove={() => unstage(item.key)} />)}
              <input
                id={inputId}
                value={query}
                role="combobox"
                aria-expanded={showList}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={showList && options.length > 0 ? optionId(activeIndex) : undefined}
                aria-label={FILE_MESSAGES.addPeoplePlaceholder}
                placeholder={staged.length ? 'Add more' : FILE_MESSAGES.addPeoplePlaceholder}
                autoComplete="off"
                disabled={share.isPending}
                onClick={() => setListOpen(true)}
                onBlur={() => window.setTimeout(() => setListOpen(false), 150)}
                onKeyDown={onKeyDown}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActive(0)
                  setListOpen(true)
                }}
                className={styles.input}
              />
            </div>
            {showList && (
              <div
                id={listId}
                role="listbox"
                aria-label="People"
                className={styles.listbox}
              >
                {people.isPending ? (
                  <Skeleton height={36} radius={10} />
                ) : options.length === 0 ? (
                  <p className={cx(styles.quiet, styles.noMatch)}>
                    {needle ? `No one called "${query.trim()}"` : 'Everyone already has access'}
                  </p>
                ) : (
                  options.map((option, index) => (
                    <div
                      key={option.key}
                      id={optionId(index)}
                      role="option"
                      aria-selected={index === activeIndex}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => stage(option)}
                      className={cx(styles.row, styles.option)}
                    >
                      {option.person ? <PersonAvatar person={option.person} size={28} /> : <WorkspaceAvatar size={28} />}
                      <span className={styles.stack}>
                        <span className={styles.name}>{option.label}</span>
                        {!option.person && <span className={styles.quiet}>{FILE_MESSAGES.everyoneInSouvenir}</span>}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <p className={styles.quiet}>{FILE_MESSAGES.shareQuiet}</p>

          <div className={styles.accessSection}>
            <p className={styles.sectionLabel}>Who has access</p>
            {access.isPending ? (
              <div aria-busy="true" className={styles.loadingList}>
                <Skeleton height={36} radius={10} />
                <Skeleton height={36} radius={10} />
              </div>
            ) : access.isError ? (
              <p role="alert" className={styles.quiet}>
                Couldn&apos;t load who has access. <button type="button" onClick={() => void access.refetch()} className={styles.linkButton}>{MESSAGES.retry}</button>
              </p>
            ) : (
              <>
                <ul className={cx('kaya-scrollbar', styles.list)}>
                  {entries.map((entry) => (
                    <li key={entry.grantId} className={cx(styles.row, styles.entry)}>
                      {entry.person ? <PersonAvatar person={entry.person} size={28} /> : <WorkspaceAvatar size={28} />}
                      <span className={cx(styles.stack, styles.entryText)}>
                        <span className={cx(styles.name, styles.truncate)}>{entryLabel(entry)}</span>
                        {entry.kind !== 'owner' && (
                          <span className={styles.quiet}>{entry.kind === 'workspace' ? FILE_MESSAGES.everyoneInSouvenir : WAY_LABEL[entry.via]}</span>
                        )}
                      </span>
                      <span className={cx(styles.quiet, styles.role)}>{entry.kind === 'owner' ? WAY_LABEL.owner : 'Viewer'}</span>
                      {entry.kind !== 'owner' && access.data?.canManage ? (
                        <Tooltip content={FILE_MESSAGES.removeAccessTip}>
                          <IconButton
                            variant="ghost"
                            size="xs"
                            aria-label={`Remove ${entryLabel(entry)}`}
                            icon={<CancelOneIcon size={12} />}
                            onClick={() => setRemoving(entry)}
                          />
                        </Tooltip>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {entries.every((entry) => entry.kind === 'owner') && (
                  <div className={styles.empty}>
                    <span aria-hidden="true" className={styles.emptyIcon}><UserAddOneIcon size={18} /></span>
                    <span className={styles.name}>Not shared yet</span>
                    <span className={cx(styles.quiet, styles.emptyHint)}>Add people or the whole workspace above.</span>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogBody>
        <DialogFooter style={{ justifyContent: 'space-between' }}>
          <Button type="button" variant="secondary" leftIcon={<LinkSixIcon size={16} />} onClick={copyLink}>Copy link</Button>
          {staged.length > 0 ? (
            <Button type="button" loading={share.isPending} onClick={submit}>
              Share{staged.length > 1 ? ` with ${staged.length}` : ''}
            </Button>
          ) : (
            <Button type="button" onClick={onClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
