"use client";

import { Suspense, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { legacyAgentChatTarget, openAgentInChat } from "@/lib/agent-chat-handoff";
import { CHAT_ROUTE } from "@/lib/routes";

// Agents have no chat page of their own any more — they are only used inside a normal /chat.
// This route only keeps old links and bookmarks working:
//   /agents/<id>/chat?chatId=<c> -> /chat?id=<c> (the chat stays bound to its agent)
//   /agents/<id>/chat            -> a fresh /chat with the agent attached ("Use in chat")
function LegacyAgentChatRedirect() {
  const { personaId } = useParams<{ personaId: string }>();
  const chatId = useSearchParams().get("chatId");
  const { replace } = useRouter();

  useEffect(() => {
    const target = legacyAgentChatTarget(chatId);
    if (target) { replace(target); return; }
    void openAgentInChat(personaId, replace).then(ok => { if (!ok) replace(CHAT_ROUTE); });
  }, [personaId, chatId, replace]);

  return null;
}

export default function LegacyAgentChatPage() {
  return (
    <Suspense fallback={null}>
      <LegacyAgentChatRedirect />
    </Suspense>
  );
}
