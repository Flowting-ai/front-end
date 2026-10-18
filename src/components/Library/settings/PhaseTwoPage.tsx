import React from 'react'
import { SettingsPageShell } from '@/components/SettingsPageShell'
import { PhaseBadge, PhasePlaceholder } from './SettingsParts'

/** A static Admin page that is promised for phase 2: the title with its "Phase 2" badge and one line in a dashed box (prototype PhaseTwo). */
export function PhaseTwoPage({ title, text }: { title: string; text: string }) {
  return (
    <SettingsPageShell
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>{title}<PhaseBadge /></span>}
      description=""
      maxWidth={860}
    >
      <div style={{ marginTop: 14 }}>
        <PhasePlaceholder>{text}</PhasePlaceholder>
      </div>
    </SettingsPageShell>
  )
}
