import { z } from 'zod'
import { apiFetchJson } from './client'
import { API_BASE_URL } from '../config'

const WAREHOUSE = `${API_BASE_URL}/warehouse`

const categoryStateSchema = z.object({
  category:     z.string(),
  status:       z.string(),
  lastSyncedAt: z.string().nullable(),
})

const workspaceSchema = z.object({
  id:         z.string(),
  name:       z.string(),
  slug:       z.string(),
  timezone:   z.string(),
  /** Connector slugs feeding the workspace. */
  connectors: z.array(z.string()),
  categories: z.array(categoryStateSchema),
})

const metricUnitSchema = z.enum(['money', 'count', 'ratio'])

const metricEntrySchema = z.object({
  name:        z.string(),
  label:       z.string(),
  unit:        metricUnitSchema,
  description: z.string(),
})

export const grainSchema = z.enum(['day', 'week', 'month', 'total'])

const periodSchema = z.object({
  start:  z.string(),
  values: z.record(z.string(), z.number().nullable()),
})

const measurementSchema = z.object({
  grain:       grainSchema,
  start:       z.string(),
  end:         z.string(),
  timezone:    z.string(),
  periods:     z.array(periodSchema),
  /** Metric name → why this store cannot measure it (a table no connection fills). */
  unavailable: z.record(z.string(), z.string()),
})

const columnSchema = z.object({ name: z.string(), type: z.string() })

const tableSummarySchema = z.object({
  name:    z.string(),
  meaning: z.string(),
  columns: z.array(columnSchema),
  rows:    z.number(),
})

const tableRowsSchema = z.object({
  name:    z.string(),
  columns: z.array(columnSchema),
  rows:    z.array(z.record(z.string(), z.unknown())),
  total:   z.number(),
})

export type Workspace = z.infer<typeof workspaceSchema>
export type MetricUnit = z.infer<typeof metricUnitSchema>
export type MetricEntry = z.infer<typeof metricEntrySchema>
export type Grain = z.infer<typeof grainSchema>
export type Period = z.infer<typeof periodSchema>
export type Measurement = z.infer<typeof measurementSchema>
export type TableColumn = z.infer<typeof columnSchema>
export type TableSummary = z.infer<typeof tableSummarySchema>
export type TableRows = z.infer<typeof tableRowsSchema>

export interface MeasureRequest {
  metrics: string[]
  /** ISO dates, inclusive. */
  start: string
  end: string
  grain: Grain
}

export async function fetchWorkspace(signal?: AbortSignal): Promise<Workspace> {
  return workspaceSchema.parse(await apiFetchJson<unknown>(WAREHOUSE, { signal }))
}

export async function fetchMetricCatalog(signal?: AbortSignal): Promise<MetricEntry[]> {
  return z.array(metricEntrySchema).parse(await apiFetchJson<unknown>(`${WAREHOUSE}/metrics`, { signal }))
}

export async function measure(request: MeasureRequest, signal?: AbortSignal): Promise<Measurement> {
  return measurementSchema.parse(await apiFetchJson<unknown>(`${WAREHOUSE}/metrics`, {
    method: 'POST', body: JSON.stringify(request), headers: { 'Content-Type': 'application/json' }, signal,
  }))
}

export async function fetchTables(signal?: AbortSignal): Promise<TableSummary[]> {
  return z.array(tableSummarySchema).parse(await apiFetchJson<unknown>(`${WAREHOUSE}/tables`, { signal }))
}

export async function fetchRows(table: string, limit: number, offset: number, signal?: AbortSignal): Promise<TableRows> {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  return tableRowsSchema.parse(await apiFetchJson<unknown>(`${WAREHOUSE}/tables/${encodeURIComponent(table)}?${query}`, { signal }))
}
