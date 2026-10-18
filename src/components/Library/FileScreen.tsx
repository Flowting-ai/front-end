'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowDownOneIcon, ArrowLeftOneIcon, CancelOneIcon, DownloadOneIcon, InformationCircleIcon, ShareOneIcon, SidebarRightIcon } from '@strange-huge/icons'
import { Button, IconButton } from '@/components/ui/button'
import { Skeleton } from '@/components/Skeleton'
import { FilePageSkeleton } from './LibrarySkeletons'
import { Tooltip } from '@/components/Tooltip'
import { ChatInput } from '@/components/ChatInput'
import { useAskAbout } from './useAskAbout'
import { ONLY_OWNER_TIP } from '@/lib/library/access'
import { trackLibrary } from '@/lib/library/analytics'
import { parseCite } from '@/lib/library/cite'
import { isGoneError, isLockedError } from '@/lib/library/errors'
import { fileDocumentTitle, formatLabel } from '@/lib/library/format'
import { FILE_MESSAGES, MESSAGES } from '@/lib/library/messages'
import { useMarkOpened } from '@/lib/library/mutations'
import { useLibraryFile } from '@/lib/library/queries'
import { libraryReturnUrl } from '@/lib/library/return-to'
import { useLibraryViewer } from '@/lib/library/viewer'
import { warmFile } from '@/lib/library/warm'
import { EmptyState } from './EmptyState'
import { FileDialogs, useFileActions } from './FileDialogs'
import { FileInfoCard } from './FileInfoCard'
import { GoneState, LockedState, LibraryProcessingBanner, TrashedBanner } from './FileStates'
import { LibraryShell } from './LibraryShell'
import { LinkButton } from './LinkButton'
import { RowMenu } from './FileTable/RowMenu'
import styles from './FileScreen.module.css'

// The preview (and, inside it, pdf.js) is fetched only once a file page is opened.
const FilePreview = dynamic(() => import('./viewers/FilePreview'), {
  ssr: false,
  loading: () => <Skeleton height={420} radius={12} style={{ width: '100%', maxWidth: 720 }} />,
})

const FILE_ERROR = "Couldn't load this file."

// The Opened / Closed toasts of a file page share one id; `pendingClose` is the Closed still waiting its tick.
const FILE_PAGE_TOAST_ID = 'library-file-page'
let pendingClose: ReturnType<typeof setTimeout> | null = null

export function FileScreen({ id }: { id: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const cite = parseCite(params.get('cite'), params.get('passage'))
  // Close and a delete go back to the Library list the person came from (tab, search, filters).
  const backHref = libraryReturnUrl(params.get('from'))
  const { viewerId } = useLibraryViewer()
  // Ask for the details and the first preview now, side by side: the queries below wait for the
  // workspace to load and then pick these up, instead of starting one after the other. A row cite
  // opens a sheet at another window, so that preview is left to the viewer.
  const citesRow = cite?.type === 'row'
  useEffect(() => { warmFile(id, { preview: !citesRow }) }, [id, citesRow])
  const detail = useLibraryFile(id)
  const markOpened = useMarkOpened()
  const { dialog, closeDialog, handle } = useFileActions()
  const [infoOpen, setInfoOpen] = useState(true)
  const reduceMotion = useReducedMotion()
  const ask = useAskAbout()
  const scrollRef = useRef<HTMLDivElement>(null)
  // The info card floats over the page, so a wheel turn on it would otherwise go nowhere: pass it to the
  // file's scroller unless the card has its own overflow to scroll.
  const forwardWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const aside = event.currentTarget.firstElementChild as HTMLElement | null
    const card = aside?.querySelector<HTMLElement>('[data-info-scroll]') ?? aside
    const scroller = scrollRef.current
    if (!card || !scroller) return
    const goingDown = event.deltaY > 0
    const cardCanScroll = goingDown ? card.scrollTop + card.clientHeight < card.scrollHeight - 1 : card.scrollTop > 0
    if (!cardCanScroll) scroller.scrollBy({ top: event.deltaY, left: event.deltaX })
  }
  const [question, setQuestion] = useState('')
  // A deleted file is "No longer available" for every link (a chat chip, a citation, a shared URL), even for
  // its owner. Only a row in Trash opens it (`?from=trash`), to show how many days are left and Restore.
  const fromTrash = params.get('from') === 'trash'
  const deletedLink = detail.data?.life === 'trashed' && !fromTrash
  const file = deletedLink ? undefined : detail.data

  // Tab title: the sanitised file name, never the raw one.
  useEffect(() => {
    if (!file) return
    const previous = document.title
    document.title = fileDocumentTitle(file)
    return () => { document.title = previous }
  }, [file])

  // "Opened <name>" when the file page shows its file, "Closed <name>" when it is left, however that
  // happens (Close, browser back, a link, the sidebar): they are all this page unmounting. One toast id,
  // so a Closed never stacks on an Opened. React's dev double-mount runs the cleanup and the effect
  // again at once, so the Closed waits a tick and the next Opened cancels it.
  const fileId = file?.id
  const nameRef = useRef(file?.name ?? '')
  const fileName = file?.name
  useEffect(() => { if (fileName) nameRef.current = fileName }, [fileName])
  useEffect(() => {
    if (!fileId) return
    if (pendingClose) { clearTimeout(pendingClose); pendingClose = null }
    toast(FILE_MESSAGES.openedFile(nameRef.current), { id: FILE_PAGE_TOAST_ID })
    return () => {
      const closedName = nameRef.current
      pendingClose = setTimeout(() => {
        pendingClose = null
        toast(FILE_MESSAGES.closedFile(closedName), { id: FILE_PAGE_TOAST_ID })
      }, 0)
    }
  }, [fileId])

  // Once per visit: clear the unread marker and record the view (format and source only).
  const opened = useRef<string | null>(null)
  useEffect(() => {
    if (!file || opened.current === file.id) return
    opened.current = file.id
    trackLibrary('open_file', { format: file.format, source: file.source })
    if (file.life === 'active') markOpened.mutate({ id: file.id })
  }, [file, markOpened])

  if (detail.isPending) return <LibraryShell><FilePageSkeleton /></LibraryShell>

  if (detail.isError || !file) {
    return (
      <LibraryShell>
        {isLockedError(detail.error) ? (
          <LockedState fileId={id} />
        ) : isGoneError(detail.error) || deletedLink ? (
          <GoneState backHref={backHref} />
        ) : (
          <EmptyState icon={<ArrowLeftOneIcon size={20} />} title={FILE_ERROR}>
            <Button variant="secondary" onClick={() => void detail.refetch()}>{MESSAGES.retry}</Button>
            <LinkButton href={backHref}>{FILE_MESSAGES.backToLibrary}</LinkButton>
          </EmptyState>
        )}
      </LibraryShell>
    )
  }

  const caps = file.caps
  const name = file.name
  const trashed = file.life === 'trashed'
  // Download and Ask need the file itself: neither is offered when the viewer cannot open it.
  const download = caps.open ? () => handle('download', file) : undefined
  const askAbout = (text: string) => { void ask(file, text) }
  // The detail's `phase` is always "ready"; Library processing (processingPhase) never blocks chat use of the original.
  const canAsk = !trashed && caps.open
  // The info card rises in place: opacity and scale only, from the corner its button sits in, so the
  // compositor does all the work. The page re-centres with a FLIP (transform) rather than a width tween.
  const ease = [0.16, 1, 0.3, 1] as const
  const glide = reduceMotion ? { duration: 0 } : { duration: 0.32, ease }
  const card = reduceMotion
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 0, transition: { duration: 0 } } }
    : {
        initial: { opacity: 0, scale: 0.96, y: -6 },
        animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.28, ease } },
        exit: { opacity: 0, scale: 0.98, y: -4, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] as const } },
      }

  return (
    <LibraryShell>
      <div className={infoOpen ? `${styles.viewer} ${styles.viewerInfo}` : styles.viewer}>
        {/* The scroller spans the whole viewer, so its scrollbar sits at the far right, beyond the info card. */}
        <m.div ref={scrollRef} layoutScroll className={`${styles.scroll} kaya-scrollbar`}>
          <m.div className={styles.main} layout="position" transition={glide}>
            {trashed && <TrashedBanner fileId={file.id} title={name} daysLeft={file.daysLeft} canRestore={caps.restore} />}
            {!trashed && <LibraryProcessingBanner file={file} />}
            <div className={styles.page}>
              <h1 className={styles.pageTitle}>{name}</h1>
              <p className={styles.pageSub}>{formatLabel(file.format)}{file.extension ? ` · .${file.extension}` : ''}</p>
              <FilePreview file={file} cite={cite} onDownload={download} />
            </div>
          </m.div>
          <div className={infoOpen ? styles.spacer : `${styles.spacer} ${styles.spacerClosed}`} aria-hidden="true" />
        </m.div>

        <div className={styles.bar}>
          <RowMenu
            file={file}
            onAction={handle}
            withOpen={false}
            placement="bottom-start"
            // Styled like the chat name in the chat top bar, plus a down arrow: it opens the file's menu.
            trigger={
              <button type="button" className={styles.namePill} aria-label={`Actions for ${name}`} aria-haspopup="menu">
                <span className={styles.pillTitle}>{name}</span>
                <ArrowDownOneIcon size={14} aria-hidden="true" />
              </button>
            }
          />
          <span className={styles.end}>
            {download && <IconButton variant="secondary" aria-label="Download" title="Download" icon={<DownloadOneIcon size={18} />} onClick={download} />}
            {!trashed && (
              caps.share ? (
                <Button variant="secondary" leftIcon={<ShareOneIcon size={16} />} onClick={() => handle('share', file)}>Share</Button>
              ) : (
                <Tooltip content={ONLY_OWNER_TIP}>
                  <span>
                    <Button variant="secondary" leftIcon={<ShareOneIcon size={16} />} disabled>Share</Button>
                  </span>
                </Tooltip>
              )
            )}
            <IconButton
              variant="secondary"
              aria-label="File info"
              aria-pressed={infoOpen}
              title="File info"
              icon={infoOpen ? <SidebarRightIcon size={18} /> : <InformationCircleIcon size={18} />}
              onClick={() => setInfoOpen((open) => !open)}
            />
            <IconButton variant="secondary" aria-label="Close and go back to Library" title="Close" icon={<CancelOneIcon size={18} />} onClick={() => router.push(backHref)} />
          </span>
        </div>

        <AnimatePresence initial={false}>
          {infoOpen && (
            <m.div
              key="file-info"
              className={styles.slide}
              onWheel={forwardWheel}
              {...card}
            >
              <FileInfoCard
                file={file}
                viewerId={viewerId}
                onManageAccess={() => handle('share', file)}
                onRename={() => handle('rename', file)}
                onClose={() => setInfoOpen(false)}
                onAsk={() => askAbout('')}
                onDownload={download}
                onDelete={() => handle('delete', file)}
              />
            </m.div>
          )}
        </AnimatePresence>

        {canAsk && (
          <div className={styles.dock}>
            <div className={styles.ask}>
              <ChatInput
                value={question}
                onChange={setQuestion}
                onSend={(text) => {
                  if (!text.trim()) return
                  setQuestion('')
                  askAbout(text)
                }}
                placeholder="Ask about this file"
                textareaLabel="Ask about this file"
                hideModelSelector
                // The composer's leading "+", but here it opens a new chat about this file (prototype), not a menu.
                addMenu={null}
                onAdd={() => askAbout('')}
                addButtonLabel={FILE_MESSAGES.askInNewChat}
                addButtonTooltip={FILE_MESSAGES.openInNewChat}
                compact
              />
            </div>
          </div>
        )}
      </div>

      {/* The dialog works on the live file, not the copy taken when it opened (a rename or a share
          elsewhere while it is open would otherwise show stale details). */}
      <FileDialogs dialog={dialog && dialog.file.id === file.id ? { ...dialog, file } : dialog} onClose={closeDialog} onDeleted={() => router.push(backHref)} />
    </LibraryShell>
  )
}
