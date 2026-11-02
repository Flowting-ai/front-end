import { useEffect, useRef } from "react";
import { CHAT_CREATED_EVENT } from "@/hooks/use-sidebar-events";
import type { ChatCreatedEventDetail } from "@/hooks/use-sidebar-events";
import type { UseChatHistoryResult } from "@/hooks/use-chat-history";

// Mirror chat:created window events (fired by the chat page alongside the context
// addOptimistic call) so the sidebar always sees new chats immediately, even when
// the key-based Sidebar remount races the React context propagation.
export function useChatCreatedMirror(addOptimistic: UseChatHistoryResult["addOptimistic"]) {
  // Keep a stable ref to addOptimistic so the event listener never captures a stale closure.
  const addOptimisticRef = useRef(addOptimistic);
  useEffect(() => { addOptimisticRef.current = addOptimistic });

  useEffect(() => {
    const handle = (e: Event) => {
      const detail = (e as CustomEvent<ChatCreatedEventDetail>).detail;
      addOptimisticRef.current({
        id: detail.id,
        title: detail.title,
        created_at: detail.created_at,
        updated_at: detail.updated_at,
        starred: detail.starred,
        can_edit: detail.can_edit,
      });
    };
    window.addEventListener(CHAT_CREATED_EVENT, handle);
    return () => window.removeEventListener(CHAT_CREATED_EVENT, handle);
  }, []);
}
