'use client'

import { Suspense, useState, useId } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { Sidebar } from '@/components/Sidebar'
import {
  ScheduleListView,
  ScheduleDetailView,
  ScheduleEditModal,
  ScheduleDeleteModal,
  type ScheduleListItem,
  type ScheduleDetailItem,
  type ScheduleEditData,
} from '@/templates/Brain'
import { BrainSidebarSections } from '../BrainSidebarSections'

// ── Page wrapper ──────────────────────────────────────────────────────────────

export default function BrainSchedulesPage() {
  return (
    <Suspense fallback={null}>
      <BrainSchedulesPageInner />
    </Suspense>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function listItemToDetail(item: ScheduleListItem): ScheduleDetailItem {
  return {
    id:           item.id,
    name:         item.name,
    instructions: item.description ?? '',
    frequency:    item.frequency,
    isActive:     item.isActive,
  }
}

// ── Inner page ────────────────────────────────────────────────────────────────

function BrainSchedulesPageInner() {
  const { push }                            = useRouter()
  const { user, logout, isAuthenticated }   = useAuth()
  const idPrefix                            = useId()

  const displayName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name || ''
    : ''

  const [schedules,        setSchedules]        = useState<ScheduleListItem[]>([])
  const [selectedId,       setSelectedId]       = useState<string | null>(null)
  const [editModalOpen,    setEditModalOpen]    = useState(false)
  const [deleteModalOpen,  setDeleteModalOpen]  = useState(false)
  const [editingSchedule,  setEditingSchedule]  = useState<ScheduleEditData | undefined>(undefined)

  const selectedSchedule = schedules.find(s => s.id === selectedId) ?? null

  const handleCreateNew = () => {
    setEditingSchedule(undefined)
    setEditModalOpen(true)
  }

  const handleEdit = () => {
    if (!selectedSchedule) return
    setEditingSchedule({
      name:         selectedSchedule.name,
      instructions: selectedSchedule.description ?? '',
      frequency:    selectedSchedule.frequency,
    })
    setEditModalOpen(true)
  }

  const handleSave = (data: ScheduleEditData) => {
    setSchedules(prev => {
      if (editingSchedule && selectedId) {
        return prev.map(s =>
          s.id === selectedId
            ? { ...s, name: data.name, description: data.instructions, frequency: data.frequency }
            : s
        )
      }
      const newItem: ScheduleListItem = {
        id:          `${idPrefix}-${Date.now()}`,
        name:        data.name,
        description: data.instructions,
        frequency:   data.frequency,
        isActive:    true,
      }
      return [...prev, newItem]
    })
    setEditModalOpen(false)
    setEditingSchedule(undefined)
  }

  const handleDeleteConfirm = () => {
    setSchedules(prev => prev.filter(s => s.id !== selectedId))
    setSelectedId(null)
    setDeleteModalOpen(false)
  }

  const handleToggleActive = (active: boolean) => {
    setSchedules(prev =>
      prev.map(s => s.id === selectedId ? { ...s, isActive: active } : s)
    )
  }

  return (
    <div style={{
      display:         'flex',
      alignItems:      'stretch',
      width:           '100%',
      height:          '100svh',
      backgroundColor: 'var(--neutral-white)',
    }}>
      {/* ── Left sidebar ── */}
      <Sidebar
        userName={displayName || 'Account'}
        userEmail={user?.email ?? ''}
        isAuthenticated={isAuthenticated}
        projectItems={
          <BrainSidebarSections
            activeChatId={null}
            isSchedulesPage={true}
            onThreadClick={(id) => push(`/brain?id=${id}`)}
          />
        }
        recentItems={null}
        onNewChat={() => push('/brain')}
        onBrainClick={() => push('/brain')}
        onChatsClick={() => push('/chats')}
        onPersonasClick={() => push('/personas')}
        onProjectsClick={() => push('/projects')}
        onSettingsClick={() => push('/settings')}
        onHelpClick={() => push('/settings/help')}
        onLogoutClick={() => { void logout() }}
      />

      {/* ── Main content area ── */}
      <div style={{
        position:        'relative',
        flex:            '1 0 0',
        minWidth:        0,
        display:         'flex',
        flexDirection:   'column',
        backgroundColor: 'var(--neutral-50)',
        padding:         '10px 0',
      }}>
        {/* Glass card — matches BrainShell center panel spec */}
        <div style={{
          position:        'relative',
          flex:            '1 0 0',
          minHeight:       0,
          display:         'flex',
          flexDirection:   'column',
          borderRadius:    '22px',
          border:          '1px solid var(--neutral-200)',
          backgroundColor: 'var(--color-surface-glass)',
          overflow:        'hidden',
        }}>
          <div
            style={{
              flex:                '1 0 0',
              minHeight:           0,
              overflowY:           'auto',
              overscrollBehaviorY: 'contain',
            }}
            className="kaya-scrollbar"
          >
            <div style={{
              maxWidth:     '810px',
              width:        '100%',
              margin:       '0 auto',
              paddingLeft:  28,
              paddingRight: 28,
              paddingBottom: 40,
              boxSizing:    'border-box',
            }}>
              {selectedSchedule ? (
                <ScheduleDetailView
                  schedule={listItemToDetail(selectedSchedule)}
                  onBack={() => setSelectedId(null)}
                  onEdit={handleEdit}
                  onDelete={() => setDeleteModalOpen(true)}
                  onToggleActive={handleToggleActive}
                />
              ) : (
                <ScheduleListView
                  schedules={schedules}
                  onScheduleClick={setSelectedId}
                  onCreateNew={handleCreateNew}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      <ScheduleEditModal
        isOpen={editModalOpen}
        schedule={editingSchedule}
        onSave={handleSave}
        onClose={() => { setEditModalOpen(false); setEditingSchedule(undefined) }}
      />

      {selectedSchedule && (
        <ScheduleDeleteModal
          isOpen={deleteModalOpen}
          scheduleName={selectedSchedule.name}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteModalOpen(false)}
        />
      )}
    </div>
  )
}
