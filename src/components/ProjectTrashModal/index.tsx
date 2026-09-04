'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { Spinner } from '@/components/Spinner'
import { toast } from 'sonner'
import { fetchDeletedProjects, restoreProjectApi, type ApiProjectSummary } from '@/lib/api/projects'

// Net-new pattern — nothing else in this app has a soft-delete recovery UI to
// mirror (confirmed by a dedicated research pass). Same hand-rolled overlay
// shape as the other new modals for visual consistency.
const SHADOW_MODAL = '0px 19px 32px 0px rgba(18,12,8,0.15), 0px 2px 2.8px 0px rgba(130,122,116,0.1)'

export interface ProjectTrashModalProps {
  currentUserId: string
  onClose:       () => void
  /** Called after a successful restore — refresh the caller's project list. */
  onRestored:    () => void
}

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

export function ProjectTrashModal({ currentUserId, onClose, onRestored }: ProjectTrashModalProps) {
  const [loading,     setLoading]     = useState(true)
  const [projects,    setProjects]    = useState<ApiProjectSummary[]>([])
  // Distinct from "loaded, zero results" — a failed fetch must never read as
  // "trash is empty", or a real fetch failure would be shown as if there's
  // simply nothing to restore.
  const [loadFailed,  setLoadFailed]  = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadFailed(false)
    fetchDeletedProjects(currentUserId)
      .then(list => { if (!cancelled) setProjects(list) })
      .catch(() => {
        if (cancelled) return
        setLoadFailed(true)
        toast.error("Couldn't load deleted projects")
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [currentUserId, loadAttempt])

  const handleRestore = async (projectId: string) => {
    setRestoringId(projectId)
    try {
      await restoreProjectApi(projectId, currentUserId)
      setProjects(prev => prev.filter(p => p.id !== projectId))
      toast.success('Project restored.')
      onRestored()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to restore project')
    } finally {
      setRestoringId(null)
    }
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.28)',
        backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--neutral-white, #fff)', borderRadius: 16, padding: 24, width: 480,
          maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 64px)', overflow: 'hidden',
          boxShadow: SHADOW_MODAL, display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <div>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 16, lineHeight: '24px', color: 'var(--neutral-900)', margin: 0 }}>
            Trash
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '8px 0 0' }}>
            Workspace and shared projects stay recoverable for 30 days after
            deletion. Personal projects delete instantly and never appear here.
          </p>
        </div>

        <div className="kaya-scrollbar" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <Spinner size={20} />
            </div>
          ) : loadFailed ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 24 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', textAlign: 'center', margin: 0 }}>
                Couldn't load the trash.
              </p>
              <Button variant="secondary" size="sm" onClick={() => setLoadAttempt(a => a + 1)}>
                Try again
              </Button>
            </div>
          ) : projects.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', textAlign: 'center', padding: 24, margin: 0 }}>
              Nothing in the trash.
            </p>
          ) : (
            projects.map(p => (
              <div
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  border: '1px solid var(--neutral-200)', borderRadius: 10,
                }}
              >
                <div style={{ flex: '1 0 0', minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.title}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-500)', margin: 0 }}>
                    Last updated {fmtRelative(p.updatedAt)}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={restoringId === p.id}
                  onClick={() => { void handleRestore(p.id) }}
                >
                  Restore
                </Button>
              </div>
            ))
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}

export default ProjectTrashModal
