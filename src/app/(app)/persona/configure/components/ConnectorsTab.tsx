'use client'

import { useState, useRef } from 'react'
import {
  Search,
  ArrowDownToLine,
  SlidersHorizontal,
  ChevronDown,
  Eye,
  MoreHorizontal,
  Upload,
  Plus,
} from 'lucide-react'

export type ConnectorItem = {
  id: string
  name: string
  type: 'file' | 'url' | 'connected'
  fileType?: string
  size?: string
  date?: string
  source?: 'drive' | 'slack' | 'onedrive'
  priority: 'Priority' | 'Normal' | 'Low'
}

type ConnectorsTabProps = {
  items: ConnectorItem[]
  onItemsChange: (items: ConnectorItem[]) => void
}

const FILE_BADGE_COLORS: Record<string, { bg: string; border: string; text: string; innerShadow: string }> = {
  PDF:  { bg: '#cadcf1', border: 'rgba(13,110,178,0.5)',  text: '#135487', innerShadow: 'inset 0px 1px 0px 0px rgba(231,244,253,0.7), inset 0px -1px 0px 0px rgba(13,110,178,0.1)' },
  DOCX: { bg: '#cadcf1', border: 'rgba(13,110,178,0.5)',  text: '#135487', innerShadow: 'inset 0px 1px 0px 0px rgba(231,244,253,0.7), inset 0px -1px 0px 0px rgba(13,110,178,0.1)' },
  TXT:  { bg: '#cadcf1', border: 'rgba(13,110,178,0.5)',  text: '#135487', innerShadow: 'inset 0px 1px 0px 0px rgba(231,244,253,0.7), inset 0px -1px 0px 0px rgba(13,110,178,0.1)' },
  CSV:  { bg: '#cadcf1', border: 'rgba(13,110,178,0.5)',  text: '#135487', innerShadow: 'inset 0px 1px 0px 0px rgba(231,244,253,0.7), inset 0px -1px 0px 0px rgba(13,110,178,0.1)' },
  XLSX: { bg: '#cadcf1', border: 'rgba(13,110,178,0.5)',  text: '#135487', innerShadow: 'inset 0px 1px 0px 0px rgba(231,244,253,0.7), inset 0px -1px 0px 0px rgba(13,110,178,0.1)' },
  MD:   { bg: '#cadcf1', border: 'rgba(13,110,178,0.5)',  text: '#135487', innerShadow: 'inset 0px 1px 0px 0px rgba(231,244,253,0.7), inset 0px -1px 0px 0px rgba(13,110,178,0.1)' },
  JSON: { bg: '#cadcf1', border: 'rgba(13,110,178,0.5)',  text: '#135487', innerShadow: 'inset 0px 1px 0px 0px rgba(231,244,253,0.7), inset 0px -1px 0px 0px rgba(13,110,178,0.1)' },
  URL:  { bg: '#ffbfb6', border: 'rgba(159,38,35,0.5)',   text: '#7a201c', innerShadow: 'inset 0px 1px 0px 0px rgba(253,231,231,0.7), inset 0px -1px 0px 0px rgba(159,38,35,0.1)' },
  URLs: { bg: '#ffbfb6', border: 'rgba(159,38,35,0.5)',   text: '#7a201c', innerShadow: 'inset 0px 1px 0px 0px rgba(253,231,231,0.7), inset 0px -1px 0px 0px rgba(159,38,35,0.1)' },
}

function FileBadge({ label }: { label: string }) {
  const c = FILE_BADGE_COLORS[label] ?? { bg: '#ede1d7', border: 'rgba(106,98,93,0.5)', text: '#524b47', innerShadow: '' }
  return (
    <span
      style={{
        fontFamily: 'var(--font-body)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 20,
        padding: '0 4px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        backgroundColor: c.bg,
        color: c.text,
        boxShadow: `0px 1px 1.5px 0px rgba(2,15,24,0.2), 0px 0px 0px 1px ${c.border}, ${c.innerShadow}`,
      }}
    >
      {label}
    </span>
  )
}

function NeutralChip({ label }: { label: string }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 11,
        fontWeight: 500,
        lineHeight: '16px',
        color: '#524b47',
        padding: '2px 4px',
        borderRadius: 6,
        backgroundColor: '#ede1d7',
        boxShadow: '0px 1px 1.5px 0px rgba(18,12,8,0.2), 0px 0px 0px 1px rgba(106,98,93,0.5), inset 0px 1px 0px 0px rgba(247,242,237,0.7), inset 0px -1px 0px 0px rgba(106,98,93,0.1)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

const CONNECTOR_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  drive:    { bg: '#e8f0fe', fg: '#1a73e8', label: 'Drive' },
  slack:    { bg: '#fce8ff', fg: '#4a154b', label: 'Slack' },
  onedrive: { bg: '#e3f2fd', fg: '#0078d4', label: 'OneDrive' },
}

function ConnectorDot({ source }: { source: 'drive' | 'slack' | 'onedrive' }) {
  return (
    <div
      style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        flexShrink: 0,
        backgroundColor: CONNECTOR_COLORS[source]?.fg ?? '#827a74',
      }}
    />
  )
}

function PriorityDropdown({ priority, onSelect }: { priority: string; onSelect: (p: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          height: 32,
          padding: '5px 8px',
          borderRadius: 8,
          border: 'none',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)',
        }}
      >
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: '#524b47', whiteSpace: 'nowrap' }}>
          {priority}
        </span>
        <ChevronDown size={16} color="#524b47" />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 36,
            right: 0,
            zIndex: 20,
            backgroundColor: 'white',
            borderRadius: 8,
            border: '1px solid #d1c6bd',
            boxShadow: '0 4px 8px rgba(0,0,0,0.08)',
            padding: '4px 0',
            minWidth: 110,
          }}
        >
          {(['Priority', 'Normal', 'Low'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => { onSelect(p); setOpen(false) }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 12px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: '#3b3632',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FileRow({ item, onRemove, onPriority }: {
  item: ConnectorItem
  onRemove: (id: string) => void
  onPriority: (id: string, p: string) => void
}) {
  const badge = item.type === 'url' ? 'URLs' : (item.fileType ?? 'PDF')
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 56,
        padding: '0 12px',
        borderRadius: 12,
        backgroundColor: 'white',
        boxShadow: '0px 0px 0px 1px white',
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <p
        style={{
          flex: '1 0 0',
          minWidth: 0,
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          fontWeight: 500,
          color: '#3b3632',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          margin: 0,
        }}
      >
        {item.name}
      </p>
      <div style={{ display: 'flex', gap: 17, alignItems: 'center', width: 265, flexShrink: 0 }}>
        <FileBadge label={badge} />
        {item.size && (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, color: '#6a625d', whiteSpace: 'nowrap' }}>
            {item.size}
          </span>
        )}
        {item.date && (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, color: '#6a625d', whiteSpace: 'nowrap' }}>
            {item.date}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
        <PriorityDropdown priority={item.priority} onSelect={p => onPriority(item.id, p)} />
        <button
          type="button"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 8,
            border: '0.727px solid rgba(59,54,50,0.3)', backgroundColor: 'transparent', cursor: 'pointer',
          }}
        >
          <Eye size={20} color="#524b47" />
        </button>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 8,
            border: '0.727px solid rgba(59,54,50,0.3)', backgroundColor: 'transparent', cursor: 'pointer',
          }}
        >
          <MoreHorizontal size={20} color="#524b47" />
        </button>
      </div>
    </div>
  )
}

function ConnectedRow({ item, onRemove, onPriority }: {
  item: ConnectorItem
  onRemove: (id: string) => void
  onPriority: (id: string, p: string) => void
}) {
  const src = item.source ?? 'drive'
  const colors = CONNECTOR_COLORS[src]
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 56,
        padding: '0 12px',
        borderRadius: 12,
        backgroundColor: 'white',
        boxShadow: '0px 0px 0px 1px white',
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', flex: '1 0 0', minWidth: 0, alignItems: 'center', gap: 8 }}>
        {/* Source app icon */}
        <div
          style={{
            width: 35,
            height: 35,
            borderRadius: 6,
            flexShrink: 0,
            backgroundColor: colors.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: colors.fg }}>
            {colors.label[0]}
          </span>
        </div>
        <p
          style={{
            flex: '1 0 0',
            minWidth: 0,
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 500,
            color: '#3b3632',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            margin: 0,
          }}
        >
          {item.name}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 17, alignItems: 'center', width: 265, flexShrink: 0 }}>
        {item.size && (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, color: '#6a625d', whiteSpace: 'nowrap' }}>
            {item.size}
          </span>
        )}
        {item.date && (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, color: '#6a625d', whiteSpace: 'nowrap' }}>
            {item.date}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
        <PriorityDropdown priority={item.priority} onSelect={p => onPriority(item.id, p)} />
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 8,
            border: '0.727px solid rgba(59,54,50,0.3)', backgroundColor: 'transparent', cursor: 'pointer',
          }}
        >
          <MoreHorizontal size={20} color="#524b47" />
        </button>
      </div>
    </div>
  )
}

export default function ConnectorsTab({ items, onItemsChange }: ConnectorsTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [connectorFilter, setConnectorFilter] = useState<'all' | 'drive' | 'slack' | 'onedrive'>('all')

  const today = () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newItems: ConnectorItem[] = Array.from(e.target.files ?? []).map(f => ({
      id: crypto.randomUUID(),
      name: f.name,
      type: 'file',
      fileType: f.name.split('.').pop()?.toUpperCase() ?? 'PDF',
      size: `${(f.size / 1024 / 1024).toFixed(1)} MB`,
      date: today(),
      priority: 'Priority',
    }))
    onItemsChange([...items, ...newItems])
    e.target.value = ''
  }

  const handleAddUrl = () => {
    const url = urlInput.trim()
    if (!url) return
    onItemsChange([
      ...items,
      { id: crypto.randomUUID(), name: url, type: 'url', date: today(), priority: 'Priority' },
    ])
    setUrlInput('')
    setShowUrlInput(false)
  }

  const handleRemove = (id: string) => onItemsChange(items.filter(i => i.id !== id))

  const handlePriority = (id: string, priority: string) =>
    onItemsChange(items.map(i => i.id === id ? { ...i, priority: priority as ConnectorItem['priority'] } : i))

  const matches = (item: ConnectorItem) =>
    !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase())

  const fileItems = items.filter(i => i.type === 'file' && matches(i))
  const urlItems  = items.filter(i => i.type === 'url' && matches(i))
  const connectedItems = items.filter(
    i => i.type === 'connected' && matches(i) && (connectorFilter === 'all' || i.source === connectorFilter)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h2
            style={{
              fontFamily: 'var(--font-title)',
              fontWeight: 400,
              fontSize: 24,
              lineHeight: '32px',
              color: '#1a1916',
              margin: 0,
              whiteSpace: 'nowrap',
            }}
          >
            Connectors Management
          </h2>
          {items.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <NeutralChip label={`${items.length} ${items.length === 1 ? 'file' : 'files'}`} />
              <NeutralChip label="Updated just now" />
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {!showUrlInput && (
            <button
              type="button"
              onClick={() => setShowUrlInput(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                height: 36,
                padding: '6px 10px',
                borderRadius: 10,
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)',
              }}
            >
              <Plus size={16} color="#524b47" />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: '#524b47', whiteSpace: 'nowrap' }}>
                Add URL
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              height: 36,
              padding: '6px 10px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              overflow: 'hidden',
              boxShadow:
                '0px 0px 0px 1px black, 0px 1.091px 1.091px 0px rgba(59,54,50,0.1), 0px 1.455px 3.127px 0px rgba(59,54,50,0.4)',
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, #524b47 0%, #26211e 100%)',
                pointerEvents: 'none',
              }}
            />
            <div
              aria-hidden
              style={{
                position: 'absolute', inset: 0, borderRadius: 'inherit',
                boxShadow:
                  'inset 0px 1px 0.364px 0px rgba(247,242,237,0.3), inset 0px -2.182px 0.364px 0px #120c08, inset 0px -2.545px 4px -2.182px rgba(247,242,237,0.5)',
                pointerEvents: 'none',
              }}
            />
            <Upload size={16} color="#f7f2ed" style={{ position: 'relative', flexShrink: 0 }} />
            <span
              style={{
                position: 'relative',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: 500,
                color: '#f7f2ed',
                whiteSpace: 'nowrap',
                textShadow: '0px -0.727px 0.364px rgba(0,0,0,0.25), 0px 0.364px 0.364px rgba(255,255,255,0.25)',
              }}
            >
              Upload
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,.csv,.md,.json,.xlsx"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {/* ── URL input ───────────────────────────────────────────────────────── */}
      {showUrlInput && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div
            style={{
              flex: '1 0 0',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              padding: '7px 10px',
              borderRadius: 10,
              boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px #ede1d7',
            }}
          >
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddUrl()
                if (e.key === 'Escape') { setShowUrlInput(false); setUrlInput('') }
              }}
              placeholder="Paste a URL…"
              autoFocus
              style={{
                flex: 1,
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                color: '#3b3632',
                backgroundColor: 'transparent',
                outline: 'none',
                border: 'none',
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleAddUrl}
            style={{
              position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: 36, padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', overflow: 'hidden',
              boxShadow:
                '0px 0px 0px 1px black, 0px 1.091px 1.091px 0px rgba(59,54,50,0.1), 0px 1.455px 3.127px 0px rgba(59,54,50,0.4)',
            }}
          >
            <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #524b47 0%, #26211e 100%)', pointerEvents: 'none' }} />
            <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', boxShadow: 'inset 0px 1px 0.364px 0px rgba(247,242,237,0.3), inset 0px -2.182px 0.364px 0px #120c08', pointerEvents: 'none' }} />
            <span style={{ position: 'relative', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: '#f7f2ed', whiteSpace: 'nowrap' }}>
              Add
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setShowUrlInput(false); setUrlInput('') }}
            style={{
              fontFamily: 'var(--font-body)', fontSize: 14, color: '#6a625d',
              height: 36, padding: '6px 8px', borderRadius: 10, border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Search + filter bar ─────────────────────────────────────────────── */}
      {items.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div
            style={{
              flex: '1 0 0',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              padding: '7px 10px',
              borderRadius: 10,
              boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px #ede1d7',
            }}
          >
            <Search size={16} color="#6a625d" style={{ flexShrink: 0 }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search knowledge…"
              style={{
                flex: 1,
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                color: '#6a625d',
                backgroundColor: 'transparent',
                outline: 'none',
                border: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '0 4px' }}>
            <button
              type="button"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, borderRadius: 8, border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}
            >
              <ArrowDownToLine size={20} color="#524b47" />
            </button>
            <button
              type="button"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, borderRadius: 8, border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}
            >
              <SlidersHorizontal size={20} color="#524b47" />
            </button>
          </div>
        </div>
      )}

      {/* ── Files section ───────────────────────────────────────────────────── */}
      {fileItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '21px', color: '#0a0a0a', margin: 0 }}>
            Files
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {fileItems.map(item => (
              <FileRow key={item.id} item={item} onRemove={handleRemove} onPriority={handlePriority} />
            ))}
          </div>
        </div>
      )}

      {/* ── URLs section ────────────────────────────────────────────────────── */}
      {urlItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '21px', color: '#0a0a0a', margin: 0 }}>
            Web sights – Urls
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {urlItems.map(item => (
              <FileRow key={item.id} item={item} onRemove={handleRemove} onPriority={handlePriority} />
            ))}
          </div>
        </div>
      )}

      {/* ── Connected section ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '21px', color: '#0a0a0a', margin: 0 }}>
          Connected
        </p>

        {/* Connector filter pills */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {(['drive', 'slack', 'onedrive'] as const).map(src => {
            const active = connectorFilter === src
            return (
              <button
                key={src}
                type="button"
                onClick={() => setConnectorFilter(active ? 'all' : src)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  height: 32,
                  padding: '5px 8px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: active ? '#ede1d7' : 'transparent',
                  cursor: 'pointer',
                  boxShadow: active
                    ? '0px 0px 0px 1px rgba(59,54,50,0.4)'
                    : '0px 0px 0px 1px rgba(59,54,50,0.3)',
                  transition: 'background-color 150ms, box-shadow 150ms',
                }}
              >
                <ConnectorDot source={src} />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: '#524b47', whiteSpace: 'nowrap' }}>
                  {CONNECTOR_COLORS[src].label}
                </span>
                <ChevronDown size={16} color="#524b47" />
              </button>
            )
          })}
        </div>

        {/* Connected rows */}
        {connectedItems.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {connectedItems.map(item => (
              <ConnectedRow key={item.id} item={item} onRemove={handleRemove} onPriority={handlePriority} />
            ))}
          </div>
        ) : (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              lineHeight: '20px',
              color: '#9c938b',
              margin: 0,
              padding: '16px 0',
            }}
          >
            {connectorFilter === 'all'
              ? 'No connected files yet. Connect Drive, Slack, or OneDrive to get started.'
              : `No ${CONNECTOR_COLORS[connectorFilter].label} files connected.`}
          </p>
        )}
      </div>

    </div>
  )
}
