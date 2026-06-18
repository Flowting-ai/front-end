'use client'

import React, { useState } from 'react'
import { useAuth } from '@/context/auth-context'
import { FilesSkeleton } from '../SettingsSkeleton'

// ── Local helpers ─────────────────────────────────────────────────────────────

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border:        '1px solid var(--neutral-200)',
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
        display:      'flex',
        flexDirection:'column',
        padding:      `${padTop}px 24px ${padBottom}px`,
        borderBottom: divider ? '1px solid var(--neutral-100)' : undefined,
      }}
    >
      {children}
    </div>
  )
}

function ProgressBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0
  return (
    <div
      style={{
        height:          4,
        borderRadius:    2,
        backgroundColor: 'var(--neutral-white)',
        overflow:        'hidden',
        position:        'relative',
        width:           '100%',
      }}
    >
      <div
        style={{
          position:        'absolute',
          top:             0,
          left:            0,
          height:          '100%',
          width:           `${pct}%`,
          borderRadius:    'inherit',
          backgroundColor: 'var(--blue-600)',
        }}
      />
    </div>
  )
}

function BlueBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        position:        'relative',
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '2px',
        borderRadius:    6,
        boxShadow:       '0px 1px 1.5px 0px rgba(2,15,24,0.2), 0px 0px 0px 1px rgba(13,110,178,0.5)',
        overflow:        'hidden',
      }}
    >
      <span
        aria-hidden
        style={{
          position:        'absolute',
          inset:           0,
          borderRadius:    6,
          backgroundColor: 'var(--blue-100)',
          pointerEvents:   'none',
        }}
      />
      <span
        aria-hidden
        style={{
          position:     'absolute',
          inset:        0,
          borderRadius: 'inherit',
          boxShadow:    'inset 0px 1px 0px 0px rgba(231,244,253,0.7), inset 0px -1px 0px 0px rgba(13,110,178,0.1)',
          pointerEvents:'none',
        }}
      />
      <span style={{
        position:   'relative',
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding:    '0 2px',
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        fontSize: 12,
        lineHeight: '16px',
        color:      'var(--blue-700)',
        whiteSpace: 'nowrap',
      }}>
        {children}
      </span>
    </span>
  )
}

function BrownBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        position:        'relative',
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '2px',
        borderRadius:    6,
        boxShadow:       '0px 1px 1.5px 0px rgba(20,12,5,0.2), 0px 0px 0px 1px rgba(126,84,53,0.5)',
        overflow:        'hidden',
        flexShrink:      0,
      }}
    >
      <span
        aria-hidden
        style={{
          position:        'absolute',
          inset:           0,
          borderRadius:    6,
          backgroundColor: 'var(--brown-100)',
          pointerEvents:   'none',
        }}
      />
      <span
        aria-hidden
        style={{
          position:     'absolute',
          inset:        0,
          borderRadius: 'inherit',
          boxShadow:    'inset 0px 1px 0px 0px rgba(250,241,235,0.7), inset 0px -1px 0px 0px rgba(126,84,53,0.1)',
          pointerEvents:'none',
        }}
      />
      <span style={{
        position:   'relative',
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding:    '0 2px',
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        fontSize: 12,
        lineHeight: '16px',
        color:      'var(--brown-700)',
        whiteSpace: 'nowrap',
      }}>
        {children}
      </span>
    </span>
  )
}

// Styled native <select> matching InputField appearance
function SelectField({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <div style={{ position: 'relative', width: 327, flexShrink: 0 }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width:           '100%',
          appearance:      'none',
          WebkitAppearance:'none',
          backgroundColor: 'var(--neutral-white)',
          border:          'none',
          borderRadius:    10,
          boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
          padding:         '7px 32px 7px 12px',
          fontFamily:      'var(--font-body)',
          fontWeight:      400,
          fontSize:        14,
          lineHeight:      '22px',
          color:           'var(--neutral-600)',
          cursor:          'pointer',
          outline:         'none',
        }}
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {/* Chevron icon */}
      <svg
        aria-hidden
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        style={{
          position:     'absolute',
          right:        10,
          top:          '50%',
          transform:    'translateY(-50%)',
          pointerEvents:'none',
          flexShrink:   0,
        }}
      >
        <path d="M4 6L8 10L12 6" stroke="var(--neutral-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

// Inline row for storage breakdown
function StorageRow({
  label,
  value,
  divider,
}: {
  label: string
  value: string
  divider?: boolean
}) {
  return (
    <div
      style={{
        display:      'flex',
        alignItems:   'center',
        padding:      '12px 0',
        borderBottom: divider ? '1px solid var(--neutral-100)' : undefined,
      }}
    >
      <span style={{
        flex:         '1 0 0',
        minWidth:     0,
        fontFamily:   'var(--font-body)',
        fontWeight:   400,
        fontSize:     14,
        lineHeight:   '22px',
        color:        'var(--neutral-900)',
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        whiteSpace:   'nowrap',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily:   'var(--font-body)',
        fontWeight:   400,
        fontSize:     14,
        lineHeight:   '22px',
        color:        'var(--neutral-500)',
        whiteSpace:   'nowrap',
        flexShrink:   0,
      }}>
        {value}
      </span>
    </div>
  )
}

// Setting row: label+caption left, control right
function SettingRow({
  label,
  caption,
  control,
  divider,
}: {
  label: string
  caption: string
  control: React.ReactNode
  divider?: boolean
}) {
  return (
    <div
      style={{
        display:      'flex',
        flexDirection:'column',
        padding:      '12px 24px 24px',
        borderBottom: divider ? '1px solid var(--neutral-100)' : undefined,
      }}
    >
      <div style={{ display: 'flex', gap: 64, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 0 0', minWidth: 0 }}>
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
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: 12,
            lineHeight: '16px',
            color:      'var(--neutral-500)',
            margin:     0,
          }}>
            {caption}
          </p>
        </div>
        {control}
      </div>
    </div>
  )
}

// Outline button (neutral)
function OutlineButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        position:        'relative',
        flexShrink:      0,
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        gap:             2,
        padding:         '6px 10px 8px',
        borderRadius:    10,
        border:          'none',
        cursor:          'pointer',
        backgroundColor: 'var(--neutral-white)',
        boxShadow:       '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)',
        fontFamily:      'var(--font-body)',
        fontWeight:      500,
        fontSize:        14,
        lineHeight:      '22px',
        color:           'var(--neutral-700)',
        whiteSpace:      'nowrap',
        overflow:        'hidden',
      }}
    >
      <span aria-hidden style={{
        position:     'absolute',
        inset:        0,
        borderRadius: 'inherit',
        boxShadow:    'inset 0px -2.182px 0.364px 0px var(--neutral-100)',
        pointerEvents:'none',
      }} />
      {children}
    </button>
  )
}

// Danger outline button (red)
function DangerButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        position:        'relative',
        flexShrink:      0,
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        gap:             2,
        padding:         '6px 10px 8px',
        borderRadius:    10,
        border:          'none',
        cursor:          'pointer',
        backgroundColor: 'var(--neutral-white)',
        boxShadow:       '0px 1.091px 1.091px 0px rgba(24,2,2,0.05), 0px 1.455px 3.127px 0px rgba(24,2,2,0.15), 0px 0px 0px 1px var(--red-100)',
        fontFamily:      'var(--font-body)',
        fontWeight:      500,
        fontSize:        14,
        lineHeight:      '22px',
        color:           'var(--red-700)',
        whiteSpace:      'nowrap',
        overflow:        'hidden',
      }}
    >
      <span aria-hidden style={{
        position:     'absolute',
        inset:        0,
        borderRadius: 'inherit',
        boxShadow:    'inset 0px -2.182px 0.364px 0px var(--red-100)',
        pointerEvents:'none',
      }} />
      {children}
    </button>
  )
}

// ── Plan limits table ─────────────────────────────────────────────────────────

const PLAN_LIMITS = [
  { plan: 'Starter', storage: '5 GB',  maxFile: '20 MB',  retention: '30 days',          last: false },
  { plan: 'Pro',     storage: '10 GB', maxFile: '50 MB',  retention: '30 / 60 / 90 days', last: false },
  { plan: 'Power',   storage: '20 GB', maxFile: '100 MB', retention: '30 / 60 / 90 days', last: true  },
]

const FILE_TYPES = ['PDF', 'DOCX', 'TXT', 'CSV', 'XLSX', 'PNG', 'JPG', 'ZIP']

const MAX_FILE_OPTIONS  = ['20 MB', '50 MB', '100 MB']
const RETENTION_OPTIONS = ['30 days', '60 days', '90 days']

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FilesPage() {
  const { user } = useAuth()
  if (!user) return <FilesSkeleton />

  const planName    = user?.planName ?? 'Starter'
  const storageLimit = planName.toLowerCase().includes('power') ? '20 GB'
    : planName.toLowerCase().includes('pro') ? '10 GB'
    : '5 GB'

  // Static storage values - TODO: wire to files API
  const storageUsedGB  = 2.4
  const storageTotalGB = parseInt(storageLimit)

  const [maxFileSize,    setMaxFileSize]    = useState('50 MB')
  const [fileRetention,  setFileRetention]  = useState('30 days')

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
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            Files &amp; Data
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-500)',
            margin:     0,
          }}>
            Manage uploaded files, storage limits, file handling rules, and data export.
          </p>
        </div>

        {/* ── Storage used card ── */}
        <SettingsCard>
          {/* Header */}
          <CardSection divider padTop={12} padBottom={24}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
              <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                  Storage used
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
                  Files you&apos;ve uploaded across all chats, personas, and knowledge bases.
                </p>
              </div>
              <BlueBadge>{planName} · {storageLimit}</BlueBadge>
            </div>
          </CardSection>

          {/* Total storage + progress bar */}
          <CardSection divider padTop={12} padBottom={24}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <p style={{
                  flex:         '1 0 0',
                  minWidth:     0,
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
                  Total storage
                </p>
                <p style={{
                  fontFamily:   'var(--font-body)',
                  fontWeight:   400,
                  fontSize:     14,
                  lineHeight:   '22px',
                  color:        'var(--neutral-500)',
                  margin:       0,
                  whiteSpace:   'nowrap',
                  flexShrink:   0,
                }}>
                  {storageUsedGB} GB of {storageTotalGB} GB
                </p>
              </div>
              <ProgressBar used={storageUsedGB} total={storageTotalGB} />
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
                {storageLimit} on {planName} · Upgrades available in Usage &amp; Billing
              </p>
            </div>
          </CardSection>

          {/* Storage breakdown rows */}
          <div style={{ padding: '0 24px' }}>
            <StorageRow label="Chat attachments"      value="1.2 GB" divider />
            <StorageRow label="Persona knowledge files" value="0.8 GB" divider />
            <StorageRow label="Workspace shared files" value="0.4 GB" />
          </div>
        </SettingsCard>

        {/* ── File processing card ── */}
        <SettingsCard>
          {/* Header */}
          <CardSection divider padTop={12} padBottom={24}>
            <p style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   500,
              fontSize:     16,
              lineHeight:   '22px',
              color:        'var(--neutral-900)',
              margin:       '0 0 4px',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              File processing
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
              Configure how uploaded files are handled and which types are accepted.
            </p>
          </CardSection>

          {/* Max file size */}
          <SettingRow
            divider
            label="Max file size"
            caption="Per file upload limit. Larger files cost more processing credits."
            control={
              <SelectField
                value={maxFileSize}
                onChange={setMaxFileSize}
                options={MAX_FILE_OPTIONS}
              />
            }
          />

          {/* File retention */}
          <SettingRow
            divider
            label="File retention"
            caption="Auto-delete uploaded files after this period. Does not affect pinned content."
            control={
              <SelectField
                value={fileRetention}
                onChange={setFileRetention}
                options={RETENTION_OPTIONS}
              />
            }
          />

          {/* Allowed file types */}
          <CardSection padTop={12} padBottom={12}>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize:   14,
              lineHeight: '22px',
              color:      'var(--neutral-900)',
              margin:     '0 0 2px',
            }}>
              Allowed file types
            </p>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: 12,
              lineHeight: '16px',
              color:      'var(--neutral-500)',
              margin:     '0 0 12px',
            }}>
              File types accepted for upload across all surfaces - chat, personas, and knowledge base.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {FILE_TYPES.map(type => (
                <BrownBadge key={type}>{type}</BrownBadge>
              ))}
            </div>
          </CardSection>
        </SettingsCard>

        {/* ── Limits by plan card ── */}
        <SettingsCard>
          <CardSection divider padTop={12} padBottom={24}>
            <p style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   500,
              fontSize:     16,
              lineHeight:   '22px',
              color:        'var(--neutral-900)',
              margin:       '0 0 4px',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              Limits by plan
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
              Storage and file size limits vary by subscription tier.
            </p>
          </CardSection>

          <CardSection padTop={0} padBottom={12}>
            {/* Inner white table card */}
            <div style={{
              backgroundColor: 'var(--neutral-white)',
              borderRadius:    8,
              border:          '1px solid var(--neutral-100)',
              boxShadow:       '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
              overflow:        'hidden',
              padding:         12,
            }}>
              {/* Table header */}
              <div style={{
                display:             'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr',
                gap:                 42,
                padding:             '0 12px 12px',
                borderBottom:        '1px solid var(--neutral-100)',
              }}>
                {['Plan', 'Storage', 'Max file size', 'Retention'].map(col => (
                  <span key={col} style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 400,
                    fontSize:   14,
                    lineHeight: '22px',
                    color:      'var(--neutral-900)',
                    overflow:   'hidden',
                    textOverflow:'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {col}
                  </span>
                ))}
              </div>

              {/* Table rows */}
              {PLAN_LIMITS.map(row => (
                <div
                  key={row.plan}
                  style={{
                    display:             'grid',
                    gridTemplateColumns: '1fr 1fr 1fr 1fr',
                    gap:                 42,
                    padding:             '12px',
                    borderBottom:        row.last ? undefined : '1px solid var(--neutral-100)',
                    alignItems:          'center',
                  }}
                >
                  <span style={{
                    fontFamily:   'var(--font-body)',
                    fontWeight:   500,
                    fontSize:     14,
                    lineHeight:   '22px',
                    color:        'var(--neutral-900)',
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace:   'nowrap',
                  }}>
                    {row.plan}
                  </span>
                  <span style={{
                    fontFamily:   'var(--font-body)',
                    fontWeight:   500,
                    fontSize:     14,
                    lineHeight:   '22px',
                    color:        'var(--neutral-900)',
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace:   'nowrap',
                  }}>
                    {row.storage}
                  </span>
                  <span style={{
                    fontFamily:   'var(--font-body)',
                    fontWeight:   400,
                    fontSize:     14,
                    lineHeight:   '22px',
                    color:        'var(--neutral-900)',
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace:   'nowrap',
                  }}>
                    {row.maxFile}
                  </span>
                  <span style={{
                    fontFamily:   'var(--font-body)',
                    fontWeight:   400,
                    fontSize:     14,
                    lineHeight:   '22px',
                    color:        'var(--neutral-900)',
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace:   'nowrap',
                  }}>
                    {row.retention}
                  </span>
                </div>
              ))}
            </div>
          </CardSection>
        </SettingsCard>

        {/* ── Data Management card ── */}
        <SettingsCard>
          <CardSection divider padTop={12} padBottom={24}>
            <p style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   500,
              fontSize:     16,
              lineHeight:   '22px',
              color:        'var(--neutral-900)',
              margin:       '0 0 4px',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              Data Management
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
              Export or permanently remove your stored data.
            </p>
          </CardSection>

          {/* Export all data */}
          <CardSection divider padTop={12} padBottom={24}>
            <div style={{ display: 'flex', gap: 64, alignItems: 'flex-start' }}>
              <div style={{ flex: '1 0 0', minWidth: 0 }}>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  fontSize:   14,
                  lineHeight: '22px',
                  color:      'var(--neutral-900)',
                  margin:     0,
                }}>
                  Export all data
                </p>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize: 12,
                  lineHeight: '16px',
                  color:      'var(--neutral-500)',
                  margin:     0,
                }}>
                  Download all your chats, pins, personas, workflows, and files as a ZIP archive. Delivered to your email.
                </p>
              </div>
              <OutlineButton>Export</OutlineButton>
            </div>
          </CardSection>

          {/* Clear all files */}
          <CardSection padTop={12} padBottom={12}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: '1 0 0', minWidth: 0 }}>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  fontSize:   14,
                  lineHeight: '22px',
                  color:      'var(--neutral-900)',
                  margin:     0,
                }}>
                  Clear all files
                </p>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize: 12,
                  lineHeight: '16px',
                  color:      'var(--neutral-500)',
                  margin:     0,
                }}>
                  Permanently remove all uploaded files from your account. Your chat history is not affected.
                </p>
              </div>
              <DangerButton>Clear files</DangerButton>
            </div>
          </CardSection>
        </SettingsCard>

      </div>
    </div>
  )
}
