'use client'

import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import type { EditProjectModalProps } from '@/components/EditProjectModal'

// Project modals are mounted (closed) on every projects page, the chat home,
// the sidebar and each chat history row, so a static import puts all of their
// code in those pages' first load. These wrappers fetch a modal's chunk the
// first time it opens and keep it mounted afterwards, so its exit animation
// and any reopen are unchanged. Import the modals from here, not directly.

/** Renders nothing until `open` is first true, then stays mounted. */
function openOnce<P extends { open: boolean }>(Impl: React.ComponentType<P>) {
  function LazyModal(props: P) {
    const [opened, setOpened] = useState(props.open)
    if (props.open && !opened) setOpened(true)
    return opened ? <Impl {...props} /> : null
  }
  return LazyModal
}

const EditProjectModalImpl = dynamic(
  () => import('@/components/EditProjectModal').then(m => ({ default: m.EditProjectModal })),
  { ssr: false, loading: () => null },
)
const DeleteProjectModalImpl = dynamic(
  () => import('@/components/DeleteProjectModal').then(m => ({ default: m.DeleteProjectModal })),
  { ssr: false, loading: () => null },
)
const ProjectShareModalImpl = dynamic(
  () => import('@/components/ProjectShareModal').then(m => ({ default: m.ProjectShareModal })),
  { ssr: false, loading: () => null },
)
const MoveToProjectModalImpl = dynamic(
  () => import('@/components/MoveToProjectModal').then(m => ({ default: m.MoveToProjectModal })),
  { ssr: false, loading: () => null },
)

export const EditProjectModal = openOnce<EditProjectModalProps>(EditProjectModalImpl)
export const DeleteProjectModal = openOnce<React.ComponentProps<typeof DeleteProjectModalImpl>>(DeleteProjectModalImpl)
export const ProjectShareModal = openOnce<React.ComponentProps<typeof ProjectShareModalImpl>>(ProjectShareModalImpl)
export const MoveToProjectModal = openOnce<React.ComponentProps<typeof MoveToProjectModalImpl>>(MoveToProjectModalImpl)

/** Only ever mounted while open by its callers, so a plain dynamic import is enough. */
export const LeaveProjectModal = dynamic(
  () => import('@/components/LeaveProjectModal').then(m => ({ default: m.LeaveProjectModal })),
  { ssr: false, loading: () => null },
)
