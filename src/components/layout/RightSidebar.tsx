"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { usePinboard, type PinItem, type PinCategory } from "@/context/pinboard-context"
import { useChatHistoryContext } from "@/context/chat-history-context"
import { Pinboard, type PinboardPin } from "@/components/Pinboard"
import type { PinboardExpandedFolder } from "@/components/PinboardExpanded"
import { exportSinglePin, exportPins } from "@/lib/export-pins"
import { listPinFolders, createPinFolder, movePinToFolder } from "@/lib/api/pins"
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

  const chatName = (item.chatId ? chatNameById.get(item.chatId) : undefined)
    ?? item.chatName
    ?? ""

  return {
    id:          item.id,
    category:    item.category,
    pinTitle:    item.title || item.content.split("\n")[0].slice(0, 120) || "Untitled Pin",
    description: item.content,
    chatName,
    labels: [
      ...tagLabels,
      ...(item.modelName ? [{ color: "Neutral" as BadgeColor, text: item.modelName }] : []),
    ],
    onExport,
    onDelete,
    onDuplicate,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RightSidebar() {
  const { pins, isOpen, close, removePin, clonePin, updatePinFolder } = usePinboard()
  const { chats } = useChatHistoryContext()
  const [categoryFilter, setCategoryFilter] = useState<PinCategory | "All">("All")
  const [searchQuery,    setSearchQuery]    = useState("")
  const [sortOrder,      setSortOrder]      = useState<"newest" | "oldest">("newest")
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [folders, setFolders] = useState<PinboardExpandedFolder[]>([])

  const chatNameById = useMemo((): Map<string, string> => {
    const map = new Map<string, string>()
    for (const chat of chats) map.set(chat.id, chat.title)
    return map
  }, [chats])

  // Suppress unused-variable warnings for filter/sort state — these will be wired
  // to dropdown menus once the KDS FilterMenu / SortMenu components ship.
  void setCategoryFilter
  void setSortOrder
  void sortOrder

  // ── Fetch real folders from backend on mount ────────────────────────────
  useEffect(() => {
    listPinFolders()
      .then((raw) => setFolders(raw.map(f => ({ id: f.id, label: f.name }))))
      .catch((err) => console.error("[RightSidebar] Failed to load folders", err))
  }, [])

  // ── Folder CRUD ─────────────────────────────────────────────────────────
  const handleCreateFolder = useCallback(async (name: string) => {
    const trimmed = name.trim().slice(0, 30)
    if (!trimmed) return
    if (folders.some(f => f.label?.toLowerCase() === trimmed.toLowerCase())) return
    try {
      const created = await createPinFolder(trimmed)
      setFolders(prev => [...prev, { id: created.id, label: created.name || trimmed }])
    } catch (err) {
      console.error("[RightSidebar] Failed to create folder", err)
    }
  }, [folders])

  const handleMoveToFolder = useCallback(async (pinIds: string[], folderId: string) => {
    const folderName = folders.find(f => f.id === folderId)?.label
    await Promise.all(
      pinIds.map(async (pinId) => {
        try {
          await movePinToFolder(pinId, folderId)
          updatePinFolder(pinId, folderId, folderName)
        } catch (err) {
          console.error("[RightSidebar] Failed to move pin", err)
        }
      }),
    )
  }, [folders, updatePinFolder])

  const handleDeletePins = useCallback((pinIds: string[]) => {
    pinIds.forEach(id => removePin(id))
  }, [removePin])

  // ── View/folder filter ──────────────────────────────────────────────────
  const handleViewChange = useCallback((viewId: string) => {
    const isFolder = folders.some(f => f.id === viewId)
    setSelectedFolderId(isFolder ? viewId : null)
  }, [folders])

  const filteredRawPins = useMemo((): PinItem[] => {
    let result = pins
    if (selectedFolderId) {
      result = result.filter(p => p.folderId === selectedFolderId)
    }
    if (categoryFilter !== "All") {
      result = result.filter(p => p.category === categoryFilter)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        p => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q),
      )
    }
    if (sortOrder === "oldest") result = [...result].reverse()
    return result
  }, [pins, selectedFolderId, categoryFilter, searchQuery, sortOrder])

  const filteredPins = useMemo((): PinboardPin[] => {
    return filteredRawPins.map(p =>
      toPinboardPin(
        p,
        chatNameById,
        () => exportSinglePin(p, chatNameById),
        () => removePin(p.id),
        () => clonePin(p),
      )
    )
  }, [filteredRawPins, chatNameById, removePin, clonePin])

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="pinboard-sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 332, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 32, mass: 0.9 }}
            style={{
              height:       "100%",
              flexShrink:   0,
              overflow:     "hidden",
              borderRadius: 16,
            }}
          >
            <Pinboard
              fluid
              pins={filteredPins}
              personalFolders={folders}
              onSearch={setSearchQuery}
              onClose={close}
              onExport={() => exportPins(filteredRawPins, chatNameById)}
              onViewChange={(viewId) => handleViewChange(viewId)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
