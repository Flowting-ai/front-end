/**
 * XmlWeather.parse.ts
 *
 * Pure parsing for the <weather> XML block, split out from XmlWeather.tsx so
 * that file only exports the component (Fast Refresh can't safely preserve
 * component state in a file that also exports non-component values).
 */

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
