"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeftOneIcon, PlusSignIcon } from "@strange-huge/icons";
import { IconButton } from "@/components/IconButton";
import { Button } from "@/components/Button";
import { ChatInput } from "@/components/chat/ChatInput";
import {
  getPersona,
  fetchPersonaChatMessages,
  createAndStreamPersonaChat,
  streamPersonaMessage,
  type Persona,
} from "@/lib/api/personas";
import {
  emitPersonaChatCreated,
  emitPersonaChatTitleUpdated,
} from "@/hooks/use-sidebar-events";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LocalMessage {
  id:          string;
  role:        "user" | "assistant";
  content:     string;
  isStreaming?: boolean;
}

export interface PersonaChatInterfaceProps {
  personaId:      string;
  initialChatId?: string;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#7C3AED", "#2563EB", "#059669", "#DC2626",
  "#D97706", "#0891B2", "#BE185D", "#65A30D",
];

function PersonaAvatar({
  imageUrl,
  name,
  size = 32,
}: {
  imageUrl: string | null;
  name:     string;
  size?:    number;
}) {
  const bg  = AVATAR_COLORS[(name.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
  const rad = size * 0.4;

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        style={{
          width:        size,
          height:       size,
          borderRadius: "50%",
          objectFit:    "cover",
          flexShrink:   0,
          display:      "block",
        }}
      />
    );
  }

  return (
    <div
      aria-hidden
      style={{
        width:          size,
        height:         size,
        borderRadius:   "50%",
        background:     bg,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        flexShrink:     0,
        color:          "#fff",
        fontFamily:     "var(--font-body)",
        fontWeight:     700,
        fontSize:       rad,
        userSelect:     "none",
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Message row ───────────────────────────────────────────────────────────────

function MessageRow({
  message,
  persona,
}: {
  message: LocalMessage;
  persona: Persona | null;
}) {
  const isUser = message.role === "user";

  return (
    <div
      style={{
        display:       "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems:    "flex-end",
        gap:           10,
        padding:       "4px 0",
      }}
    >
      {/* Persona avatar beside assistant messages */}
      {!isUser && persona && (
        <div style={{ flexShrink: 0, marginBottom: 2 }}>
          <PersonaAvatar imageUrl={persona.imageUrl} name={persona.name} size={28} />
        </div>
      )}

      {/* Bubble */}
      <div
        style={{
          maxWidth:    "76%",
          padding:     isUser ? "10px 14px" : "10px 14px",
          borderRadius: isUser
            ? "18px 18px 4px 18px"
            : "4px 18px 18px 18px",
          background:  isUser ? "var(--neutral-900)" : "var(--neutral-white)",
          color:       isUser ? "var(--neutral-white)" : "var(--neutral-900)",
          boxShadow:   isUser ? "none" : "0 1px 2px rgba(0,0,0,0.06), 0 0 0 1px var(--neutral-150, var(--neutral-200))",
          fontFamily:  "var(--font-body)",
          fontWeight:  "var(--font-weight-regular)",
          fontSize:    "var(--font-size-body)",
          lineHeight:  "var(--line-height-body)",
          whiteSpace:  "pre-wrap",
          wordBreak:   "break-word",
        }}
      >
        {message.content || (message.isStreaming ? null : "")}
        {message.isStreaming && (
          <motion.span
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            style={{
              display:       "inline-block",
              width:         2,
              height:        "1em",
              background:    "currentColor",
              marginLeft:    2,
              verticalAlign: "text-bottom",
              borderRadius:  1,
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ persona }: { persona: Persona | null }) {
  if (!persona) {
    return (
      <div style={{ flex: "1 0 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width:        48,
            height:       48,
            borderRadius: "50%",
            background:   "var(--neutral-100)",
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        flex:           "1 0 0",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        gap:            20,
        padding:        "60px 32px",
        textAlign:      "center",
      }}
    >
      <PersonaAvatar imageUrl={persona.imageUrl} name={persona.name} size={80} />

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 440 }}>
        <p
          style={{
            margin:     0,
            fontFamily: "var(--font-title)",
            fontWeight: 400,
            fontSize:   24,
            lineHeight: "32px",
            color:      "var(--neutral-900)",
          }}
        >
          {persona.name}
        </p>
        {persona.description && (
          <p
            style={{
              margin:     0,
              fontFamily: "var(--font-body)",
              fontWeight: "var(--font-weight-regular)",
              fontSize:   "var(--font-size-body)",
              lineHeight: "var(--line-height-body)",
              color:      "var(--neutral-500)",
            }}
          >
            {persona.description}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function MessageSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "24px 24px 0" }}>
      {[{ w: "55%", user: false }, { w: "45%", user: true }, { w: "70%", user: false }].map(
        ({ w, user }, i) => (
          <div
            key={i}
            style={{
              display:        "flex",
              justifyContent: user ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                width:        w,
                height:       40,
                borderRadius: 12,
                background:   "var(--neutral-100)",
              }}
            />
          </div>
        ),
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PersonaChatInterface({
  personaId,
  initialChatId,
}: PersonaChatInterfaceProps) {
  const router = useRouter();

  const [persona,           setPersona]           = useState<Persona | null>(null);
  const [messages,          setMessages]          = useState<LocalMessage[]>([]);
  const [activeChatId,      setActiveChatId]      = useState<string | undefined>(initialChatId);
  const [input,             setInput]             = useState("");
  const [isStreaming,       setIsStreaming]        = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(!!initialChatId);

  const abortRef  = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load persona metadata
  useEffect(() => {
    getPersona(personaId).then(setPersona).catch(console.error);
  }, [personaId]);

  // Load history when resuming an existing chat
  useEffect(() => {
    if (!initialChatId) return;
    setIsLoadingMessages(true);
    fetchPersonaChatMessages(personaId, initialChatId)
      .then((msgs) =>
        setMessages(msgs.map((m) => ({ id: m.id, role: m.role, content: m.content }))),
      )
      .catch(console.error)
      .finally(() => setIsLoadingMessages(false));
  }, [personaId, initialChatId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup stream on unmount
  useEffect(() => () => { abortRef.current?.(); }, []);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      setInput("");

      const userMsgId      = `u-${Date.now()}`;
      const assistantMsgId = `a-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        { id: userMsgId,      role: "user",      content: trimmed },
        { id: assistantMsgId, role: "assistant",  content: "", isStreaming: true },
      ]);
      setIsStreaming(true);

      // Snapshot the chatId at call-time; avoid stale closure inside callbacks
      const currentChatId = activeChatId;

      const callbacks = {
        onChatId: (chatId: string) => {
          setActiveChatId(chatId);
          window.history.replaceState(
            null, "",
            `/personas/${personaId}/chat?chatId=${chatId}`,
          );
          emitPersonaChatCreated({
            personaId,
            chatId,
            title: trimmed.slice(0, 80),
          });
        },
        onChunk: (delta: string) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, content: m.content + delta } : m,
            ),
          );
        },
        onDone: () => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, isStreaming: false } : m,
            ),
          );
          setIsStreaming(false);
          abortRef.current = null;
          // Surface the first assistant reply as the chat title in the sidebar
          setMessages((snap) => {
            const assistantMsg = snap.find((m) => m.id === assistantMsgId);
            if (assistantMsg?.content && activeChatId) {
              emitPersonaChatTitleUpdated({
                personaId,
                chatId: activeChatId,
                title:  assistantMsg.content.slice(0, 80),
              });
            }
            return snap;
          });
        },
        onError: (err: string) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: `Something went wrong: ${err}`, isStreaming: false }
                : m,
            ),
          );
          setIsStreaming(false);
          abortRef.current = null;
        },
      };

      try {
        const abort = currentChatId
          ? await streamPersonaMessage(personaId, currentChatId, trimmed, callbacks)
          : await createAndStreamPersonaChat(personaId, trimmed, callbacks);
        abortRef.current = abort;
      } catch {
        setIsStreaming(false);
      }
    },
    [personaId, activeChatId, isStreaming],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
    );
    setIsStreaming(false);
  }, []);

  const handleNewChat = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    setMessages([]);
    setActiveChatId(undefined);
    setInput("");
    setIsStreaming(false);
    window.history.replaceState(null, "", `/personas/${personaId}/chat`);
  }, [personaId]);

  const name = persona?.name ?? "";

  return (
    <div
      style={{
        display:       "flex",
        flexDirection: "column",
        flex:          "1 0 0",
        minHeight:     0,
        height:        "100%",
        background:    "var(--neutral-50)",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display:      "flex",
          alignItems:   "center",
          gap:          10,
          padding:      "10px 16px",
          borderBottom: "1px solid var(--neutral-200)",
          background:   "var(--neutral-white)",
          flexShrink:   0,
          minHeight:    56,
        }}
      >
        <IconButton
          variant="ghost"
          size="sm"
          icon={<ArrowLeftOneIcon size={20} />}
          aria-label="Back to personas"
          onClick={() => router.push("/personas")}
        />

        {persona ? (
          <>
            <PersonaAvatar imageUrl={persona.imageUrl} name={name} size={32} />
            <span
              style={{
                flex:         "1 0 0",
                minWidth:     0,
                fontFamily:   "var(--font-body)",
                fontWeight:   "var(--font-weight-semibold)",
                fontSize:     "var(--font-size-body)",
                lineHeight:   "var(--line-height-body)",
                color:        "var(--neutral-900)",
                overflow:     "hidden",
                textOverflow: "ellipsis",
                whiteSpace:   "nowrap",
              }}
            >
              {name}
            </span>
          </>
        ) : (
          <div style={{ flex: "1 0 0" }} />
        )}

        <Button
          variant="secondary"
          size="sm"
          leftIcon={<PlusSignIcon size={16} />}
          onClick={handleNewChat}
        >
          New chat
        </Button>
      </div>

      {/* ── Message area ── */}
      <div
        className="kaya-scrollbar"
        style={{
          flex:                "1 0 0",
          minHeight:           0,
          overflowY:           "auto",
          overflowX:           "hidden",
          overscrollBehaviorY: "contain",
          display:             "flex",
          flexDirection:       "column",
        }}
      >
        {isLoadingMessages ? (
          <MessageSkeleton />
        ) : messages.length === 0 ? (
          <EmptyState persona={persona} />
        ) : (
          <div
            style={{
              display:       "flex",
              flexDirection: "column",
              gap:           4,
              padding:       "24px 24px 16px",
              maxWidth:      760,
              margin:        "0 auto",
              width:         "100%",
              boxSizing:     "border-box",
            }}
          >
            {messages.map((msg) => (
              <MessageRow key={msg.id} message={msg} persona={persona} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Input footer ── */}
      <div
        style={{
          flexShrink:  0,
          padding:     "10px 24px 16px",
          background:  "var(--neutral-50)",
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={handleSend}
            onStop={handleStop}
            isStreaming={isStreaming}
            placeholder={`Message ${name || "persona"}…`}
          />
        </div>
      </div>
    </div>
  );
}
