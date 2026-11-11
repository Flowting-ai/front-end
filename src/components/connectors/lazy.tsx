'use client'

import dynamic from 'next/dynamic'

// These are only mounted while open (or, for AccountDetailView, while an
// account is selected), so a plain dynamic import keeps their code out of the
// /connectors first load and out of the chat composer's ConnectAppMenu.
// Import them from here, not directly.

export const SetupModal = dynamic(
  () => import('./SetupModal').then(m => ({ default: m.SetupModal })),
  { ssr: false, loading: () => null },
)

export const CustomApiModal = dynamic(
  () => import('./CustomApiModal').then(m => ({ default: m.CustomApiModal })),
  { ssr: false, loading: () => null },
)

export const RemoveModal = dynamic(
  () => import('./RemoveModal').then(m => ({ default: m.RemoveModal })),
  { ssr: false, loading: () => null },
)

export const AccountDetailView = dynamic(
  () => import('./AccountDetailView').then(m => ({ default: m.AccountDetailView })),
  { ssr: false, loading: () => null },
)
