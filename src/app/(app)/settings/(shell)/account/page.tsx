'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/context/auth-context'
import { InputField } from '@/components/InputField'
import { Dropdown } from '@/components/Dropdown'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { updateUser, updateOnboarding, roleDisplayLabel, toneDisplayLabel } from '@/lib/api/user'
import { useSettingsGuard } from '@/context/settings-guard-context'
import { toast } from 'sonner'
import { AccountSkeleton } from '../SettingsSkeleton'

// ── Settings v1.5 — Account page ─────────────────────────────────────────────
// Figma: https://www.figma.com/design/EirgiIxJWDEeUNZnKwr3f8/Settings-v1.5?node-id=18-27466

// Style dropdown — the only 3 backend-accepted display tones (TONE_API_MAP in
// lib/api/user.ts). Figma shows this as a constrained dropdown, not the old
// free-text "AI Tone" input.
const TONE_OPTIONS = ['Direct', 'Balanced', 'Warm'] as const

// Default Model dropdown — the 3 Souvenir Muse tiers (MODEL_TIER_RANK in
// lib/ai-models.ts). PENDING CONFIRMATION: there is no backend field for a
// per-user "default model" preference anywhere in this codebase — every
// existing model-tier default is computed (pickDefaultModel() always starts
// new chats on "Standard"), not stored per-user. Rather than fabricate a save
// call against a contract that doesn't exist, this control persists to
// localStorage only (client-side, this browser only) and does NOT feed back
// into pickDefaultModel() or any chat-creation path — flagged here rather
// than silently wiring a real-looking control to nothing, or silently
// changing unrelated chat-creation behavior beyond what was asked.
const MODEL_TIER_OPTIONS = ['Advanced', 'Standard', 'Basic'] as const
const DEFAULT_MODEL_TIER_STORAGE_KEY = 'souvenir:settings:default-model-tier'

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M5 8l5 5 5-5" stroke="var(--neutral-400,#9c938b)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Compact pill select — Figma "Button" (18:27528/18:27537) ─────────────────
function PillSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: readonly T[]
  onChange: (value: T) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dropdown.Float open={open} onOpenChange={setOpen} placement="bottom-end" offset={4} trigger={
      <button
        type="button"
        style={{
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          gap:             8,
          width:           100,
          padding:         '5px 8px',
          borderRadius:    8,
          border:          'none',
          backgroundColor: 'var(--neutral-white,#fff)',
          boxShadow:       '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100,#ede1d7)',
          cursor:          'pointer',
          fontFamily:      'var(--font-body)',
          fontWeight:      500,
          fontSize:        14,
          lineHeight:      '22px',
          color:           'var(--neutral-700,#524b47)',
        }}
      >
        {value}
        <ChevronDownIcon />
      </button>
    }>
      <Dropdown>
        {/* Not Dropdown.Section — its item wrapper hardcodes width:100% (fluid)
            or width:217px on every nested div, a percentage/fixed chain that
            left a few px of slack between the widest item and the popover's
            own shrink-to-fit edge. Omitting width entirely here (on both this
            wrapper and each item, via style below) lets the container and
            items resolve through plain flex `align-items: stretch` (the
            default) instead — a single, first-pass-then-stretch computation
            with no percentage-of-indeterminate-ancestor step, so the item's
            right edge lands exactly on the container's own edge. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8 }}>
          {options.map(option => (
            <Dropdown.Item
              key={option}
              label={option}
              selected={option === value}
              onClick={() => { onChange(option); setOpen(false) }}
              style={{ width: 'auto' }}
            />
          ))}
        </div>
      </Dropdown>
    </Dropdown.Float>
  )
}

// ── Table-style settings row — Figma "table/base" rows (18:27521/18:27530) ───
function SettingsRow({
  title,
  subtitle,
  divider,
  children,
}: {
  title: string
  subtitle: string
  divider?: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      justifyContent: 'space-between',
      padding:      '12px 24px',
      borderBottom: divider ? '1px solid var(--neutral-100)' : undefined,
    }}>
      <div>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
          {title}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0 }}>
          {subtitle}
        </p>
      </div>
      {children}
    </div>
  )
}

// Avatars are stored as a small square data-URL in `profile_picture` (the API
// has no file-upload endpoint). Downscale + center-crop before encoding.
const AVATAR_SIZE = 256
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not read that image'))
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = AVATAR_SIZE
        canvas.height = AVATAR_SIZE
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(reader.result as string); return }
        const min = Math.min(img.width, img.height)
        const sx = (img.width - min) / 2
        const sy = (img.height - min) / 2
        ctx.drawImage(img, sx, sy, min, min, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

// ── Section card wrapper ──────────────────────────────────────────────────────

function SettingsCard({
  children,
  danger,
}: {
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <div
      style={{
        border:        `1px solid ${danger ? 'var(--red-400)' : 'var(--neutral-200)'}`,
        borderRadius:  16,
        boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
        display:       'flex',
        flexDirection: 'column',
        overflow:      'hidden',
        paddingTop:    12,
        paddingBottom: 12,
      }}
    >
      {children}
    </div>
  )
}

// ── Divider inside a card ─────────────────────────────────────────────────────

function CardSection({
  children,
  divider,
  padTop = 12,
  padBottom = 24,
}: {
  children: React.ReactNode
  divider?: boolean
  padTop?: number
  padBottom?: number
}) {
  return (
    <div
      style={{
        display:         'flex',
        flexDirection:   'column',
        padding:         `${padTop}px 24px ${padBottom}px`,
        borderBottom:    divider ? '1px solid var(--neutral-100)' : undefined,
      }}
    >
      {children}
    </div>
  )
}

// ── Outer shell — null guard only ─────────────────────────────────────────────

export default function AccountPage() {
  const { user, refreshUser } = useAuth()
  if (!user) return <AccountSkeleton />
  return <AccountPageContent user={user} refreshUser={refreshUser} />
}

// ── Inner content — all hooks live here ──────────────────────────────────────

type AuthUser = NonNullable<ReturnType<typeof useAuth>['user']>

function AccountPageContent({
  user,
  refreshUser,
}: {
  user: AuthUser
  refreshUser: () => Promise<void>
}) {
  // ── Navigation guard ─────────────────────────────────────────────────────
  const { setIsDirty, saveRef } = useSettingsGuard()
  const isDirtyRef = useRef(false)

  // Browser close / refresh
  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBefore)
    return () => {
      window.removeEventListener('beforeunload', onBefore)
      setIsDirty(false)
      saveRef.current = null
    }
  }, [setIsDirty, saveRef])

  // Baselines from the loaded profile — the source of truth for dirty checks.
  const baseFirstName = user.firstName ?? ''
  const baseLastName  = user.lastName ?? ''
  const baseRole      = roleDisplayLabel(user.onboardingRole)
  const baseTone      = toneDisplayLabel(user.onboardingTone)
  const baseAvatar    = user.profilePicture ?? null

  const [firstName,   setFirstName]   = useState(baseFirstName)
  const [lastName,    setLastName]    = useState(baseLastName)
  const [avatar,      setAvatar]      = useState<string | null>(baseAvatar)
  const [isSaving,    setIsSaving]    = useState(false)
  const [avatarHover, setAvatarHover] = useState(false)

  const [tone, setToneState] = useState(baseTone)
  const [tonePending, setTonePending] = useState(false)
  const [modelTier, setModelTier] = useState<typeof MODEL_TIER_OPTIONS[number]>('Standard')
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DEFAULT_MODEL_TIER_STORAGE_KEY)
      if (stored && (MODEL_TIER_OPTIONS as readonly string[]).includes(stored)) {
        setModelTier(stored as typeof MODEL_TIER_OPTIONS[number])
      }
    } catch { /* localStorage unavailable - keep the "Standard" default */ }
  }, [])

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Re-sync local state whenever the profile (re)loads — e.g. after a save the
  // refreshed baseline flows back in and the form is no longer "dirty". Done as
  // a during-render reset (React's recommended pattern) keyed on the baseline,
  // so it doesn't clobber edits while the user is typing.
  const profileKey = `${baseFirstName} ${baseLastName} ${baseAvatar ?? ''}`
  const [syncedKey, setSyncedKey] = useState(profileKey)
  if (profileKey !== syncedKey) {
    setSyncedKey(profileKey)
    setFirstName(baseFirstName)
    setLastName(baseLastName)
    setAvatar(baseAvatar)
  }
  // Tone's own baseline resync — separate from the block above since it isn't
  // part of the dirty-guarded card and shouldn't fight an in-flight selection.
  const [syncedTone, setSyncedTone] = useState(baseTone)
  if (baseTone !== syncedTone) {
    setSyncedTone(baseTone)
    setToneState(baseTone)
  }

  const nameChanged   = firstName.trim() !== baseFirstName.trim() || lastName.trim() !== baseLastName.trim()
  const avatarChanged = (avatar ?? '') !== (baseAvatar ?? '')
  const isDirty = nameChanged || avatarChanged

  // Keep ref in sync for the beforeunload handler (ref writes during render are safe)
  isDirtyRef.current = isDirty

  // Sync dirty flag to the nav guard context via effect — calling setIsDirty during
  // render would update a different component (SettingsGuardProvider), which React forbids.
  useEffect(() => {
    setIsDirty(isDirty)
  }, [isDirty, setIsDirty])

  const initials = (`${firstName} ${lastName}`.trim() || `${baseFirstName} ${baseLastName}`.trim())
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  const handleToneChange = async (next: typeof TONE_OPTIONS[number]) => {
    if (next === tone || tonePending) return
    const previous = tone
    setToneState(next)
    setTonePending(true)
    try {
      await updateOnboarding({ ai_tone: next })
      await refreshUser()
    } catch {
      toast.error('Failed to save style — please try again')
      setToneState(previous)
    } finally {
      setTonePending(false)
    }
  }

  const handleModelTierChange = (next: typeof MODEL_TIER_OPTIONS[number]) => {
    setModelTier(next)
    try { window.localStorage.setItem(DEFAULT_MODEL_TIER_STORAGE_KEY, next) } catch { /* best-effort */ }
  }

  const handlePickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('That image is too large (max 8 MB)')
      return
    }
    try {
      setAvatar(await fileToAvatarDataUrl(file))
    } catch {
      toast.error('Could not read that image')
    }
  }

  const handleSave = async (): Promise<boolean> => {
    if (!isDirty || isSaving) return false
    setIsSaving(true)
    try {
      const tasks: Promise<unknown>[] = []

      if (nameChanged || avatarChanged) {
        const userPayload: Parameters<typeof updateUser>[0] = {}
        if (nameChanged) {
          userPayload.first_name = firstName.trim() || null
          userPayload.last_name  = lastName.trim() || null
        }
        if (avatarChanged) userPayload.profile_picture = avatar
        tasks.push(updateUser(userPayload))
      }

      await Promise.all(tasks)
      await refreshUser()
      toast.success('Account saved')
      return true
    } catch {
      toast.error('Failed to save — please try again')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  // Keep the guard's save reference up to date on every render
  saveRef.current = handleSave

  const handleDeleteAccount = () => {
    // TODO: open confirmation dialog before proceeding
  }

  return (
    <div
      className="kaya-scrollbar"
      style={{
        flex:          '1 0 0',
        minHeight:     0,
        overflowY:     'auto',
        overflowX:     'hidden',
        display:       'flex',
        alignItems:    'flex-start',
        justifyContent:'center',
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
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            Account
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-500)',
            margin:     0,
          }}>
            Manage your personal profile, sign-in methods, and account settings.
          </p>
        </div>

        {/* ── Main profile card ── */}
        <SettingsCard>
          {/* Profile picture */}
          <CardSection divider padTop={12} padBottom={24}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => { void handlePickAvatar(e) }}
                style={{ display: 'none' }}
              />

              {/* Avatar — click to change */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onMouseEnter={() => setAvatarHover(true)}
                onMouseLeave={() => setAvatarHover(false)}
                aria-label="Change profile picture"
                style={{
                  width:        65,
                  height:       65,
                  borderRadius: 55,
                  padding:      0,
                  border:       'none',
                  cursor:       'pointer',
                  backgroundColor: 'var(--neutral-100)',
                  boxShadow:    '0px 1.091px 1.09px 0px rgba(59,54,50,0.05), 0px 1.455px 1px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)',
                  flexShrink:   0,
                  overflow:     'hidden',
                  position:     'relative',
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent:'center',
                }}
              >
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element -- user-supplied data-URL avatar, not a static asset
                  <img
                    alt="Profile"
                    src={avatar}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <span style={{
                    fontFamily: 'var(--font-title)',
                    fontWeight: 400,
                    fontSize:   24,
                    color:      'var(--neutral-500)',
                  }}>
                    {initials}
                  </span>
                )}
                {/* Hover overlay */}
                <span
                  aria-hidden
                  style={{
                    position:       'absolute',
                    inset:          0,
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    backgroundColor:'rgba(38,33,30,0.55)',
                    color:          'var(--neutral-white)',
                    fontFamily:     'var(--font-body)',
                    fontWeight:     500,
                    fontSize:       11,
                    lineHeight:     '14px',
                    textAlign:      'center',
                    opacity:        avatarHover ? 1 : 0,
                    transition:     'opacity 150ms',
                    pointerEvents:  'none',
                  }}
                >
                  Change
                </span>
              </button>

              {/* Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize:   16,
                  lineHeight: '22px',
                  color:      'var(--neutral-900)',
                  margin:     0,
                  overflow:   'hidden',
                  textOverflow:'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  Profile Picture
                </p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      padding:        '5px 8px',
                      borderRadius:   8,
                      border:         'none',
                      cursor:         'pointer',
                      backgroundColor:'transparent',
                      boxShadow:      '0px 0px 0px 1px rgba(59,54,50,0.3)',
                      fontFamily:     'var(--font-body)',
                      fontWeight:     500,
                      fontSize:       14,
                      lineHeight:     '22px',
                      color:          'var(--neutral-700)',
                    }}
                  >
                    Change Avatar
                  </button>
                  {avatar && (
                    <button
                      type="button"
                      onClick={() => setAvatar(null)}
                      style={{
                        display:        'flex',
                        alignItems:     'center',
                        justifyContent: 'center',
                        padding:        '5px 8px',
                        borderRadius:   8,
                        border:         'none',
                        cursor:         'pointer',
                        backgroundColor:'transparent',
                        fontFamily:     'var(--font-body)',
                        fontWeight:     500,
                        fontSize:       14,
                        lineHeight:     '22px',
                        color:          'var(--neutral-500)',
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </CardSection>

          {/* Full Name + Last Name — Figma labels these "Full Name"/"Last Name",
              but they're wired to the real first_name/last_name fields (see
              the baseline comment above) rather than split from one string. */}
          <CardSection divider padTop={12} padBottom={24}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              <InputField
                fluid
                label="Full Name"
                value={firstName}
                onChange={setFirstName}
                placeholder="Your first name"
                subtitle="Shown in team chats and persona attribution"
              />
              <InputField
                fluid
                label="Last Name"
                value={lastName}
                onChange={setLastName}
                placeholder="Your last name"
              />
            </div>
          </CardSection>

          {/* Role + Email — both read-only in this design (Role editing moved
              out; there is no dedicated "edit role" surface any more). */}
          <CardSection padTop={12} padBottom={12}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              <InputField
                fluid
                label="Role"
                value={baseRole}
                disabled
                subtitle="Set during onboarding"
              />
              <InputField
                fluid
                label="Email address"
                value={user.email ?? ''}
                disabled
                subtitle="Used for billing and notifications"
              />
            </div>
          </CardSection>

          {/* Save changes */}
          <CardSection padTop={12} padBottom={12}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="default"
                size="sm"
                disabled={!isDirty || isSaving}
                loading={isSaving}
                onClick={handleSave}
              >
                Save changes
              </Button>
            </div>
          </CardSection>
        </SettingsCard>

        {/* ── Personalisation card — node 18:27502. Style/Default Model commit
            immediately on selection (no Save button in this card in Figma). ── */}
        <SettingsCard>
          <CardSection divider padTop={12} padBottom={12}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
              Personalisation
            </p>
          </CardSection>
          <SettingsRow title="Style" subtitle="How the interface should feel" divider>
            <PillSelect value={tone as typeof TONE_OPTIONS[number]} options={TONE_OPTIONS} onChange={(v) => void handleToneChange(v)} />
          </SettingsRow>
          <SettingsRow title="Default Model" subtitle="Model selected by default for new work">
            <PillSelect value={modelTier} options={MODEL_TIER_OPTIONS} onChange={handleModelTierChange} />
          </SettingsRow>
        </SettingsCard>

        {/* ── Danger Zone card ── */}
        <SettingsCard danger>
          {/* Header */}
          <CardSection divider padTop={6} padBottom={12}>
            <h2 style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   500,
              fontSize:     16,
              lineHeight:   '22px',
              color:        'var(--red-400)',
              margin:       0,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              Danger Zone
            </h2>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize:   14,
              lineHeight: '22px',
              color:      'var(--neutral-500)',
              margin:     0,
            }}>
              Permanent actions that cannot be undone.
            </p>
          </CardSection>

          {/* Delete account row. Figma (18:27552) shows this button in an
              enabled, non-greyed state with no "Coming soon" badge — but
              there is still no DELETE /users/me (or equivalent) endpoint
              anywhere in this codebase's API layer. Account deletion is
              irreversible and destroys personas/workflows/pins, so this
              deliberately stays disabled behind the existing "Coming soon"
              treatment rather than matching the mock's visual state — wiring
              a real-looking enabled button to a no-op (or to nothing) would
              be actively worse than the 1:1 deviation. */}
          <CardSection padTop={20} padBottom={12}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
              <div style={{ flex: '1 0 0', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <p style={{
                    fontFamily:   'var(--font-body)',
                    fontWeight:   500,
                    fontSize:     16,
                    lineHeight:   '22px',
                    color:        'var(--neutral-900)',
                    margin:       0,
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace:   'nowrap',
                  }}>
                    Delete account
                  </p>
                  <Badge label="Coming soon" color="Red" />
                </div>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize:   14,
                  lineHeight: '22px',
                  color:      'var(--neutral-500)',
                  margin:     0,
                }}>
                  Permanently delete your account and all associated data, personas, workflows, and pins. This action cannot be undone.
                </p>
              </div>

              {/* Danger outline button — disabled until delete flow is implemented */}
              <button
                disabled
                onClick={handleDeleteAccount}
                style={{
                  flexShrink:     0,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  padding:        '6px 10px 8px',
                  borderRadius:   10,
                  border:         'none',
                  cursor:         'not-allowed',
                  opacity:        0.45,
                  backgroundColor:'var(--neutral-white)',
                  boxShadow:      '0px 1.091px 1.091px 0px rgba(24,2,2,0.05), 0px 1.455px 3.127px 0px rgba(24,2,2,0.15), 0px 0px 0px 1px var(--red-100)',
                  fontFamily:     'var(--font-body)',
                  fontWeight:     500,
                  fontSize:       14,
                  lineHeight:     '22px',
                  color:          'var(--red-700)',
                  whiteSpace:     'nowrap',
                  position:       'relative',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position:     'absolute',
                    inset:        0,
                    borderRadius: 'inherit',
                    boxShadow:    'inset 0px -2.182px 0.364px 0px var(--red-100)',
                    pointerEvents:'none',
                  }}
                />
                Delete account
              </button>
            </div>
          </CardSection>
        </SettingsCard>

      </div>
    </div>
  )
}
