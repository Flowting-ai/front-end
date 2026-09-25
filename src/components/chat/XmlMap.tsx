"use client"

import React from "react"
import dynamic from "next/dynamic"
import { MapPin } from "lucide-react"
import styles from "./XmlMap.module.css"
import { parseMapXml } from "@/components/chat/XmlMap.parse"

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
