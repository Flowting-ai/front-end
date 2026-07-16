"use client"

/**
 * XmlWeather.tsx
 *
 * Renders a <weather>...</weather> XML block from the assistant as a weather
 * card — current conditions on a condition-tinted header plus a daily
 * forecast list with Apple-style temperature range bars (each day's low→high
 * positioned on the whole period's scale, colored cold-blue → hot-orange):
 *
 *   <weather location="San Francisco" unit="°C">
 *     <current temp="18" condition="partly-cloudy" high="21" low="14"
 *              humidity="72%" wind="14 km/h"/>
 *     <day label="Wed" high="21" low="14" condition="sunny"/>
 *     <day label="Thu" high="19" low="13" condition="rain"/>
 *   </weather>
 *
 * Data comes from the backend get_weather tool (Open-Meteo).
 * See: docs/frontend-rendering.md - Weather section.
 */

import React from "react"
import { m } from "framer-motion"
import { scanTags } from "@/lib/xml-widgets"

export interface ParsedWeather {
  location: string
  unit: string
  current?: {
    temp: string
    condition?: string
    high?: string
    low?: string
    humidity?: string
    wind?: string
  }
  days: Array<{ label: string; high?: string; low?: string; condition?: string }>
}

const CONDITION_ICON: Array<[RegExp, string]> = [
  [/thunder|storm/i, "⛈️"],
  [/drizzle/i, "🌦️"],
  [/rain|shower/i, "🌧️"],
  [/snow|sleet|ice/i, "🌨️"],
  [/fog|mist|haze/i, "🌫️"],
  [/overcast/i, "☁️"],
  [/partly|part[- ]?cloud/i, "⛅"],
  [/cloud/i, "☁️"],
  [/wind/i, "💨"],
  [/sun|clear/i, "☀️"],
]

export function conditionIcon(condition?: string): string {
  if (!condition) return "🌡️"
  for (const [re, icon] of CONDITION_ICON) {
    if (re.test(condition)) return icon
  }
  return "🌡️"
}

function conditionLabel(condition?: string): string {
  return (condition ?? "").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

// Subtle header tint per condition family — enough atmosphere to read the
// weather at a glance without fighting the neutral palette.
const CONDITION_TINT: Array<[RegExp, string]> = [
  [/thunder|storm/i, "linear-gradient(135deg, rgba(82,75,71,0.16), rgba(82,75,71,0.04))"],
  [/rain|shower|drizzle/i, "linear-gradient(135deg, rgba(13,110,178,0.13), rgba(13,110,178,0.03))"],
  [/snow|sleet|ice/i, "linear-gradient(135deg, rgba(147,197,253,0.22), rgba(147,197,253,0.05))"],
  [/fog|mist|haze|overcast|cloud/i, "linear-gradient(135deg, rgba(156,147,139,0.16), rgba(156,147,139,0.04))"],
  [/sun|clear/i, "linear-gradient(135deg, rgba(250,190,60,0.20), rgba(251,146,60,0.05))"],
]

function conditionTint(condition?: string): string {
  for (const [re, tint] of CONDITION_TINT) {
    if (condition && re.test(condition)) return tint
  }
  return "linear-gradient(135deg, rgba(156,147,139,0.10), rgba(156,147,139,0.02))"
}

/** Cold-blue → hot-orange hue for a temperature (°C internally). */
export function tempColor(value: number, unit: string): string {
  const celsius = /f/i.test(unit) ? ((value - 32) * 5) / 9 : value
  const t = Math.max(0, Math.min(1, (celsius + 10) / 45)) // -10°C … 35°C
  const hue = 220 - t * 195 // 220 (blue) → 25 (orange-red)
  return `hsl(${Math.round(hue)} 70% 52%)`
}

export function parseWeatherXml(xml: string): ParsedWeather | null {
  const [weather] = scanTags(xml, "weather")
  if (!weather) return null
  const [current] = scanTags(weather.inner, "current")
  const days = scanTags(weather.inner, "day")
    .filter((d) => d.attrs.label)
    .map((d) => ({ label: d.attrs.label, high: d.attrs.high, low: d.attrs.low, condition: d.attrs.condition }))

  if (!current && days.length === 0) return null
  return {
    location: weather.attrs.location ?? "",
    unit:     weather.attrs.unit ?? "°",
    current:  current?.attrs.temp
      ? {
          temp:      current.attrs.temp,
          condition: current.attrs.condition,
          high:      current.attrs.high,
          low:       current.attrs.low,
          humidity:  current.attrs.humidity,
          wind:      current.attrs.wind,
        }
      : undefined,
    days,
  }
}

const captionStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize:   "var(--font-size-caption)",
  lineHeight: "var(--line-height-caption)",
  color:      "var(--neutral-500)",
}

function DayRow({
  day,
  unit,
  periodMin,
  periodMax,
  index,
}: {
  day: ParsedWeather["days"][number]
  unit: string
  periodMin: number
  periodMax: number
  index: number
}) {
  const low = Number(day.low)
  const high = Number(day.high)
  const hasRange = Number.isFinite(low) && Number.isFinite(high) && periodMax > periodMin
  const left = hasRange ? ((low - periodMin) / (periodMax - periodMin)) * 100 : 0
  const width = hasRange ? Math.max(((high - low) / (periodMax - periodMin)) * 100, 4) : 0

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
      <span style={{ ...captionStyle, width: 40, flexShrink: 0, color: "var(--neutral-700)", fontWeight: 500 }}>
        {day.label}
      </span>
      <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, width: 22, textAlign: "center" }} aria-hidden>
        {conditionIcon(day.condition)}
      </span>
      <span style={{ ...captionStyle, width: 32, flexShrink: 0, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {day.low}{unit && "°"}
      </span>
      <div
        style={{
          flex:            "1 1 0",
          height:          5,
          borderRadius:    999,
          backgroundColor: "var(--neutral-100)",
          position:        "relative",
          overflow:        "hidden",
        }}
        title={`${day.low}–${day.high}${unit}`}
      >
        {hasRange && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.12 + index * 0.06 }}
            style={{
              position:     "absolute",
              left:         `${left}%`,
              width:        `${width}%`,
              top:          0,
              bottom:       0,
              borderRadius: 999,
              background:   `linear-gradient(90deg, ${tempColor(low, unit)}, ${tempColor(high, unit)})`,
            }}
          />
        )}
      </div>
      <span style={{ ...captionStyle, width: 32, flexShrink: 0, textAlign: "right", color: "var(--neutral-800)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
        {day.high}{unit && "°"}
      </span>
    </div>
  )
}

export function XmlWeather({ xml }: { xml: string }) {
  const weather = React.useMemo(() => parseWeatherXml(xml), [xml])
  if (!weather) return null

  const lows = weather.days.map((d) => Number(d.low)).filter(Number.isFinite)
  const highs = weather.days.map((d) => Number(d.high)).filter(Number.isFinite)
  const periodMin = Math.min(...lows, Infinity)
  const periodMax = Math.max(...highs, -Infinity)

  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      style={{
        margin:          "12px 0",
        borderRadius:    14,
        border:          "1px solid var(--neutral-100)",
        backgroundColor: "var(--neutral-white)",
        boxShadow:       "var(--shadow-surface-card)",
        overflow:        "hidden",
        maxWidth:        440,
      }}
    >
      {/* Current conditions on a condition-tinted header */}
      {weather.current && (
        <div
          style={{
            display:    "flex",
            alignItems: "center",
            gap:        14,
            padding:    "16px 16px 14px",
            background: conditionTint(weather.current.condition),
          }}
        >
          <span style={{ fontSize: 40, lineHeight: 1 }} aria-hidden>
            {conditionIcon(weather.current.condition)}
          </span>
          <div style={{ flex: "1 1 0", display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span
              style={{
                fontFamily: "var(--font-title)",
                fontSize:   32,
                lineHeight: "36px",
                fontWeight: "var(--font-weight-medium)",
                color:      "var(--neutral-900)",
              }}
            >
              {weather.current.temp}{weather.unit}
            </span>
            <span style={{ ...captionStyle, color: "var(--neutral-600)" }}>
              {[weather.location, conditionLabel(weather.current.condition)].filter(Boolean).join(" · ")}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
            {(weather.current.high || weather.current.low) && (
              <span style={{ ...captionStyle, color: "var(--neutral-700)", fontWeight: 500 }}>
                H {weather.current.high}° · L {weather.current.low}°
              </span>
            )}
            {weather.current.humidity && <span style={captionStyle}>💧 {weather.current.humidity}</span>}
            {weather.current.wind && <span style={captionStyle}>🌬 {weather.current.wind}</span>}
          </div>
        </div>
      )}

      {/* Daily forecast — shared temperature scale, per-day range bars */}
      {weather.days.length > 0 && (
        <div style={{ padding: "8px 16px 12px" }}>
          {weather.days.map((day, i) => (
            <DayRow
              key={`${day.label}-${i}`}
              day={day}
              unit={weather.unit}
              periodMin={periodMin}
              periodMax={periodMax}
              index={i}
            />
          ))}
        </div>
      )}
    </m.div>
  )
}
