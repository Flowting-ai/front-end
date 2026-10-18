'use client'

// Where the chat's file panel sits: over the right side of the chat, the same place as the Sources panel.
// A locked citation chip opens it (library-citations.tsx); closing it, or leaving the chat, shuts it.

import React, { useEffect, useSyncExternalStore } from 'react'
import { closeChatFilePanel, getChatFilePanel, subscribeChatFilePanel } from '@/lib/library/chat-file-panel'
import { ChatFilePanel } from './ChatFilePanel'

export function ChatFilePanelSlot({ chatId }: { chatId: string | undefined }) {
  const fileId = useSyncExternalStore(subscribeChatFilePanel, getChatFilePanel, getChatFilePanel)
  useEffect(() => closeChatFilePanel, [chatId])
  if (!fileId) return null
  return (
    <div style={{ position: 'absolute', top: 52, right: 12, bottom: 12, zIndex: 30, display: 'flex', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-card-deep)' }}>
      <ChatFilePanel fileId={fileId} onClose={closeChatFilePanel} />
    </div>
  )
}
