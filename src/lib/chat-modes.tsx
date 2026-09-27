import type React from 'react'
import {
  QuillWriteOneIcon,
  NeuralNetworkIcon,
  AiVisionRecognitionIcon,
  AiWebBrowsingIcon,
} from '@strange-huge/icons'

// ── Chat mode ─────────────────────────────────────────────────────────────────
// Shared by chat/page.tsx and project/[id]/chat/[chatId]/page.tsx — both had
// an identical copy of this "pick a starting mode" action-button set.

export type ChatMode = 'write' | 'research' | 'think' | 'build'

export const ACTION_BUTTONS: Array<{ mode: ChatMode; label: string; icon: React.ReactNode; disabled?: boolean }> = [
  { mode: 'write',    label: 'Write',    icon: <QuillWriteOneIcon       size={16} animated /> },
  { mode: 'research', label: 'Research', icon: <NeuralNetworkIcon       size={16} animated /> },
  { mode: 'think',    label: 'Think',    icon: <AiVisionRecognitionIcon size={16} animated /> },
  { mode: 'build',    label: 'Build',    icon: <AiWebBrowsingIcon       size={16} animated /> },
]

export const MODE_PLACEHOLDERS: Record<ChatMode, string> = {
  write:    'What would you like to write?',
  research: 'What would you like to research?',
  think:    'What would you like to think through?',
  build:    'What would you like to build?',
}
