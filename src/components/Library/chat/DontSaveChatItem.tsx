'use client'

import React from 'react'
import { Dropdown } from '@/components/Dropdown'
import { CHAT_MESSAGES } from '@/lib/library/messages'
import { setDontSaveChat, useDontSaveChat } from '@/lib/library/library-dont-save'

/** The chat's More menu item: "Don't save files from this chat", with "They stay in this chat" under it. */
export function DontSaveChatItem({ chatId }: { chatId: string }) {
  const checked = useDontSaveChat(chatId)
  return (
    <Dropdown.Item
      label={CHAT_MESSAGES.dontSaveFromChat}
      subLabel={CHAT_MESSAGES.dontSaveFromChatHint}
      fluid
      showCheckbox
      checkboxChecked={checked}
      onCheckboxChange={(next: boolean) => setDontSaveChat(chatId, next)}
    />
  )
}
