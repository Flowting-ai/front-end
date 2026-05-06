"use client"

import React, { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { usePinboard, type PinItem, type PinCategory } from "@/context/pinboard-context"
import { Pinboard, type PinboardPin } from "@/components/Pinboard"
import { PinboardExpanded } from "@/components/layout/PinboardExpanded"
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

function toPinboardPin(item: PinItem): PinboardPin {
  const tagLabels: { color: BadgeColor; text: string }[] =
    item.tags && item.tags.length > 0
      ? item.tags.map((tag, i) => ({ color: TAG_COLORS[i % TAG_COLORS.length], text: tag }))
      : [{ color: CATEGORY_COLOR[item.category], text: item.category }];

  return {
    id:          item.id,
    category:    item.category,
    pinTitle:    item.title || item.content.split("\n")[0].slice(0, 120) || "Untitled Pin",
    description: item.content,
    chatName:    item.chatName ?? "",
    labels: [
      ...tagLabels,
      ...(item.modelName ? [{ color: "Neutral" as BadgeColor, text: item.modelName }] : []),
    ],
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RightSidebar() {
  const { pins, isOpen, close } = usePinboard()
  const [expandedOpen,   setExpandedOpen]   = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<PinCategory | "All">("All")
  const [searchQuery,    setSearchQuery]    = useState("")
  const [sortOrder,      setSortOrder]      = useState<"newest" | "oldest">("newest")

  const filteredPins = useMemo((): PinboardPin[] => {
    let result = pins
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
    return result.map(toPinboardPin)
  }, [pins, categoryFilter, searchQuery, sortOrder])

  const filterLabel = categoryFilter === "All" ? "All pins" : categoryFilter

  // Suppress unused-variable warnings for filter/sort state — these will be wired
  // to dropdown menus once the KDS FilterMenu / SortMenu components ship.
  void setCategoryFilter
  void setSortOrder
  void sortOrder

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
              filterLabel={filterLabel}
              onSearch={setSearchQuery}
              onClose={close}
              onOrganize={() => setExpandedOpen(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {expandedOpen && (
          <PinboardExpanded onClose={() => setExpandedOpen(false)} />
        )}
      </AnimatePresence>
    </>
  )
}
