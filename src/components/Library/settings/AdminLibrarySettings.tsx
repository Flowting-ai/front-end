'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/Badge'
import { Skeleton } from '@/components/Skeleton'
import { SettingsPageShell } from '@/components/SettingsPageShell'
import { FORMAT_GROUP_LABELS } from '@/lib/library/format'
import { MESSAGES } from '@/lib/library/messages'
import { useUpdateOrgSettings } from '@/lib/library/mutations'
import { useOrgSettings, useStorage } from '@/lib/library/queries'
import { AUTO_SAVE_MODES, FORMAT_GROUPS, type OrgSettings, type OrgSettingsPatch } from '@/lib/library/schemas'
import { detectForeignChange } from '@/lib/library/settings-notice'
import { useLibraryViewer } from '@/lib/library/viewer'
import { InfoTip } from '../InfoTip'
import { AUTO_SAVE_LABELS } from './PersonalLibrarySettings'
import {
  NativeSelect,
  QuietLine,
  SettingRow,
  SettingSwitch,
  SettingValue,
  SettingsCard,
  SettingsSection,
  StorageBlock,
} from './SettingsParts'

const SIZE_PRESETS_MB = [10, 30, 50, 100]
// The backend's limit is in MiB (50 MiB = 52,428,800 B), and the saved toast counts that way too: "50 MB", not "52 MB".
const MB = 1024 * 1024

function sizeOptions(current: number) {
  const mb = Math.round(current / MB)
  const values = SIZE_PRESETS_MB.includes(mb) ? SIZE_PRESETS_MB : [...SIZE_PRESETS_MB, mb].sort((a, b) => a - b)
  return values.map((value) => ({ value: String(value), label: `${value} MB` }))
}

/** Read-only, one line, as in the prototype ("PDF, Document, Sheet, CSV, Image, Audio"). */
const FILE_TYPES_LINE = FORMAT_GROUPS.map((group) => FORMAT_GROUP_LABELS[group]).join(', ')

function RowLoading({ last }: { last?: boolean }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 24, minHeight: 64, padding: '14px 16px', boxSizing: 'border-box', borderTop: last === false ? undefined : '1px solid var(--neutral-100)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton height={14} radius={6} width="32%" />
        <Skeleton height={12} radius={6} width="48%" />
      </div>
      <Skeleton height={32} radius={10} width={88} />
    </div>
  )
}

function CardLoading({ rows = 2 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => <RowLoading key={index} last={index === 0 ? false : undefined} />)}
    </div>
  )
}

function CardError({ children, onRetry }: { children: React.ReactNode; onRetry?: () => void }) {
  return (
    <div role="alert" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-600)' }}>
      <span>{children}</span>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>{MESSAGES.retry}</Button>}
    </div>
  )
}

/** The page title, like the prototype's: "Library settings", an Admin badge, and an info tip. */
function AdminTitle() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      Library settings
      <Badge label="Admin" color="Yellow" />
      <InfoTip text="These apply to everyone. Members see a short notice when you change them." />
    </span>
  )
}

/**
 * Workspace Library settings (Admin), laid out like the prototype: Saving files, Souvenir, Files, Storage.
 * Each control saves on change with an optimistic update. Two Admins editing at once: the later write wins, and the other one sees who changed it.
 */
export function AdminLibrarySettings() {
  const { viewerId, isAdmin } = useLibraryViewer()
  const settings = useOrgSettings(isAdmin)
  const storage = useStorage()
  const update = useUpdateOrgSettings()

  // "Changed by X just now": the version this browser has accepted as current. A newer version written
  // by someone else (it arrives on window focus) is reported until dismissed or until we save.
  const [knownVersion, setKnownVersion] = useState<number | null>(null)
  const data = settings.data
  if (data && knownVersion === null) setKnownVersion(data.version)
  const changedBy = data ? detectForeignChange(knownVersion, data, viewerId)?.by ?? null : null

  const save = (patch: OrgSettingsPatch, current: OrgSettings) => {
    setKnownVersion(current.version)
    update.mutate({ patch, version: current.version })
  }

  if (!isAdmin) return null

  return (
    <SettingsPageShell title={<AdminTitle />} description="How Library behaves for everyone in the workspace." maxWidth={860}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, marginTop: 14 }}>
        {changedBy && (
          <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', borderRadius: 12, background: 'var(--neutral-100)', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)' }}>
            <span>{MESSAGES.changedBy(changedBy)}. The settings below show what applies now.</span>
            <Button variant="secondary" size="sm" onClick={() => data && setKnownVersion(data.version)}>Dismiss</Button>
          </div>
        )}

        <SettingsSection title="Saving files">
          <SettingsCard>
            {settings.isPending ? (
              <CardLoading />
            ) : !data ? (
              <CardError onRetry={() => void settings.refetch()}>{MESSAGES.listError}</CardError>
            ) : (
              <>
                <SettingRow
                  title="Auto-save default"
                  hint="The starting choice for people who have not picked their own"
                  control={
                    <NativeSelect
                      label="Auto-save default"
                      value={data.defaultAutoSave}
                      disabled={data.forceAutoSaveOff}
                      options={AUTO_SAVE_MODES.map((value) => ({ value, label: AUTO_SAVE_LABELS[value] }))}
                      onChange={(defaultAutoSave) => save({ defaultAutoSave }, data)}
                    />
                  }
                />
                <SettingRow
                  title="Force auto-save off"
                  hint="Files stay in their chat"
                  control={<SettingSwitch label="Force auto-save off" checked={data.forceAutoSaveOff} onChange={(forceAutoSaveOff) => save({ forceAutoSaveOff }, data)} />}
                />
              </>
            )}
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title="Souvenir">
          <SettingsCard>
            {settings.isPending ? (
              <CardLoading rows={1} />
            ) : !data ? (
              <CardError onRetry={() => void settings.refetch()}>{MESSAGES.listError}</CardError>
            ) : (
              <SettingRow
                title="AI reference"
                titleExtra={<InfoTip text="When off, Souvenir stops looking through files on its own for everyone within a minute. Browsing, search and attaching by hand keep working." />}
                hint="Search Library in answers"
                control={<SettingSwitch label="AI reference" checked={data.aiReferenceEnabled} onChange={(aiReferenceEnabled) => save({ aiReferenceEnabled }, data)} />}
              />
            )}
          </SettingsCard>
        </SettingsSection>

        {data && (
          <SettingsSection title="Files">
            <SettingsCard>
              <SettingRow
                title="File size limit"
                control={
                  <NativeSelect
                    label="File size limit"
                    value={String(Math.round(data.maxFileBytes / MB))}
                    options={sizeOptions(data.maxFileBytes)}
                    onChange={(value) => save({ maxFileBytes: Number(value) * MB }, data)}
                  />
                }
              />
              <SettingRow title="File types" control={<SettingValue>{FILE_TYPES_LINE}</SettingValue>} />
            </SettingsCard>
          </SettingsSection>
        )}

        <SettingsSection title="Storage">
          {storage.isPending ? (
            <SettingsCard><CardLoading rows={1} /></SettingsCard>
          ) : storage.data ? (
            <StorageBlock storage={storage.data} tip={storage.data.limitBytes === null ? <InfoTip text="There is no storage limit yet." /> : undefined} />
          ) : (
            <SettingsCard><CardError>Couldn&apos;t load storage.</CardError></SettingsCard>
          )}
        </SettingsSection>

        {/* Wording is a placeholder until Legal approves the final text (open question OQ-12). */}
        <QuietLine>Library content is not used to train models. It is encrypted in transit and at rest, and each workspace&apos;s search index is kept separate.</QuietLine>
      </div>
    </SettingsPageShell>
  )
}

