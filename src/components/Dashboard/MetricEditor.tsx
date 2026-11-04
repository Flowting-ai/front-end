'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { InputField } from '@/components/InputField'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { MetricEntry, MetricUnit, TableSummary } from '@/lib/api/warehouse'
import { EMPTY_FORM, metricNameOf, metricOf, parseFormula, unitOf, type EditorForm } from '@/lib/warehouse/editor'
import { usePutMetric } from '@/lib/warehouse/queries'
import styles from './Dashboard.module.css'

const UNITS: ReadonlyArray<{ id: MetricUnit; label: string }> = [
  { id: 'money', label: 'Money' }, { id: 'count', label: 'Count' }, { id: 'ratio', label: 'Percent' },
]

export interface MetricEditorProps {
  tables: TableSummary[]
  catalog: MetricEntry[]
  onClose: () => void
}

/** One formula over the metrics and tables the store has; the name and unit come along. */
export function MetricEditor({ tables, catalog, onClose }: MetricEditorProps) {
  const [form, setForm] = useState<EditorForm>(EMPTY_FORM)
  const [unitPicked, setUnitPicked] = useState(false)
  const put = usePutMetric()
  const names = useMemo(() => catalog.map(entry => entry.name), [catalog])

  const parsed = useMemo(() => {
    try {
      return { value: parseFormula(form.formula, names, tables), error: null }
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : 'Try again' }
    }
  }, [form.formula, names, tables])
  const unit = unitPicked || parsed.value === null ? form.unit : unitOf(parsed.value)
  const ready = parsed.value !== null && form.label.trim() !== ''
  const hint = form.formula.trim() === ''
    ? 'Metric names, numbers, + − × ÷ and brackets. Or sum(orders.total), count(refunds).'
    : parsed.error ?? `Saved as ${metricNameOf(form.label) || '…'}`

  const insert = (name: string) => setForm(current => ({
    ...current, formula: `${current.formula}${current.formula === '' || /[\s(]$/.test(current.formula) ? '' : ' '}${name}`,
  }))

  const save = async () => {
    if (parsed.value === null) return
    try {
      await put.mutateAsync(metricOf({ ...form, unit }, parsed.value))
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
            Write it like a sum: shipping_revenue / revenue.
          </DialogDescription>
        </div>
        <div className={styles.form}>
          <InputField label="Name" value={form.label} onChange={label => setForm(current => ({ ...current, label }))}
            placeholder="Shipping share of revenue" fluid />
          <InputField label="Formula" value={form.formula} onChange={formula => setForm(current => ({ ...current, formula }))}
            placeholder="shipping_revenue / revenue" error={form.formula.trim() !== '' && parsed.error !== null} fluid />
          <span className={styles.hint} aria-live="polite">{hint}</span>
          <div className={styles.chips} aria-label="Metrics you can use">
            {catalog.map(entry => (
              <button key={entry.name} type="button" className={styles.chipButton} title={entry.description} onClick={() => insert(entry.name)}>
                {entry.name}
              </button>
            ))}
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Shown as</span>
            <div className={styles.choice} role="radiogroup" aria-label="Unit">
              {UNITS.map(option => (
                <button key={option.id} type="button" role="radio" aria-checked={option.id === unit} className={styles.choiceOption}
                  onClick={() => { setUnitPicked(true); setForm(current => ({ ...current, unit: option.id })) }}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.formFooter}>
          <Button variant="secondary" disabled={put.isPending} onClick={onClose}>Cancel</Button>
          <Button disabled={!ready} loading={put.isPending} onClick={() => { void save() }}>Add metric</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
