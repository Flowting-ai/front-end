'use client'

import React, { useState } from 'react'
import { Switch } from '@/components/Switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { MoreVerticalIcon } from '@strange-huge/icons'

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7" cy="7" r="4.5" stroke="var(--neutral-400)" strokeWidth="1.5"/>
      <path d="M10.5 10.5L13.5 13.5" stroke="var(--neutral-400)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function ChevronRightIcon({ rotated }: { rotated?: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ transform: rotated ? 'rotate(90deg)' : undefined, transition: 'transform 200ms' }}
    >
      <path d="M6 4L10 8L6 12" stroke="var(--neutral-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="9" y="2" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="2" y="9" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="9" y="9" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  )
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="9" cy="9" r="2.5" stroke="var(--neutral-500)" strokeWidth="1.5"/>
      <path
        d="M9 2.5v1M9 14.5v1M2.5 9h-1M16.5 9h-1M4.464 4.464l-.707-.707M14.243 14.243l-.707-.707M4.464 13.536l-.707.707M14.243 3.757l-.707.707"
        stroke="var(--neutral-500)" strokeWidth="1.5" strokeLinecap="round"
      />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" stroke="var(--neutral-600)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

// Google Drive logo (4-part multicolor)
function GoogleDriveIcon({ size = 32 }: { size?: number }) {
  const s = size
  return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Blue triangle bottom-left */}
      <path d="M2.667 24.333L10.667 10.667L6 2.667L0 13.333L2.667 24.333Z" fill="#4285F4"/>
      {/* Red triangle top */}
      <path d="M16 2.667L10.667 10.667L21.333 10.667L26.667 2.667L16 2.667Z" fill="#EA4335"/>
      {/* Green triangle bottom-right */}
      <path d="M32 13.333L26 2.667L21.333 10.667L29.333 24.333L32 13.333Z" fill="#34A853"/>
      {/* Blue bar bottom */}
      <path d="M0 13.333L2.667 24.333L16 24.333L21.333 10.667L10.667 10.667L0 13.333Z" fill="#4285F4" opacity="0.3"/>
      {/* Full bottom bar */}
      <path d="M2.667 24.333H29.333L26.667 29.333H5.333L2.667 24.333Z" fill="#FBBC04"/>
      {/* Re-draw green */}
      <path d="M21.333 10.667L29.333 24.333H16L21.333 10.667Z" fill="#34A853" opacity="0.7"/>
    </svg>
  )
}

// Cleaner Google Drive icon using known proportions
function GDriveIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 27h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
    </svg>
  )
}

// GitHub icon
function GithubIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#1B1F23"/>
      <path
        fillRule="evenodd" clipRule="evenodd"
        d="M16 5.5C10.201 5.5 5.5 10.314 5.5 16.25c0 4.778 3.006 8.83 7.176 10.258.524.1.716-.234.716-.521 0-.258-.009-.938-.014-1.843-2.916.653-3.531-1.448-3.531-1.448-.477-1.249-1.165-1.58-1.165-1.58-.952-.669.073-.656.073-.656 1.052.076 1.606 1.114 1.606 1.114.935 1.647 2.453 1.171 3.051.896.095-.697.365-1.171.665-1.44-2.328-.272-4.779-1.201-4.779-5.344 0-1.179.41-2.144 1.082-2.898-.108-.273-.47-1.372.103-2.862 0 0 .883-.29 2.893 1.109A9.79 9.79 0 0116 10.93c.893.004 1.793.124 2.633.364 2.008-1.398 2.89-1.109 2.89-1.109.574 1.49.213 2.59.105 2.862.674.754 1.08 1.719 1.08 2.898 0 4.153-2.454 5.069-4.79 5.335.377.334.712.994.712 2.003 0 1.445-.013 2.608-.013 2.964 0 .29.19.626.72.52C23.497 25.077 26.5 21.027 26.5 16.25 26.5 10.314 21.799 5.5 16 5.5z"
        fill="white"
      />
    </svg>
  )
}

// ── Data ──────────────────────────────────────────────────────────────────────

type ConnectorIcon = 'google-drive' | 'github'
type ConnectorCategory = 'All' | 'Productivity' | 'Communication' | 'Design' | 'Interactive' | 'Data'

interface Connector {
  id:          string
  name:        string
  category:    Exclude<ConnectorCategory, 'All'>
  description: string
  connected:   boolean
  icon:        ConnectorIcon
}

const CONNECTORS: Connector[] = [
  {
    id: 'gd-1', name: 'Google Drive', category: 'Productivity',
    description: 'Access, attach, and search files from your Drive directly in chat and search files from your Drive directly in chat.',
    connected: true, icon: 'google-drive',
  },
  {
    id: 'gd-2', name: 'Google Drive', category: 'Productivity',
    description: 'Access, attach, and search files from your Drive directly in chat and search files from your Drive directly in chat.',
    connected: true, icon: 'google-drive',
  },
  {
    id: 'gd-3', name: 'Google Drive', category: 'Productivity',
    description: 'Access, attach, and search files from your Drive directly in chat and search files from your Drive directly in chat.',
    connected: true, icon: 'google-drive',
  },
  {
    id: 'gh-1', name: 'Github', category: 'Interactive',
    description: 'Reference repos, pull requests, and issues. Review code with full repo context.',
    connected: false, icon: 'github',
  },
  {
    id: 'gh-2', name: 'Github', category: 'Interactive',
    description: 'Reference repos, pull requests, and issues. Review code with full repo context.',
    connected: false, icon: 'github',
  },
  {
    id: 'gh-3', name: 'Github', category: 'Interactive',
    description: 'Reference repos, pull requests, and issues. Review code with full repo context.',
    connected: false, icon: 'github',
  },
  {
    id: 'gh-4', name: 'Github', category: 'Interactive',
    description: 'Reference repos, pull requests, and issues. Review code with full repo context.',
    connected: false, icon: 'github',
  },
  {
    id: 'gh-5', name: 'Github', category: 'Interactive',
    description: 'Reference repos, pull requests, and issues. Review code with full repo context.',
    connected: false, icon: 'github',
  },
  {
    id: 'gh-6', name: 'Github', category: 'Interactive',
    description: 'Reference repos, pull requests, and issues. Review code with full repo context.',
    connected: false, icon: 'github',
  },
]

const CATEGORIES: ConnectorCategory[] = ['All', 'Productivity', 'Communication', 'Design', 'Interactive', 'Data']

// ── Connector icon resolver ───────────────────────────────────────────────────

function ConnectorIcon({ icon }: { icon: ConnectorIcon }) {
  if (icon === 'google-drive') return <GDriveIcon />
  return <GithubIcon />
}

// ── Connector card ────────────────────────────────────────────────────────────

function ConnectorCard({
  connector,
  onManage,
}: {
  connector: Connector
  onManage?: (c: Connector) => void
}) {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius:    16,
      padding:         16,
      display:         'flex',
      flexDirection:   'column',
      gap:             12,
      boxShadow:       '0px 2px 2.8px 0px var(--neutral-200), 0px 0px 0px 1px var(--neutral-200)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Icon container */}
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            width:          38,
            height:         38,
            flexShrink:     0,
          }}>
            <div style={{ width: 32, height: 32, flexShrink: 0 }}>
              <ConnectorIcon icon={connector.icon} />
            </div>
          </div>
          {/* Name + category */}
          <div style={{ flex: '1 0 0', minWidth: 0 }}>
            <p style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   500,
              fontSize:     14,
              lineHeight:   '22px',
              color:        'var(--neutral-900)',
              margin:       0,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              {connector.name}
            </p>
            <p style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   500,
              fontSize:     11,
              lineHeight:   '16px',
              color:        'var(--neutral-500)',
              margin:       0,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              {connector.category}
            </p>
          </div>
        </div>
        {/* 3-dot menu button */}
        <button style={{
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          width:           36,
          height:          36,
          borderRadius:    10,
          border:          'none',
          backgroundColor: 'transparent',
          cursor:          'pointer',
          flexShrink:      0,
          color:           'var(--neutral-500)',
        }}>
          <MoreVerticalIcon size={20} />
        </button>
      </div>

      {/* Description */}
      <p style={{
        fontFamily:    'var(--font-body)',
        fontWeight:    400,
        fontSize:      11,
        lineHeight:    '16px',
        color:         'var(--neutral-500)',
        margin:        0,
        overflow:      'hidden',
        display:       '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
      } as React.CSSProperties}>
        {connector.description}
      </p>

      {/* Footer button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {connector.connected ? (
          <button
            onClick={() => onManage?.(connector)}
            style={{
              display:         'inline-flex',
              alignItems:      'center',
              justifyContent:  'center',
              padding:         '5px 10px',
              borderRadius:    8,
              border:          'none',
              cursor:          'pointer',
              backgroundColor: 'white',
              boxShadow:       '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100), inset 0px -2.182px 0.364px 0px var(--neutral-100)',
              fontFamily:      'var(--font-body)',
              fontWeight:      500,
              fontSize:        14,
              lineHeight:      '22px',
              color:           'var(--neutral-700)',
              whiteSpace:      'nowrap',
            }}
          >
            Manage
          </button>
        ) : (
          <button style={{
            display:         'inline-flex',
            alignItems:      'center',
            justifyContent:  'center',
            padding:         '5px 10px',
            borderRadius:    8,
            border:          'none',
            cursor:          'pointer',
            background:      'linear-gradient(180deg, var(--neutral-700) 0%, var(--neutral-900) 100%)',
            boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.24), 0px 0px 0px 1px var(--neutral-800)',
            fontFamily:      'var(--font-body)',
            fontWeight:      500,
            fontSize:        14,
            lineHeight:      '22px',
            color:           'white',
            whiteSpace:      'nowrap',
          }}>
            Connect
          </button>
        )}
      </div>
    </div>
  )
}

// ── Tool permissions modal ────────────────────────────────────────────────────

type ToolPermission = 'Always allow' | 'Ask' | 'Never'

interface PermissionGroup {
  label:       string
  count:       number
  permission:  ToolPermission
}

function PermissionDropdown({
  value,
  onChange,
}: {
  value:    ToolPermission
  onChange: (v: ToolPermission) => void
}) {
  const [open, setOpen] = useState(false)
  const OPTIONS: ToolPermission[] = ['Always allow', 'Ask', 'Never']

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display:         'inline-flex',
          alignItems:      'center',
          gap:             6,
          padding:         '4px 10px',
          borderRadius:    8,
          border:          'none',
          cursor:          'pointer',
          backgroundColor: 'white',
          boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)',
          fontFamily:      'var(--font-body)',
          fontWeight:      500,
          fontSize:        13,
          lineHeight:      '20px',
          color:           'var(--neutral-700)',
          whiteSpace:      'nowrap',
        }}
      >
        {value}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="var(--neutral-500)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position:        'absolute',
            right:           0,
            top:             'calc(100% + 4px)',
            backgroundColor: 'white',
            borderRadius:    10,
            boxShadow:       '0px 4px 16px 0px rgba(38,33,30,0.12), 0px 0px 0px 1px var(--neutral-100)',
            overflow:        'hidden',
            zIndex:          20,
            minWidth:        120,
          }}>
            {OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false) }}
                style={{
                  display:         'flex',
                  width:           '100%',
                  padding:         '8px 12px',
                  border:          'none',
                  backgroundColor: opt === value ? 'var(--neutral-50)' : 'transparent',
                  cursor:          'pointer',
                  fontFamily:      'var(--font-body)',
                  fontWeight:      opt === value ? 500 : 400,
                  fontSize:        13,
                  lineHeight:      '20px',
                  color:           'var(--neutral-700)',
                  textAlign:       'left',
                  whiteSpace:      'nowrap',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ToolPermissionsModal({
  connector,
  onClose,
}: {
  connector: Connector
  onClose:   () => void
}) {
  const [groups, setGroups] = useState<PermissionGroup[]>([
    { label: 'Read-only tools',   count: 23, permission: 'Always allow' },
    { label: 'Write/delete tools', count: 28, permission: 'Always allow' },
  ])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const setPermission = (idx: number, v: ToolPermission) => {
    setGroups(prev => prev.map((g, i) => i === idx ? { ...g, permission: v } : g))
  }

  const toggleExpanded = (label: string) => {
    setExpanded(prev => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:        'fixed',
          inset:           0,
          backgroundColor: 'rgba(38,33,30,0.32)',
          zIndex:          50,
        }}
      />

      {/* Modal */}
      <div style={{
        position:        'fixed',
        top:             '50%',
        left:            '50%',
        transform:       'translate(-50%, -50%)',
        zIndex:          51,
        backgroundColor: 'white',
        borderRadius:    16,
        boxShadow:       '0px 8px 32px 0px rgba(38,33,30,0.18), 0px 0px 0px 1px var(--neutral-100)',
        width:           680,
        maxWidth:        'calc(100vw - 48px)',
        maxHeight:       'calc(100vh - 96px)',
        overflowY:       'auto',
      }}>
        {/* Modal header */}
        <div style={{
          display:      'flex',
          alignItems:   'center',
          padding:      '20px 24px 16px',
          borderBottom: '1px solid var(--neutral-100)',
        }}>
          <div style={{ flex: '1 0 0', minWidth: 0 }}>
            <h2 style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize:   18,
              lineHeight: '26px',
              color:      'var(--neutral-900)',
              margin:     0,
            }}>
              {connector.name}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button style={{
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              width:           32,
              height:          32,
              borderRadius:    8,
              border:          'none',
              backgroundColor: 'transparent',
              cursor:          'pointer',
            }}>
              <GearIcon />
            </button>
            <button
              onClick={onClose}
              style={{
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                width:           32,
                height:          32,
                borderRadius:    8,
                border:          'none',
                backgroundColor: 'transparent',
                cursor:          'pointer',
              }}
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* Description */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-500)',
            margin:     0,
          }}>
            {connector.icon === 'github'
              ? 'The GitHub connector enables secure, real-time interaction between AI agents like Claude and your GitHub repositories. Reference repos, pull requests, and issues. Review code with full repo context.'
              : 'The Google Drive connector enables secure, real-time interaction between AI agents like Claude and your Drive. Access, attach, and search files from your Drive directly in chat.'}
          </p>
        </div>

        {/* Tool permissions section */}
        <div style={{ padding: '20px 24px' }}>
          <p style={{
            fontFamily:  'var(--font-body)',
            fontWeight:  600,
            fontSize:    14,
            lineHeight:  '22px',
            color:       'var(--neutral-900)',
            margin:      '0 0 4px',
          }}>
            Tool permissions
          </p>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   13,
            lineHeight: '20px',
            color:      'var(--neutral-500)',
            margin:     '0 0 16px',
          }}>
            Choose when Souvenir is allowed to use these tools.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {groups.map((group, idx) => (
              <div key={group.label}>
                {idx > 0 && (
                  <div style={{ height: 1, backgroundColor: 'var(--neutral-100)', margin: '0' }} />
                )}
                <div style={{
                  display:    'flex',
                  alignItems: 'center',
                  gap:        12,
                  padding:    '14px 0',
                }}>
                  {/* Chevron + label */}
                  <button
                    onClick={() => toggleExpanded(group.label)}
                    style={{
                      display:         'flex',
                      alignItems:      'center',
                      gap:             8,
                      flex:            '1 0 0',
                      minWidth:        0,
                      border:          'none',
                      backgroundColor: 'transparent',
                      cursor:          'pointer',
                      padding:         0,
                      textAlign:       'left',
                    }}
                  >
                    <ChevronRightIcon rotated={expanded[group.label]} />
                    <span style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                      fontSize:   14,
                      lineHeight: '22px',
                      color:      'var(--neutral-900)',
                    }}>
                      {group.label}
                    </span>
                    {/* Count badge */}
                    <span style={{
                      display:         'inline-flex',
                      alignItems:      'center',
                      justifyContent:  'center',
                      padding:         '1px 5px',
                      borderRadius:    6,
                      backgroundColor: 'var(--neutral-100)',
                      fontFamily:      'var(--font-body)',
                      fontWeight:      500,
                      fontSize:        11,
                      lineHeight:      '16px',
                      color:           'var(--neutral-600)',
                    }}>
                      {group.count}
                    </span>
                  </button>

                  <PermissionDropdown
                    value={group.permission}
                    onChange={v => setPermission(idx, v)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ConnectorsPage() {
  const [mainTab,           setMainTab]           = useState('my')
  const [category,          setCategory]          = useState<ConnectorCategory>('All')
  const [searchQuery,       setSearchQuery]       = useState('')
  const [isSearching,       setIsSearching]       = useState(false)
  const [suggestionsOn,     setSuggestionsOn]     = useState(false)
  const [modalConnector,    setModalConnector]    = useState<Connector | null>(null)

  const filtered = (() => {
    let list = CONNECTORS
    if (isSearching && searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q))
    } else if (category !== 'All') {
      list = list.filter(c => c.category === category)
    }
    return list
  })()

  const connectedCount = CONNECTORS.filter(c => c.connected).length

  const handleSearchFocus = () => setIsSearching(true)
  const handleBack = () => {
    setIsSearching(false)
    setSearchQuery('')
  }

  return (
    <>
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
          padding:        '96px 12px 48px',
        }}
      >
        <div style={{
          flex:          '1 0 0',
          maxWidth:      967,
          minWidth:      0,
          display:       'flex',
          flexDirection: 'column',
          gap:           10,
        }}>

          {/* ── Page header ── */}
          <div style={{ paddingLeft: 4, marginBottom: 16 }}>
            <h1 style={{
              fontFamily: 'var(--font-title)',
              fontWeight: 400,
              fontSize:   24,
              lineHeight: '32px',
              color:      'var(--neutral-900)',
              margin:     '0 0 12px',
            }}>
              Connectors
            </h1>
            {/* Main tab: My Connectors / Workspace Connectors */}
            <Tabs value={mainTab} onValueChange={setMainTab}>
              <TabsList>
                <TabsTrigger value="my">My Connectors</TabsTrigger>
                <TabsTrigger value="workspace">Workspace Connectors</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* ── Suggestions toggle card ── */}
          <div style={{
            border:        '1px solid var(--neutral-200)',
            borderRadius:  16,
            boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
            padding:       '14px 20px',
            display:       'flex',
            alignItems:    'center',
            gap:           12,
          }}>
            <Switch
              checked={suggestionsOn}
              onCheckedChange={setSuggestionsOn}
            />
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-900)',
                margin:     0,
              }}>
                Surface connector suggestions in chat
              </p>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-500)',
                margin:     0,
              }}>
                Souvenir proactively suggests relevant connectors based on what you&apos;re working on
              </p>
            </div>
          </div>

          {/* ── Main connectors card ── */}
          <div style={{
            border:       '1px solid var(--neutral-200)',
            borderRadius: 16,
            boxShadow:    '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
            overflow:     'hidden',
          }}>
            {/* Toolbar: category tabs OR Back button + search */}
            <div style={{
              display:      'flex',
              alignItems:   'center',
              gap:          12,
              padding:      '12px 16px',
              borderBottom: '1px solid var(--neutral-100)',
            }}>
              {isSearching ? (
                /* Back button */
                <button
                  onClick={handleBack}
                  style={{
                    display:         'inline-flex',
                    alignItems:      'center',
                    gap:             6,
                    padding:         '6px 12px',
                    borderRadius:    10,
                    border:          'none',
                    cursor:          'pointer',
                    background:      'linear-gradient(180deg, var(--neutral-700) 0%, var(--neutral-900) 100%)',
                    boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.24), 0px 0px 0px 1px var(--neutral-800)',
                    fontFamily:      'var(--font-body)',
                    fontWeight:      500,
                    fontSize:        14,
                    lineHeight:      '22px',
                    color:           'white',
                    whiteSpace:      'nowrap',
                    flexShrink:      0,
                  }}
                >
                  <ArrowLeftIcon />
                  Back
                </button>
              ) : (
                /* Category tabs */
                <div style={{ flex: '1 0 0', minWidth: 0 }}>
                  <Tabs value={category} onValueChange={v => setCategory(v as ConnectorCategory)}>
                    <TabsList size="small">
                      <TabsTrigger value="All" icon={<GridIcon />}>All</TabsTrigger>
                      <TabsTrigger value="Productivity">Productivity</TabsTrigger>
                      <TabsTrigger value="Communication">Communication</TabsTrigger>
                      <TabsTrigger value="Design">Design</TabsTrigger>
                      <TabsTrigger value="Interactive">Interactive</TabsTrigger>
                      <TabsTrigger value="Data">Data</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              )}

              {/* Search input */}
              <div style={{
                display:      'flex',
                alignItems:   'center',
                gap:          8,
                width:        280,
                flexShrink:   0,
                backgroundColor: 'white',
                borderRadius: 10,
                boxShadow:    '0px 1px 1.5px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-200)',
                padding:      '6px 10px',
              }}>
                <SearchIcon />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={handleSearchFocus}
                  placeholder="Search connectors"
                  style={{
                    flex:        '1 0 0',
                    minWidth:    0,
                    border:      'none',
                    outline:     'none',
                    fontFamily:  'var(--font-body)',
                    fontWeight:  400,
                    fontSize:    14,
                    lineHeight:  '22px',
                    color:       'var(--neutral-700)',
                    background:  'transparent',
                  }}
                />
              </div>
            </div>

            {/* Connector grid content */}
            <div style={{ padding: '16px' }}>
              {isSearching ? (
                /* Flat search results */
                filtered.length > 0 ? (
                  <div style={{
                    display:             'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap:                 12,
                  }}>
                    {filtered.map(c => (
                      <ConnectorCard key={c.id} connector={c} onManage={setModalConnector} />
                    ))}
                  </div>
                ) : (
                  <p style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 400,
                    fontSize:   14,
                    lineHeight: '22px',
                    color:      'var(--neutral-400)',
                    margin:     0,
                    padding:    '24px 8px',
                    textAlign:  'center',
                  }}>
                    No connectors found for &ldquo;{searchQuery}&rdquo;
                  </p>
                )
              ) : (
                <>
                  {/* Connected section */}
                  {(() => {
                    const connected = filtered.filter(c => c.connected)
                    if (connected.length === 0) return null
                    return (
                      <div style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <p style={{
                            fontFamily: 'var(--font-body)',
                            fontWeight: 500,
                            fontSize:   14,
                            lineHeight: '22px',
                            color:      'var(--neutral-900)',
                            margin:     0,
                          }}>
                            Connected
                          </p>
                          {/* Green badge */}
                          <span style={{
                            display:         'inline-flex',
                            alignItems:      'center',
                            padding:         '1px 6px',
                            borderRadius:    6,
                            backgroundColor: 'var(--green-50)',
                            boxShadow:       '0px 0px 0px 1px rgba(128,183,7,0.4)',
                            fontFamily:      'var(--font-body)',
                            fontWeight:      500,
                            fontSize:        11,
                            lineHeight:      '16px',
                            color:           'var(--green-800)',
                          }}>
                            {connectedCount} active
                          </span>
                        </div>
                        <div style={{
                          display:             'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap:                 12,
                        }}>
                          {connected.map(c => (
                            <ConnectorCard key={c.id} connector={c} onManage={setModalConnector} />
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Available to connect section */}
                  {(() => {
                    const available = filtered.filter(c => !c.connected)
                    if (available.length === 0) return null
                    return (
                      <div>
                        <p style={{
                          fontFamily:  'var(--font-body)',
                          fontWeight:  500,
                          fontSize:    14,
                          lineHeight:  '22px',
                          color:       'var(--neutral-900)',
                          margin:      '0 0 12px',
                        }}>
                          Available to connect
                        </p>
                        <div style={{
                          display:             'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap:                 12,
                        }}>
                          {available.map(c => (
                            <ConnectorCard key={c.id} connector={c} onManage={setModalConnector} />
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Tool permissions modal */}
      {modalConnector && (
        <ToolPermissionsModal
          connector={modalConnector}
          onClose={() => setModalConnector(null)}
        />
      )}
    </>
  )
}
