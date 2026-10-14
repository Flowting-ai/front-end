'use client'

// The account's name (renames in place) and its rail: sharing and removal
// (part of AccountDetailView).

import React, { useRef, useState } from 'react'
import { toast } from 'sonner'
import { DeleteTwoIcon, PenOneIcon } from '@strange-huge/icons'
import { Switch } from '@/components/Switch'
import { ConnectorCatalog, ConnectorConnection, updateAccount } from '@/lib/api/connectors'
import styles from './AccountDetailView.module.css'
import { SPACE, text, secondary, label } from './account-styles'

export function AccountName({ account, onChanged }: { account: ConnectorConnection; onChanged: () => void }) {
  const [label, setLabel] = useState(account.nickname)
  const [syncedNickname, setSyncedNickname] = useState(account.nickname)
  if (account.nickname !== syncedNickname) {
    setSyncedNickname(account.nickname)
    setLabel(account.nickname)
  }
  const [saving, setSaving] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const skipBlurRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const style: React.CSSProperties = { ...text, fontSize: 18, lineHeight: '26px', fontWeight: 600 }

  if (!account.canManage) return <h1 style={style}>{account.nickname}</h1>

  async function commit() {
    const next = label.trim()
    if (!next || next === account.nickname) {
      setLabel(account.nickname)
      return
    }
    setSaving(true)
    try {
      await updateAccount(account.id, { accountLabel: next, expectedVersion: account.version })
      toast.success('Account renamed')
      onChanged()
    } catch (err) {
      setLabel(account.nickname)
      toast.error(err instanceof Error ? err.message : 'Failed to rename account')
    } finally {
      setSaving(false)
    }
  }

  const field: React.CSSProperties = { ...style, gridArea: '1 / 1', padding: 0, whiteSpace: 'pre' }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => inputRef.current?.focus()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: SPACE.md,
        maxWidth: '100%',
        cursor: focused ? 'text' : 'pointer',
      }}
    >
      <span
        style={{
          display: 'inline-grid',
          minWidth: 0,
          maxWidth: '100%',
          overflow: 'hidden',
          borderBottom: `1px ${focused ? 'solid' : 'dashed'} ${focused ? 'var(--neutral-500)' : hovered && !saving ? 'var(--neutral-300)' : 'transparent'}`,
          transition: 'border-color 120ms ease',
        }}
      >
        <span aria-hidden style={{ ...field, visibility: 'hidden' }}>{label || ' '}</span>
        <input
          ref={inputRef}
          aria-label="Account name"
          size={1}
          value={label}
          disabled={saving}
          onChange={event => setLabel(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            if (skipBlurRef.current) {
              skipBlurRef.current = false
              return
            }
            void commit()
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              skipBlurRef.current = true
              void commit()
              event.currentTarget.blur()
            }
            if (event.key === 'Escape') {
              skipBlurRef.current = true
              setLabel(account.nickname)
              event.currentTarget.blur()
            }
          }}
          style={{ ...field, width: '100%', minWidth: 0, border: 0, background: 'transparent', outline: 'none', cursor: 'inherit' }}
        />
      </span>
      {!focused && (
        <span aria-hidden style={{ display: 'grid', placeItems: 'center', color: hovered ? 'var(--neutral-700)' : 'var(--neutral-400)', transition: 'color 120ms ease' }}>
          <PenOneIcon size={14} />
        </span>
      )}
    </div>
  )
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
      <h3 style={label}>{title}</h3>
      {children}
    </section>
  )
}

export function AccountRail({
  account, catalog, onChanged, onRemove,
}: { account: ConnectorConnection; catalog: ConnectorCatalog; onChanged: () => void; onRemove: () => void }) {
  const [shared, setShared] = useState(account.shared)
  const [syncedShared, setSyncedShared] = useState(account.shared)
  if (account.shared !== syncedShared) {
    setSyncedShared(account.shared)
    setShared(account.shared)
  }
  const [sharing, setSharing] = useState(false)
  // Edit rights come from the model's one rule (ConnectorConnection.canManage).
  const owned = account.canManage

  async function changeSharing(next: boolean) {
    setShared(next)
    setSharing(true)
    try {
      await updateAccount(account.id, { shared: next, expectedVersion: account.version })
      toast.success(next ? 'Shared with your workspace' : 'Only you can use this account now')
      onChanged()
    } catch (err) {
      setShared(account.shared)
      toast.error(err instanceof Error ? err.message : 'Failed to change access')
    } finally {
      setSharing(false)
    }
  }

  return (
    <aside className={styles.rail}>
      {catalog.description && (
        <RailSection title="Overview">
          <p style={secondary}>{catalog.description}</p>
        </RailSection>
      )}

      <RailSection title="Access">
        <label style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACE.lg, cursor: owned ? 'pointer' : 'default' }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={text}>Share with workspace</span>
            <span style={secondary}>
              {owned
                ? shared ? 'Everyone in this workspace can use it. Only you can change it.' : 'Only you can use it.'
                : 'Shared with you. Only the person who connected it can change this.'}
            </span>
          </span>
          <Switch checked={shared} disabled={!owned || sharing} onCheckedChange={next => void changeSharing(next)} aria-label="Share with workspace" />
        </label>
      </RailSection>

      {owned && (
        <div style={{ marginTop: 'auto', paddingTop: SPACE.xl, borderTop: '1px solid var(--neutral-100)' }}>
          <button type="button" className={styles.remove} onClick={onRemove}>
            <DeleteTwoIcon size={16} />
            Remove account
          </button>
        </div>
      )}
    </aside>
  )
}

