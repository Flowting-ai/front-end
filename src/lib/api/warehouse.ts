import { z } from 'zod'
import { apiFetchJson, apiFetchVoid } from './client'
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
  /** The library category, or "custom" for one this workspace added. */
  category:    z.string(),
})

export const CUSTOM_CATEGORY = 'custom'

/** A base figure: one table's rows summed on a column or counted, placed on days by `day`, optionally filtered. */
export interface MetricAggregate {
  kind: 'sum' | 'count'
  table: string
  column: string | null
  day: string
  where: string | null
}

export type MetricTerm = string | number | MetricExpression

export type MetricExpression =
  | { op: 'add'; terms: MetricTerm[] }
  | { op: 'subtract'; left: MetricTerm; right: MetricTerm }
  | { op: 'multiply'; terms: MetricTerm[] }
  | { op: 'ratio'; numerator: MetricTerm; denominator: MetricTerm }

const customMetricSchema = z.object({
  name:        z.string(),
  label:       z.string(),
  unit:        metricUnitSchema,
  description: z.string(),
  value:       z.custom<MetricAggregate | MetricExpression>(value => typeof value === 'object' && value !== null),
})

export interface MetricChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** What one turn of the metric conversation comes back with: words, and the metric once it is settled. */
const metricDraftSchema = z.object({ reply: z.string(), metric: customMetricSchema.nullable() })

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

export type Workspace = z.infer<typeof workspaceSchema>
export type MetricUnit = z.infer<typeof metricUnitSchema>
export type MetricEntry = z.infer<typeof metricEntrySchema>
export type CustomMetric = z.infer<typeof customMetricSchema>
export type MetricDraft = z.infer<typeof metricDraftSchema>
export type Grain = z.infer<typeof grainSchema>
export type Period = z.infer<typeof periodSchema>
export type Measurement = z.infer<typeof measurementSchema>

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

export async function putMetric(metric: CustomMetric, signal?: AbortSignal): Promise<MetricEntry[]> {
  return z.array(metricEntrySchema).parse(await apiFetchJson<unknown>(`${WAREHOUSE}/metrics`, {
    method: 'PUT', body: JSON.stringify(metric), headers: { 'Content-Type': 'application/json' }, signal,
  }))
}

export async function draftMetric(messages: MetricChatMessage[], signal?: AbortSignal): Promise<MetricDraft> {
  return metricDraftSchema.parse(await apiFetchJson<unknown>(`${WAREHOUSE}/metrics/draft`, {
    method: 'POST', body: JSON.stringify({ messages }), headers: { 'Content-Type': 'application/json' }, signal,
  }))
}

export async function deleteMetric(name: string, signal?: AbortSignal): Promise<void> {
  await apiFetchVoid(`${WAREHOUSE}/metrics/${encodeURIComponent(name)}`, { method: 'DELETE', signal })
}

export async function measure(request: MeasureRequest, signal?: AbortSignal): Promise<Measurement> {
  return measurementSchema.parse(await apiFetchJson<unknown>(`${WAREHOUSE}/metrics`, {
    method: 'POST', body: JSON.stringify(request), headers: { 'Content-Type': 'application/json' }, signal,
  }))
}
