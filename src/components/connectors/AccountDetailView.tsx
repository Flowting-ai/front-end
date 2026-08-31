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
  getConnector,
  updateConnector,
  connectorToolBooleans,
  type ConnectorTool,
  type ConnectorToolPermission,
} from '@/lib/api/connectors'
import { updateOrgConnectorAccount } from '@/lib/api/org-connectors'
import type { UnifiedAccount, UnifiedConnectorSummary } from '@/lib/connectorsUnified'
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

function humanizeAction(toolSlug: string, connectorSlug: string): string {
  let s = toolSlug
  const prefix = `${connectorSlug.replace(/[\s-]/g, '_').toUpperCase()}_`
  if (s.toUpperCase().startsWith(prefix)) s = s.slice(prefix.length)
  s = s.replace(/_/g, ' ').trim().toLowerCase()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : toolSlug
}

// No backend field groups tools as read-only vs. write (Gap #4) — this is a
// hand-maintained keyword heuristic over the tool slug, same category of
// workaround as connectorCategories.ts. Revisit if/when the backend adds a
// real ToolEntry.group field.
const WRITE_KEYWORDS = ['send', 'delete', 'remove', 'create', 'update', 'modify', 'write', 'post', 'add', 'edit', 'archive']
function toolGroupOf(tool: ConnectorTool): 'write' | 'read-only' {
  const lower = tool.slug.toLowerCase()
  return WRITE_KEYWORDS.some(kw => lower.includes(kw)) ? 'write' : 'read-only'
}
function groupTools(tools: ConnectorTool[]) {
  const readOnly = tools.filter(t => toolGroupOf(t) === 'read-only')
  const write = tools.filter(t => toolGroupOf(t) === 'write')
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
  return disabled ? <Tooltip content="Tool permissions for shared accounts aren't supported yet" side="top">{control}</Tooltip> : control
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
    return <Tooltip content="Tool permissions for shared accounts aren't supported yet" side="top">{trigger}</Tooltip>
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

function PermissionsTab({ account, summary }: { account: UnifiedAccount; summary: UnifiedConnectorSummary }) {
  const isShared = account.visibility === 'shared'
  const [tools, setTools] = useState<ConnectorTool[]>(summary.tools)
  const [saving, setSaving] = useState<string | null>(null)
  // Only the initial backfill fetch counts as "loading" — an empty result
  // after it resolves is a real "no tools" state, not a loading one.
  const [loadingTools, setLoadingTools] = useState(!isShared && summary.tools.length === 0)
  const baselineRef = useRef<ConnectorTool[]>(summary.tools)
  const abortedRef = useRef(false)

  useEffect(() => {
    abortedRef.current = false
    return () => { abortedRef.current = true }
  }, [])

  // Long-tail connectors return an empty tools array on the list endpoint —
  // lazily backfill on first open, fail silently (account stays manageable
  // even without a tool list).
  useEffect(() => {
    if (isShared || tools.length > 0) return
    let cancelled = false
    getConnector(summary.slug)
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
  }, [isShared, summary.slug, tools.length])

  const groups = groupTools(tools)

  async function changeTool(toolSlug: string, mode: PermissionMode) {
    const booleans = connectorToolBooleans(toBackendPermission(mode))
    setTools(prev => prev.map(t => (t.slug === toolSlug ? { ...t, ...booleans, permission: toBackendPermission(mode) } : t)))
    setSaving(toolSlug)
    try {
      const updated = await updateConnector(summary.slug, { permissions: [{ slug: toolSlug, ...booleans }] })
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

  async function changeGroup(groupTools_: ConnectorTool[], mode: PermissionMode) {
    const booleans = connectorToolBooleans(toBackendPermission(mode))
    const slugs = new Set(groupTools_.map(t => t.slug))
    setTools(prev => prev.map(t => (slugs.has(t.slug) ? { ...t, ...booleans, permission: toBackendPermission(mode) } : t)))
    setSaving('__group__')
    try {
      const updated = await updateConnector(summary.slug, { permissions: groupTools_.map(t => ({ slug: t.slug, ...booleans })) })
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
    const modes = groupToolList.map(t => fromBackendPermission(t.permission ?? 'ask'))
    return modes.every(m => m === modes[0]) ? modes[0] : undefined
  }

  return (
    <section>
      <h2 style={{ ...heading, fontSize: 18, marginBottom: SPACE.xs }}>Tool permissions</h2>
      <p style={{ ...muted, marginBottom: SPACE.lg }}>Choose when Souvenir can use these tools.</p>
      {isShared && (
        <div style={{ ...panel, padding: SPACE.lg, marginBottom: SPACE.lg, background: 'var(--yellow-50)' }}>
          <BodyTextInline>Tool permissions for shared accounts aren&apos;t supported yet — the controls below are shown for reference only. (See Gap #11.)</BodyTextInline>
        </div>
      )}
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
                  <GroupPermissionDropdown value={currentGroupMode} label={`Set all ${group.name.toLowerCase()}`} disabled={isShared} change={mode => void changeGroup(group.tools, mode)} />
                </div>
                {group.tools.map((tool, index) => (
                  <div key={tool.slug} style={{ display: 'flex', alignItems: 'center', gap: SPACE.xl, flexWrap: 'wrap', padding: SPACE.xl, borderTop: index === 0 ? undefined : '1px solid var(--neutral-100)' }}>
                    <div style={{ flex: '1 1 300px' }}>
                      <strong style={{ fontWeight: 500 }}>{humanizeAction(tool.slug, summary.slug)}</strong>
                    </div>
                    <PermissionControl
                      value={fromBackendPermission(tool.permission ?? 'ask')}
                      label={`Permission for ${humanizeAction(tool.slug, summary.slug)}`}
                      disabled={isShared || saving === tool.slug}
                      change={mode => void changeTool(tool.slug, mode)}
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

function BodyTextInline({ children }: { children: React.ReactNode }) {
  return <p style={{ ...muted, margin: 0 }}>{children}</p>
}

function AccessTab({ account }: { account: UnifiedAccount }) {
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

function SettingsTab({ account, summary, orgId, canManageShared, onChanged, onRemove }: { account: UnifiedAccount; summary: UnifiedConnectorSummary; orgId: string | null; canManageShared: boolean; onChanged: () => void; onRemove: () => void }) {
  const [label, setLabel] = useState(account.nickname)
  const [saving, setSaving] = useState(false)
  const isShared = account.visibility === 'shared'
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
  account, summary, orgId, canManageShared, active, back, change, onChanged, onRemove,
}: {
  account: UnifiedAccount
  summary: UnifiedConnectorSummary
  orgId: string | null
  /** False for a non-admin member — the backend still requires org
   *  owner/admin for every shared-account mutation (rename/remove/etc). */
  canManageShared: boolean
  active: ActiveTab
  back: () => void
  change: (tab: ActiveTab) => void
  onChanged: () => void
  onRemove: () => void
}) {
  return (
    <ConnectorsShell>
      <Back onClick={back}>{summary.name}</Back>
      <div style={{ maxWidth: 968, margin: '0 auto', padding: 'clamp(22px, 4vw, 36px)', borderRadius: 22, background: 'var(--neutral-white)', boxShadow: '0 0 0 1px var(--neutral-100)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.lg, marginBottom: SPACE.xxl }}>
          <div>
            <h1 style={{ ...heading, fontSize: 26 }}>{summary.name}</h1>
            <p style={{ ...muted, marginTop: SPACE.xs }}>
              {account.email || account.nickname} · {account.visibility === 'shared' ? 'Shared' : 'Private'}
            </p>
          </div>
        </div>
        <AccountTabs active={active} change={change} />
        <div style={{ maxWidth: 820 }}>
          {active === 'permissions' && <PermissionsTab account={account} summary={summary} />}
          {active === 'access' && <AccessTab account={account} />}
          {active === 'settings' && <SettingsTab account={account} summary={summary} orgId={orgId} canManageShared={canManageShared} onChanged={onChanged} onRemove={onRemove} />}
        </div>
      </div>
    </ConnectorsShell>
  )
}
