'use client'

import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import type { ScheduleEditModalProps } from './ScheduleEditModal'
import type { ScheduleDeleteModalProps } from './ScheduleDeleteModal'

// Both modals are mounted (closed) on every /schedules page. These wrappers
// fetch a modal's chunk the first time it opens and keep it mounted after, so
// the exit animation and reopening are unchanged (same as Projects/lazy-modals).

/** Renders nothing until `isOpen` is first true, then stays mounted. */
function openOnce<P extends { isOpen: boolean }>(Impl: React.ComponentType<P>) {
  function LazyModal(props: P) {
    const [opened, setOpened] = useState(props.isOpen)
    if (props.isOpen && !opened) setOpened(true)
    return opened ? <Impl {...props} /> : null
  }
  return LazyModal
}

const ScheduleEditModalImpl = dynamic(
  () => import('./ScheduleEditModal').then(m => ({ default: m.ScheduleEditModal })),
  { ssr: false, loading: () => null },
)
const ScheduleDeleteModalImpl = dynamic(
  () => import('./ScheduleDeleteModal').then(m => ({ default: m.ScheduleDeleteModal })),
  { ssr: false, loading: () => null },
)

export const ScheduleEditModal = openOnce<ScheduleEditModalProps>(ScheduleEditModalImpl)
export const ScheduleDeleteModal = openOnce<ScheduleDeleteModalProps>(ScheduleDeleteModalImpl)
