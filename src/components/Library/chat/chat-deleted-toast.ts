import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { restoreChat } from '@/lib/api/chat'
import { libraryKeys } from '@/lib/library/keys'
import { CHAT_MESSAGES, FILE_MESSAGES } from '@/lib/library/messages'
import { queryKeys } from '@/lib/query-keys'

/**
 * The notice after Delete chat. A deleted chat stays restorable for the Trash window
 * (`POST /chats/{id}/restore`), so the notice offers Undo. Files moved to Trash with the
 * chat are not brought back by it, so the caller leaves Undo off in that case.
 */
export function chatDeletedToast(message: string, chatId: string, queryClient: QueryClient, orgKey: string, { undo = true } = {}): void {
  if (!undo) {
    toast(message)
    return
  }
  toast(message, {
    action: {
      label: FILE_MESSAGES.undo,
      onClick: () => {
        void restoreChat(chatId).then(
          () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.chats.all() })
            void queryClient.invalidateQueries({ queryKey: libraryKeys.all(orgKey) })
            toast(CHAT_MESSAGES.chatRestored)
          },
          () => toast.error(CHAT_MESSAGES.chatRestoreFailed),
        )
      },
    },
  })
}
