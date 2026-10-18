'use client'

import React, { useState } from 'react'
import { ArrowDownOneIcon, InformationCircleIcon } from '@strange-huge/icons'
import { Dropdown } from '@/components/Dropdown'
import { Switch } from '@/components/Switch'
import { Button } from '@/components/ui/button'
import { formatBytes, storageLabel, storageShare } from '@/lib/library/format'
import type { Format, Storage } from '@/lib/library/schemas'
import { FormatGlyph } from '../FormatGlyph'
import styles from './SettingsParts.module.css'

/** A heading (16 / 500) with its card underneath. Sections are 32px apart, set by the parent. */
export function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '24px', color: 'var(--neutral-900)' }}>{title}</h2>
      {children}
    </section>
  )
}

export function SettingsCard({ children }: { children: React.ReactNode }) {
  return <div className={styles.card}>{children}</div>
}

/**
 * One setting: a bold title and an optional quiet line on the left, the control on the right. `why` says
 * in words why a control is off (amber, with an icon). Rows in one card are divided by a hairline.
 */
export function SettingRow({
  title,
  hint,
  why,
  titleExtra,
  leading,
  control,
  children,
}: {
  title: string
  hint?: string
  why?: React.ReactNode
  titleExtra?: React.ReactNode
  /** An avatar or icon before the text. */
  leading?: React.ReactNode
  control?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className={styles.row}>
      {leading}
      <div className={styles.grow}>
        <p className={styles.title}>
          {title}
          {titleExtra}
        </p>
        {hint && <span className={styles.hint}>{hint}</span>}
        {why && (
          <span className={styles.why} role="status">
            <InformationCircleIcon size={14} aria-hidden="true" />
            {why}
          </span>
        )}
        {children}
      </div>
      {control}
    </div>
  )
}

/** The read-only value on the right of a row. */
export function SettingValue({ children }: { children: React.ReactNode }) {
  return <span className={styles.value}>{children}</span>
}

/** A quiet line under the last card. */
export function QuietLine({ children }: { children: React.ReactNode }) {
  return <p className={styles.quiet}>{children}</p>
}

export function PhaseBadge() {
  return <span className={styles.badge}>Phase 2</span>
}

/** A quiet red text action at the end of a row (Remove, Leave), like the prototype's text-danger button. */
export function DangerTextButton({ children, onClick, disabled = false, label }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <Button variant="ghost" size="sm" disabled={disabled} aria-label={label} onClick={onClick} style={{ color: disabled ? 'var(--neutral-400)' : 'var(--red-500)', flexShrink: 0 }}>
      {children}
    </Button>
  )
}

/** A Phase 2 page: the title with its badge comes from the page shell; this is the dashed box with one line. */
export function PhasePlaceholder({ children }: { children: React.ReactNode }) {
  return <div className={styles.phasePage}>{children}</div>
}

export interface FileTypeOption {
  group: string
  label: string
  /** What is in the group, in a few words. */
  hint: string
  format: Format
}

/** The file types Library accepts, one read-only tile per group: a type glyph, its name and what it covers. */
export function FileTypeList({ options }: { options: FileTypeOption[] }) {
  return (
    <ul className={styles.pickerGrid} aria-label="File types">
      {options.map((option) => (
        <li key={option.group} className={styles.tile}>
          <FormatGlyph format={option.format} size="md" />
          <span className={styles.tileText}>
            <b>{option.label}</b>
            <small>{option.hint}</small>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** A select built from the design system's Dropdown: a quiet pill showing the choice, and a menu with the current one marked. */
export function NativeSelect<T extends string>({ value, onChange, options, label, disabled = false }: { value: T; onChange: (value: T) => void; options: { value: T; label: string }[]; label: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const current = options.find((option) => option.value === value)
  return (
    <Dropdown.Float
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      trigger={
        <Button variant="ghost" disabled={disabled} aria-label={`${label}: ${current?.label ?? ''}`} aria-haspopup="menu" aria-expanded={open} rightIcon={<ArrowDownOneIcon animated />}>
          {current?.label ?? label}
        </Button>
      }
    >
      <Dropdown maxHeight={false} style={{ minWidth: 144 }}>
        <Dropdown.Section fluid>
          {options.map((option) => (
            <Dropdown.Item
              key={option.value}
              label={option.label}
              fluid
              selected={option.value === value}
              onClick={() => {
                setOpen(false)
                if (option.value !== value) onChange(option.value)
              }}
            />
          ))}
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )
}

export function SettingSwitch({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  return <Switch checked={checked} onCheckedChange={onChange} aria-label={label} disabled={disabled} />
}

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`
}

/**
 * Storage, like the prototype: a bold "X of Y used" line, a thick bar, then a card with one row per kind
 * (Files, Images, Audio) and its size. Each row also says how many files it holds. Without a cap (the real Phase 1 server) it reads "X used" and the bar stays at its minimum.
 */
export function StorageBlock({ storage, tip }: { storage: Storage; tip?: React.ReactNode }) {
  const share = storageShare(storage.usedBytes, storage.limitBytes)
  const { counts } = storage
  const rows: { name: string; bytes: number; count?: string }[] = [
    { name: 'Files', bytes: storage.breakdown.filesBytes, count: counts && plural(counts.files, 'file', 'files') },
    { name: 'Images', bytes: storage.breakdown.imagesBytes, count: counts && plural(counts.images, 'image', 'images') },
    { name: 'Audio', bytes: storage.breakdown.audioBytes, count: counts && plural(counts.audio, 'recording', 'recordings') },
  ]
  return (
    <>
      <p className={styles.storageTitle}>
        {/* A round cap reads "20 GB", as in the prototype (formatBytes drops trailing zeros). */}
        {storageLabel(storage.usedBytes, storage.limitBytes)}
        {tip}
      </p>
      <div
        className={styles.bar}
        role="progressbar"
        aria-label={storage.limitBytes === null ? 'Storage used, no limit' : 'Storage used'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(share * 100)}
      >
        <i className={styles.barFill} style={{ width: `${share * 100}%` }} />
      </div>
      <div className={styles.card} style={{ marginTop: 0 }}>
        {rows.map((row) => (
          <SettingRow key={row.name} title={row.name} hint={row.count ? `${formatBytes(row.bytes)} · ${row.count}` : formatBytes(row.bytes)} />
        ))}
      </div>
    </>
  )
}
