'use client'

import React, { useRef } from 'react'
import { PlusSignIcon, FolderOneIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { DocumentCard } from '@/components/DocumentCard'
import type { ProjectFile } from '@/context/projects-context'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProjectFilesPanelProps {
  files:      ProjectFile[]
  usedBytes:  number
  totalBytes: number
  onUpload?:  (files: FileList) => void
  onRemove?:  (fileId: string) => void
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
          border:        '1px solid var(--neutral-100)',
          boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
          width:         '100%',
          minHeight:     '400px',
          boxSizing:     'border-box',
          overflow:      'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 'var(--font-weight-regular)',
                fontSize:   '16px',
                lineHeight: '22px',
                color:      '#000',
                margin:     0,
                flexShrink: 0,
              }}
            >
              Files
            </p>
            {!isEmpty && (
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 'var(--font-weight-regular)',
                  fontSize:   '11px',
                  lineHeight: '16px',
                  color:      'var(--neutral-700)',
                }}
              >
                {fileCount} {fileCount === 1 ? 'File' : 'Files'}{urlCount > 0 ? ` / ${urlCount} ${urlCount === 1 ? 'Url' : 'Urls'}` : ''}
              </span>
            )}
          </div>
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
              <div
                style={{
                  height:       '4px',
                  borderRadius: '2px',
                  background:   'var(--neutral-white)',
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
            </div>

            {/* File grid */}
            <div
              style={{
                display:               'grid',
                gridTemplateColumns:   '1fr',
                gap:                   '8px',
                overflowY:             'auto',
                flex:                  '1 1 0',
              }}
            >
              {files.map((file) => (
                <DocumentCard
                  key={file.id}
                  name={file.name}
                  type={file.type}
                  sizeLabel={file.sizeLabel}
                  onRemove={onRemove ? () => onRemove(file.id) : undefined}
                />
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
              minHeight:       '300px',
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
