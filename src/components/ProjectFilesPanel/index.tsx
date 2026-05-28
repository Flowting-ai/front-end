'use client'

import React, { useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { PlusSignIcon, FolderOneIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { ProjectDocumentCard } from '@/components/ProjectDocumentCard'
import type { ProjectFile } from '@/context/projects-context'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProjectFilesPanelProps {
  files:         ProjectFile[]
  usedBytes:     number
  totalBytes:    number
  /** Files currently being uploaded — shown as optimistic cards with a spinner. */
  pendingFiles?: File[]
  onUpload?:     (files: FileList) => void | Promise<void>
  onRemove?:     (fileId: string) => void
}

function formatBytes(bytes: number): string {
  if (bytes <= 0)          return ''
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ProjectFilesPanel({ files, usedBytes, totalBytes, pendingFiles, onUpload, onRemove, ref }: ProjectFilesPanelProps & { ref?: React.Ref<HTMLDivElement> }) {
    const inputRef   = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    const [dragging,  setDragging]  = useState(false)

    const hasPending  = (pendingFiles?.length ?? 0) > 0
    const isUploading = uploading || hasPending
    const totalCount  = files.length + (pendingFiles?.length ?? 0)
    const isEmpty     = totalCount === 0

    // Include pending file sizes in the capacity bar while uploading.
    const pendingBytes = pendingFiles?.reduce((s, f) => s + f.size, 0) ?? 0
    const totalUsed    = usedBytes + pendingBytes
    const usedPct      = Math.min(100, totalBytes > 0 ? (totalUsed / totalBytes) * 100 : 0)
    const usedLabel    = formatBytes(totalUsed) || '0 B'
    const totalMB      = Math.round(totalBytes / (1024 * 1024))

    async function triggerUpload(fileList: FileList) {
      if (!fileList.length || !onUpload) return
      setUploading(true)
      try {
        await onUpload(fileList)
      } finally {
        setUploading(false)
      }
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
      if (e.target.files) {
        void triggerUpload(e.target.files)
        e.target.value = ''
      }
    }

    function handleDrop(e: React.DragEvent) {
      e.preventDefault()
      setDragging(false)
      if (!isUploading && e.dataTransfer.files.length > 0) void triggerUpload(e.dataTransfer.files)
    }

    function handleDragOver(e: React.DragEvent) {
      e.preventDefault()
      setDragging(true)
    }

    function handleDragLeave(e: React.DragEvent) {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
    }

    return (
      <div
        ref={ref}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           '12px',
          padding:       '12px 12px 16px',
          borderRadius:  '16px',
          background:    dragging ? 'var(--neutral-100)' : 'var(--neutral-50)',
          border:        dragging
            ? '1.5px dashed var(--neutral-400)'
            : '1px solid var(--neutral-100)',
          boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
          width:         '100%',
          minHeight:     isEmpty ? '400px' : 'unset',
          boxSizing:     'border-box',
          overflow:      'hidden',
          transition:    'background 180ms, border-color 180ms',
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
                  fontSize: '12px',
                  lineHeight: '16px',
                  color:      'var(--neutral-700)',
                }}
              >
                {totalCount} {totalCount === 1 ? 'file' : 'files'}
              </span>
            )}
          </div>
          <IconButton
            variant="ghost"
            size="xs"
            icon={<PlusSignIcon />}
            aria-label="Upload file"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          />
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleInputChange}
          aria-hidden
        />

        {/* Capacity bar – always visible */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 'var(--font-weight-regular)',
              fontSize: '12px',
              lineHeight: '16px',
              color:      '#857a72',
              margin:     0,
            }}
          >
            {usedLabel} of {totalMB} MB used
          </p>
          <div
            style={{
              height:       '4px',
              borderRadius: '2px',
              background:   'var(--neutral-white)',
              overflow:     'hidden',
            }}
          >
            <m.div
              animate={{ width: `${usedPct}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 28 }}
              style={{
                height:       '100%',
                background:   usedPct > 90 ? 'var(--red-500, #ef4444)' : 'var(--blue-500)',
                borderRadius: 'inherit',
              }}
            />
          </div>
        </div>

        {/* File list – real files + optimistic pending cards */}
        {!isEmpty && (
          <div
            className="kaya-scrollbar"
            style={{
              display:             'flex',
              flexDirection:       'column',
              gap:                 '6px',
              overflowY:           'auto',
              maxHeight:           '240px',
              overscrollBehaviorY: 'contain',
              padding:             '3px',
            }}
          >
            <AnimatePresence initial={false}>
              {files.map((file) => (
                <ProjectDocumentCard
                  key={file.id}
                  name={file.name}
                  sizeLabel={file.sizeLabel || undefined}
                  onRemove={onRemove ? () => onRemove(file.id) : undefined}
                />
              ))}
              {pendingFiles?.map((file) => (
                <ProjectDocumentCard
                  key={`pending-${file.name}-${file.size}`}
                  name={file.name}
                  sizeLabel={formatBytes(file.size)}
                  uploading={true}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Empty drop zone */}
        {isEmpty && (
          <button
            onClick={() => inputRef.current?.click()}
            style={{
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            '6px',
              flex:           '1 1 0',
              borderRadius:   '10px',
              border:         'none',
              background:     'transparent',
              boxShadow:      '0px 0px 0px 1px rgba(59,54,50,0.3)',
              cursor:         'pointer',
              padding:        '24px 12px',
            }}
          >
            <FolderOneIcon style={{ width: 16, height: 16, color: 'var(--neutral-700)', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 'var(--font-weight-medium)',
                  fontSize:   '14px',
                  lineHeight: '22px',
                  color:      'var(--neutral-700)',
                  whiteSpace: 'nowrap',
                }}
              >
                Upload Files
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 'var(--font-weight-regular)',
                  fontSize: '12px',
                  lineHeight: '16px',
                  color:      'var(--neutral-700)',
                  textAlign:  'center',
                  maxWidth:   '226px',
                }}
              >
                Add files as shared knowledge for every chat in this project.
              </span>
            </div>
          </button>
        )}
      </div>
    )
}

ProjectFilesPanel.displayName = 'ProjectFilesPanel'
export default ProjectFilesPanel
