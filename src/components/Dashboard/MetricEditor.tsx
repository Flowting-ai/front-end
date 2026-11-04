'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { InputField } from '@/components/InputField'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { MetricEntry, MetricUnit, TableSummary } from '@/lib/api/warehouse'
import {
  EMPTY_FORM, OP_LABELS, dayColumns, incomplete, metricOf, numericColumns, type EditorForm, type EditorMode, type FormulaOp,
} from '@/lib/warehouse/editor'
import { usePutMetric } from '@/lib/warehouse/queries'
import styles from './Dashboard.module.css'

const UNITS: ReadonlyArray<{ id: MetricUnit; label: string }> = [
  { id: 'money', label: 'Money' }, { id: 'count', label: 'Count' }, { id: 'ratio', label: 'Percent' },
]
const MODES: ReadonlyArray<{ id: EditorMode; label: string }> = [
  { id: 'table', label: 'From a table' }, { id: 'formula', label: 'From other metrics' },
]

export interface MetricEditorProps {
  tables: TableSummary[]
  catalog: MetricEntry[]
  onClose: () => void
}

function Choice<T extends string>({ options, value, onChange, label }: {
  options: ReadonlyArray<{ id: T; label: string }>; value: T; onChange: (id: T) => void; label: string
}) {
  return (
    <div className={styles.choice} role="radiogroup" aria-label={label}>
      {options.map(option => (
        <button key={option.id} type="button" role="radio" aria-checked={option.id === value}
          className={styles.choiceOption} onClick={() => onChange(option.id)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Select({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (value: string) => void
  options: ReadonlyArray<{ id: string; label: string }>; placeholder: string
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <select className={styles.select} value={value} onChange={event => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
  )
}

/** Builds one metric: a figure from a store table, or a formula over the metrics already there. */
export function MetricEditor({ tables, catalog, onClose }: MetricEditorProps) {
  const [form, setForm] = useState<EditorForm>(EMPTY_FORM)
  const put = usePutMetric()
  const set = <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => setForm(current => ({ ...current, [key]: value }))
  const table = tables.find(t => t.name === form.table)
  const missing = incomplete(form)
  const metrics = catalog.map(entry => ({ id: entry.name, label: entry.label }))

  const save = async () => {
    try {
      await put.mutateAsync(metricOf(form))
      toast.success(`${form.label.trim()} added`)
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The warehouse refused the metric')
    }
  }

  return (
    <Dialog open onOpenChange={next => { if (!next && !put.isPending) onClose() }}>
      <DialogContent size="md" style={{ padding: 24, gap: 20 }}>
        <div>
          <DialogTitle>Add a metric</DialogTitle>
          <DialogDescription className={styles.emptyText} style={{ margin: '8px 0 0' }}>
            A figure from one of your store tables, or a formula over metrics you already have. It shows up on the dashboard with the rest.
          </DialogDescription>
        </div>
        <div className={styles.form}>
          <InputField label="Name" value={form.label} onChange={value => set('label', value)} placeholder="Shipping share of revenue" fluid />
          <InputField label="What it means" value={form.description} onChange={value => set('description', value)} placeholder="Optional" fluid />
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Shown as</span>
            <Choice options={UNITS} value={form.unit} onChange={unit => set('unit', unit)} label="Unit" />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Built</span>
            <Choice options={MODES} value={form.mode} onChange={mode => set('mode', mode)} label="How the metric is built" />
          </div>
          {form.mode === 'table' ? (
            <>
              <Select label="Table" value={form.table} placeholder="Pick a table" options={tables.map(t => ({ id: t.name, label: t.name.replace(/_/g, ' ') }))}
                onChange={value => setForm(current => ({ ...current, table: value, column: '', day: dayColumns(tables.find(t => t.name === value))[0] ?? '' }))} />
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Figure</span>
                <Choice options={[{ id: 'sum', label: 'Sum of a column' }, { id: 'count', label: 'Count of rows' }]}
                  value={form.kind} onChange={kind => set('kind', kind)} label="Figure" />
              </div>
              {form.kind === 'sum' && (
                <Select label="Column" value={form.column} placeholder="Pick a column" onChange={value => set('column', value)}
                  options={numericColumns(table).map(name => ({ id: name, label: name }))} />
              )}
              <Select label="Dated by" value={form.day} placeholder="Pick a date column" onChange={value => set('day', value)}
                options={dayColumns(table).map(name => ({ id: name, label: name }))} />
              <InputField label="Only rows where" value={form.where} onChange={value => set('where', value)}
                placeholder="Optional, e.g. cancelled_at is null" fluid />
            </>
          ) : (
            <div className={styles.formula}>
              <Select label="First" value={form.left} placeholder="Pick a metric" options={metrics} onChange={value => set('left', value)} />
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Then</span>
                <Choice options={(Object.keys(OP_LABELS) as FormulaOp[]).map(op => ({ id: op, label: OP_LABELS[op] }))}
                  value={form.op} onChange={op => set('op', op)} label="Operation" />
              </div>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Second</span>
                <input className={styles.select} list="metric-editor-metrics" value={form.right}
                  onChange={event => set('right', event.target.value)} placeholder="A metric, or a number" />
                <datalist id="metric-editor-metrics">
                  {metrics.map(metric => <option key={metric.id} value={metric.id}>{metric.label}</option>)}
                </datalist>
              </label>
            </div>
          )}
        </div>
        <div className={styles.formFooter}>
          <span className={styles.toolbarMeta}>{missing ?? `Saved as ${metricOf(form).name}`}</span>
          <span className={styles.pager}>
            <Button variant="secondary" disabled={put.isPending} onClick={onClose}>Cancel</Button>
            <Button disabled={missing !== null} loading={put.isPending} onClick={() => { void save() }}>Add metric</Button>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
