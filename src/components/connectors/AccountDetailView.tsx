'use client'

// Account detail — S20/S21/S22 in one dialog over the connector page: the
// name renames in place, the rail holds sharing and removal, and the
// permissions list fills the rest. See docs v1.5/connectors-v1.5-migration-plan.md
// §4 (edge cases to preserve).
//
// Everything here edits one account, and only its owner may. Permissions belong
// to the account rather than the connector, so two linked Gmails can be
// permissioned differently; sharing is a flag the owner flips.

import React, { useEffect, useRef, useState } from 'react'
import { m } from 'framer-motion'
import { toast } from 'sonner'
import { useOrg } from '@/context/org-context'
import { connectionAddedBy } from '@/lib/connector-owner'
import {
  AlertTwoIcon,
  ArrowDownOneIcon,
  CancelCircleIcon,
  CancelOneIcon,
  CheckmarkCircleTwoIcon,
  DeleteTwoIcon,
  InformationCircleIcon,
  PenOneIcon,
  SearchOneIcon,
} from '@strange-huge/icons'
import { ConnectorGlyph } from '@/components/ConnectorGlyph'
import { Dropdown } from '@/components/Dropdown'
import { IconButton } from '@/components/IconButton'
import { InputField } from '@/components/InputField'
import { Switch } from '@/components/Switch'
import { Tooltip } from '@/components/Tooltip'
import {
  AccountTool,
  ConnectorCatalog,
  ConnectorConnection,
  getConnector,
  updateAccount,
  type ConnectorToolPermission,
} from '@/lib/api/connectors'
import styles from './AccountDetailView.module.css'

const SPACE = { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, xxl: 24, section: 32 } as const
const text: React.CSSProperties = { margin: 0, color: 'var(--neutral-900)', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '20px' }
const secondary: React.CSSProperties = { ...text, color: 'var(--color-text-muted)' }
const label: React.CSSProperties = { ...text, fontWeight: 500 }

// Story's PermissionMode ('always'|'ask'|'blocked') vs. the backend's
// ConnectorToolPermission ('allow'|'ask'|'block') — same 3 states,
// different labels for always-allow and never.
type PermissionMode = 'always' | 'ask' | 'blocked'
const toBackendPermission = (mode: PermissionMode): ConnectorToolPermission => (
  mode === 'always' ? 'allow' : mode === 'blocked' ? 'block' : mode
)
const fromBackendPermission = (p: ConnectorToolPermission): PermissionMode => (
  p === 'allow' ? 'always' : p === 'block' ? 'blocked' : p
)

const PERMISSION_MODES: PermissionMode[] = ['blocked', 'ask', 'always']
const PERMISSION_LABELS: Record<PermissionMode, string> = { always: 'Always allow', ask: 'Ask before use', blocked: 'Blocked' }
const PERMISSION_SHORT: Record<PermissionMode, string> = { always: 'Allow', ask: 'Ask', blocked: 'Block' }
const PERMISSION_ICONS: Record<PermissionMode, React.ReactElement> = {
  always: <CheckmarkCircleTwoIcon size={16} />,
  ask: <AlertTwoIcon size={16} />,
  blocked: <CancelCircleIcon size={16} />,
}

function groupTools(tools: AccountTool[]) {
  const readOnly = tools.filter(t => t.group === 'read-only')
  const write = tools.filter(t => t.group === 'write')
  return [
    { id: 'read-only', name: 'Read-only tools', tools: readOnly },
    { id: 'write', name: 'Write tools', tools: write },
  ].filter(g => g.tools.length > 0)
}

function PermissionControl({ id, value, label: name, change, disabled }: { id: string; value: PermissionMode; label: string; change: (value: PermissionMode) => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label={name} className={styles.segmented} data-disabled={disabled || undefined}>
      {PERMISSION_MODES.map(mode => {
        const checked = mode === value
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={PERMISSION_LABELS[mode]}
            disabled={disabled}
            className={styles.segment}
            data-checked={checked || undefined}
            onClick={() => !checked && change(mode)}
          >
            {checked && <m.span layoutId={`permission-${id}`} className={styles.segmentPill} transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
            <span className={styles.segmentLabel}>{PERMISSION_SHORT[mode]}</span>
          </button>
        )
      })}
    </div>
  )
}

function GroupPermissionDropdown({ value, label: name, change, disabled }: { value?: PermissionMode; label: string; change: (value: PermissionMode) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const trigger = (
    <button type="button" className={styles.groupTrigger} disabled={disabled} aria-label={name}>
      {value ? PERMISSION_SHORT[value] : 'Custom'}
      <ArrowDownOneIcon size={14} />
    </button>
  )
  if (disabled) return trigger
  return (
    <Dropdown.Float trigger={trigger} open={open} onOpenChange={setOpen} placement="bottom-end" autoFlipVertical>
      <Dropdown size="sm" maxHeight={false}>
        <Dropdown.Section fluid>
          {PERMISSION_MODES.map(mode => (
            <Dropdown.Item key={mode} label={PERMISSION_LABELS[mode]} icon={PERMISSION_ICONS[mode]} selected={mode === value} fluid onClick={() => { change(mode); setOpen(false) }} />
          ))}
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )
}

function PermissionsTabSkeleton() {
  return (
    <div aria-hidden style={{ display: 'flex', flexDirection: 'column' }}>
      <span className="kaya-skeleton" style={{ display: 'block', height: 40, borderRadius: 8 }} />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 10px 8px', borderTop: i === 0 ? undefined : '1px solid var(--neutral-100)' }}>
          <span className="kaya-skeleton" style={{ display: 'block', width: 160, height: 14, borderRadius: 4 }} />
          <span className="kaya-skeleton" style={{ display: 'block', width: 132, height: 32, borderRadius: 8 }} />
        </div>
      ))}
    </div>
  )
}

export function PermissionsTab({
  account, catalog, onChanged,
}: { account: ConnectorConnection; catalog: ConnectorCatalog; onChanged: () => void }) {
  // The catalog says what the tools are; the account says what it decided
  // about each. Joining them here is what makes two Gmails independent.
  const [tools, setTools] = useState<AccountTool[]>(() => account.toolsFrom(catalog.tools))
  const [saving, setSaving] = useState<string | null>(null)
  const [loadingTools, setLoadingTools] = useState(catalog.tools.length === 0)
  const baselineRef = useRef<AccountTool[]>(tools)
  const abortedRef = useRef(false)
  const readOnly = !account.owned
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    abortedRef.current = false
    return () => { abortedRef.current = true }
  }, [])

  useEffect(() => {
    // No fetch needed once tools are populated — and no setState needed
    // either: loadingTools' own initializer (catalog.tools.length === 0)
    // already starts false whenever tools arrive pre-populated, and on every
    // other path this effect's own fetch below already flips it false itself
    // (in the .finally() as the fetch resolves) before tools.length can ever
    // become >0 and re-trigger this effect. A synchronous setState here was
    // therefore always a redundant no-op — removed rather than converted.
    if (tools.length > 0) return
    let cancelled = false
    getConnector(catalog.slug)
      .then(detail => {
        if (cancelled || abortedRef.current) return
        // The list endpoint ships accounts without their saved permissions,
        // so join against the account as the detail response carries it.
        const saved = detail.connections.find(row => row.id === account.id)
        if (!saved) return
        const joined = saved.toolsFrom(detail.tools)
        baselineRef.current = joined
        setTools(joined)
      })
      .catch(() => { /* keep the empty list */ })
      .finally(() => {
        if (!cancelled && !abortedRef.current) setLoadingTools(false)
      })
    return () => { cancelled = true }
  }, [catalog.slug, tools.length, account])

  const needle = query.trim().toLowerCase()
  const matches = (tool: AccountTool) =>
    !needle || tool.name.toLowerCase().includes(needle) || (tool.description ?? '').toLowerCase().includes(needle)
  const groups = groupTools(tools)
    .map(group => ({ ...group, visible: group.tools.filter(matches) }))
    .filter(group => group.visible.length > 0)

  async function file(next: AccountTool[], changed: { key: string; permission: ConnectorToolPermission }[], busyKey: string) {
    setTools(next)
    setSaving(busyKey)
    try {
      const updated = await updateAccount(account.id, { permissions: changed })
      if (abortedRef.current) return
      const joined = updated.toolsFrom(catalog.tools)
      baselineRef.current = joined
      setTools(joined)
      toast.success(changed.length === 1 ? 'Permission updated' : 'Permissions updated')
      onChanged()
    } catch (err) {
      if (abortedRef.current) return
      setTools(baselineRef.current)
      toast.error(err instanceof Error ? err.message : 'Failed to update permission')
    } finally {
      if (!abortedRef.current) setSaving(null)
    }
  }

  async function changeTool(toolKey: string, mode: PermissionMode) {
    const permission = toBackendPermission(mode)
    await file(
      tools.map(t => (t.key === toolKey ? t.withPermission(permission) : t)),
      [{ key: toolKey, permission }],
      toolKey,
    )
  }

  async function changeGroup(groupToolList: AccountTool[], mode: PermissionMode) {
    const permission = toBackendPermission(mode)
    const keys = new Set(groupToolList.map(t => t.key))
    await file(
      tools.map(t => (keys.has(t.key) ? t.withPermission(permission) : t)),
      groupToolList.map(t => ({ key: t.key, permission })),
      '__group__',
    )
  }

  function groupMode(groupToolList: AccountTool[]): PermissionMode | undefined {
    const modes = groupToolList.map(t => t.permissionMode)
    return modes.every(m => m === modes[0]) ? modes[0] : undefined
  }

  function toggleGroup(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: SPACE.xl }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.xl, flexWrap: 'wrap', minHeight: 32 }}>
        <h2 style={label}>Manage permissions</h2>
        {tools.length > 6 && (
          <div style={{ width: 'min(220px, 100%)' }}>
            <InputField label="Search tools" showLabel={false} value={query} onChange={setQuery} placeholder="Search tools" leftIcon={<SearchOneIcon size={16} />} size="small" fluid />
          </div>
        )}
      </div>
      {readOnly && <p style={secondary}>Set by the person who connected {account.nickname}.</p>}
      {loadingTools ? (
        <PermissionsTabSkeleton />
      ) : tools.length === 0 ? (
        <p style={secondary}>No tools available for this connector.</p>
      ) : groups.length === 0 ? (
        <p style={{ ...secondary, padding: SPACE.xxl, textAlign: 'center' }}>No tools match “{query.trim()}”.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xl }}>
          {groups.map(group => {
            const open = needle.length > 0 || !collapsed.has(group.id)
            return (
              <section key={group.id} style={{ display: 'flex', flexDirection: 'column', isolation: 'isolate' }}>
                <div className={styles.groupHeader}>
                  <button type="button" aria-expanded={open} onClick={() => toggleGroup(group.id)} className={styles.groupToggle}>
                    <span aria-hidden className={styles.chevron} data-open={open || undefined}>
                      <ArrowDownOneIcon size={16} />
                    </span>
                    {group.name}
                    <span style={{ color: 'var(--neutral-400)', fontWeight: 400 }}>{group.tools.length}</span>
                  </button>
                  <GroupPermissionDropdown value={groupMode(group.tools)} label={`Set all ${group.name.toLowerCase()}`} disabled={readOnly || saving === '__group__'} change={mode => void changeGroup(group.tools, mode)} />
                </div>
                {open && (
                  <div style={{ display: 'flex', flexDirection: 'column', paddingTop: SPACE.xs }}>
                    {group.visible.map((tool, index) => (
                      <div key={tool.key} role="group" aria-label={tool.name} className={styles.toolRow} style={{ borderTop: index === 0 ? undefined : '1px solid var(--neutral-100)' }}>
                        <div style={{ ...text, flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
                          <span style={{ minWidth: 0 }}>{tool.name}</span>
                          {tool.description && (
                            <Tooltip content={tool.description} side="top">
                              <span tabIndex={0} aria-label={tool.description} className={styles.info}>
                                <InformationCircleIcon size={14} />
                              </span>
                            </Tooltip>
                          )}
                        </div>
                        <PermissionControl
                          id={`${account.id}-${tool.key}`}
                          value={fromBackendPermission(tool.permission)}
                          label={`Permission for ${tool.name}`}
                          disabled={readOnly || saving === tool.key}
                          change={mode => void changeTool(tool.key, mode)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </section>
  )
}

function AccountName({ account, onChanged }: { account: ConnectorConnection; onChanged: () => void }) {
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

  if (!account.owned) return <h1 style={style}>{account.nickname}</h1>

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

function AccountRail({
  account, catalog, onChanged, onRemove,
}: { account: ConnectorConnection; catalog: ConnectorCatalog; onChanged: () => void; onRemove: () => void }) {
  const [shared, setShared] = useState(account.shared)
  const [syncedShared, setSyncedShared] = useState(account.shared)
  if (account.shared !== syncedShared) {
    setSyncedShared(account.shared)
    setShared(account.shared)
  }
  const [sharing, setSharing] = useState(false)
  const owned = account.owned

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

export function AccountDetailView({
  account, catalog, close, onChanged, onRemove,
}: {
  account: ConnectorConnection
  catalog: ConnectorCatalog
  close: () => void
  onChanged: () => void
  onRemove: () => void
}) {
  const { members } = useOrg()
  const addedBy = connectionAddedBy(account, members)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.defaultPrevented) close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  return (
    <div className={styles.overlay} onClick={close}>
      <m.div
        role="dialog"
        aria-modal="true"
        aria-label={`${catalog.name} · ${account.nickname}`}
        className={styles.dialog}
        onClick={event => event.stopPropagation()}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
      >
        <header className={styles.header}>
          <ConnectorGlyph slug={catalog.slug} name={catalog.name} logoUrl={catalog.logoUrl} size={44} />
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <AccountName account={account} onChanged={onChanged} />
            <p style={secondary}>
              {[catalog.name, account.email, `Added by ${addedBy}`, account.owned ? null : 'shared with you'].filter(Boolean).join(' · ')}
            </p>
          </div>
          <IconButton variant="outline" size="sm" aria-label="Close" icon={<CancelOneIcon size={16} />} onClick={close} />
        </header>
        {!account.canManage && (
          <p className={styles.readOnlyNotice}>You can use this shared account. Only the person who added it can edit its settings.</p>
        )}
        <div className={styles.body}>
          <div className={styles.column}>
            <AccountRail account={account} catalog={catalog} onChanged={onChanged} onRemove={onRemove} />
          </div>
          <div className={`${styles.column} ${styles.main}`}>
            <PermissionsTab account={account} catalog={catalog} onChanged={onChanged} />
          </div>
        </div>
      </m.div>
    </div>
  )
}
