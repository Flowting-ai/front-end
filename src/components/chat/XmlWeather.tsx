"use client"

/**
 * XmlWeather.tsx
 *
 * Renders a <weather>...</weather> XML block from the assistant as a weather
 * card — current conditions plus an optional daily forecast strip:
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
  color:      "var(--neutral-500)",
}

export function XmlWeather({ xml }: { xml: string }) {
  const weather = React.useMemo(() => parseWeatherXml(xml), [xml])
  if (!weather) return null

  return (
    <div
      style={{
        margin:          "12px 0",
        padding:         "14px 16px",
        borderRadius:    12,
        border:          "1px solid var(--neutral-100)",
        backgroundColor: "var(--neutral-white)",
        boxShadow:       "var(--shadow-surface-card)",
        maxWidth:        460,
      }}
    >
      {/* Current conditions */}
      {weather.current && (
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 34, lineHeight: 1 }} aria-hidden>
            {conditionIcon(weather.current.condition)}
          </span>
          <div style={{ flex: "1 1 0", display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span
              style={{
                fontFamily: "var(--font-title)",
                fontSize:   "var(--font-size-heading)",
                fontWeight: "var(--font-weight-medium)",
                color:      "var(--neutral-900)",
              }}
            >
              {weather.current.temp}{weather.unit}
            </span>
            <span style={captionStyle}>
              {[weather.location, conditionLabel(weather.current.condition)].filter(Boolean).join(" · ")}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
            {(weather.current.high || weather.current.low) && (
              <span style={captionStyle}>
                H {weather.current.high}{weather.unit} · L {weather.current.low}{weather.unit}
              </span>
            )}
            {weather.current.humidity && <span style={captionStyle}>Humidity {weather.current.humidity}</span>}
            {weather.current.wind && <span style={captionStyle}>Wind {weather.current.wind}</span>}
          </div>
        </div>
      )}

      {/* Daily strip */}
      {weather.days.length > 0 && (
        <div
          className="kaya-scrollbar"
          style={{
            display:   "flex",
            gap:       4,
            marginTop: weather.current ? 12 : 0,
            paddingTop: weather.current ? 12 : 0,
            borderTop: weather.current ? "1px solid var(--neutral-100)" : "none",
            overflowX: "auto",
          }}
        >
          {weather.days.map((day, i) => (
            <div
              key={`${day.label}-${i}`}
              style={{
                flex:          "1 0 56px",
                display:       "flex",
                flexDirection: "column",
                alignItems:    "center",
                gap:           3,
              }}
            >
              <span style={captionStyle}>{day.label}</span>
              <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden>{conditionIcon(day.condition)}</span>
              <span style={{ ...captionStyle, color: "var(--neutral-800)" }}>
                {day.high}{weather.unit}
              </span>
              <span style={{ ...captionStyle, color: "var(--neutral-400)" }}>
                {day.low}{weather.unit}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
