"use client"

import React, { useCallback, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { usePinboard, type PinItem, type PinCategory, type PinComment } from "@/context/pinboard-context"
import { useChatHistoryContext } from "@/context/chat-history-context"
import { Pinboard, type PinboardPin } from "@/components/Pinboard"
import { PinboardSkeleton } from "@/components/PinboardSkeleton"
import type { PinboardExpandedFolder } from "@/components/PinboardExpanded"
import { exportSinglePin, exportPins } from "@/lib/export-pins"
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

// ── Helper ────────────────────────────────────────────────────────────────────

function toPinboardPin(
  item: PinItem,
  chatNameById: Map<string, string>,
  onExport: () => void,
  onDelete: () => void,
  onDuplicate: () => void,
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
    onInsert: () => window.dispatchEvent(
      new CustomEvent('pin:insert', { detail: { content: item.content } })
    ),
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RightSidebar() {
  const { pins, folders: contextFolders, isLoading, isOpen, close, removePin, clonePin } = usePinboard()
  const { chats } = useChatHistoryContext()

  const [categoryFilter, setCategoryFilter] = useState<PinCategory | "All">("All")
  const [searchQuery,    setSearchQuery]    = useState("")
  const [sortOrder,      setSortOrder]      = useState<"newest" | "oldest">("newest")
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

  // Convert context folders to PinboardExpandedFolder shape
  const folders = useMemo(
    (): PinboardExpandedFolder[] => contextFolders.map((f) => ({ id: f.id, label: f.label })),
    [contextFolders],
  )

  // Suppress unused-variable warnings for filter/sort state until dropdowns ship
  void setCategoryFilter
  void setSortOrder
  void sortOrder

  const chatNameById = useMemo((): Map<string, string> => {
    const map = new Map<string, string>()
    for (const chat of chats) map.set(chat.id, chat.title)
    return map
  }, [chats])

  const handleViewChange = useCallback((viewId: string) => {
    const isFolder = contextFolders.some((f) => f.id === viewId)
    setSelectedFolderId(isFolder ? viewId : null)
  }, [contextFolders])

  // ── Stable per-pin handlers ──────────────────────────────────────────────
  // Closures are created once per pin ID and cached in a ref so they don't
  // change identity on re-renders. filteredRawRef and chatNameByIdRef are
  // kept current so handler calls always see the latest data.
  const filteredRawRef  = useRef<PinItem[]>([])
  const chatNameByIdRef = useRef(chatNameById)
  chatNameByIdRef.current = chatNameById

  const handlersRef = useRef(
    new Map<string, { onExport: () => void; onDelete: () => void; onDuplicate: () => void }>(),
  )

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
        })
      }
      return handlersRef.current.get(pinId)!
    },
    [removePin, clonePin],
  )

  // ── Single filtered+mapped memo (replaces two separate memos) ───────────
  const filteredPins = useMemo((): PinboardPin[] => {
    let result = pins
    if (selectedFolderId)       result = result.filter((p) => p.folderId === selectedFolderId)
    if (categoryFilter !== "All") result = result.filter((p) => p.category === categoryFilter)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (p) => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q),
      )
    }
    if (sortOrder === "oldest") result = [...result].reverse()

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
      return toPinboardPin(p, chatNameById, h.onExport, h.onDelete, h.onDuplicate)
    })
  }, [pins, selectedFolderId, categoryFilter, searchQuery, sortOrder, chatNameById, getHandlers])

  return (
    <motion.div
      animate={isOpen ? { width: 332, opacity: 1 } : { width: 0, opacity: 0 }}
      initial={{ width: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 32, mass: 0.9 }}
      style={{
        height:        "100%",
        flexShrink:    0,
        overflow:      "hidden",
        borderRadius:  16,
        pointerEvents: isOpen ? undefined : "none",
      }}
      aria-hidden={!isOpen || undefined}
    >
      {/* Fixed-width inner shell keeps the Pinboard content at exactly 332 px
          regardless of the animated outer width. Without this, the outer
          motion.div's width animation (0 → 332) would resize the fluid Pinboard
          on every frame, firing every Pin's ResizeObserver and triggering N
          concurrent height spring animations throughout the transition. */}
      <div style={{ width: 332, height: "100%", flexShrink: 0 }}>
        {isLoading ? (
          <PinboardSkeleton fluid pinCount={4} />
        ) : (
          <Pinboard
            fluid
            pins={filteredPins}
            personalFolders={folders}
            onSearch={setSearchQuery}
            onClose={close}
            onExport={() => exportPins(filteredRawRef.current, chatNameByIdRef.current)}
            onViewChange={handleViewChange}
          />
        )}
      </div>
    </motion.div>
  )
}
