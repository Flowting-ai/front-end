"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PersonaChatInterface } from "@/components/layout/PersonaChatInterface";
import { PERSONA_CHAT_CREATED_EVENT, PERSONA_CHAT_NAV_EVENT } from "@/hooks/use-sidebar-events";
import { Button } from "@/components/ui/button";
import { AGENT_CHAT_ENABLED } from "@/lib/feature-flags";
import { AGENTS_ROUTE } from "@/lib/routes";

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

  // Belt-and-suspenders alongside the params/searchParams-driven effect below
  // — LeftSidebar fires this synchronously from the click itself (before
  // navigation completes) whenever it routes to a persona chat, same
  // reasoning as PROJECT_NEW_CHAT_EVENT/emitSidebarNewChat elsewhere in this
  // codebase: useSearchParams() has been found unreliable across Suspense
  // transitions, so a reactive-params-only reset can lag or get missed. This
  // guarantees a fresh instanceKey on the next render regardless.
  const navBumpRef = useRef(0);
  useEffect(() => {
    const handler = () => { navBumpRef.current += 1; };
    window.addEventListener(PERSONA_CHAT_NAV_EVENT, handler);
    return () => window.removeEventListener(PERSONA_CHAT_NAV_EVENT, handler);
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
    const navBumped        = navBumpRef.current > 0;
    navBumpRef.current = 0;

    if (personaChanged || chatIdSwitched || newChatRequested || navBumped || (!justCreatedChat && !prev.chatId && !!chatId)) {
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

// Sidebar agent rows and search results still link here; while the backend has no agent chat
// (AGENT_CHAT_ENABLED), say so instead of opening a chat whose every send fails.
function AgentChatUnavailable() {
  const { push } = useRouter();
  return (
    <div
      role="status"
      style={{
        flex: '1 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 12, padding: 32, textAlign: 'center', minHeight: 0,
      }}
    >
      <h2 style={{ margin: 0, fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)' }}>
        Agent chats are unavailable right now
      </h2>
      <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)' }}>
        You can still create, edit and share agents. Chatting with them will come back soon.
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Button variant="secondary" onClick={() => push(AGENTS_ROUTE)}>Back to agents</Button>
      </div>
    </div>
  );
}

export default function PersonaChatPage() {
  if (!AGENT_CHAT_ENABLED) return <AgentChatUnavailable />;
  return (
    <Suspense fallback={null}>
      <PersonaChatPageInner />
    </Suspense>
  );
}
