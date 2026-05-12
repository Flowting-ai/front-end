'use client'

import React, { useRef } from 'react'
import { PlusSignIcon, CancelOneIcon, FolderOneIcon, FileTwoIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Badge } from '@/components/Badge'
import type { ProjectFile } from '@/context/projects-context'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProjectFilesPanelProps {
  files:      ProjectFile[]
  usedBytes:  number
  totalBytes: number
  onUpload?:  (files: FileList) => void
  onRemove?:  (fileId: string) => void
}

// ── File type → badge color mapping ──────────────────────────────────────────

function fileBadgeColor(type: string) {
  const t = type.toUpperCase()
  if (t === 'PDF')           return 'Red'    as const
  if (t === 'FIG')           return 'Blue'   as const
  if (t === 'DOC' || t === 'DOCX') return 'Blue' as const
  if (t === 'MD')            return 'Neutral' as const
  if (t === 'URL')           return 'Green'  as const
  return 'Neutral' as const
}

function formatBytes(bytes: number) {
  if (bytes < 1024)           return `${bytes} B`
  if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Component ──────────────────────────────────────────────────────────────────

export const ProjectFilesPanel = React.forwardRef<HTMLDivElement, ProjectFilesPanelProps>(
  function ProjectFilesPanel({ files, usedBytes, totalBytes, onUpload, onRemove }, ref) {
    const inputRef   = useRef<HTMLInputElement>(null)
    const isEmpty    = files.length === 0
    const usedMB     = (usedBytes / (1024 * 1024)).toFixed(0)
    const totalMB    = (totalBytes / (1024 * 1024)).toFixed(0)
    const usedPct    = Math.min(100, (usedBytes / totalBytes) * 100)
    const urlCount   = files.filter(f => f.type === 'URL').length
    const fileCount  = files.length - urlCount

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
      if (e.target.files && e.target.files.length > 0) {
        onUpload?.(e.target.files)
      }
    }

    function handleDropZoneClick() {
      inputRef.current?.click()
    }

    function handleDrop(e: React.DragEvent) {
      e.preventDefault()
      if (e.dataTransfer.files.length > 0) {
        onUpload?.(e.dataTransfer.files)
      }
    }

    function handleDragOver(e: React.DragEvent) {
      e.preventDefault()
    }

    return (
      <div
        ref={ref}
        style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           '12px',
          padding:       '12px 12px 16px',
          borderRadius:  '16px',
          background:    'var(--neutral-50)',
          border:        '1px dashed var(--neutral-300)',
          boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
          width:         '100%',
          flex:          '1 1 0',
          boxSizing:     'border-box',
          overflow:      'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 'var(--font-weight-regular)',
              fontSize:   '16px',
              lineHeight: 'var(--line-height-body)',
              color:      '#000',
              margin:     0,
            }}
          >
            {isEmpty
              ? 'Files'
              : `${fileCount} ${fileCount === 1 ? 'File' : 'Files'}${urlCount > 0 ? ` / ${urlCount} ${urlCount === 1 ? 'Url' : 'Urls'}` : ''}`}
          </p>
          <IconButton
            variant="ghost"
            size="xs"
            icon={<PlusSignIcon />}
            aria-label="Upload file"
            onClick={handleDropZoneClick}
          />
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />

        {!isEmpty && (
          <>
            {/* Capacity bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
              <div
                style={{
                  height:       '4px',
                  borderRadius: '2px',
                  background:   'var(--neutral-200)',
                  overflow:     'hidden',
                }}
              >
                <div
                  style={{
                    height:       '100%',
                    width:        `${usedPct}%`,
                    background:   'var(--blue-500)',
                    borderRadius: 'inherit',
                    transition:   'width 300ms ease',
                  }}
                />
              </div>
              <p
                style={{
                  fontFamily:  'var(--font-body)',
                  fontWeight:  'var(--font-weight-regular)',
                  fontSize:    '11px',
                  lineHeight:  '16px',
                  color:       '#857a72',
                  margin:      0,
                }}
              >
                {usedMB} MB of {totalMB} MB used
              </p>
            </div>

            {/* File list */}
            <div
              style={{
                display:   'flex',
                flexDirection: 'column',
                gap:       '2px',
                overflowY: 'auto',
                flex:      '1 1 0',
              }}
            >
              {files.map((file) => (
                <div
                  key={file.id}
                  style={{
                    display:         'flex',
                    alignItems:      'center',
                    gap:             '8px',
                    padding:         '6px 8px',
                    borderRadius:    '8px',
                    backgroundColor: 'transparent',
                    transition:      'background-color 120ms ease',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--neutral-100)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent' }}
                >
                  <FileTwoIcon style={{ width: 16, height: 16, color: '#857a72', flexShrink: 0 }} />
                  <span
                    style={{
                      flex:        '1 0 0',
                      minWidth:    0,
                      fontFamily:  'var(--font-body)',
                      fontWeight:  'var(--font-weight-regular)',
                      fontSize:    '13px',
                      lineHeight:  '20px',
                      color:       '#1a1714',
                      overflow:    'hidden',
                      textOverflow:'ellipsis',
                      whiteSpace:  'nowrap',
                    }}
                  >
                    {file.name}
                  </span>
                  <Badge label={file.type} color={fileBadgeColor(file.type)} />
                  <span
                    style={{
                      fontFamily:  'var(--font-body)',
                      fontWeight:  'var(--font-weight-regular)',
                      fontSize:    '11px',
                      lineHeight:  '16px',
                      color:       '#a39b95',
                      flexShrink:  0,
                    }}
                  >
                    {file.sizeLabel}
                  </span>
                  {onRemove && (
                    <IconButton
                      variant="ghost"
                      size="xs"
                      icon={<CancelOneIcon />}
                      aria-label={`Remove ${file.name}`}
                      onClick={() => onRemove(file.id)}
                    />
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {isEmpty && (
          /* Upload drop zone */
          <button
            onClick={handleDropZoneClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            style={{
              display:         'flex',
              flexDirection:   'column',
              alignItems:      'center',
              justifyContent:  'center',
              gap:             '6px',
              flex:            '1 1 0',
              borderRadius:    '10px',
              border:          'none',
              background:      'transparent',
              boxShadow:       '0px 0px 0px 1px rgba(59,54,50,0.3)',
              cursor:          'pointer',
              padding:         '8px 12px',
              minHeight:       '120px',
            }}
          >
            <FolderOneIcon style={{ width: 16, height: 16, color: 'var(--neutral-700)', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
              <span
                style={{
                  fontFamily:  'var(--font-body)',
                  fontWeight:  'var(--font-weight-medium)',
                  fontSize:    '14px',
                  lineHeight:  '22px',
                  color:       'var(--neutral-700)',
                  whiteSpace:  'nowrap',
                }}
              >
                Upload Files
              </span>
              <span
                style={{
                  fontFamily:  'var(--font-body)',
                  fontWeight:  'var(--font-weight-regular)',
                  fontSize:    '11px',
                  lineHeight:  '16px',
                  color:       'var(--neutral-700)',
                  textAlign:   'center',
                  maxWidth:    '226px',
                }}
              >
                Add files as shared knowledge for every chat in this project.
              </span>
            </div>
          </button>
        )}
      </div>
    )
  },
)

ProjectFilesPanel.displayName = 'ProjectFilesPanel'
export default ProjectFilesPanel
