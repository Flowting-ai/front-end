"use client"

/**
 * Renders the assistant's <weather> XML block as an atmospheric, responsive
 * forecast card. Parsing stays deliberately small and deterministic; all
 * liveliness is presentation-only and respects reduced-motion preferences.
 */

import React from "react"
import { m, useReducedMotion } from "framer-motion"
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Sun,
  Thermometer,
  Wind,
} from "lucide-react"
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

type ConditionFamily = "storm" | "rain" | "snow" | "fog" | "cloud" | "partly" | "wind" | "clear" | "neutral"

interface WeatherPalette {
  surface: string
  accent: string
  accentSoft: string
  glow: string
  ink: string
}

const PALETTES: Record<ConditionFamily, WeatherPalette> = {
  clear: {
    surface: "linear-gradient(135deg, #FFF8E8 0%, #FFFDF8 52%, #F8EBDD 100%)",
    accent: "#D98A21",
    accentSoft: "rgba(217, 138, 33, 0.18)",
    glow: "rgba(244, 177, 61, 0.30)",
    ink: "#7B4C16",
  },
  partly: {
    surface: "linear-gradient(135deg, #F2F7FC 0%, #FCFAF7 55%, #EEE8E0 100%)",
    accent: "#6684A5",
    accentSoft: "rgba(102, 132, 165, 0.16)",
    glow: "rgba(123, 161, 199, 0.25)",
    ink: "#3F5870",
  },
  cloud: {
    surface: "linear-gradient(135deg, #F1F2F3 0%, #FCFBFA 50%, #E9E6E2 100%)",
    accent: "#75808A",
    accentSoft: "rgba(117, 128, 138, 0.16)",
    glow: "rgba(144, 153, 162, 0.24)",
    ink: "#505961",
  },
  rain: {
    surface: "linear-gradient(135deg, #EAF3FA 0%, #F8FBFC 52%, #E5ECF2 100%)",
    accent: "#3979A7",
    accentSoft: "rgba(57, 121, 167, 0.16)",
    glow: "rgba(71, 142, 193, 0.24)",
    ink: "#285A7D",
  },
  storm: {
    surface: "linear-gradient(135deg, #ECEAF1 0%, #F8F7FA 50%, #E3DFE8 100%)",
    accent: "#6D5C91",
    accentSoft: "rgba(109, 92, 145, 0.16)",
    glow: "rgba(114, 90, 161, 0.24)",
    ink: "#4F426B",
  },
  snow: {
    surface: "linear-gradient(135deg, #ECF7FA 0%, #FFFFFF 52%, #E7F0F4 100%)",
    accent: "#5C92A8",
    accentSoft: "rgba(92, 146, 168, 0.15)",
    glow: "rgba(114, 180, 204, 0.22)",
    ink: "#416B7B",
  },
  fog: {
    surface: "linear-gradient(135deg, #F0F0ED 0%, #FCFBF8 52%, #E8E6E1 100%)",
    accent: "#7F817D",
    accentSoft: "rgba(127, 129, 125, 0.14)",
    glow: "rgba(154, 155, 151, 0.22)",
    ink: "#5C5E5A",
  },
  wind: {
    surface: "linear-gradient(135deg, #EDF7F5 0%, #FAFCFB 50%, #E5EFEC 100%)",
    accent: "#4D8B7B",
    accentSoft: "rgba(77, 139, 123, 0.15)",
    glow: "rgba(83, 158, 139, 0.22)",
    ink: "#356558",
  },
  neutral: {
    surface: "linear-gradient(135deg, #F5F1EC 0%, #FFFDFC 52%, #EEE9E3 100%)",
    accent: "#82766C",
    accentSoft: "rgba(130, 118, 108, 0.14)",
    glow: "rgba(149, 134, 121, 0.20)",
    ink: "#5F564F",
  },
}

function conditionFamily(condition?: string): ConditionFamily {
  if (!condition) return "neutral"
  if (/thunder|storm/i.test(condition)) return "storm"
  if (/rain|shower|drizzle/i.test(condition)) return "rain"
  if (/snow|sleet|ice/i.test(condition)) return "snow"
  if (/fog|mist|haze/i.test(condition)) return "fog"
  if (/partly|part[- ]?cloud/i.test(condition)) return "partly"
  if (/overcast|cloud/i.test(condition)) return "cloud"
  if (/wind/i.test(condition)) return "wind"
  if (/sun|clear/i.test(condition)) return "clear"
  return "neutral"
}

const CONDITION_ICON: Record<ConditionFamily, string> = {
  storm: "⛈️",
  rain: "🌧️",
  snow: "🌨️",
  fog: "🌫️",
  cloud: "☁️",
  partly: "⛅",
  wind: "💨",
  clear: "☀️",
  neutral: "🌡️",
}

/** Kept exported for callers that need a compact text/emoji representation. */
export function conditionIcon(condition?: string): string {
  return CONDITION_ICON[conditionFamily(condition)]
}

function conditionLabel(condition?: string): string {
  return (condition ?? "").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function paletteFor(condition?: string): WeatherPalette {
  return PALETTES[conditionFamily(condition)]
}

/** Cold-blue → hot-orange hue for a temperature (°C internally). */
export function tempColor(value: number, unit: string): string {
  const celsius = /f/i.test(unit) ? ((value - 32) * 5) / 9 : value
  const t = Math.max(0, Math.min(1, (celsius + 10) / 45))
  const hue = 220 - t * 195
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
    unit: weather.attrs.unit ?? "°",
    current: current?.attrs.temp
      ? {
          temp: current.attrs.temp,
          condition: current.attrs.condition,
          high: current.attrs.high,
          low: current.attrs.low,
          humidity: current.attrs.humidity,
          wind: current.attrs.wind,
        }
      : undefined,
    days,
  }
}

const captionStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--font-size-caption)",
  lineHeight: "var(--line-height-caption)",
  color: "var(--neutral-500)",
}

function WeatherGlyph({
  condition,
  size,
  reduceMotion,
  decorative = false,
}: {
  condition?: string
  size: number
  reduceMotion: boolean
  decorative?: boolean
}) {
  const family = conditionFamily(condition)
  const palette = PALETTES[family]
  const iconProps = { size, strokeWidth: 1.55, color: palette.accent }

  const icon = (() => {
    switch (family) {
      case "storm": return <CloudLightning {...iconProps} />
      case "rain": return <CloudRain {...iconProps} />
      case "snow": return <CloudSnow {...iconProps} />
      case "fog": return <CloudFog {...iconProps} />
      case "partly": return <CloudSun {...iconProps} />
      case "cloud": return <Cloud {...iconProps} />
      case "wind": return <Wind {...iconProps} />
      case "clear": return <Sun {...iconProps} />
      default: return <Thermometer {...iconProps} />
    }
  })()

  const animate = reduceMotion
    ? undefined
    : family === "clear"
      ? { rotate: [0, 4, 0, -4, 0], scale: [1, 1.045, 1] }
      : family === "rain" || family === "snow"
        ? { y: [0, 3, 0] }
        : family === "wind"
          ? { x: [-2, 3, -2] }
          : { y: [0, -2, 0] }

  return (
    <m.div
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : conditionLabel(condition) || "Weather"}
      role={decorative ? undefined : "img"}
      animate={animate}
      transition={reduceMotion ? undefined : { duration: family === "clear" ? 5 : 3.2, repeat: Infinity, ease: "easeInOut" }}
      style={{ display: "grid", placeItems: "center", flexShrink: 0 }}
    >
      {icon}
    </m.div>
  )
}

function WeatherMeta({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span
      style={{
        ...captionStyle,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 8px",
        borderRadius: 999,
        color: "var(--neutral-700)",
        background: "rgba(255,255,255,0.60)",
        border: "1px solid rgba(255,255,255,0.72)",
        backdropFilter: "blur(8px)",
      }}
    >
      {icon}
      {children}
    </span>
  )
}

function ForecastTile({
  day,
  unit,
  periodMin,
  periodMax,
  index,
  reduceMotion,
}: {
  day: ParsedWeather["days"][number]
  unit: string
  periodMin: number
  periodMax: number
  index: number
  reduceMotion: boolean
}) {
  const low = Number(day.low)
  const high = Number(day.high)
  const hasRange = Number.isFinite(low) && Number.isFinite(high) && periodMax > periodMin
  const left = hasRange ? ((low - periodMin) / (periodMax - periodMin)) * 100 : 0
  const width = hasRange ? Math.max(((high - low) / (periodMax - periodMin)) * 100, 6) : 0

  return (
    <m.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: reduceMotion ? 0 : 0.12 + index * 0.055, ease: [0.16, 1, 0.3, 1] }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      style={{
        minWidth: 88,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "13px 12px 12px",
        borderLeft: index === 0 ? undefined : "1px solid var(--neutral-100)",
      }}
    >
      <span style={{ ...captionStyle, color: "var(--neutral-600)", fontWeight: 600 }}>{day.label}</span>
      <WeatherGlyph condition={day.condition} size={22} reduceMotion={reduceMotion} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, fontVariantNumeric: "tabular-nums" }}>
        <span style={{ fontFamily: "var(--font-title)", fontSize: 17, fontWeight: 600, color: "var(--neutral-800)" }}>
          {day.high ?? "–"}°
        </span>
        <span style={{ ...captionStyle }}>{day.low ?? "–"}°</span>
      </div>
      <div
        title={hasRange ? `${day.low}–${day.high}${unit}` : undefined}
        style={{ width: "100%", height: 4, borderRadius: 999, background: "var(--neutral-100)", position: "relative", overflow: "hidden" }}
      >
        {hasRange && (
          <m.div
            initial={reduceMotion ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.45, delay: reduceMotion ? 0 : 0.18 + index * 0.055, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "absolute",
              left: `${left}%`,
              width: `${width}%`,
              insetBlock: 0,
              borderRadius: 999,
              transformOrigin: "left center",
              background: `linear-gradient(90deg, ${tempColor(low, unit)}, ${tempColor(high, unit)})`,
            }}
          />
        )}
      </div>
    </m.div>
  )
}

export function XmlWeather({ xml }: { xml: string }) {
  const weather = React.useMemo(() => parseWeatherXml(xml), [xml])
  const reduceMotion = useReducedMotion() ?? false
  if (!weather) return null

  const lows = weather.days.map((d) => Number(d.low)).filter(Number.isFinite)
  const highs = weather.days.map((d) => Number(d.high)).filter(Number.isFinite)
  const periodMin = Math.min(...lows, Infinity)
  const periodMax = Math.max(...highs, -Infinity)
  const condition = weather.current?.condition ?? weather.days[0]?.condition
  const palette = paletteFor(condition)

  return (
    <m.section
      aria-label={`Weather${weather.location ? ` for ${weather.location}` : ""}`}
      initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.992 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      style={{
        margin: "14px 0",
        borderRadius: 20,
        border: "1px solid var(--neutral-100)",
        backgroundColor: "var(--neutral-white)",
        boxShadow: "var(--shadow-surface-card)",
        overflow: "hidden",
        width: "min(100%, 680px)",
      }}
    >
      {weather.current && (
        <div
          style={{
            position: "relative",
            minHeight: 188,
            padding: "24px clamp(20px, 4vw, 30px)",
            display: "flex",
            alignItems: "stretch",
            overflow: "hidden",
            background: palette.surface,
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.28,
              backgroundImage: `radial-gradient(${palette.accent} 0.7px, transparent 0.7px)`,
              backgroundSize: "25px 25px",
              maskImage: "linear-gradient(to right, transparent, black 42%, black)",
            }}
          />
          <m.div
            aria-hidden
            animate={reduceMotion ? undefined : { x: [0, 14, 0], y: [0, -8, 0], scale: [1, 1.08, 1] }}
            transition={reduceMotion ? undefined : { duration: 10, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute",
              width: 210,
              height: 210,
              right: -42,
              top: -82,
              borderRadius: "50%",
              background: palette.glow,
              filter: "blur(18px)",
            }}
          />

          <div style={{ position: "relative", zIndex: 1, flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--font-size-eyebrow)",
                lineHeight: "var(--line-height-eyebrow)",
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: palette.ink,
                opacity: 0.82,
              }}
            >
              {weather.location || "Current weather"}
            </span>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginTop: 14 }}>
              <span
                style={{
                  fontFamily: "var(--font-title)",
                  fontSize: "clamp(46px, 9vw, 68px)",
                  lineHeight: 0.9,
                  letterSpacing: "-0.045em",
                  fontWeight: "var(--font-weight-medium)",
                  color: "var(--neutral-900)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {weather.current.temp}
                <span style={{ fontSize: "0.42em", letterSpacing: "-0.01em", verticalAlign: "top", marginLeft: 3 }}>{weather.unit}</span>
              </span>
              <span style={{ ...captionStyle, color: palette.ink, fontWeight: 600, paddingBottom: 4 }}>
                {conditionLabel(weather.current.condition) || "Current"}
              </span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: "auto", paddingTop: 20 }}>
              {(weather.current.high || weather.current.low) && (
                <WeatherMeta icon={<Thermometer size={13} strokeWidth={1.8} aria-hidden />}>
                  H {weather.current.high ?? "–"}° · L {weather.current.low ?? "–"}°
                </WeatherMeta>
              )}
              {weather.current.humidity && (
                <WeatherMeta icon={<Droplets size={13} strokeWidth={1.8} aria-hidden />}>{weather.current.humidity}</WeatherMeta>
              )}
              {weather.current.wind && (
                <WeatherMeta icon={<Wind size={13} strokeWidth={1.8} aria-hidden />}>{weather.current.wind}</WeatherMeta>
              )}
            </div>
          </div>

          <div
            aria-hidden
            style={{
              position: "relative",
              zIndex: 1,
              width: "clamp(88px, 20vw, 148px)",
              display: "grid",
              placeItems: "center",
              filter: `drop-shadow(0 18px 24px ${palette.accentSoft})`,
            }}
          >
            <div style={{ position: "absolute", width: 104, height: 104, borderRadius: "50%", background: palette.accentSoft, filter: "blur(2px)" }} />
            <WeatherGlyph condition={weather.current.condition} size={88} reduceMotion={reduceMotion} decorative />
          </div>
        </div>
      )}

      {weather.days.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${weather.days.length}, minmax(88px, 1fr))`,
            overflowX: "auto",
            background: "linear-gradient(180deg, var(--neutral-white), var(--neutral-50))",
            borderTop: weather.current ? "1px solid var(--neutral-100)" : undefined,
          }}
        >
          {weather.days.map((day, index) => (
            <ForecastTile
              key={`${day.label}-${index}`}
              day={day}
              unit={weather.unit}
              periodMin={periodMin}
              periodMax={periodMax}
              index={index}
              reduceMotion={reduceMotion}
            />
          ))}
        </div>
      )}
    </m.section>
  )
}
