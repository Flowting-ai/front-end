'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowDownOneIcon, TickTwoIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { Dropdown, DropdownFloat } from '@/components/Dropdown'
import { DropdownMenuItem } from '@/components/DropdownMenuItem'
import { useOrg } from '@/context/org-context'
import { useAuth } from '@/context/auth-context'
import { getOrg, updateOrg, getOrgSettings, updateOrgSettings, deleteOrg, transferOrgOwnership, listMembers } from '@/lib/api/organization'
import type { OrgMember } from '@/types/teams'
import { listSlackChannels, setSlackChannelMapping } from '@/lib/api/slack'
import type { SlackChannel } from '@/lib/api/slack'

// ── Text input ────────────────────────────────────────────────────────────────

function TextInput({
  value,
  onChange,
  placeholder,
  readOnly,
  style,
}: {
  value:        string
  onChange?:    (v: string) => void
  placeholder?: string
  readOnly?:    boolean
  style?:       React.CSSProperties
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      style={{
        height:          36,
        backgroundColor: readOnly ? 'var(--neutral-50)' : 'white',
        borderRadius:    10,
        boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
        border:          'none',
        padding:         '7px 10px',
        fontFamily:      'var(--font-body)',
        fontWeight:      400,
        fontSize:        14,
        lineHeight:      '22px',
        color:           readOnly ? 'var(--neutral-400)' : 'var(--neutral-900)',
        boxSizing:       'border-box',
        outline:         'none',
        ...style,
      }}
    />
  )
}

// ── Copy icon ─────────────────────────────────────────────────────────────────

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5.5" y="5.5" width="7" height="8" rx="1.5" stroke="var(--neutral-400)" strokeWidth="1.2" />
      <path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" stroke="var(--neutral-400)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

// ── Card shell ────────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      border:       '1px solid var(--neutral-200)',
      borderRadius: 16,
      boxShadow:    '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
      overflow:     'hidden',
    }}>
      {children}
    </div>
  )
}

function CardHeader({
  title,
  subtitle,
  badge,
}: {
  title:     string
  subtitle?: string
  badge?:    React.ReactNode
}) {
  return (
    <div style={{
      borderBottom: '1px solid var(--neutral-100)',
      padding:      '12px 24px 24px',
      display:      'flex',
      alignItems:   'flex-start',
      gap:          12,
    }}>
      <div style={{ flex: '1 0 0', minWidth: 0 }}>
        <p style={{
          fontFamily:   'var(--font-body)',
          fontWeight:   500,
          fontSize:     16,
          lineHeight:   '22px',
          color:        'var(--neutral-900)',
          margin:       '0 0 6px',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {title}
        </p>
        {subtitle && (
          <p style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   400,
            fontSize:     14,
            lineHeight:   '22px',
            color:        'var(--neutral-500)',
            margin:       0,
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {badge}
    </div>
  )
}

// ── Field row ─────────────────────────────────────────────────────────────────

function FieldRow({
  label,
  helper,
  children,
}: {
  label:    string
  helper?:  string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        fontSize:   14,
        lineHeight: '22px',
        color:      'var(--neutral-900)',
        margin:     0,
      }}>
        {label}
      </p>
      {children}
      {helper && (
        <p style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
          fontSize: 12,
          lineHeight: '16px',
          color:      'var(--neutral-400)',
          margin:     0,
        }}>
          {helper}
        </p>
      )}
    </div>
  )
}

// ── Visibility select ─────────────────────────────────────────────────────────

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private by default' },
  { value: 'team',    label: 'Team only'           },
]

function VisibilitySelect({
  value,
  onChange,
  disabled,
}: {
  value:     string
  onChange:  (v: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const label = VISIBILITY_OPTIONS.find(o => o.value === value)?.label ?? value

  return (
    <DropdownFloat
      open={open}
      onOpenChange={v => { if (!disabled) setOpen(v) }}
      placement="bottom-end"
      offset={4}
      trigger={
        <button
          type="button"
          disabled={disabled}
          style={{
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'space-between',
            gap:             8,
            width:           327,
            height:          36,
            padding:         '0 10px',
            borderRadius:    10,
            border:          'none',
            backgroundColor: 'white',
            boxShadow:       '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)',
            cursor:          disabled ? 'not-allowed' : 'pointer',
            opacity:         disabled ? 0.6 : 1,
            outline:         'none',
            flexShrink:      0,
          }}
        >
          <span style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-700)',
          }}>
            {label}
          </span>
          <ArrowDownOneIcon size={12} color="var(--neutral-400)" />
        </button>
      }
    >
      <Dropdown style={{ width: 327 }}>
        {VISIBILITY_OPTIONS.map(o => (
          <DropdownMenuItem
            key={o.value}
            fluid
            label={o.label}
            selected={o.value === value}
            icon={o.value === value ? <TickTwoIcon size={14} /> : undefined}
            onClick={() => { onChange(o.value); setOpen(false) }}
          />
        ))}
      </Dropdown>
    </DropdownFloat>
  )
}

// ── Image compression ─────────────────────────────────────────────────────────

function compressImage(file: File, maxW: number, maxH: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        const ratio = Math.min(maxW / width, maxH / height, 1)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonBlock({
  width = '100%',
  height,
  radius = 8,
}: {
  width?: number | string
  height: number
  radius?: number
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius:   radius,
        flexShrink:     0,
        background:     'linear-gradient(90deg, var(--neutral-100) 25%, var(--neutral-50) 50%, var(--neutral-100) 75%)',
        backgroundSize: '200% 100%',
        animation:      'generalSkeletonShimmer 1.4s ease-in-out infinite',
      }}
    />
  )
}

function SkeletonCard({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <div style={{
      border:       `1px solid ${danger ? 'var(--red-400, #f87171)' : 'var(--neutral-200)'}`,
      borderRadius: 16,
      boxShadow:    '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
      overflow:     'hidden',
    }}>
      {children}
    </div>
  )
}

function SkeletonRow({ children, border = true }: { children: React.ReactNode; border?: boolean }) {
  return (
    <div style={{
      padding:      '12px 24px',
      borderBottom: border ? '1px solid var(--neutral-100)' : undefined,
      display:      'flex',
      alignItems:   'center',
      gap:          12,
    }}>
      {children}
    </div>
  )
}

function GeneralPageSkeleton() {
  return (
    <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <style>{`@keyframes generalSkeletonShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* Page header */}
      <div style={{ paddingLeft: 4, marginBottom: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkeletonBlock width={90}  height={28} radius={8} />
        <SkeletonBlock width={360} height={14} radius={5} />
      </div>

      {/* Workspace Identity */}
      <SkeletonCard>
        {/* Card header */}
        <div style={{ borderBottom: '1px solid var(--neutral-100)', padding: '12px 24px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonBlock width={170} height={16} radius={5} />
          <SkeletonBlock width={260} height={13} radius={4} />
        </div>
        {/* Avatar */}
        <SkeletonRow>
          <SkeletonBlock width={65} height={65} radius={33} />
          <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonBlock width={120} height={14} radius={5} />
            <SkeletonBlock width={220} height={12} radius={4} />
          </div>
          <SkeletonBlock width={100} height={32} radius={8} />
        </SkeletonRow>
        {/* Name */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonBlock width={120} height={14} radius={5} />
          <SkeletonBlock width={521} height={36} radius={10} />
        </div>
        {/* Slug + ID */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', gap: 16 }}>
          <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonBlock width={140} height={14} radius={5} />
            <SkeletonBlock height={36} radius={10} />
            <SkeletonBlock width={180} height={12} radius={4} />
          </div>
          <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonBlock width={110} height={14} radius={5} />
            <SkeletonBlock height={36} radius={10} />
          </div>
        </div>
        {/* Save */}
        <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'flex-end' }}>
          <SkeletonBlock width={108} height={32} radius={8} />
        </div>
      </SkeletonCard>

      {/* AI Instructions */}
      <SkeletonCard>
        <div style={{ borderBottom: '1px solid var(--neutral-100)', padding: '12px 24px 24px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkeletonBlock width={260} height={16} radius={5} />
            <SkeletonBlock height={14} radius={4} />
            <SkeletonBlock width='60%' height={14} radius={4} />
          </div>
          <SkeletonBlock width={116} height={22} radius={6} />
        </div>
        <div style={{ padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SkeletonBlock height={96} radius={10} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <SkeletonBlock width={130} height={32} radius={8} />
          </div>
        </div>
      </SkeletonCard>

      {/* Allowed email domains */}
      <SkeletonCard>
        <div style={{ borderBottom: '1px solid var(--neutral-100)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <SkeletonBlock width={190} height={16} radius={5} />
          <div style={{ flex: '1 0 0' }} />
          <SkeletonBlock width={96} height={32} radius={8} />
        </div>
        <div style={{ padding: '12px 24px' }}>
          <SkeletonBlock width={210} height={14} radius={5} />
        </div>
      </SkeletonCard>

      {/* Workspace defaults */}
      <SkeletonCard>
        <div style={{ borderBottom: '1px solid var(--neutral-100)', padding: '12px 24px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonBlock width={180} height={16} radius={5} />
          <SkeletonBlock width='80%' height={13} radius={4} />
        </div>
        <SkeletonRow>
          <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonBlock width={160} height={14} radius={5} />
            <SkeletonBlock width={320} height={12} radius={4} />
          </div>
          <SkeletonBlock width={327} height={36} radius={10} />
        </SkeletonRow>
        <SkeletonRow>
          <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonBlock width={160} height={14} radius={5} />
            <SkeletonBlock width={240} height={12} radius={4} />
          </div>
          <SkeletonBlock width={327} height={36} radius={10} />
        </SkeletonRow>
        <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--neutral-100)' }}>
          <SkeletonBlock width={108} height={32} radius={8} />
        </div>
      </SkeletonCard>

      {/* Danger Zone */}
      <SkeletonCard danger>
        <div style={{ borderBottom: '1px solid var(--neutral-100)', padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonBlock width={110} height={16} radius={5} />
          <SkeletonBlock width={310} height={13} radius={4} />
        </div>
        <SkeletonRow>
          <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonBlock width={150} height={14} radius={5} />
            <SkeletonBlock width={280} height={13} radius={4} />
          </div>
          <SkeletonBlock width={80} height={32} radius={8} />
        </SkeletonRow>
        <div style={{ padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: undefined }}>
          <SkeletonBlock width={160} height={14} radius={5} />
          <SkeletonBlock width={250} height={13} radius={4} />
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <SkeletonBlock width={280} height={36} radius={10} />
            <SkeletonBlock width={150} height={36} radius={8} />
          </div>
        </div>
      </SkeletonCard>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrgGeneralPage() {
  const { orgId, caps } = useOrg()
  // Deleting the organization (the workspace/space) is org admin+ only.
  const canDeleteOrg = caps.canManageOrg
  const { user } = useAuth()
  const router = useRouter()

  // Identity fields
  const [workspaceName,  setWorkspaceName]  = useState('')
  const [slugValue,      setSlugValue]      = useState('')
  const [orgIdValue,     setOrgIdValue]     = useState('')
  const [logoUrl,        setLogoUrl]        = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [identityLoading, setIdentityLoading] = useState(true)
  const [identitySaving,  setIdentitySaving]  = useState(false)

  // Danger zone
  const [deleteOrgInput, setDeleteOrgInput] = useState('')
  const [deletingOrg,    setDeletingOrg]    = useState(false)
  const [transferOpen,   setTransferOpen]   = useState(false)
  const [orgMembers,     setOrgMembers]     = useState<OrgMember[]>([])
  const [transferTarget, setTransferTarget] = useState('')
  const [transferring,   setTransferring]   = useState(false)

  // Settings fields
  const [aiInstructions,           setAiInstructions]           = useState('')
  const [allowedDomains,           setAllowedDomains]           = useState<string[]>([])
  const [defaultChatVisibility,    setDefaultChatVisibility]    = useState('private')
  const [defaultPersonaVisibility, setDefaultPersonaVisibility] = useState('private')
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsSaving,  setSettingsSaving]  = useState(false)
  const [showAddDomain,   setShowAddDomain]   = useState(false)
  const [addDomainInput,  setAddDomainInput]  = useState('')

  // Slack channel mapping
  const [slackChannels,     setSlackChannels]     = useState<SlackChannel[]>([])
  const [slackTeamName,     setSlackTeamName]     = useState<string | null>(null)
  const [slackLoading,      setSlackLoading]      = useState(false)
  const [slackMappingSlug,  setSlackMappingSlug]  = useState<string | null>(null)
  const [slackProjectInput, setSlackProjectInput] = useState('')
  const [slackSaving,       setSlackSaving]       = useState(false)

  // Load org identity
  useEffect(() => {
    if (!orgId) { setIdentityLoading(false); return }
    setIdentityLoading(true)
    getOrg(orgId)
      .then(data => {
        setWorkspaceName(data.name)
        setSlugValue(data.slug)
        setOrgIdValue(data.id)
        setLogoUrl(data.logoUrl)
      })
      .catch(console.error)
      .finally(() => setIdentityLoading(false))
  }, [orgId])

  // Load org settings
  useEffect(() => {
    if (!orgId) { setSettingsLoading(false); return }
    setSettingsLoading(true)
    getOrgSettings(orgId)
      .then(s => {
        setAiInstructions(s.orgInstructions ?? '')
        setAllowedDomains(s.allowedEmailDomains ?? [])
        setDefaultChatVisibility(s.defaultChatVisibility ?? 'private')
        setDefaultPersonaVisibility(s.defaultPersonaVisibility ?? 'private')
      })
      .catch(console.error)
      .finally(() => setSettingsLoading(false))
  }, [orgId])

  // Load Slack channels (only if Slack is connected — 404 is silent)
  useEffect(() => {
    if (!orgId) return
    setSlackLoading(true)
    listSlackChannels(orgId)
      .then(res => { setSlackTeamName(res.teamName); setSlackChannels(res.channels) })
      .catch(() => { /* not connected — no-op */ })
      .finally(() => setSlackLoading(false))
  }, [orgId])

  const handleLogoUpload = useCallback(async (file: File) => {
    if (!orgId || !file.type.startsWith('image/')) return
    setAvatarUploading(true)
    try {
      // Downscale to 512x512 client-side, then upload the raw bytes. The backend
      // stores them in S3 and returns the logo URL.
      let upload: File = file
      try {
        const dataUrl = await compressImage(file, 512, 512, 0.85)
        const blob = await (await fetch(dataUrl)).blob()
        upload = new File([blob], 'logo.jpg', { type: blob.type || 'image/jpeg' })
      } catch {
        // compression unsupported in this browser — fall back to the original file
      }
      const { logoUrl } = await updateOrg(orgId, { logoFile: upload })
      setLogoUrl(logoUrl)
      toast.success('Logo updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update logo')
    } finally {
      setAvatarUploading(false)
    }
  }, [orgId])

  const handleSetSlackMapping = async (channelId: string, projectId: string | null) => {
    if (!orgId) return
    setSlackSaving(true)
    try {
      const updated = await setSlackChannelMapping(orgId, channelId, projectId || null)
      setSlackChannels(prev => prev.map(c => c.channelId === channelId ? updated : c))
      setSlackMappingSlug(null)
      toast.success('Channel mapping saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save mapping')
    } finally {
      setSlackSaving(false)
    }
  }

  const handleDeleteOrg = async () => {
    if (!orgId || deleteOrgInput !== workspaceName) return
    if (!canDeleteOrg) { toast.error('Only an admin or owner can delete this organization.'); return }
    setDeletingOrg(true)
    try {
      await deleteOrg(orgId, deleteOrgInput)
      toast.success('Organization deleted')
      router.push('/chat')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete organization')
    } finally {
      setDeletingOrg(false)
    }
  }

  const handleOpenTransfer = () => {
    if (!orgId) return
    setTransferOpen(true)
    listMembers(orgId)
      .then(all => setOrgMembers(all.filter(m => m.email !== user?.email && m.orgRole !== 'owner')))
      .catch(console.error)
  }

  const handleTransferOwnership = async () => {
    if (!orgId || !transferTarget) return
    setTransferring(true)
    try {
      await transferOrgOwnership(orgId, transferTarget)
      toast.success('Ownership transferred')
      setTransferOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to transfer ownership')
    } finally {
      setTransferring(false)
    }
  }

  const handleSaveIdentity = async () => {
    if (!orgId) return
    setIdentitySaving(true)
    try {
      const updated = await updateOrg(orgId, { name: workspaceName, slug: slugValue })
      setWorkspaceName(updated.name)
      setSlugValue(updated.slug)
      toast.success('Workspace identity saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save identity')
    } finally {
      setIdentitySaving(false)
    }
  }

  const handleClearInstructions = async () => {
    if (!orgId) return
    setSettingsSaving(true)
    try {
      const updated = await updateOrgSettings(orgId, { orgInstructions: '' })
      setAiInstructions(updated.orgInstructions ?? '')
      toast.success('Instructions cleared')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clear instructions')
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleSaveInstructions = async () => {
    if (!orgId) return
    setSettingsSaving(true)
    const intended = aiInstructions || ''
    try {
      // The PATCH echoes back the persisted settings. Trust that — not the request —
      // so we never show "saved" for a write the server silently dropped.
      // Send "" (not null) to clear: the backend strips null fields from partial
      // updates, so null never clears the column — an empty string does.
      const updated = await updateOrgSettings(orgId, { orgInstructions: aiInstructions })
      const persisted = updated.orgInstructions ?? ''
      setAiInstructions(persisted)
      if (persisted === intended) {
        toast.success('Instructions saved')
      } else {
        toast.error('The server did not save your instructions. Please try again or report this.')
        console.error('[org/general] instructions not persisted', { sent: intended, returned: persisted })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save instructions')
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleSaveDefaults = async () => {
    if (!orgId) return
    setSettingsSaving(true)
    try {
      await updateOrgSettings(orgId, {
        defaultChatVisibility,
        defaultPersonaVisibility,
      })
      toast.success('Workspace defaults saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save defaults')
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleSaveDomains = async () => {
    if (!orgId) return
    setSettingsSaving(true)
    try {
      await updateOrgSettings(orgId, { allowedEmailDomains: allowedDomains.filter(Boolean) })
      toast.success('Allowed domains saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save domains')
    } finally {
      setSettingsSaving(false)
    }
  }

  const copyOrgId = () => {
    void navigator.clipboard.writeText(orgIdValue)
    toast.success('Copied to clipboard')
  }

  if (identityLoading || settingsLoading) {
    return (
      <div
        className="kaya-scrollbar"
        style={{
          flex:           '1 0 0',
          minHeight:      0,
          overflowY:      'auto',
          overflowX:      'hidden',
          display:        'flex',
          alignItems:     'flex-start',
          justifyContent: 'center',
          padding:        '64px 24px 48px',
        }}
      >
        <GeneralPageSkeleton />
      </div>
    )
  }

  return (
    <div
      className="kaya-scrollbar"
      style={{
        flex:           '1 0 0',
        minHeight:      0,
        overflowY:      'auto',
        overflowX:      'hidden',
        display:        'flex',
        alignItems:     'flex-start',
        justifyContent: 'center',
        padding:        '64px 24px 48px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 10 }}>

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
            Manage your workspace identity, AI instructions, and default settings.
          </p>
        </div>

        {/* ── Workspace Identity card ── */}
        <Card>
          <CardHeader
            title="Workspace Identity"
            subtitle="Set your workspace name, logo, and URL."
          />

          {/* Avatar row */}
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          12,
            padding:      '12px 24px',
            borderBottom: '1px solid var(--neutral-100)',
          }}>
            <div style={{
              width:           65,
              height:          65,
              borderRadius:    '50%',
              backgroundColor: 'var(--neutral-200)',
              flexShrink:      0,
              overflow:        'hidden',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
            }}>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Workspace logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="32" height="32" rx="16" fill="var(--neutral-300)" />
                  <path d="M16 8a5 5 0 1 1 0 10A5 5 0 0 1 16 8zM8 26c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="var(--neutral-500)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
            </div>
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-900)',
                margin:     0,
              }}>
                Workspace logo
              </p>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 12,
                lineHeight: '16px',
                color:      'var(--neutral-400)',
                margin:     0,
              }}>
                PNG, JPG or GIF. Recommended 512×512px.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={avatarUploading}
              onClick={() => logoInputRef.current?.click()}
            >
              {avatarUploading ? 'Uploading…' : logoUrl ? 'Change Logo' : 'Upload Logo'}
            </Button>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = '' }}
            />
          </div>

          {/* Workspace name */}
          <div style={{
            padding:      '12px 24px',
            borderBottom: '1px solid var(--neutral-100)',
            opacity:      identityLoading ? 0.6 : 1,
          }}>
            <FieldRow label="Workspace name">
              <TextInput
                value={workspaceName}
                onChange={setWorkspaceName}
                style={{ width: 521 }}
              />
            </FieldRow>
          </div>

          {/* Slug + ID side by side */}
          <div style={{
            padding:      '12px 24px',
            borderBottom: '1px solid var(--neutral-100)',
            display:      'flex',
            gap:          16,
            opacity:      identityLoading ? 0.6 : 1,
          }}>
            {/* commenting out worksspace slug to make it dynamic with url in the future. */}
            {/* <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <FieldRow
                label="Workspace URL slug"
                helper={slugValue ? `souvenir.ai/workspace/${slugValue}` : undefined}
              >
                <TextInput
                  value={slugValue}
                  onChange={setSlugValue}
                />
              </FieldRow>
            </div> */}
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <FieldRow label="Workspace ID" helper="Read-only identifier">
                <div style={{ position: 'relative' }}>
                  <TextInput
                    value={orgIdValue}
                    readOnly
                    style={{ width: '100%', paddingRight: 32 }}
                  />
                  <button
                    onClick={copyOrgId}
                    style={{
                      position:        'absolute',
                      right:           8,
                      top:             '50%',
                      transform:       'translateY(-50%)',
                      background:      'none',
                      border:          'none',
                      cursor:          'pointer',
                      padding:         0,
                      display:         'flex',
                      alignItems:      'center',
                      justifyContent:  'center',
                    }}
                  >
                    <CopyIcon />
                  </button>
                </div>
              </FieldRow>
            </div>
          </div>

          {/* Save changes */}
          <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveIdentity}
              disabled={identitySaving || identityLoading}
            >
              {identitySaving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </Card>

        {/* ── Organization-level AI instructions card ── */}
        <Card>
          <CardHeader
            title="Organization-level AI instructions"
            subtitle="These instructions apply to all AI interactions across your workspace. Members can add personal instructions that stack on top of these."
            badge={
              <div style={{
                display:         'inline-flex',
                alignItems:      'center',
                justifyContent:  'center',
                padding:         '2px 6px',
                borderRadius:    6,
                backgroundColor: 'var(--yellow-100)',
                boxShadow:       '0px 1px 1.5px 0px rgba(17,25,1,0.1), 0px 0px 0px 1px rgba(143,116,39,0.5)',
                flexShrink:      0,
              }}>
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  fontSize: 12,
                  lineHeight: '16px',
                  color:      'var(--yellow-700)',
                  whiteSpace: 'nowrap',
                }}>
                  Overrides personal
                </span>
              </div>
            }
          />

          <div style={{ padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 10, opacity: settingsLoading ? 0.6 : 1 }}>
            <textarea
              value={aiInstructions}
              onChange={e => setAiInstructions(e.target.value.slice(0, 3000))}
              placeholder={`e.g. "Always cite sources", "Keep responses under 200 words", "Use bullet points for lists"`}
              style={{
                width:           '100%',
                height:          96,
                resize:          'none',
                backgroundColor: 'white',
                borderRadius:    10,
                boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
                border:          'none',
                padding:         '7px 10px',
                fontFamily:      'var(--font-body)',
                fontWeight:      400,
                fontSize:        14,
                lineHeight:      '22px',
                color:           'var(--neutral-600)',
                boxSizing:       'border-box',
                outline:         'none',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 12,
                lineHeight: '16px',
                color:      'var(--neutral-400)',
                margin:     0,
              }}>
                Changes take up to 1 hour to propagate across active sessions.
              </p>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-500)',
                margin:     0,
                flexShrink: 0,
              }}>
                {aiInstructions.length}/3000
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleClearInstructions}
                disabled={!aiInstructions || settingsSaving || settingsLoading}
              >
                Clear
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveInstructions}
                disabled={settingsSaving || settingsLoading}
              >
                {settingsSaving ? 'Saving…' : 'Save instructions'}
              </Button>
            </div>
          </div>
        </Card>

        {/* ── Allowed email domains card ── */}
        <Card>
          <div style={{
            borderBottom: '1px solid var(--neutral-100)',
            padding:      '12px 24px',
            display:      'flex',
            alignItems:   'center',
            gap:          12,
          }}>
            <p style={{
              flex:       '1 0 0',
              minWidth:   0,
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize:   16,
              lineHeight: '22px',
              color:      'var(--neutral-900)',
              margin:     0,
            }}>
              Allowed email domains
            </p>
            <Button variant="secondary" size="sm" onClick={() => { setShowAddDomain(true); setAddDomainInput('') }}>+ Add domain</Button>
          </div>

          <div style={{ padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 8, opacity: settingsLoading ? 0.6 : 1 }}>
            {allowedDomains.length === 0 && !showAddDomain ? (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                No allowed domains configured.
              </p>
            ) : allowedDomains.map(domain => (
              <div key={domain} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ flex: '1 0 0', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-900)' }}>
                  {domain}
                </span>
                <button
                  onClick={() => setAllowedDomains(ds => ds.filter(d => d !== domain))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red-500)', fontFamily: 'var(--font-body)', fontSize: 13 }}
                >
                  Remove
                </button>
              </div>
            ))}
            {showAddDomain && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TextInput
                  value={addDomainInput}
                  onChange={setAddDomainInput}
                  placeholder="example.com"
                  style={{ flex: '1 0 0' }}
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    const domain = addDomainInput.trim().toLowerCase()
                    if (!domain) return
                    if (!allowedDomains.includes(domain)) {
                      setAllowedDomains(ds => [...ds, domain])
                    }
                    setShowAddDomain(false)
                    setAddDomainInput('')
                  }}
                >
                  Add
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { setShowAddDomain(false); setAddDomainInput('') }}
                >
                  Cancel
                </Button>
              </div>
            )}
            {allowedDomains.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveDomains}
                  disabled={settingsSaving}
                >
                  {settingsSaving ? 'Saving…' : 'Save domains'}
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* ── Workspace defaults card (temporarily disabled) ── */}
        {false && (
        <Card>
          <CardHeader
            title="Workspace defaults"
            subtitle="Set default behaviors for new chats and AI interactions in your workspace."
          />

          {/* Default chat visibility */}
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          12,
            padding:      '12px 24px',
            borderBottom: '1px solid var(--neutral-100)',
            opacity:      settingsLoading ? 0.6 : 1,
          }}>
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-900)',
                margin:     0,
              }}>
                Default chat visibility
              </p>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 12,
                lineHeight: '16px',
                color:      'var(--neutral-400)',
                margin:     0,
              }}>
                Controls whether new chats are visible to workspace members by default.
              </p>
            </div>
            <VisibilitySelect
              value={defaultChatVisibility}
              onChange={setDefaultChatVisibility}
              disabled={settingsLoading}
            />
          </div>

          {/* Default agent visibility */}
          <div style={{
            display:    'flex',
            alignItems: 'center',
            gap:        12,
            padding:    '12px 24px',
            opacity:    settingsLoading ? 0.6 : 1,
          }}>
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-900)',
                margin:     0,
              }}>
                Default agent visibility
              </p>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 12,
                lineHeight: '16px',
                color:      'var(--neutral-400)',
                margin:     0,
              }}>
                The default visibility for newly created agents.
              </p>
            </div>
            <VisibilitySelect
              value={defaultPersonaVisibility}
              onChange={setDefaultPersonaVisibility}
              disabled={settingsLoading}
            />
          </div>

          <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--neutral-100)' }}>
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveDefaults}
              disabled={settingsSaving || settingsLoading}
            >
              {settingsSaving ? 'Saving…' : 'Save defaults'}
            </Button>
          </div>
        </Card>
        )}

        {/* ── Slack channel mapping card ── */}
        {(slackLoading || slackChannels.length > 0) && (
          <Card>
            <CardHeader
              title={slackTeamName ? `Slack · ${slackTeamName}` : 'Slack'}
              subtitle="Map Slack channels to projects so messages are routed correctly."
            />
            <div style={{ padding: '6px 24px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {slackLoading && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>Loading channels…</p>
              )}
              {!slackLoading && slackChannels.length === 0 && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>No channels found.</p>
              )}
              {slackChannels.map(ch => (
                <div key={ch.channelId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--neutral-100)' }}>
                  <div style={{ flex: '1 0 0', minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', margin: 0 }}>#{ch.channelName}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-500)', margin: 0 }}>
                      {ch.projectId ? `Mapped to project ${ch.projectId}` : 'No project mapping'}
                    </p>
                  </div>
                  {slackMappingSlug === ch.channelId ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="text"
                        value={slackProjectInput}
                        onChange={e => setSlackProjectInput(e.target.value)}
                        placeholder="Project ID (or blank to clear)"
                        style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '4px 8px', border: '1px solid var(--neutral-200)', borderRadius: 6, width: 220 }}
                      />
                      <Button variant="default" size="sm" disabled={slackSaving} onClick={() => handleSetSlackMapping(ch.channelId, slackProjectInput || null)}>
                        {slackSaving ? 'Saving…' : 'Save'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setSlackMappingSlug(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setSlackMappingSlug(ch.channelId); setSlackProjectInput(ch.projectId ?? '') }}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--neutral-200)', background: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-600)', fontWeight: 500, flexShrink: 0 }}
                    >
                      {ch.projectId ? 'Change mapping' : 'Map to project'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── Danger Zone card ── */}
        <div style={{
          border:       '1px solid var(--red-400, #f87171)',
          borderRadius: 16,
          boxShadow:    '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
          overflow:     'hidden',
        }}>
          <div style={{ borderBottom: '1px solid var(--neutral-100)', padding: '12px 24px 12px' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--red-500, #ef4444)', margin: 0 }}>
              Danger Zone
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
              Actions here are permanent and cannot be undone.
            </p>
          </div>

          {/* Delete organization — org admin+ only; hidden from members. */}
          {canDeleteOrg && (
          <div style={{ padding: '12px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24 }}>
              <div style={{ flex: '1 0 0', minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                  Delete organization
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: '0 0 8px' }}>
                  Permanently delete this organization and all its data.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <TextInput
                    value={deleteOrgInput}
                    onChange={setDeleteOrgInput}
                    placeholder={`Type "${workspaceName}" to confirm`}
                    style={{ width: 280 }}
                  />
                  <button
                    type="button"
                    disabled={deleteOrgInput !== workspaceName || deletingOrg}
                    onClick={handleDeleteOrg}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      padding: '5px 12px', borderRadius: 8, border: 'none',
                      cursor: deleteOrgInput !== workspaceName ? 'default' : 'pointer',
                      backgroundColor: 'white', opacity: deleteOrgInput !== workspaceName ? 0.5 : 1,
                      boxShadow: '0px 1px 1.5px 0px rgba(24,2,2,0.05), 0px 1px 2px 0px rgba(24,2,2,0.15), 0px 0px 0px 1px var(--red-200, #fecaca)',
                      fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px',
                      color: 'var(--red-700, #b91c1c)',
                    }}
                  >
                    {deletingOrg ? 'Deleting…' : 'Delete organization'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>

      </div>
    </div>
  )
}
