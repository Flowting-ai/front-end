"use client"

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { createPortal } from "react-dom"
import { m, AnimatePresence } from "framer-motion"
import { CancelOneIcon } from "@strange-huge/icons"
import { usePinboard, type PinItem, type PinCategory, type PinComment } from "@/context/pinboard-context"
import { useChatHistoryContext } from "@/context/chat-history-context"
import { Pinboard, type PinboardPin, type PinboardView } from "@/components/Pinboard"
import { PinboardSkeleton } from "@/components/PinboardSkeleton"
import type { PinboardExpandedFolder } from "@/components/PinboardExpanded"
import { exportSinglePin, exportPins } from "@/lib/export-pins"
import { CHAT_ROUTE } from "@/lib/routes"
import { createPinFolder, validateFolderName, movePinToFolder, renamePinFolder, deletePinFolder } from "@/lib/api/pins"
import { Button } from "@/components/Button"
import { IconButton } from "@/components/IconButton"
import { InputField } from "@/components/InputField"
import { toast } from "sonner"
import type { BadgeColor } from "@/components/Badge"

// ── Category → badge color ────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<PinCategory, BadgeColor> = {
  Code:     "Green",
  Research: "Blue",
  Creative: "Purple",
  Planning: "Yellow",
  Tasks:    "Red",
  Quote:    "Brown",
  Workflow: "Neutral",
}

const TAG_COLORS: BadgeColor[] = ["Blue", "Green", "Purple", "Yellow", "Red", "Neutral", "Brown"]

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return "Updated just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `Updated ${minutes} minute${minutes === 1 ? "" : "s"} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Updated ${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.floor(hours / 24)
  return `Updated ${days} day${days === 1 ? "" : "s"} ago`
}

// ── Helper ────────────────────────────────────────────────────────────────────

function toPinboardPin(
  item: PinItem,
  chatNameById: Map<string, string>,
  onExport: () => void,
  onDelete: () => void,
  onDuplicate: () => void,
  onShowInChat: () => void,
  onSaveComment: (text: string) => void,
): PinboardPin {
  const tagLabels: { color: BadgeColor; text: string }[] =
    item.tags && item.tags.length > 0
      ? item.tags.map((tag, i) => ({ color: TAG_COLORS[i % TAG_COLORS.length], text: tag }))
      : [{ color: CATEGORY_COLOR[item.category], text: item.category }]

  const chatName =
    (item.chatId ? chatNameById.get(item.chatId) : undefined) ?? item.chatName ?? ""

  return {
    id:          item.id,
    category:    item.category,
    pinTitle:    item.title || item.content.split("\n")[0].slice(0, 120) || "Untitled Pin",
    description: item.content,
    chatName,
    modelName:   item.modelName,
    createdAt:   item.createdAt,
    comments:    item.comments as PinComment[] | undefined,
    labels: [
      ...tagLabels,
      ...(item.modelName ? [{ color: "Neutral" as BadgeColor, text: item.modelName }] : []),
    ],
    onExport,
    onDelete,
    onDuplicate,
    onShowInChat,
    onSaveComment,
    // Structured payload (id/title/content) so listeners can add this pin as
    // a real @-mention, same as picking it from the PinMentionDropdown —
    // NOT raw text splice into the input.
    onInsert: () => window.dispatchEvent(
      new CustomEvent('pin:insert', { detail: { id: item.id, title: item.title, content: item.content } })
    ),
  }
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

// ── Component ─────────────────────────────────────────────────────────────────

function RightSidebarImpl() {
  // Always render PinboardSkeleton on first paint so server HTML (isLoading=true)
  // and client initial render match, preventing a hydration mismatch when the
  // pinboard context has a cached/stale isLoading=false value on the client.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const { pins, folders: contextFolders, isLoading, isOpen, close, removePin, clonePin, addFolder, updatePinFolder, renameFolder, removeFolder, chatFilter, clearChatFilter, updatePinComment } = usePinboard()
  const { chats } = useChatHistoryContext()

  // Derive active chat ID from URL — same dual-pattern logic as FloatingPanel.
  // Regular chat: /chat?id={chatId}  |  Project chat: /project/[id]/chat/[chatId]
  const pathname     = usePathname()
  const sidebarSearchParams = useSearchParams()
  const currentChatId = (() => {
    const m = pathname.match(/\/project\/[^/]+\/chat\/([^/]+)/)
    if (m) return m[1]
    return sidebarSearchParams.get("id") ?? undefined
  })()

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [selectedTagIds,      setSelectedTagIds]      = useState<string[]>([])
  const [rawSearch,      setRawSearch]      = useState("")
  const searchQuery = useDebounce(rawSearch, 150)
  const [sortOrder,      setSortOrder]      = useState<string>("newest")
  const [selectedViewId,   setSelectedViewId]   = useState<string>(() => chatFilter ? "current-chat" : "all")
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

  // When a chat-specific filter is applied (e.g. from the chats board), switch to "current-chat" view.
  useEffect(() => {
    if (chatFilter) setSelectedViewId("current-chat")
  }, [chatFilter])

  // ── Last-activity tracking for dynamic updatedLabel ───────────────────────
  const [lastActivityAt, setLastActivityAt] = useState<Date | null>(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!lastActivityAt) return
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [lastActivityAt])

  const updatedLabel = lastActivityAt ? formatTimeAgo(lastActivityAt) : ""

  // ── Create folder modal ────────────────────────────────────────────────────
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [folderModalName, setFolderModalName] = useState("")

  const handleCreateFolder = async () => {
    const name = folderModalName.trim()
    setShowFolderModal(false)
    setFolderModalName("")
    if (!name) return
    const existingNames = contextFolders.map((f) => f.label)
    const error = validateFolderName(name, existingNames)
    if (error) { toast.error(error); return }
    try {
      const created = await createPinFolder(name)
      addFolder({ id: created.id, label: created.name })
      toast(`Folder "${created.name}" created`)
      setLastActivityAt(new Date())
    } catch {
      toast.error("Failed to create folder.")
    }
  }

  // ── Organize-mode handlers ────────────────────────────────────────────────
  const handleMoveToFolder = useCallback(
    async (pinIds: string[], folderId: string, folderLabel: string) => {
      // Snapshot current folder state for rollback on failure
      const snapshot = new Map(
        pinIds.map((id) => {
          const pin = pins.find((p) => p.id === id)
          return [id, { folderId: pin?.folderId ?? null, folderName: pin?.folderName }] as const
        }),
      )
      // Optimistic update
      for (const id of pinIds) updatePinFolder(id, folderId, folderLabel)
      try {
        await Promise.all(pinIds.map((id) => movePinToFolder(id, folderId)))
        const count = pinIds.length
        toast(count === 1 ? `Moved to ${folderLabel}` : `Moved ${count} pins to ${folderLabel}`)
        setLastActivityAt(new Date())
      } catch {
        // Rollback on failure
        for (const id of pinIds) {
          const prev = snapshot.get(id)
          if (prev) updatePinFolder(id, prev.folderId, prev.folderName)
        }
        toast.error("Failed to move pins to folder.")
      }
    },
    [pins, updatePinFolder],
  )

  const handleDeleteSelected = useCallback(
    (pinIds: string[]) => {
      for (const id of pinIds) removePin(id)
      const count = pinIds.length
      toast(count === 1 ? "Pin deleted" : `Deleted ${count} pins`)
      setLastActivityAt(new Date())
    },
    [removePin],
  )

  const handleExportSelected = useCallback(
    (pinIds: string[]) => {
      const toExport = filteredRawRef.current.filter((p) => pinIds.includes(p.id))
      exportPins(toExport, chatNameByIdRef.current)
    },
    [],
  )

  // ── Folder delete (two-step: request → confirm modal → API) ─────────────
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [deleteFolderTarget,     setDeleteFolderTarget]     = useState<{ id: string; label: string } | null>(null)

  const handleFolderDelete = useCallback(
    (folderId: string) => {
      const folder = contextFolders.find((f) => f.id === folderId)
      setDeleteFolderTarget(folder
        ? { id: folder.id, label: folder.label }
        : { id: folderId, label: "Folder" })
      setShowDeleteConfirmModal(true)
    },
    [contextFolders],
  )

  const handleConfirmDelete = async () => {
    if (!deleteFolderTarget) return
    const { id, label } = deleteFolderTarget
    setShowDeleteConfirmModal(false)
    setDeleteFolderTarget(null)
    try {
      await deletePinFolder(id)
      removeFolder(id)
      toast(`"${label}" deleted`)
      setLastActivityAt(new Date())
    } catch {
      toast.error("Failed to delete folder.")
    }
  }

  // ── Folder rename modal ───────────────────────────────────────────────────
  const [showRenameModal,      setShowRenameModal]      = useState(false)
  const [renameFolderTarget,   setRenameFolderTarget]   = useState<{ id: string; label: string } | null>(null)
  const [renameModalName,      setRenameModalName]      = useState("")

  const handleFolderRename = useCallback(
    (folderId: string, currentLabel: string) => {
      setRenameFolderTarget({ id: folderId, label: currentLabel })
      setRenameModalName(currentLabel)
      setShowRenameModal(true)
    },
    [],
  )

  const handleConfirmRename = async () => {
    const name = renameModalName.trim()
    setShowRenameModal(false)
    setRenameFolderTarget(null)
    setRenameModalName("")
    if (!name || !renameFolderTarget) return
    const existingNames = contextFolders
      .flatMap((f) => f.id !== renameFolderTarget.id ? [f.label] : [])
    const error = validateFolderName(name, existingNames)
    if (error) { toast.error(error); return }
    try {
      await renamePinFolder(renameFolderTarget.id, name)
      renameFolder(renameFolderTarget.id, name)
      toast(`Folder renamed to "${name}"`)
      setLastActivityAt(new Date())
    } catch {
      toast.error("Failed to rename folder.")
    }
  }

  // Convert context folders to PinboardExpandedFolder shape
  const folders = useMemo(
    (): PinboardExpandedFolder[] => contextFolders.map((f) => ({ id: f.id, label: f.label })),
    [contextFolders],
  )

  // Derive unique tags from all loaded pins so the filter menu shows real data.
  const availableTags = useMemo(() => {
    const seen = new Set<string>()
    for (const pin of pins) {
      for (const tag of pin.tags ?? []) seen.add(tag)
    }
    return Array.from(seen)
      .sort()
      .map((name) => ({ id: `tag-${name.toLowerCase().replace(/\s+/g, '-')}`, label: name }))
  }, [pins])

  const chatNameById = useMemo((): Map<string, string> => {
    const map = new Map<string, string>()
    for (const chat of chats) map.set(chat.id, chat.title)
    return map
  }, [chats])

  const handleViewChange = useCallback((viewId: string, view: PinboardView) => {
    setSelectedViewId(viewId)
    if (chatFilter) clearChatFilter()
    const isFolder = contextFolders.some((f) => f.id === viewId)
    setSelectedFolderId(isFolder ? viewId : null)
    toast.info(`Showing "${view.label}"`)
  }, [contextFolders, chatFilter, clearChatFilter])

  // When opened via openForChat(), chatFilter overrides the URL-derived chat ID
  // so the "current-chat" view correctly shows that chat's pins even on /chats.
  const effectiveChatId = useMemo(
    () => chatFilter ?? currentChatId,
    [chatFilter, currentChatId],
  )

  // ── Stable per-pin handlers ──────────────────────────────────────────────
  // Closures are created once per pin ID and cached in a ref so they don't
  // change identity on re-renders. filteredRawRef and chatNameByIdRef are
  // kept current so handler calls always see the latest data.
  const filteredRawRef  = useRef<PinItem[]>([])
  const chatNameByIdRef = useRef(chatNameById)
  chatNameByIdRef.current = chatNameById

  const handlersRef = useRef(
    new Map<string, { onExport: () => void; onDelete: () => void; onDuplicate: () => void; onShowInChat: () => void; onSaveComment: (text: string) => void }>(),
  )

  const router = useRouter()

  const getHandlers = useCallback(
    (pinId: string) => {
      if (!handlersRef.current.has(pinId)) {
        handlersRef.current.set(pinId, {
          onExport: () => {
            const p = filteredRawRef.current.find((x) => x.id === pinId)
            if (p) exportSinglePin(p, chatNameByIdRef.current)
          },
          onDelete:    () => removePin(pinId),
          onDuplicate: () => {
            const p = filteredRawRef.current.find((x) => x.id === pinId)
            if (p) clonePin(p)
          },
          onShowInChat: () => {
            const p = filteredRawRef.current.find((x) => x.id === pinId)
            if (!p?.chatId) return
            const params = new URLSearchParams({ id: p.chatId })
            if (p.messageId) params.set('msg', p.messageId)
            router.push(`${CHAT_ROUTE}?${params.toString()}`)
          },
          onSaveComment: (text: string) => updatePinComment(pinId, text),
        })
      }
      return handlersRef.current.get(pinId)!
    },
    [removePin, clonePin, router, updatePinComment],
  )

  // ── Single filtered+mapped memo (replaces two separate memos) ───────────
  const filteredPins = useMemo((): PinboardPin[] => {
    let result = pins

    // View filter: "current-chat" shows only pins from the currently open chat.
    // Folder views filter by folder assignment. All other views (all, recent)
    // show the full list and let the sort/search narrow it further.
    if (selectedViewId === "current-chat") {
      result = effectiveChatId
        ? result.filter((p) => p.chatId === effectiveChatId)
        : []
    } else if (selectedFolderId) {
      result = result.filter((p) => p.folderId === selectedFolderId)
    }

    if (selectedCategoryIds.length > 0) {
      result = result.filter((p) =>
        selectedCategoryIds.some(
          (id) => id.replace('category-', '').toLowerCase() === p.category.toLowerCase(),
        ),
      )
    }
    if (selectedTagIds.length > 0) {
      result = result.filter((p) =>
        p.tags?.some((tag) =>
          selectedTagIds.includes(`tag-${tag.toLowerCase().replace(/\s+/g, '-')}`),
        ),
      )
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (p) => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q),
      )
    }
    if (sortOrder === "oldest") {
      result = result.toSorted((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    } else if (sortOrder === "most-used") {
      result = result.toSorted((a, b) =>
        (b.comments?.length ?? 0) - (a.comments?.length ?? 0) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    } else if (sortOrder === "alphabetical") {
      result = result.toSorted((a, b) => a.title.localeCompare(b.title))
    } else if (sortOrder === "reverse-alphabetical") {
      result = result.toSorted((a, b) => b.title.localeCompare(a.title))
    } else {
      result = result.toSorted((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }

    // Keep raw ref current for bulk export + per-pin export handlers.
    // Side-effectful inside useMemo is safe here because filteredRawRef is
    // only read during user-triggered actions, never during render.
    filteredRawRef.current = result

    // Evict handlers for pins no longer in the filtered list
    const ids = new Set(result.map((p) => p.id))
    for (const id of handlersRef.current.keys()) {
      if (!ids.has(id)) handlersRef.current.delete(id)
    }

    return result.map((p) => {
      const h = getHandlers(p.id)
      return toPinboardPin(p, chatNameById, h.onExport, h.onDelete, h.onDuplicate, h.onShowInChat, h.onSaveComment)
    })
  }, [pins, selectedViewId, selectedFolderId, effectiveChatId, selectedCategoryIds, selectedTagIds, searchQuery, sortOrder, chatNameById, getHandlers])

  return (
    <>
    <m.div
      animate={isOpen ? { width: 332, opacity: 1 } : { width: 0, opacity: 0 }}
      initial={{ width: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 32, mass: 0.9 }}
      style={{
        height:        "100%",
        flexShrink:    0,
        overflow:      "hidden",
        pointerEvents: isOpen ? undefined : "none",
      }}
      aria-hidden={!isOpen || undefined}
    >
      {/* Fixed-width inner shell keeps the Pinboard content at exactly 332 px
          regardless of the animated outer width. Without this, the outer
          m.div's width animation (0 → 332) would resize the fluid Pinboard
          on every frame, firing every Pin's ResizeObserver and triggering N
          concurrent height spring animations throughout the transition. */}
      <div style={{ width: 332, height: "100%", flexShrink: 0 }}>
        {(!mounted || isLoading) ? (
          <PinboardSkeleton fluid pinCount={4} />
        ) : (
          <Pinboard
            fluid
            pins={filteredPins}
            personalFolders={folders}
            onSearch={setRawSearch}
            onClose={close}
            tags={availableTags}
            selectedCategoryIds={selectedCategoryIds}
            onSelectedCategoryIdsChange={(ids) => setSelectedCategoryIds([...ids])}
            selectedTagIds={selectedTagIds}
            onSelectedTagIdsChange={(ids) => setSelectedTagIds([...ids])}
            contentTypes={[]}
            defaultSelectedSortId="newest"
            onSelectedSortIdChange={v => setSortOrder(v ?? 'newest')}
            onExport={() => exportPins(filteredRawRef.current, chatNameByIdRef.current)}
            onViewChange={handleViewChange}
            onNewFolderClick={() => { setFolderModalName(""); setShowFolderModal(true) }}
            onMoveToFolder={handleMoveToFolder}
            onDeleteSelected={handleDeleteSelected}
            onExportSelected={handleExportSelected}
            updatedLabel={updatedLabel}
            onFolderRename={handleFolderRename}
            onFolderDelete={handleFolderDelete}
          />
        )}
      </div>
    </m.div>

    {/* ── Delete folder confirmation modal ─────────────────────────────────── */}
    {typeof document !== "undefined" && createPortal(
      <AnimatePresence>
        {showDeleteConfirmModal && (
          <m.div
            key="delete-folder-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => { setShowDeleteConfirmModal(false); setDeleteFolderTarget(null) }}
            style={{
              position:        "fixed",
              inset:           0,
              zIndex:          9999,
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              backgroundColor: "rgba(26,23,20,0.4)",
              backdropFilter:  "blur(2px)",
            }}
          >
            <m.div
              key="delete-folder-dialog"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{    opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 400, damping: 32, mass: 0.8 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background:    "var(--neutral-white)",
                borderRadius:  "20px",
                boxShadow:     "0px 8px 32px 0px rgba(26,23,20,0.24), 0px 0px 0px 1px rgba(59,54,50,0.12)",
                width:         "360px",
                maxWidth:      "calc(100vw - 32px)",
                display:       "flex",
                flexDirection: "column",
                overflow:      "hidden",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 16px" }}>
                <p style={{ margin: 0, fontFamily: "var(--font-title)", fontWeight: 400, fontSize: 18, lineHeight: "26px", color: "var(--neutral-900)" }}>
                  Delete folder
                </p>
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<CancelOneIcon size={20} />}
                  aria-label="Close"
                  onClick={() => { setShowDeleteConfirmModal(false); setDeleteFolderTarget(null) }}
                />
              </div>
              <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 16, }}>
                <p style={{ margin: 0, fontFamily: "var(--font-body)", fontWeight: 400, fontSize: 14, lineHeight: "20px", color: "var(--neutral-600)" }}>
                  {deleteFolderTarget
                    ? `"${deleteFolderTarget.label}" will be deleted, but your pins will still be available in All Pins.`
                    : "This folder will be deleted, but your pins will still be available in All Pins."}
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <Button variant="ghost" size="sm" onClick={() => { setShowDeleteConfirmModal(false); setDeleteFolderTarget(null) }}>
                    Cancel
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleConfirmDelete}>
                    Delete
                  </Button>
                </div>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>,
      document.body
    )}

    {/* ── Rename folder modal ──────────────────────────────────────────────── */}
    {typeof document !== "undefined" && createPortal(
      <AnimatePresence>
        {showRenameModal && (
          <m.div
            key="rename-folder-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => { setShowRenameModal(false); setRenameFolderTarget(null); setRenameModalName("") }}
            style={{
              position:        "fixed",
              inset:           0,
              zIndex:          20,
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              backgroundColor: "rgba(26,23,20,0.4)",
              backdropFilter:  "blur(2px)",
            }}
          >
            <m.div
              key="rename-folder-dialog"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{    opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 400, damping: 32, mass: 0.8 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background:    "var(--neutral-white)",
                borderRadius:  "20px",
                boxShadow:     "0px 8px 32px 0px rgba(26,23,20,0.24), 0px 0px 0px 1px rgba(59,54,50,0.12)",
                width:         "360px",
                maxWidth:      "calc(100vw - 32px)",
                display:       "flex",
                flexDirection: "column",
                overflow:      "hidden",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 16px" }}>
                <p style={{ margin: 0, fontFamily: "var(--font-title)", fontWeight: 400, fontSize: 18, lineHeight: "26px", color: "var(--neutral-900)" }}>
                  Rename folder
                </p>
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<CancelOneIcon size={20} />}
                  aria-label="Close"
                  onClick={() => { setShowRenameModal(false); setRenameFolderTarget(null); setRenameModalName("") }}
                />
              </div>
              <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <InputField
                  label="Folder name"
                  showLabel
                  placeholder="e.g. Research notes"
                  value={renameModalName}
                  onChange={setRenameModalName}
                  fluid
                  autoFocus
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter")  handleConfirmRename()
                    if (e.key === "Escape") { setShowRenameModal(false); setRenameFolderTarget(null); setRenameModalName("") }
                  }}
                  aria-label="Folder name"
                />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <Button variant="ghost" size="sm" onClick={() => { setShowRenameModal(false); setRenameFolderTarget(null); setRenameModalName("") }}>
                    Cancel
                  </Button>
                  <Button variant="default" size="sm" disabled={!renameModalName.trim()} onClick={handleConfirmRename}>
                    Rename
                  </Button>
                </div>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>,
      document.body
    )}

    {/* ── Create folder modal ───────────────────────────────────────────────── */}
    {typeof document !== "undefined" && createPortal(
      <AnimatePresence>
        {showFolderModal && (
          <m.div
            key="create-folder-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => { setShowFolderModal(false); setFolderModalName("") }}
            style={{
              position:        "fixed",
              inset:           0,
              zIndex:          22,
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              backgroundColor: "rgba(26,23,20,0.4)",
              backdropFilter:  "blur(2px)",
            }}
          >
            <m.div
              key="create-folder-dialog"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{    opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 400, damping: 32, mass: 0.8 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background:    "var(--neutral-white)",
                borderRadius:  "20px",
                boxShadow:     "0px 8px 32px 0px rgba(26,23,20,0.24), 0px 0px 0px 1px rgba(59,54,50,0.12)",
                width:         "360px",
                maxWidth:      "calc(100vw - 32px)",
                display:       "flex",
                flexDirection: "column",
                overflow:      "hidden",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 16px" }}>
                <p style={{ margin: 0, fontFamily: "var(--font-title)", fontWeight: 400, fontSize: 18, lineHeight: "26px", color: "var(--neutral-900)" }}>
                  New folder
                </p>
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<CancelOneIcon size={20} />}
                  aria-label="Close"
                  onClick={() => { setShowFolderModal(false); setFolderModalName("") }}
                />
              </div>
              <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <InputField
                  label="Folder name"
                  showLabel
                  placeholder="e.g. Research notes"
                  value={folderModalName}
                  onChange={setFolderModalName}
                  fluid
                  autoFocus
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter")  handleCreateFolder()
                    if (e.key === "Escape") { setShowFolderModal(false); setFolderModalName("") }
                  }}
                  aria-label="Folder name"
                />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <Button variant="ghost" size="sm" onClick={() => { setShowFolderModal(false); setFolderModalName("") }}>
                    Cancel
                  </Button>
                  <Button variant="default" size="sm" disabled={!folderModalName.trim()} onClick={handleCreateFolder}>
                    Create folder
                  </Button>
                </div>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </>
  )
}

export function RightSidebar() {
  return <Suspense fallback={null}><RightSidebarImpl /></Suspense>
}
