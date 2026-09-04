'use client'

// Account detail — S20 (permissions), S21 (access), S22 (settings). Ported
// from the story's AccountDetail/AccountTabs/PermissionControl/
// GroupPermissionDropdown, wired to real mutations. See
// docs v1.5/connectors-v1.5-migration-plan.md §4 (edge cases to preserve),
// Gap #2 (visibility can't be changed), Gap #11 (shared accounts have no
// tool-permission storage), Gap #13 (private accounts can't be renamed).

import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTwoIcon,
  ArrowDownOneIcon,
  ArrowLeftOneIcon,
  CancelCircleIcon,
  CheckmarkCircleTwoIcon,
  DeleteTwoIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { Dropdown } from '@/components/Dropdown'
import { InputField } from '@/components/InputField'
import { Tabs as TabsRoot, TabsList, TabsTrigger } from '@/components/Tabs'
import { Tooltip } from '@/components/Tooltip'
import { VisibilityRow } from '@/components/VisibilityRow'
import {
  ConnectorCatalog,
  ConnectorConnection,
  ConnectorTool,
  getConnector,
  updateConnector,
  type ConnectorToolPermission,
} from '@/lib/api/connectors'
import { updateOrgConnectorAccount } from '@/lib/api/org-connectors'
import { ConnectorsShell } from './ConnectionsView'

const SPACE = { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, xxl: 24, section: 32 } as const
const heading: React.CSSProperties = { margin: 0, color: 'var(--neutral-900)', fontFamily: 'var(--font-title)', fontSize: 32, fontWeight: 400, lineHeight: 1.2 }
const muted: React.CSSProperties = { margin: 0, color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)' }
const panel: React.CSSProperties = { borderRadius: 12, background: 'var(--neutral-white)', boxShadow: '0 0 0 1px var(--neutral-100)' }

function Back({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: SPACE.xxl }}>
      <Button variant="ghost" size="sm" leftIcon={<ArrowLeftOneIcon size={16} />} onClick={onClick}>{children}</Button>
    </div>
  )
}

type ActiveTab = 'permissions' | 'access' | 'settings'
function AccountTabs({ active, change }: { active: ActiveTab; change: (value: ActiveTab) => void }) {
  const tabs: ActiveTab[] = ['permissions', 'access', 'settings']
  return (
    <TabsRoot value={active} onValueChange={value => change(value as ActiveTab)} style={{ marginBottom: SPACE.xxl }}>
      <TabsList size="small" aria-label="Account sections">
        {tabs.map(tab => <TabsTrigger key={tab} value={tab}>{tab[0].toUpperCase() + tab.slice(1)}</TabsTrigger>)}
      </TabsList>
    </TabsRoot>
  )
}

// Story's PermissionMode ('always'|'ask'|'blocked') vs. the backend's
// ConnectorToolPermission ('allowed'|'ask'|'blocked') — same 3 states,
// different label for "always allow".
type PermissionMode = 'always' | 'ask' | 'blocked'
const toBackendPermission = (mode: PermissionMode): ConnectorToolPermission => (mode === 'always' ? 'allowed' : mode)
const fromBackendPermission = (p: ConnectorToolPermission): PermissionMode => (p === 'allowed' ? 'always' : p)

const PERMISSION_LABELS: Record<PermissionMode, string> = { always: 'Always allow', ask: 'Ask before use', blocked: 'Blocked' }
const PERMISSION_ICONS: Record<PermissionMode, React.ReactElement> = {
  always: <CheckmarkCircleTwoIcon size={16} />,
  ask: <AlertTwoIcon size={16} />,
  blocked: <CancelCircleIcon size={16} />,
}

function groupTools(tools: ConnectorTool[]) {
  const readOnly = tools.filter(t => t.group === 'read-only')
  const write = tools.filter(t => t.group === 'write')
  return [
    { id: 'read-only', name: 'Read-only tools', tools: readOnly },
    { id: 'write', name: 'Write tools', tools: write },
  ].filter(g => g.tools.length > 0)
}

function PermissionControl({ value, label, change, disabled }: { value: PermissionMode; label: string; change: (value: PermissionMode) => void; disabled?: boolean }) {
  const modes = Object.keys(PERMISSION_LABELS) as PermissionMode[]
  const control = (
    <TabsRoot value={value} onValueChange={mode => !disabled && change(mode as PermissionMode)}>
      <TabsList size="small" aria-label={label}>
        {modes.map(mode => {
          const trigger = <TabsTrigger value={mode} icon={PERMISSION_ICONS[mode]} aria-label={PERMISSION_LABELS[mode]} disabled={disabled} />
          // Skip per-icon tooltips when the whole control is already wrapped in
          // one explaining why it's disabled — nesting tooltips here is redundant.
          return disabled
            ? <React.Fragment key={mode}>{trigger}</React.Fragment>
            : <Tooltip key={mode} content={PERMISSION_LABELS[mode]} side="top">{trigger}</Tooltip>
        })}
      </TabsList>
    </TabsRoot>
  )
  return disabled ? <Tooltip content="Saving this permission…" side="top">{control}</Tooltip> : control
}

function GroupPermissionDropdown({ value, label, change, disabled }: { value?: PermissionMode; label: string; change: (value: PermissionMode) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const display = value ? PERMISSION_LABELS[value] : 'Custom'
  const trigger = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      leftIcon={value ? PERMISSION_ICONS[value] : <AlertTwoIcon size={16} />}
      rightIcon={<ArrowDownOneIcon size={16} />}
      aria-label={label}
    >
      {display}
    </Button>
  )
  if (disabled) {
    return <Tooltip content="Saving this permission…" side="top">{trigger}</Tooltip>
  }
  return (
    <Dropdown.Float trigger={trigger} open={open} onOpenChange={setOpen} placement="bottom-end">
      <Dropdown size="sm">
        <Dropdown.Section fluid>
          {(Object.keys(PERMISSION_LABELS) as PermissionMode[]).map(mode => (
            <Dropdown.Item key={mode} label={PERMISSION_LABELS[mode]} icon={PERMISSION_ICONS[mode]} selected={mode === value} fluid onClick={() => { change(mode); setOpen(false) }} />
          ))}
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )
}

function PermissionsTabSkeleton() {
  return (
    <div aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: SPACE.lg }}>
      {[3, 2].map((rowCount, gi) => (
        <div key={gi} style={panel}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.xl, padding: SPACE.xl, background: 'var(--neutral-50)', borderRadius: '12px 12px 0 0' }}>
            <span className="kaya-skeleton" style={{ display: 'block', width: 110, height: 14, borderRadius: 4 }} />
            <span className="kaya-skeleton" style={{ display: 'block', width: 96, height: 28, borderRadius: 8 }} />
          </div>
          {Array.from({ length: rowCount }).map((_, ri) => (
            <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: SPACE.xl, padding: SPACE.xl, borderTop: ri === 0 ? undefined : '1px solid var(--neutral-100)' }}>
              <span className="kaya-skeleton" style={{ display: 'block', flex: '1 1 300px', width: 160, height: 14, borderRadius: 4 }} />
              <span className="kaya-skeleton" style={{ display: 'block', width: 96, height: 28, borderRadius: 8 }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function PermissionsTab({ catalog }: { catalog: ConnectorCatalog }) {
  const [tools, setTools] = useState<ConnectorTool[]>(catalog.tools)
  const [saving, setSaving] = useState<string | null>(null)
  const [loadingTools, setLoadingTools] = useState(catalog.tools.length === 0)
  const baselineRef = useRef<ConnectorTool[]>(catalog.tools)
  const abortedRef = useRef(false)

  useEffect(() => {
    abortedRef.current = false
    return () => { abortedRef.current = true }
  }, [])

  useEffect(() => {
    if (tools.length > 0) {
      setLoadingTools(false)
      return
    }
    let cancelled = false
    getConnector(catalog.slug)
      .then(detail => {
        if (cancelled || abortedRef.current) return
        baselineRef.current = detail.tools
        setTools(detail.tools)
      })
      .catch(() => { /* keep the empty list */ })
      .finally(() => {
        if (!cancelled && !abortedRef.current) setLoadingTools(false)
      })
    return () => { cancelled = true }
  }, [catalog.slug, tools.length])

  const groups = groupTools(tools)

  async function changeTool(toolKey: string, mode: PermissionMode) {
    const permission = toBackendPermission(mode)
    setTools(prev => prev.map(t => (t.key === toolKey ? t.withPermission(permission) : t)))
    setSaving(toolKey)
    try {
      const updated = await updateConnector(catalog.slug, { permissions: [{ key: toolKey, permission }] })
      if (abortedRef.current) return
      baselineRef.current = updated.tools
      setTools(updated.tools)
      toast.success('Permission updated')
    } catch (err) {
      if (abortedRef.current) return
      setTools(baselineRef.current)
      toast.error(err instanceof Error ? err.message : 'Failed to update permission')
    } finally {
      if (!abortedRef.current) setSaving(null)
    }
  }

  async function changeGroup(groupToolList: ConnectorTool[], mode: PermissionMode) {
    const permission = toBackendPermission(mode)
    const keys = new Set(groupToolList.map(t => t.key))
    setTools(prev => prev.map(t => (keys.has(t.key) ? t.withPermission(permission) : t)))
    setSaving('__group__')
    try {
      const updated = await updateConnector(catalog.slug, {
        permissions: groupToolList.map(t => ({ key: t.key, permission })),
      })
      if (abortedRef.current) return
      baselineRef.current = updated.tools
      setTools(updated.tools)
      toast.success('Permissions updated')
    } catch (err) {
      if (abortedRef.current) return
      setTools(baselineRef.current)
      toast.error(err instanceof Error ? err.message : 'Failed to update permissions')
    } finally {
      if (!abortedRef.current) setSaving(null)
    }
  }

  function groupMode(groupToolList: ConnectorTool[]): PermissionMode | undefined {
    const modes = groupToolList.map(t => t.permissionMode)
    return modes.every(m => m === modes[0]) ? modes[0] : undefined
  }

  return (
    <section>
      <h2 style={{ ...heading, fontSize: 18, marginBottom: SPACE.xs }}>Tool permissions</h2>
      <p style={{ ...muted, marginBottom: SPACE.lg }}>Choose when Souvenir can use these tools.</p>
      {loadingTools ? (
        <PermissionsTabSkeleton />
      ) : groups.length === 0 ? (
        <p style={muted}>No tools available for this connector.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.lg }}>
          {groups.map(group => {
            const currentGroupMode = groupMode(group.tools)
            return (
              <div key={group.id} style={panel}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.xl, flexWrap: 'wrap', padding: SPACE.xl, background: 'var(--neutral-50)', borderRadius: '12px 12px 0 0' }}>
                  <div>
                    <strong style={{ fontWeight: 500 }}>{group.name}</strong>
                    <span style={{ ...muted, marginLeft: SPACE.md, fontSize: 'var(--font-size-caption)' }}>{group.tools.length}</span>
                  </div>
                  <GroupPermissionDropdown value={currentGroupMode} label={`Set all ${group.name.toLowerCase()}`} disabled={saving === '__group__'} change={mode => void changeGroup(group.tools, mode)} />
                </div>
                {group.tools.map((tool, index) => (
                  <div key={tool.key} style={{ display: 'flex', alignItems: 'center', gap: SPACE.xl, flexWrap: 'wrap', padding: SPACE.xl, borderTop: index === 0 ? undefined : '1px solid var(--neutral-100)' }}>
                    <div style={{ flex: '1 1 300px' }}>
                      <strong style={{ fontWeight: 500 }}>{tool.name}</strong>
                      {tool.description ? (
                        <p style={{ ...muted, margin: `${SPACE.xs}px 0 0` }}>{tool.description}</p>
                      ) : null}
                    </div>
                    <PermissionControl
                      value={fromBackendPermission(tool.permission)}
                      label={`Permission for ${tool.name}`}
                      disabled={saving === tool.key}
                      change={mode => void changeTool(tool.key, mode)}
                    />
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function AccessTab({ account }: { account: ConnectorConnection }) {
  const [visibility, setVisibility] = useState(account.visibility)
  const changed = visibility !== account.visibility
  return (
    <section>
      <h2 style={{ ...heading, fontSize: 18, marginBottom: SPACE.lg }}>Who can use this account?</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
        <VisibilityRow label="Shared" description="Everyone in this workspace can use this account." selected={visibility === 'shared'} onClick={() => setVisibility('shared')} />
        <VisibilityRow label="Private" description="Only you can use this account." selected={visibility === 'private'} onClick={() => setVisibility('private')} />
      </div>
      <p style={{ ...muted, marginTop: SPACE.lg }}>
        {account.visibility === 'shared' ? 'This account is available to everyone in the workspace.' : 'Only you can use this account.'}
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: SPACE.lg }}>
        <Tooltip content="Changing an account's visibility after it's created isn't supported yet" side="top">
          {/* Gap #2 — no backend field to flip visibility after creation. Kept
              interactive above so the row selection previews correctly, but
              Save never actually persists a change today. */}
          <Button size="sm" disabled>{changed ? 'Save access' : 'Save access'}</Button>
        </Tooltip>
      </div>
    </section>
  )
}

function SettingsTab({ account, orgId, canManageShared, onChanged, onRemove }: { account: ConnectorConnection; orgId: string | null; canManageShared: boolean; onChanged: () => void; onRemove: () => void }) {
  const [label, setLabel] = useState(account.nickname)
  const [saving, setSaving] = useState(false)
  const isShared = account.isShared
  const sharedButBlocked = isShared && !canManageShared
  const canRename = isShared && canManageShared
  const changed = canRename && label.trim() !== account.nickname && label.trim().length > 0

  async function save() {
    if (!canRename || !orgId) return
    setSaving(true)
    try {
      await updateOrgConnectorAccount(orgId, account.id, { accountLabel: label.trim() })
      toast.success('Account label updated')
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update label')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div style={{ ...panel, padding: SPACE.xl }}>
        <InputField
          label="Account label"
          subtitle={
            canRename
              ? 'This helps Souvenir identify what this account is for.'
              : sharedButBlocked
                ? 'Only workspace admins can rename shared accounts.'
                : "Set when you connected — can't be changed yet."
          }
          value={label}
          onChange={setLabel}
          disabled={!canRename}
          fluid
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: SPACE.lg }}>
          <Button size="sm" disabled={!changed || saving} loading={saving} onClick={() => void save()}>Save</Button>
        </div>
      </div>
      <div style={{ marginTop: SPACE.xxl, paddingTop: SPACE.xxl, borderTop: '1px solid var(--neutral-100)' }}>
        <h2 style={{ margin: 0, color: 'var(--red-600)', fontSize: 18 }}>Remove account</h2>
        <p style={{ ...muted, margin: `${SPACE.sm}px 0 ${SPACE.xl}px` }}>Remove {account.email || account.nickname} from Souvenir.</p>
        <Button variant="danger" size="sm" leftIcon={<DeleteTwoIcon size={16} />} onClick={onRemove}>Remove</Button>
      </div>
    </>
  )
}

export function AccountDetailView({
  account, catalog, orgId, canManageShared, active, back, change, onChanged, onRemove,
}: {
  account: ConnectorConnection
  catalog: ConnectorCatalog
  orgId: string | null
  canManageShared: boolean
  active: ActiveTab
  back: () => void
  change: (tab: ActiveTab) => void
  onChanged: () => void
  onRemove: () => void
}) {
  return (
    <ConnectorsShell>
      <Back onClick={back}>{catalog.name}</Back>
      <div style={{ maxWidth: 968, margin: '0 auto', padding: 'clamp(22px, 4vw, 36px)', borderRadius: 22, background: 'var(--neutral-white)', boxShadow: '0 0 0 1px var(--neutral-100)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.lg, marginBottom: SPACE.xxl }}>
          <div>
            <h1 style={{ ...heading, fontSize: 26 }}>{catalog.name}</h1>
            <p style={{ ...muted, marginTop: SPACE.xs }}>
              {account.email || account.nickname} · {account.isShared ? 'Shared' : 'Private'}
            </p>
          </div>
        </div>
        <AccountTabs active={active} change={change} />
        <div>
          {active === 'permissions' && <PermissionsTab catalog={catalog} />}
          {active === 'access' && <AccessTab account={account} />}
          {active === 'settings' && <SettingsTab account={account} orgId={orgId} canManageShared={canManageShared} onChanged={onChanged} onRemove={onRemove} />}
        </div>
      </div>
    </ConnectorsShell>
  )
}
