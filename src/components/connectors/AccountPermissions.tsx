'use client'

// The account's per-tool permissions tab (part of AccountDetailView).

import React, { useEffect, useRef, useState } from 'react'
import { m } from 'framer-motion'
import { toast } from 'sonner'
import {
  AlertTwoIcon,
  ArrowDownOneIcon,
  CancelCircleIcon,
  CheckmarkCircleTwoIcon,
  InformationCircleIcon,
  SearchOneIcon,
} from '@strange-huge/icons'
import { Dropdown } from '@/components/Dropdown'
import { InputField } from '@/components/InputField'
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
import { SPACE, text, secondary, label } from './account-styles'


// Story's PermissionMode ('always'|'ask'|'blocked') vs. the backend's
// ConnectorToolPermission ('allowed'|'ask'|'blocked') — same 3 states,
// different label for "always allow".
type PermissionMode = 'always' | 'ask' | 'blocked'
const toBackendPermission = (mode: PermissionMode): ConnectorToolPermission => (mode === 'always' ? 'allowed' : mode)
const fromBackendPermission = (p: ConnectorToolPermission): PermissionMode => (p === 'allowed' ? 'always' : p)

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
  const readOnly = !account.canManage
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

