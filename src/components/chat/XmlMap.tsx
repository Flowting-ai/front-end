"use client"

import React from "react"
import dynamic from "next/dynamic"
import { MapPin } from "lucide-react"
import { scanTags } from "@/lib/xml-widgets"
import styles from "./XmlMap.module.css"

export interface ParsedMapPoint {
  id: string
  lat: number
  lng: number
  value: number
  label: string
  group: string
  code?: string
}

export interface ParsedMapGroup {
  key: string
  label: string
  value: number
}

export interface ParsedMap {
  title: string
  metric: string
  unit: string
  points: ParsedMapPoint[]
  groups: ParsedMapGroup[]
}

const MAX_POINTS = 250

function finiteNumber(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Number(value.replace(/,/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

/** Parse the flat, model-authored map XML without relying on browser APIs. */
export function parseMapXml(xml: string): ParsedMap | null {
  const root = scanTags(xml, "map")[0]
  if (!root) return null

  const points: ParsedMapPoint[] = []
  for (const { attrs } of scanTags(xml, "point")) {
    const lat = finiteNumber(attrs.lat)
    const lng = finiteNumber(attrs.lng)
    const value = finiteNumber(attrs.value)
    if (lat === null || lng === null || value === null) continue
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue

    const label = attrs.label?.trim() || attrs.code?.trim() || `Location ${points.length + 1}`
    const group = attrs.group?.trim() || attrs.code?.trim() || label
    points.push({
      id: attrs.id?.trim() || `map-point-${points.length}`,
      lat,
      lng,
      value,
      label,
      group,
      code: attrs.code?.trim() || undefined,
    })
    if (points.length >= MAX_POINTS) break
  }

  if (points.length === 0) return null

  const groups: ParsedMapGroup[] = []
  const seenGroups = new Set<string>()
  for (const { attrs } of scanTags(xml, "group")) {
    const key = attrs.code?.trim() || attrs.id?.trim() || attrs.label?.trim()
    const value = finiteNumber(attrs.value)
    if (!key || value === null || seenGroups.has(key)) continue
    seenGroups.add(key)
    groups.push({ key, label: attrs.label?.trim() || key, value })
  }

  return {
    title: root.attrs.title?.trim() || root.attrs.metric?.trim() || "Geographic distribution",
    metric: root.attrs.metric?.trim() || "Value",
    unit: root.attrs.unit?.trim() || "",
    points,
    groups,
  }
}

function MapPlaceholder({ label, paused = false }: { label: string; paused?: boolean }) {
  return (
    <div className={styles.placeholder} aria-label={paused ? `${label} map paused offscreen` : `Loading ${label} map`}>
      <div className={styles.placeholderGrid} aria-hidden />
      <div className={styles.placeholderLabel}>
        <MapPin size={15} aria-hidden />
        <span>{paused ? "Map paused while offscreen" : "Loading interactive map…"}</span>
      </div>
    </div>
  )
}

const InteractiveMap = dynamic(
  () => import("./XmlMapCanvas").then((module) => module.XmlMapCanvas),
  {
    ssr: false,
    loading: () => <MapPlaceholder label="interactive" />,
  },
)

export function XmlMap({ xml }: { xml: string }) {
  const parsed = React.useMemo(() => parseMapXml(xml), [xml])
  const hostRef = React.useRef<HTMLDivElement>(null)
  const [isNearViewport, setIsNearViewport] = React.useState(false)

  React.useEffect(() => {
    const host = hostRef.current
    if (!host) return
    if (!("IntersectionObserver" in window)) {
      const timer = setTimeout(() => setIsNearViewport(true), 0)
      return () => clearTimeout(timer)
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsNearViewport(entry?.isIntersecting ?? false),
      { rootMargin: "480px 0px" },
    )
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  if (!parsed) return null

  return (
    <div ref={hostRef} className={styles.host}>
      {isNearViewport ? (
        <InteractiveMap data={parsed} />
      ) : (
        <MapPlaceholder label={parsed.title} paused />
      )}
    </div>
  )
}
