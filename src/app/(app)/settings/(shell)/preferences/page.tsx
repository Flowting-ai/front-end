'use client'

import React, { useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { Checkbox } from '@/components/Checkbox'
import { useTheme } from '@/context/theme-context'

// ── Types ─────────────────────────────────────────────────────────────────────

type ThemeMode  = 'light' | 'dark' | 'system'
type TonePreset = 'Balanced' | 'Direct' | 'Warm'

// ── Theme preview thumbnail ───────────────────────────────────────────────────

// The thumbnails show what each OPTION looks like in its own theme, so they must NOT follow
// the active theme. Keep these as named constants (not inline colours or tokens): tokens flip
// in dark mode, and inline hex literals get re-tokenised by scripts/migrate-inline-colors.mjs.
const FIXED = {
  page:     '#FFFFFF',
  hairline: '#F5F2EF',
  ink:      '#26211E',
  mid:      '#827A74',
  midRgb:   '130, 122, 116',
  darkBar:  '#3B3632',
} as const

function ThemePreview({ mode }: { mode: ThemeMode }) {
  const isDark = mode === 'dark'
  return (
    <div style={{
      backgroundColor: FIXED.page,
      // The thumbnails below show what each OPTION looks like, so they use fixed
      // (light-theme) values — not tokens, which would flip when dark is active.
      border:          `1px solid ${isDark ? FIXED.ink : FIXED.hairline}`,
      borderRadius:    4,
      height:          64,
      overflow:        'hidden',
      display:         'flex',
      flexDirection:   'column',
      flexShrink:      0,
      width:           '100%',
    }}>
      <div style={{ display: 'flex', flex: '1 0 0', minHeight: 0, overflow: 'hidden' }}>
        {/* Sidebar strip */}
        <div style={{
          backgroundColor: isDark ? FIXED.ink : 'white',
          display:         'flex',
          flexDirection:   'column',
          gap:             4,
          paddingTop:      8,
          paddingLeft:     4,
          paddingRight:    4,
          flexShrink:      0,
        }}>
          {[true, false, false, false].map((isActive, i) => (
            // eslint-disable-next-line react/no-array-index-as-key -- static fixed-length skeleton array, index is stable
            <div key={i} style={{
              height:          5,
              width:           24,
              borderRadius:    3,
              backgroundColor: isDark
                ? isActive ? 'white' : FIXED.mid
                : isActive ? FIXED.ink : `rgba(${FIXED.midRgb}, 0.4)`,
            }} />
          ))}
        </div>
        {/* Main area */}
        <div style={{
          backgroundColor: isDark ? FIXED.ink : FIXED.page,
          flex:            '1 0 0',
          minWidth:        0,
          display:         'flex',
          flexDirection:   'column',
          gap:             5,
          padding:         8,
        }}>
          <div style={{
            height:          8,
            width:           50,
            borderRadius:    4,
            backgroundColor: isDark ? FIXED.mid : `rgba(${FIXED.midRgb}, 0.3)`,
          }} />
          <div style={{
            height:          8,
            width:           70,
            borderRadius:    4,
            backgroundColor: isDark ? FIXED.mid : `rgba(${FIXED.midRgb}, 0.2)`,
          }} />
          {/* Input bar */}
          <div style={{
            flex:            '1 0 0',
            minHeight:       0,
            backgroundColor: isDark ? FIXED.darkBar : 'white',
            borderRadius:    6,
            display:         'flex',
            alignItems:      'center',
            paddingLeft:     6,
            paddingRight:    6,
          }}>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: 12,
              lineHeight: '16px',
              color:      isDark ? 'white' : FIXED.ink,
              opacity:    0.8,
              flex:       '1 0 0',
              minWidth:   0,
            }}>
              Souvenir
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light',  label: 'Light'  },
  { value: 'dark',   label: 'Dark'   },
  { value: 'system', label: 'System' },
]

export default function PreferencesPage() {
  // Previously gated behind a `mounted` flag purely to force an extra
  // skeleton-then-real-content render pass — every value below is a static
  // default (no props/API/localStorage read), so nothing here actually
  // differs between the server render and the client's first render. Same
  // root cause and fix as help/notifications/security.
  // With theming OFF this stays a local, non-functional selector exactly as it
  // was (default 'system'). With it ON it is the real Light / Dark / System
  // preference, stored and applied by ThemeProvider.
  const theme = useTheme()
  const [localThemeMode,      setLocalThemeMode]      = useState<ThemeMode>('system')
  const themeMode    = theme.enabled ? theme.mode    : localThemeMode
  const setThemeMode = theme.enabled ? theme.setMode : setLocalThemeMode
  const [tonePreset,          setTonePreset]          = useState<TonePreset>('Balanced')
  const [customInstructions,  setCustomInstructions]  = useState('')

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
        paddingTop:     64,
        paddingBottom:  48,
      }}
    >
      {/* Horizontal padding lives here, not on the scrolling element above —
          keeps the scrollbar flush with the container's edge. */}
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
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            Preferences
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-500)',
            margin:     0,
          }}>
            Personalize how Souvenir looks and how the AI communicates with you.
          </p>
        </div>

        {/* ── Screen mode card ── */}
        <div style={{
          border:       '1px solid var(--neutral-200)',
          borderRadius: 16,
          boxShadow:    '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
          overflow:     'hidden',
        }}>
          <div style={{
            borderBottom: '1px solid var(--neutral-100)',
            padding:      '12px 24px 24px',
          }}>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize:   16,
              lineHeight: '22px',
              color:      'var(--neutral-900)',
              margin:     '0 0 6px',
            }}>
              Screen mode
            </p>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize:   14,
              lineHeight: '22px',
              color:      'var(--neutral-500)',
              margin:     0,
            }}>
              Choose how Souvenir looks. System follows your device setting.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 24, padding: '12px 24px' }}>
            {THEME_OPTIONS.map(opt => {
              const selected = themeMode === opt.value
              return (
                // eslint-disable-next-line click-events-have-key-events, no-static-element-interactions -- interactive div; keyboard handling delegated to inner elements
                <div
                  key={opt.value}
                  onClick={() => setThemeMode(opt.value)}
                  style={{
                    flex:            '1 0 0',
                    minWidth:        0,
                    display:         'flex',
                    flexDirection:   'column',
                    gap:             6,
                    padding:         12,
                    borderRadius:    8,
                    cursor:          'pointer',
                    position:        'relative',
                    backgroundColor: selected ? 'color-mix(in srgb, var(--neutral-100) 60%, transparent)' : 'var(--neutral-white)',
                    boxShadow:       selected
                      ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(212, 212, 212,0.4), inset 0px 1px 0px 0px color-mix(in srgb, var(--static-white) 61%, transparent), inset 0px -1px 0px 0px rgba(106,98,93,0.05)'
                      : '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
                  }}
                >
                  <ThemePreview mode={opt.value} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => setThemeMode(opt.value)}
                    />
                    <span style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 400,
                      fontSize:   14,
                      lineHeight: '22px',
                      color:      'var(--neutral-900)',
                      flex:       '1 0 0',
                      minWidth:   0,
                    }}>
                      {opt.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── AI tone card ── */}
        <div style={{
          border:       '1px solid var(--neutral-200)',
          borderRadius: 16,
          boxShadow:    '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
          overflow:     'hidden',
        }}>
          {/* Header */}
          <div style={{
            borderBottom: '1px solid var(--neutral-100)',
            padding:      '12px 24px 24px',
          }}>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize:   16,
              lineHeight: '22px',
              color:      'var(--neutral-900)',
              margin:     '0 0 6px',
            }}>
              AI tone
            </p>
            <p style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   400,
              fontSize:     14,
              lineHeight:   '22px',
              color:        'var(--neutral-500)',
              margin:       0,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              Set a default communication style for all AI responses. You can override this per agent or per chat.
            </p>
          </div>

          {/* Presets */}
          <div style={{
            borderBottom:  '1px solid var(--neutral-100)',
            padding:       '12px 24px 24px',
            display:       'flex',
            flexDirection: 'column',
            gap:           16,
          }}>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize:   14,
              lineHeight: '22px',
              color:      'var(--neutral-900)',
              margin:     0,
            }}>
              Presets
            </p>
            <Tabs value={tonePreset} onValueChange={v => setTonePreset(v as TonePreset)}>
              <TabsList>
                <TabsTrigger value="Balanced">Balanced</TabsTrigger>
                <TabsTrigger value="Direct">Direct</TabsTrigger>
                <TabsTrigger value="Warm">Warm</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Custom instructions */}
          <div style={{
            padding:       '12px 24px',
            display:       'flex',
            flexDirection: 'column',
            gap:           16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-900)',
                margin:     0,
              }}>
                Custom instructions
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
                {customInstructions.length}/500
              </p>
            </div>
            <textarea
              value={customInstructions}
              onChange={e => setCustomInstructions(e.target.value.slice(0, 500))}
              placeholder={`e.g. "Always cite sources", "Keep responses under 200 words", "Use bullet points for lists"`}
              style={{
                width:           '100%',
                height:          96,
                resize:          'none',
                backgroundColor: 'var(--neutral-white)',
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
            <p style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   400,
              fontSize:     14,
              lineHeight:   '22px',
              color:        'var(--neutral-500)',
              margin:       0,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              Set a default communication style for all AI responses. You can override this per agent or per chat.
            </p>
          </div>
        </div>

        {/* ── Souvenir's memory card ── */}
        <div style={{
          border:       '1px solid var(--neutral-200)',
          borderRadius: 16,
          boxShadow:    '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
          overflow:     'hidden',
          padding:      '12px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
            {/* Left: title + description + badge */}
            <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  fontSize:   16,
                  lineHeight: '22px',
                  color:      'var(--neutral-900)',
                  margin:     '0 0 6px',
                  overflow:   'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                }}>
                  Souvenir's memory
                </p>
                <p style={{
                  fontFamily:   'var(--font-body)',
                  fontWeight:   400,
                  fontSize:     14,
                  lineHeight:   '22px',
                  color:        'var(--neutral-500)',
                  margin:       0,
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                }}>
                  Memory is active. Souvenir is learning from your conversations and retaining context across sessions.
                </p>
              </div>

              {/* Green "Active" badge */}
              <div style={{
                display:         'inline-flex',
                alignItems:      'center',
                justifyContent:  'center',
                padding:         2,
                borderRadius:    6,
                backgroundColor: 'var(--green-50)',
                boxShadow:       '0px 1px 1.5px 0px rgba(17,25,1,0.2), 0px 0px 0px 1px rgba(128,183,7,0.5), inset 0px 1px 0px 0px rgba(247,254,230,0.7), inset 0px -1px 0px 0px rgba(128,183,7,0.1)',
                alignSelf:       'flex-start',
              }}>
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  fontSize: 12,
                  lineHeight: '16px',
                  color:      'var(--green-800)',
                  padding:    '0 2px',
                  whiteSpace: 'nowrap',
                }}>
                  Active - 12 memories saved
                </span>
              </div>
            </div>

            {/* Manage memory button */}
            <button
              style={{
                display:         'inline-flex',
                alignItems:      'center',
                justifyContent:  'center',
                padding:         '6px 10px 8px',
                borderRadius:    10,
                border:          'none',
                cursor:          'pointer',
                backgroundColor: 'var(--neutral-white)',
                boxShadow:       '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100), inset 0px -2.182px 0.364px 0px var(--neutral-100)',
                fontFamily:      'var(--font-body)',
                fontWeight:      500,
                fontSize:        14,
                lineHeight:      '22px',
                color:           'var(--neutral-700)',
                whiteSpace:      'nowrap',
                flexShrink:      0,
              }}
            >
              Manage memory
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
