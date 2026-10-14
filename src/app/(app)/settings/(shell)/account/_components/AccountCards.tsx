'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import Sun01Icon from '@hugeicons/core-free-icons/Sun01Icon'
import Moon01Icon from '@hugeicons/core-free-icons/Moon01Icon'
import ComputerIcon from '@hugeicons/core-free-icons/ComputerIcon'
import FlashIcon from '@hugeicons/core-free-icons/FlashIcon'
import BalanceScaleIcon from '@hugeicons/core-free-icons/BalanceScaleIcon'
import SmileIcon from '@hugeicons/core-free-icons/SmileIcon'
import { Badge } from '@/components/Badge'
import { Spinner } from '@/components/Spinner'
import { useTheme } from '@/context/theme-context'
import { trackBrowserEvent } from '@/lib/analytics/events'
import { saveTone } from '@/lib/api/user'
import { PINS_ENABLED } from '@/lib/feature-flags'
import styles from '../account.module.css'
import { CardSection, SettingsCard, SettingsRow } from './SettingsCard'
import { DefaultModelPicker } from './DefaultModelPicker'

// The three tones the backend accepts (TONE_API_MAP in lib/api/user.ts).
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

// Hidden for now: flip to true to show the Default Model row or the Danger Zone card again.
const SHOW_DEFAULT_MODEL_ROW = false
export const SHOW_DANGER_ZONE = false

/** Light, dark or system, as picture tiles. With theming off it is a local, non-functional choice (default System), as on Preferences. */
export function AppearanceCard() {
  const theme = useTheme()
  const [localScreenMode, setLocalScreenMode] = useState<ScreenModeLabel>('System')
  const screenMode: ScreenModeLabel = theme.enabled ? SCREEN_MODE_LABEL[theme.mode] : localScreenMode
  const handleScreenModeChange = (label: ScreenModeLabel) => {
    if (theme.enabled) {
      theme.setMode(SCREEN_MODE_VALUE[label])
      trackBrowserEvent('theme_changed', { mode: SCREEN_MODE_VALUE[label] })
    } else setLocalScreenMode(label)
  }

  return (
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
  )
}

type Tone = typeof TONE_OPTIONS[number]

/** The three response tones, each with a sample answer. Saves as soon as one is picked, reverting on failure. */
export function ResponseStyleCard({ savedTone, refreshUser }: { savedTone: string; refreshUser: () => Promise<void> }) {
  const [tone, setToneState] = useState(savedTone)
  const [tonePending, setTonePending] = useState(false)
  // A new saved tone (after a refresh) becomes the selection, without fighting a pick in flight.
  const [syncedTone, setSyncedTone] = useState(savedTone)
  if (savedTone !== syncedTone) {
    setSyncedTone(savedTone)
    setToneState(savedTone)
  }

  const handleToneChange = async (next: Tone) => {
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

  return (
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
          <DefaultModelPicker />
        </SettingsRow>
      )}
    </section>
  )
}

/** Account deletion. Hidden (SHOW_DANGER_ZONE): there is no delete-account endpoint, so the button stays disabled. */
export function DangerZoneCard() {
  return (
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
  )
}
