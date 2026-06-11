"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PersonaChatInterface } from "@/components/layout/PersonaChatInterface";
import { PERSONA_CHAT_CREATED_EVENT } from "@/hooks/use-sidebar-events";

function PersonaChatPageInner() {
  const params       = useParams<{ personaId: string }>();
  const searchParams = useSearchParams();
  const chatId       = searchParams.get("chatId") ?? undefined;

  // Stable instance key for PersonaChatInterface.
  //
  // The problem: when PersonaChatInterface creates a new chat it calls
  // window.history.replaceState("?chatId=xxx"). Next.js App Router intercepts
  // replaceState, updates its URL state, and useSearchParams() re-fires with
  // the new chatId. Without this guard the key would flip from "new" → "xxx",
  // causing React to unmount the component mid-stream and remount it.
  //
  // We only want a fresh mount when:
  //   • the user navigates between two *different* existing chats (A → B)
  //   • the user opens a brand-new chat (chatId → no chatId, e.g. "New Chat")
  //   • the personaId changes
  // We do NOT want a remount when:
  //   • the component itself creates a chat (undefined chatId → chatId)
  const [instanceKey, setInstanceKey] = useState(
    () => `${params.personaId}:${chatId ?? "new"}`,
  );

  const prevRef = useRef({ personaId: params.personaId, chatId });

  // Set to true when PersonaChatInterface fires the chat-created event, meaning
  // the component itself caused the undefined→chatId URL transition. This lets
  // us distinguish that internal transition from the user navigating to an
  // existing previous chat from the "new chat" state — which must trigger a
  // remount so initialChatId is correct.
  const justCreatedRef = useRef(false);

  useEffect(() => {
    const handler = () => { justCreatedRef.current = true; };
    window.addEventListener(PERSONA_CHAT_CREATED_EVENT, handler);
    return () => window.removeEventListener(PERSONA_CHAT_CREATED_EVENT, handler);
  }, []);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = { personaId: params.personaId, chatId };

    const personaChanged   = params.personaId !== prev.personaId;
    // Component created this chat (replaceState + event) — skip remount so stream continues.
    // Navigation to an existing previous chat also looks like !prev.chatId && !!chatId, but
    // that path does NOT fire PERSONA_CHAT_CREATED_EVENT, so justCreatedRef stays false.
    const justCreatedChat  = !prev.chatId && !!chatId && justCreatedRef.current;
    justCreatedRef.current = false;
    const chatIdSwitched   = !!chatId && !!prev.chatId && chatId !== prev.chatId;
    const newChatRequested = !chatId && !!prev.chatId;

    if (personaChanged || chatIdSwitched || newChatRequested || (!justCreatedChat && !prev.chatId && !!chatId)) {
      setInstanceKey(`${params.personaId}:${chatId ?? "new"}`);
    }
    // justCreatedChat: keep current key → no remount, stream continues
    void justCreatedChat;
  }, [params.personaId, chatId]);

  return (
    <PersonaChatInterface
      key={instanceKey}
      personaId={params.personaId}
      initialChatId={chatId}
    />
  );
}

export default function PersonaChatPage() {
  return (
    <Suspense fallback={null}>
      <PersonaChatPageInner />
    </Suspense>
  );
}
