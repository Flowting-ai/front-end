// The metric builder: one formula, typed the way you'd say it. "shipping_revenue / revenue", "net_sales * 0.3",
// "sum(orders.shipping_charged)", "count(refunds)". Metric names and numbers combine with + - * / and brackets;
// a sum or count is a metric of its own, so it stands alone.

import type { CustomMetric, MetricAggregate, MetricExpression, MetricTerm, MetricUnit, TableSummary } from '@/lib/api/warehouse'

export interface EditorForm {
  label: string
  unit: MetricUnit
  formula: string
}

export const EMPTY_FORM: EditorForm = { label: '', unit: 'money', formula: '' }

/** "Shipping share of revenue" → shipping_share_of_revenue; a name that cannot start with a letter gets one. */
export function metricNameOf(label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64)
  return /^[a-z]/.test(slug) ? slug : `m_${slug}`.slice(0, 64)
}

const DATED = /timestamp|date/

export function dayColumnOf(table: TableSummary): string | undefined {
  return table.columns.find(c => DATED.test(c.type))?.name
}

type Token = { kind: 'number'; text: string } | { kind: 'name'; text: string } | { kind: 'op'; text: string }

function tokens(formula: string): Token[] {
  const out: Token[] = []
  const pattern = /\s*(?:(\d+(?:\.\d+)?)|([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)|([-+*/()]))/giy
  let at = 0
  while (at < formula.length) {
    pattern.lastIndex = at
    const match = pattern.exec(formula)
    if (match === null) {
      if (formula.slice(at).trim() === '') break
      throw new Error(`Can't read "${formula.slice(at).trim().slice(0, 12)}"`)
    }
    if (match[1] !== undefined) out.push({ kind: 'number', text: match[1] })
    else if (match[2] !== undefined) out.push({ kind: 'name', text: match[2].toLowerCase() })
    else out.push({ kind: 'op', text: match[3] })
    at = pattern.lastIndex
  }
  return out
}

/** Reads the formula into the warehouse's metric value, or throws with what to fix. */
export function parseFormula(formula: string, metrics: string[], tables: TableSummary[]): MetricAggregate | MetricExpression {
  const list = tokens(formula)
  if (list.length === 0) throw new Error('Type a formula')
  const known = new Set(metrics)
  let at = 0
  const peek = () => list[at]
  const take = () => list[at++]

  const aggregate = (): MetricAggregate => {
    const fn = take()
    if (take()?.text !== '(') throw new Error(`${fn.text} needs brackets, like ${fn.text}(orders${fn.text === 'sum' ? '.total' : ''})`)
    const target = take()
    if (target?.kind !== 'name') throw new Error(`${fn.text}() needs a table${fn.text === 'sum' ? '.column' : ''} inside`)
    if (take()?.text !== ')') throw new Error(`Close the bracket after ${target.text}`)
    const [tableName, column] = target.text.split('.')
    const table = tables.find(t => t.name === tableName)
    if (table === undefined) throw new Error(`No table called ${tableName}. Tables: ${tables.map(t => t.name).join(', ')}`)
    const day = dayColumnOf(table)
    if (day === undefined) throw new Error(`${tableName} has no date column to place rows on days`)
    if (fn.text === 'count') {
      if (column !== undefined) throw new Error('count() takes a table, like count(orders)')
      return { kind: 'count', table: tableName, column: null, day, where: null }
    }
    if (column === undefined) throw new Error('sum() takes a table.column, like sum(orders.total)')
    if (!table.columns.some(c => c.name === column)) throw new Error(`${tableName} has no column ${column}. Columns: ${table.columns.map(c => c.name).join(', ')}`)
    return { kind: 'sum', table: tableName, column, day, where: null }
  }

  const factor = (): MetricTerm => {
    const token = peek()
    if (token === undefined) throw new Error('The formula ends early')
    if (token.kind === 'number') { take(); return Number(token.text) }
    if (token.kind === 'name') {
      if (token.text === 'sum' || token.text === 'count') throw new Error(`Make ${token.text}() its own metric first, then use its name here`)
      take()
      if (!known.has(token.text)) throw new Error(`No metric called ${token.text}`)
      return token.text
    }
    if (token.text === '(') {
      take()
      const inner = expression()
      if (take()?.text !== ')') throw new Error('Close the bracket')
      return inner
    }
    throw new Error(`Unexpected ${token.text}`)
  }

  const term = (): MetricTerm => {
    let left = factor()
    while (peek()?.kind === 'op' && (peek().text === '*' || peek().text === '/')) {
      const op = take().text
      const right = factor()
      left = op === '*' ? { op: 'multiply', terms: [left, right] } : { op: 'ratio', numerator: left, denominator: right }
    }
    return left
  }

  const expression = (): MetricTerm => {
    let left = term()
    while (peek()?.kind === 'op' && (peek().text === '+' || peek().text === '-')) {
      const op = take().text
      const right = term()
      left = op === '+' ? { op: 'add', terms: [left, right] } : { op: 'subtract', left, right }
    }
    return left
  }

  const first = peek()
  if (first.kind === 'name' && (first.text === 'sum' || first.text === 'count')) {
    const value = aggregate()
    if (at < list.length) throw new Error(`A ${first.text}() stands alone; to combine it, save it first and use its name`)
    return value
  }
  const value = expression()
  if (at < list.length) throw new Error(`Unexpected ${list[at].text}`)
  if (typeof value !== 'object') throw new Error(typeof value === 'number' ? 'A number on its own is not a metric' : 'That metric already exists; combine it with something')
  return value
}

/** The unit a formula most likely wants: a division reads as a percent, a count as a count, the rest as money. */
export function unitOf(value: MetricAggregate | MetricExpression): MetricUnit {
  if ('kind' in value) return value.kind === 'count' ? 'count' : 'money'
  return value.op === 'ratio' ? 'ratio' : 'money'
}

export function metricOf(form: EditorForm, value: MetricAggregate | MetricExpression): CustomMetric {
  return { name: metricNameOf(form.label), label: form.label.trim(), unit: form.unit, description: form.formula.trim(), value }
}
