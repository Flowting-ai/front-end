'use client'

import React from 'react'
import { useOrgIdentity } from '@/context/org-context'
import { SHOW_DANGER_ZONE } from './_components/GeneralParts'
import { GeneralPageSkeleton } from './_components/GeneralSkeleton'
import { AllowedDomainsCard, WorkspaceDefaultsCard } from './_components/HiddenSettingsCards'
import { OrgDangerZoneCard } from './_components/OrgDangerZoneCard'
import { OrgInstructionsCard } from './_components/OrgInstructionsCard'
import { WorkspaceIdentityCard } from './_components/WorkspaceIdentityCard'
import { useOrgSettings } from './_components/use-org-settings'
import { useWorkspaceIdentity } from './_components/use-workspace-identity'

// Switched off until the product turns them on (both are wired to the org settings API).
const SHOW_ALLOWED_DOMAINS = false
const SHOW_WORKSPACE_DEFAULTS = false

const scrollStyle: React.CSSProperties = { flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 64, paddingBottom: 48 }

/** Workspace settings: identity (name, logo, link), the org AI instructions, and hidden cards. Parts in ./_components. */
export default function OrgGeneralPage() {
  const { orgId, caps } = useOrgIdentity()
  const identity = useWorkspaceIdentity(orgId)
  const settings = useOrgSettings(orgId)

  if (identity.identityLoading || settings.settingsLoading) {
    return <div className="kaya-scrollbar" style={scrollStyle}><GeneralPageSkeleton /></div>
  }

  return (
    <div className="kaya-scrollbar" style={scrollStyle}>
      {/* Horizontal padding is here, not on the scroller, so the scrollbar stays flush with the edge. */}
      <div style={{ width: '100%', maxWidth: 908, padding: '0 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* ── Page header ── */}
        <div style={{ paddingLeft: 4, marginBottom: 4 }}>
          <h1 style={{
            fontFamily:   'var(--font-title)',
            fontWeight:   400,
            fontSize:     24,
            lineHeight:   '32px',
            color:        'var(--neutral-900)',
            margin:       0,
          }}>
            General
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-500)',
            margin:     0,
          }}>
            Your workspace&apos;s name, logo and link, and the instructions every AI answer follows.
          </p>
        </div>

        <WorkspaceIdentityCard identity={identity} />
        <OrgInstructionsCard settings={settings} />
        {SHOW_ALLOWED_DOMAINS && <AllowedDomainsCard settings={settings} />}
        {SHOW_WORKSPACE_DEFAULTS && <WorkspaceDefaultsCard settings={settings} />}
        {/* Deleting the workspace is org admin only. */}
        {SHOW_DANGER_ZONE && <OrgDangerZoneCard orgId={orgId} workspaceName={identity.workspaceName} canDeleteOrg={caps.canManageOrg} />}
      </div>
    </div>
  )
}
