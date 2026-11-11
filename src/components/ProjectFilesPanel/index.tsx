'use client'

import React, { useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { toast } from 'sonner'
import { PlusSignIcon, FolderOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ConfirmModal'
import { ProjectDocumentCard } from '@/components/ProjectDocumentCard'
import { FILE_ACCEPT, FILE_CONSTRAINTS, isAllowedType } from '@/hooks/use-file-upload'
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

// Up to this many rows the list simply grows with the card (nothing to clip); past it, it scrolls.
const MAX_VISIBLE_ROWS = 6
const ROW_PITCH = 68 // 62px file card (40px glyph + padding + border) + 6px gap

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
    const [removeTarget, setRemoveTarget] = useState<ProjectFile | null>(null)

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
    const usedMB       = Math.round(totalUsed / (1024 * 1024))

    // Client-side size/type validation — mirrors the chat-attachment path's
    // constraints (useFileUpload) so oversized/unsupported files are rejected
    // here instead of only being caught server-side after a full upload
    // round-trip. Type-checking still applies to drag-and-drop, which bypasses
    // the file input's `accept` filter entirely.
    function validateFiles(fileList: FileList): FileList | null {
      const files = Array.from(fileList)
      const oversized: string[] = []
      const unsupported: string[] = []
      const valid: File[] = []

      for (const file of files) {
        if (file.size > FILE_CONSTRAINTS.maxSizeBytes) { oversized.push(file.name); continue }
        if (!isAllowedType(file)) { unsupported.push(file.name); continue }
        valid.push(file)
      }

      if (oversized.length > 0) {
        const limit = `${FILE_CONSTRAINTS.maxSizeBytes / (1024 * 1024)} MB`
        toast.error(
          oversized.length === 1 ? `"${oversized[0]}" exceeds ${limit}` : `${oversized.length} files exceed ${limit}`,
          { description: 'Please upload smaller files.' },
        )
      }
      if (unsupported.length > 0) {
        toast.error(
          unsupported.length === 1 ? `"${unsupported[0]}" isn't supported` : `${unsupported.length} files aren't supported`,
        )
      }
      if (valid.length === 0) return null

      const dt = new DataTransfer()
      valid.forEach((f) => dt.items.add(f))
      return dt.files
    }

    async function triggerUpload(fileList: FileList) {
      if (!fileList.length || !onUpload) return
      const validated = validateFiles(fileList)
      if (!validated) return
      setUploading(true)
      try {
        await onUpload(validated)
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
          gap:           12,
          padding:       12,
          flexShrink:    0,
          borderRadius:  16,
          background:    dragging ? 'var(--neutral-100)' : 'var(--card-bg)',
          // Same card chrome as Instructions; a dashed edge only while a file is dragged over.
          // --focus-ring is the signature accent: blue in light mode, pink in dark.
          border:        dragging ? '1px dashed var(--focus-ring)' : '1px solid var(--text-field-ring)',
          boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
          width:         '100%',
          boxSizing:     'border-box',
          transition:    'background 180ms, border-color 180ms',
        }}
      >
        {/* Header: title + count, then the primary Add action (same size as Instructions' Edit). */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-regular)', fontSize: 16, lineHeight: '22px', color: 'var(--color-text-primary)', margin: 0 }}>
              Files
            </p>
            {!isEmpty && (
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-600)' }}>
                {totalCount}
              </span>
            )}
          </div>
          {onUpload && (
            <Button
              variant="default"
              size="xs"
              leftIcon={<PlusSignIcon size={12} />}
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
            >
              Add
            </Button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={FILE_ACCEPT}
          style={{ display: 'none' }}
          onChange={handleInputChange}
          aria-hidden
        />

        {/* Storage: one line, bar then "x of y MB". */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={totalMB}
            aria-valuenow={usedMB}
            aria-label={`${usedLabel} of ${totalMB} MB used`}
            style={{ flex: '1 1 0', height: 4, borderRadius: 2, background: 'var(--neutral-200)', overflow: 'hidden' }}
          >
            <m.div
              animate={{ width: `${usedPct}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 28 }}
              style={{ height: '100%', background: usedPct > 90 ? 'var(--red-500, #ef4444)' : 'var(--blue-500)', borderRadius: 'inherit' }}
            />
          </div>
          <span style={{ flexShrink: 0, fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-600)' }}>
            {usedLabel} of {totalMB} MB
          </span>
        </div>

        {/* File list: grows one row per file; only a long list scrolls. */}
        {!isEmpty && (
          <div
            className="kaya-scrollbar"
            style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, ...(totalCount > MAX_VISIBLE_ROWS ? { overflowY: 'auto', maxHeight: MAX_VISIBLE_ROWS * ROW_PITCH, overscrollBehaviorY: 'contain' } : null) }}
          >
            <AnimatePresence initial={false}>
              {files.map((file) => (
                <ProjectDocumentCard
                  key={file.id}
                  name={file.name}
                  sizeLabel={file.sizeLabel || undefined}
                  fileType={file.type}
                  url={file.url || undefined}
                  onRemove={onRemove ? () => setRemoveTarget(file) : undefined}
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

        {/* Empty: a compact drop zone instead of a tall blank card. */}
        {isEmpty && onUpload && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{
              display:        'flex',
              alignItems:     'center',
              gap:            10,
              borderRadius:   10,
              border:         '1px dashed var(--neutral-300)',
              background:     'transparent',
              cursor:         'pointer',
              padding:        '12px',
              textAlign:      'left',
            }}
          >
            <FolderOneIcon variant="static" style={{ width: 18, height: 18, color: 'var(--neutral-600)', flexShrink: 0 }} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 13, lineHeight: '18px', color: 'var(--neutral-800)' }}>
                Drop files or click to upload
              </span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-600)' }}>
                Shared knowledge for every chat in this project.
              </span>
            </span>
          </button>
        )}
        {isEmpty && !onUpload && (
          <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '18px', color: 'var(--neutral-600)' }}>
            No files yet.
          </p>
        )}

        {removeTarget && (
          <ConfirmModal
            title={`Remove "${removeTarget.name}"?`}
            description="This file will no longer be shared with chats in this project."
            confirmLabel="Remove"
            onConfirm={async () => { onRemove?.(removeTarget.id) }}
            onClose={() => setRemoveTarget(null)}
          />
        )}
      </div>
    )
}

ProjectFilesPanel.displayName = 'ProjectFilesPanel'
export default ProjectFilesPanel
