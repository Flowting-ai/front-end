// The metric builder's form, and the metric it produces: a figure from one table, or a formula over metrics that exist.

import type { CustomMetric, MetricAggregate, MetricExpression, MetricUnit, TableSummary } from '@/lib/api/warehouse'

export type EditorMode = 'table' | 'formula'
export type FormulaOp = MetricExpression['op']

export interface EditorForm {
  label: string
  description: string
  unit: MetricUnit
  mode: EditorMode
  table: string
  kind: MetricAggregate['kind']
  column: string
  day: string
  where: string
  left: string
  op: FormulaOp
  /** A metric name, or a number typed in. */
  right: string
}

export const OP_LABELS: Record<FormulaOp, string> = { add: '+', subtract: '−', multiply: '×', ratio: '÷' }

export const EMPTY_FORM: EditorForm = {
  label: '', description: '', unit: 'money', mode: 'table',
  table: '', kind: 'sum', column: '', day: '', where: '',
  left: '', op: 'ratio', right: '',
}

/** "Shipping share of revenue" → shipping_share_of_revenue; a name that cannot start with a letter gets one. */
export function metricNameOf(label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64)
  return /^[a-z]/.test(slug) ? slug : `m_${slug}`.slice(0, 64)
}

const NUMERIC = /int|decimal|double|float/
const DATED = /timestamp|date/

export function numericColumns(table: TableSummary | undefined): string[] {
  return (table?.columns ?? []).filter(c => NUMERIC.test(c.type)).map(c => c.name)
}

export function dayColumns(table: TableSummary | undefined): string[] {
  return (table?.columns ?? []).filter(c => DATED.test(c.type)).map(c => c.name)
}

function term(value: string): string | number {
  const trimmed = value.trim()
  return trimmed !== '' && !Number.isNaN(Number(trimmed)) ? Number(trimmed) : trimmed
}

/** What is still missing before the form is a metric; empty when it is one. */
export function incomplete(form: EditorForm): string | null {
  if (!form.label.trim()) return 'Give the metric a name'
  if (form.mode === 'table') {
    if (!form.table) return 'Pick a table'
    if (form.kind === 'sum' && !form.column) return 'Pick the column to sum'
    if (!form.day) return 'Pick the date column that places a row on a day'
    return null
  }
  if (!form.left) return 'Pick the first metric'
  if (!form.right.trim()) return 'Pick the second metric or type a number'
  return null
}

export function metricOf(form: EditorForm): CustomMetric {
  const value: MetricAggregate | MetricExpression = form.mode === 'table'
    ? { kind: form.kind, table: form.table, column: form.kind === 'sum' ? form.column : null, day: form.day, where: form.where.trim() || null }
    : form.op === 'subtract' ? { op: 'subtract', left: form.left, right: term(form.right) }
    : form.op === 'ratio' ? { op: 'ratio', numerator: form.left, denominator: term(form.right) }
    : { op: form.op, terms: [form.left, term(form.right)] }
  return { name: metricNameOf(form.label), label: form.label.trim(), unit: form.unit, description: form.description.trim(), value }
}
