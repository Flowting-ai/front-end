'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/context/auth-context'
import { PINS_ENABLED } from '@/lib/feature-flags'
import { InputField } from '@/components/InputField'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/Badge'
import { Spinner } from '@/components/Spinner'
import { saveTone, saveUser, roleDisplayLabel, toneDisplayLabel } from '@/lib/api/user'
import { currentUser } from '@/lib/api/current-user'
import { SETTINGS_DEFAULT_MODEL_KEY } from '@/lib/storage-keys'
import { useNavGuard } from '@/context/nav-guard-context'
import { toast } from 'sonner'
import { trackBrowserEvent } from '@/lib/analytics/events'
import { AccountSkeleton } from '../SettingsSkeleton'
import styles from './account.module.css'
import { PillSelect } from './_components/PillSelect'
import { CardSection, SettingsCard, SettingsRow } from './_components/SettingsCard'
import { MAX_UPLOAD_BYTES, fileToAvatarDataUrl } from './_components/avatar'
import { fetchModelsWithCache, sortModels, pickDefaultModel, modelIconSource, isAutoRoutingModelName } from '@/lib/ai-models'
import { ModelIcon } from '@/components/ModelIcon'
import { useTheme } from '@/context/theme-context'
import { HugeiconsIcon } from '@hugeicons/react'
import Sun01Icon from '@hugeicons/core-free-icons/Sun01Icon'
import Moon01Icon from '@hugeicons/core-free-icons/Moon01Icon'
import ComputerIcon from '@hugeicons/core-free-icons/ComputerIcon'
import FlashIcon from '@hugeicons/core-free-icons/FlashIcon'
import BalanceScaleIcon from '@hugeicons/core-free-icons/BalanceScaleIcon'
import SmileIcon from '@hugeicons/core-free-icons/SmileIcon'
import type { AIModel } from '@/types/ai-model'

// ── Settings v1.5 — Account page ─────────────────────────────────────────────
// Figma: https://www.figma.com/design/EirgiIxJWDEeUNZnKwr3f8/Settings-v1.5?node-id=18-27466

// Style dropdown — the only 3 backend-accepted display tones (TONE_API_MAP in
// lib/api/user.ts). Figma shows this as a constrained dropdown, not the old
// free-text "AI Tone" input.
const TONE_OPTIONS = ['Direct', 'Balanced', 'Warm'] as const

// Screen mode — same Light / Dark / System choice as the Preferences page.
const SCREEN_MODE_OPTIONS = ['Light', 'Dark', 'System'] as const
type ScreenModeLabel = typeof SCREEN_MODE_OPTIONS[number]
const SCREEN_MODE_VALUE = { Light: 'light', Dark: 'dark', System: 'system' } as const
// Leading glyph per mode in the Screen mode dropdown: sun / moon / system (computer).
const SCREEN_MODE_ICONS: Record<ScreenModeLabel, React.ReactElement> = {
  Light:  <HugeiconsIcon icon={Sun01Icon} size={16} color="currentColor" strokeWidth={1.5} />,
  Dark:   <HugeiconsIcon icon={Moon01Icon} size={16} color="currentColor" strokeWidth={1.5} />,
  System: <HugeiconsIcon icon={ComputerIcon} size={16} color="currentColor" strokeWidth={1.5} />,
}
const SCREEN_MODE_LABEL = { light: 'Light', dark: 'Dark', system: 'System' } as const
const SCREEN_MODE_DESCRIPTIONS: Record<ScreenModeLabel, string> = {
  Light:  'Always use the light theme',
  Dark:   'Always use the dark theme',
  System: 'Match your device setting',
}

// Same copy onboarding/tone/page.tsx uses to introduce these exact 3 choices —
// reused verbatim rather than reworded, so the tone means the same thing
// whether someone reads about it at onboarding or resets it here later.
const TONE_DESCRIPTIONS: Record<typeof TONE_OPTIONS[number], string> = {
  Direct:   'Skip the preamble. Just the answer.',
  Balanced: 'Friendly but efficient. The default.',
  Warm:     'Conversational, with context and reasoning.',
}

// A one-line sample of how an answer reads in each tone, so the choice is concrete.
const TONE_SAMPLES: Record<typeof TONE_OPTIONS[number], string> = {
  Direct:   'Revenue is up 12%. Repeat orders drove it.',
  Balanced: 'Revenue is up 12% this month, mostly from repeat orders.',
  Warm:     'Good news: revenue climbed 12% this month, thanks to customers coming back.',
}

const TONE_ICONS: Record<typeof TONE_OPTIONS[number], React.ReactElement> = {
  Direct:   <HugeiconsIcon icon={FlashIcon} size={16} color="currentColor" strokeWidth={1.5} />,
  Balanced: <HugeiconsIcon icon={BalanceScaleIcon} size={16} color="currentColor" strokeWidth={1.5} />,
  Warm:     <HugeiconsIcon icon={SmileIcon} size={16} color="currentColor" strokeWidth={1.5} />,
}

// Hidden for now: flip to true to show the Default Model row / Danger Zone card again.
const SHOW_DEFAULT_MODEL_ROW = false
const SHOW_DANGER_ZONE = false

// Default Model dropdown — the live catalog, ordered the same way as every
// other model picker. PENDING CONFIRMATION: there is no backend field for a
// per-user "default model" preference anywhere in this codebase — the default
// is computed (pickDefaultModel() starts new chats on the "Recommended" row),
// not stored per-user. Rather than fabricate a save call against a contract
// that doesn't exist, this control persists to localStorage only (client-side,
// this browser only) and does NOT feed back into pickDefaultModel() or any
// chat-creation path — flagged here rather than silently wiring a real-looking
// control to nothing.
const DEFAULT_MODEL_STORAGE_KEY = SETTINGS_DEFAULT_MODEL_KEY

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
  // Single app-wide guard now (nav-guard-context) — Settings' own sidebar
  // and the main app sidebar both route navigation through this, so leaving
  // this page with unsaved changes is caught no matter which sidebar the
  // user clicks.
  const { setIsDirty, setGuardMessage, setSaveHandler } = useNavGuard()
  const isDirtyRef = useRef(false)

  useEffect(() => {
    setGuardMessage({
      title:       'Unsaved profile changes',
      description: 'Your profile changes will be lost if you leave now.',
    })
    return () => setGuardMessage(null)
  }, [setGuardMessage])

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
      setSaveHandler(null)
    }
  }, [setIsDirty, setSaveHandler])

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
  const [isEditing,   setIsEditing]   = useState(false)

  // With theming OFF this stays a local, non-functional selector (default System), exactly like
  // Preferences. With it ON it is the real preference, stored and applied by ThemeProvider.
  const theme = useTheme()
  const [localScreenMode, setLocalScreenMode] = useState<ScreenModeLabel>('System')
  const screenMode: ScreenModeLabel = theme.enabled ? SCREEN_MODE_LABEL[theme.mode] : localScreenMode
  const handleScreenModeChange = (label: ScreenModeLabel) => {
    if (theme.enabled) {
      theme.setMode(SCREEN_MODE_VALUE[label])
      trackBrowserEvent('theme_changed', { mode: SCREEN_MODE_VALUE[label] })
    } else setLocalScreenMode(label)
  }
  const [tone, setToneState] = useState(baseTone)
  const [tonePending, setTonePending] = useState(false)
  const [models, setModels] = useState<AIModel[]>([])
  const [defaultModel, setDefaultModel] = useState('')
  useEffect(() => {
    let cancelled = false
    void fetchModelsWithCache().then(fetched => {
      if (cancelled) return
      const ordered = sortModels(fetched.filter(m => !m.blocked))
      setModels(ordered)
      let stored: string | null = null
      try { stored = window.localStorage.getItem(DEFAULT_MODEL_STORAGE_KEY) } catch { /* unavailable */ }
      const match = stored && ordered.some(m => m.modelName === stored) ? stored : null
      setDefaultModel(match ?? pickDefaultModel(ordered)?.modelName ?? '')
    })
    return () => { cancelled = true }
  }, [])

  const modelOptions = models.map(m => m.modelName)
  const modelDescriptions = Object.fromEntries(
    models.map(m => [m.modelName, m.description ?? '']),
  ) as Record<string, string>
  const modelIcons = Object.fromEntries(
    models.map(m => [
      m.modelName,
      // Auto-routing aliases ("Souvenir Pro"/"Souvenir Standard") don't have
      // a real provider behind them — omitting `model` here (not passing
      // modelIconSource's result) falls back to the Souvenir mark, matching
      // ModelMenu's own identical, deliberate choice for these same two rows.
      <ModelIcon key={m.modelName} model={isAutoRoutingModelName(m.modelName) ? undefined : modelIconSource(m)} size={16} />,
    ]),
  ) as Record<string, React.ReactElement>
  // Groups the picker under "Auto Routing" / "Models" mini-headers, matching
  // ModelMenu's own composer picker's exact section labels and grouping —
  // the catalog carries the auto-routing tiers as regular-looking model rows
  // (see AUTO_ROUTING_LABELS), so they'd otherwise sort in among the real
  // models with no indication they're something different.
  const autoRoutingModelOptions = modelOptions.filter(isAutoRoutingModelName)
  const otherModelOptions = modelOptions.filter(name => !isAutoRoutingModelName(name))

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

  // Keep ref in sync for the beforeunload handler. Was written directly
  // during render — technically idempotent, but refs are only safe to read
  // or write outside of render (React Compiler's `refs`/`no-ref-current-in-render`
  // rule flags this exact shape); moved into an effect, matching the
  // deps-less "always mirror the latest value" pattern this codebase already
  // uses elsewhere (e.g. Agents' `agent/configure/*` auto-save refs). The
  // beforeunload handler only reads this ref from inside a later event, not
  // during render, so the one-commit delay an effect introduces is safe.
  useEffect(() => {
    isDirtyRef.current = isDirty
  })

  // Sync dirty flag to the nav guard context via effect — calling setIsDirty during
  // render would update a different component (NavGuardProvider), which React forbids.
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
      await saveTone(next)
      trackBrowserEvent('tone_changed', { tone: next.toLowerCase() })
      await refreshUser()
    } catch {
      toast.error('Failed to save style — please try again')
      setToneState(previous)
    } finally {
      setTonePending(false)
    }
  }

  const handleDefaultModelChange = (next: string) => {
    setDefaultModel(next)
    try { window.localStorage.setItem(DEFAULT_MODEL_STORAGE_KEY, next) } catch { /* best-effort */ }
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
    // Purely local/staged — nothing is sent to the backend until Save
    // changes, but reading+resizing the image is genuinely async, so this
    // still gets its own loading→success/error toast rather than silently
    // updating the preview.
    const toastId = toast.loading('Updating profile picture…')
    try {
      setAvatar(await fileToAvatarDataUrl(file))
      toast.success('Profile picture updated', { id: toastId })
    } catch {
      toast.error('Could not read that image', { id: toastId })
    }
  }

  const handleRemoveAvatar = () => {
    setAvatar(null)
    toast.success('Profile picture removed')
  }

  const handleSave = async (): Promise<boolean> => {
    if (!isDirty || isSaving) return false
    setIsSaving(true)
    try {
      const tasks: Promise<unknown>[] = []

      if (nameChanged || avatarChanged) {
        const userPayload: Parameters<typeof saveUser>[0] = {}
        if (nameChanged) {
          userPayload.first_name = firstName.trim() || null
          userPayload.last_name  = lastName.trim() || null
        }
        if (avatarChanged) userPayload.profile_picture = avatar
        // The PATCH returns the saved profile: seed ["me"] with it (AuthProvider
        // follows that query) instead of a second GET /users/me.
        tasks.push(saveUser(userPayload).then(saved => currentUser.set(saved)))
      }

      await Promise.all(tasks)
      trackBrowserEvent('profile_updated', { name_changed: nameChanged, avatar_changed: avatarChanged })
      toast.success('Account details updated')
      setIsEditing(false)
      return true
    } catch {
      toast.error('Failed to save — please try again')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditProfile = () => {
    setIsEditing(true)
    toast.info('Editing profile')
  }

  const handleCancelEdit = () => {
    setFirstName(baseFirstName)
    setLastName(baseLastName)
    setAvatar(baseAvatar)
    setIsEditing(false)
    toast.info('Changes discarded')
  }

  // Keep the guard's registered save handler pointed at the latest
  // `handleSave` closure. `handleSave` is recreated every render (it isn't
  // memoized), so the handler passed to setSaveHandler must be a stable
  // wrapper that reads through a ref — registering the raw closure directly
  // in a effect keyed on `[handleSave]` would re-run (and re-render) on
  // every render instead of once.
  const handleSaveRef = useRef(handleSave)
  // Was written directly during render (`handleSaveRef.current = handleSave`)
  // — moved into a deps-less effect for the same reason as `isDirtyRef`
  // above; only ever read later, from inside the setSaveHandler wrapper.
  useEffect(() => {
    handleSaveRef.current = handleSave
  })
  useEffect(() => {
    setSaveHandler(() => handleSaveRef.current())
    return () => setSaveHandler(null)
  }, [setSaveHandler])

  const handleDeleteAccount = () => {
    // TODO: open confirmation dialog before proceeding
  }

  const fullName = `${firstName} ${lastName}`.trim() || 'Your name'

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
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Page header ── */}
        <div style={{ paddingLeft: 4, marginBottom: 4 }}>
          <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
            Account
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)', margin: 0 }}>
            Your profile, and how Souvenir looks and writes to you.
          </p>
        </div>

        {/* ── Profile: who you are at a glance, then the editable details ── */}
        <section className={styles.card} aria-label="Profile">
          <div className={styles.profile}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => { void handlePickAvatar(e) }}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className={styles.avatar}
              disabled={!isEditing}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Change profile picture"
            >
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- user-supplied data-URL avatar, not a static asset
                <img alt="" src={avatar} />
              ) : (
                <span>{initials || '?'}</span>
              )}
              <span className={styles.avatarOverlay} aria-hidden="true">Change</span>
            </button>

            <div className={styles.identity}>
              <p className={styles.name}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName}</span>
                {baseRole && <Badge label={baseRole} color="Neutral" />}
              </p>
              <p className={styles.email}>{user.email ?? ''}</p>
              {isEditing && (
                <div className={styles.avatarActions}>
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    {avatar ? 'Change photo' : 'Upload photo'}
                  </Button>
                  {avatar && (
                    <Button variant="ghost" size="sm" className="bg-transparent" onClick={handleRemoveAvatar}>
                      Remove
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className={styles.actions}>
              {isEditing ? (
                <>
                  <Button variant="ghost" size="sm" className="bg-transparent" disabled={isSaving} onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                  <Button variant="default" size="sm" disabled={!isDirty || isSaving} loading={isSaving} onClick={handleSave}>
                    Save changes
                  </Button>
                </>
              ) : (
                <Button variant="secondary" size="sm" onClick={handleEditProfile}>
                  Edit profile
                </Button>
              )}
            </div>
          </div>

          <div className={styles.fields}>
            <InputField
              fluid
              label="First name"
              value={firstName}
              onChange={setFirstName}
              placeholder="Your first name"
              subtitle="Shown in team chats and persona attribution"
              disabled={!isEditing}
            />
            <InputField
              fluid
              label="Last name"
              value={lastName}
              onChange={setLastName}
              placeholder="Your last name"
              disabled={!isEditing}
            />
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
        </section>

        {/* ── Appearance: the three modes as picture tiles instead of a dropdown ── */}
        <section className={styles.card} aria-labelledby="appearance-title">
          <div className={styles.cardHead}>
            <h2 id="appearance-title" className={styles.cardTitle}>Appearance</h2>
            <p className={styles.cardHint}>Light, dark, or match your device.</p>
          </div>
          <div className={styles.choices} role="radiogroup" aria-labelledby="appearance-title">
            {SCREEN_MODE_OPTIONS.map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={screenMode === mode}
                className={styles.choice}
                onClick={() => handleScreenModeChange(mode)}
              >
                <span className={styles.preview} aria-hidden="true">
                  {mode !== 'Dark' && (
                    <span className={`${styles.previewHalf} ${styles.light}`}>
                      <i style={{ width: '70%' }} /><i style={{ width: '90%' }} /><i style={{ width: '50%' }} />
                    </span>
                  )}
                  {mode !== 'Light' && (
                    <span className={`${styles.previewHalf} ${styles.dark}`}>
                      <i style={{ width: '70%' }} /><i style={{ width: '90%' }} /><i style={{ width: '50%' }} />
                    </span>
                  )}
                </span>
                <span className={styles.choiceHead}>
                  <span style={{ display: 'inline-flex', color: 'var(--neutral-600)' }}>{SCREEN_MODE_ICONS[mode]}</span>
                  <span className={styles.choiceTitle}>{mode}</span>
                  <span className={styles.radio} aria-hidden="true" />
                </span>
                <span className={styles.choiceHint}>{SCREEN_MODE_DESCRIPTIONS[mode]}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Response style: each tone with a sample of how an answer reads ── */}
        <section className={styles.card} aria-labelledby="style-title">
          <div className={styles.cardHead}>
            <h2 id="style-title" className={styles.cardTitle}>Response style</h2>
            <p className={styles.cardHint}>How Souvenir writes its answers to you. Saves as soon as you pick one.</p>
          </div>
          <div className={styles.choices} role="radiogroup" aria-labelledby="style-title" aria-busy={tonePending}>
            {TONE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={tone === option}
                className={styles.choice}
                disabled={tonePending}
                onClick={() => void handleToneChange(option)}
              >
                <span className={styles.bubblePreview} aria-hidden="true">
                  <span className={styles.bubble}>{TONE_SAMPLES[option]}</span>
                </span>
                <span className={styles.choiceHead}>
                  <span style={{ display: 'inline-flex', color: 'var(--neutral-600)' }}>{TONE_ICONS[option]}</span>
                  <span className={styles.choiceTitle}>{option}</span>
                  {tonePending && tone === option ? <Spinner size={14} /> : <span className={styles.radio} aria-hidden="true" />}
                </span>
                <span className={styles.choiceHint}>{TONE_DESCRIPTIONS[option]}</span>
              </button>
            ))}
          </div>
          {SHOW_DEFAULT_MODEL_ROW && (
          <SettingsRow title="Default Model" subtitle="Model selected by default for new work">
            <PillSelect
              label="Default model"
              value={defaultModel}
              options={modelOptions}
              onChange={handleDefaultModelChange}
              descriptions={modelDescriptions}
              icons={modelIcons}
              sections={[
                { label: 'Auto Routing', options: autoRoutingModelOptions },
                { label: 'Models', options: otherModelOptions },
              ]}
            />
          </SettingsRow>
        )}
        </section>

        {/* ── Danger Zone card ── */}
{SHOW_DANGER_ZONE && (
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
                  Permanently delete your account and all associated data, personas, workflows{PINS_ENABLED ? ', and pins' : ''}. This action cannot be undone.
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
                  backgroundColor:'var(--field-surface)',
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
        )}
      </div>
    </div>
  )
}
