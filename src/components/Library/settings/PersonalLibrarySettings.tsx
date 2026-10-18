'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/Skeleton'
import { SettingsPageShell } from '@/components/SettingsPageShell'
import { trackLibrary } from '@/lib/library/analytics'
import { MESSAGES } from '@/lib/library/messages'
import { useUpdatePrefs } from '@/lib/library/mutations'
import { useLibraryPrefs, useStorage } from '@/lib/library/queries'
import { AUTO_SAVE_MODES, type AutoSave } from '@/lib/library/schemas'
import { InfoTip } from '../InfoTip'
import { NativeSelect, QuietLine, SettingRow, SettingSwitch, SettingsCard, SettingsSection, StorageBlock } from './SettingsParts'

export const AUTO_SAVE_LABELS: Record<AutoSave, string> = { always: 'Always', ask: 'Ask each time', never: 'Never' }
const AUTO_SAVE_OPTIONS = AUTO_SAVE_MODES.map((value) => ({ value, label: AUTO_SAVE_LABELS[value] }))

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

/**
 * Settings > Library for one person, laid out like the prototype: Chats (save files from chats, search my
 * Library in chats), Storage, then one quiet line.
 */
export function PersonalLibrarySettings() {
  const prefs = useLibraryPrefs()
  const storage = useStorage()
  const update = useUpdatePrefs()
  // The "an Admin changed Library settings" notice lives on the Library page (prototype library.tsx), not here.
  const data = prefs.data

  return (
    <SettingsPageShell title="Library" description="Where your files are saved, and how Souvenir may use them." maxWidth={860}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, marginTop: 14 }}>
        <SettingsSection title="Chats">
          <SettingsCard>
            {prefs.isPending ? (
              <CardLoading />
            ) : !data ? (
              <div role="alert" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-600)' }}>{MESSAGES.listError}</span>
                <Button variant="secondary" size="sm" onClick={() => void prefs.refetch()}>{MESSAGES.retry}</Button>
              </div>
            ) : (
              <>
                <SettingRow
                  title="Save files from chats"
                  hint={!data.forcedOff && data.autoSave === null ? 'Using your workspace’s default' : undefined}
                  why={data.forcedOff ? MESSAGES.adminTurnedAutoSaveOff : undefined}
                  control={
                    <NativeSelect
                      label="Save files from chats"
                      value={data.forcedOff ? 'never' : (data.autoSave ?? data.effectiveAutoSave)}
                      disabled={data.forcedOff || update.isPending}
                      options={AUTO_SAVE_OPTIONS}
                      onChange={(autoSave) => update.mutate({ autoSave }, { onSuccess: () => trackLibrary('autosave_changed', { value: autoSave }) })}
                    />
                  }
                />
                <SettingRow
                  title="Search my Library in chats"
                  titleExtra={<InfoTip text="Souvenir can look through your files on its own to answer you. Files you attach by hand always work." />}
                  why={!data.aiReferenceAllowed ? MESSAGES.adminTurnedOff : undefined}
                  control={
                    <SettingSwitch
                      label="Search my Library in chats"
                      checked={data.aiReferenceEnabled && data.aiReferenceAllowed}
                      disabled={!data.aiReferenceAllowed || update.isPending}
                      onChange={(aiReferenceEnabled) => update.mutate({ aiReferenceEnabled })}
                    />
                  }
                />
              </>
            )}
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title="Storage">
          {storage.isPending ? (
            <SettingsCard><CardLoading /></SettingsCard>
          ) : storage.data ? (
            <StorageBlock storage={storage.data} tip={storage.data.limitBytes === null ? <InfoTip text="There is no storage limit yet." /> : undefined} />
          ) : (
            <SettingsCard>
              <div role="alert" style={{ padding: 16, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-600)' }}>Couldn&apos;t load storage.</div>
            </SettingsCard>
          )}
        </SettingsSection>

        <QuietLine>Avoid uploading customers&apos; personal data unless your workspace allows it.</QuietLine>
      </div>
    </SettingsPageShell>
  )
}
