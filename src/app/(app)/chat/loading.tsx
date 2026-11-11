import { ChatMessagesSkeleton } from '@/components/chat/ChatMessagesSkeleton'

// Shown while the chat route segment loads (first visit, navigation from
// another page). Same shape ChatInterface uses while a conversation loads.
export default function ChatLoading() {
  return (
    <div role="status" aria-label="Loading chat" style={{ display: 'flex', justifyContent: 'center', padding: '24px 16px', height: '100%' }}>
      <div style={{ width: '100%', maxWidth: 768 }}>
        <ChatMessagesSkeleton />
      </div>
    </div>
  )
}
