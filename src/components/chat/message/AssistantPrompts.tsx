"use client";

import React from "react";
import { ConnectPromptCard } from "../ConnectorPrompts";
import { PermissionPromptCard } from "@/components/shared/PermissionPromptCard";
import { ChatPromptCard } from "../ChatPromptCard";
import { respondToChatPrompt } from "@/lib/api/chat";
import type { UIMessage } from "@/types/chat";

// ── Inline prompt cards: connector connect / permission, and chat questions ───

const stackStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };

export function AssistantPrompts({
  message,
  onPromptDecided,
  onPromptAnswered,
}: {
  message: UIMessage;
  onPromptDecided?: (messageId: string, requestId: string, decision: string) => void;
  onPromptAnswered?: () => void;
}) {
  return (
    <>
      {/* Connector connect prompts — inline CTA when a tool needs linking */}
      {message.connectorConnectPrompts && message.connectorConnectPrompts.length > 0 && (
        <div style={stackStyle}>
          {message.connectorConnectPrompts.map((prompt) => (
            <ConnectPromptCard key={prompt.request_id} prompt={prompt} />
          ))}
        </div>
      )}

      {/* Connector permission prompts — inline Allow/Block/Allow once buttons */}
      {message.connectorPermissionPrompts && message.connectorPermissionPrompts.length > 0 && (
        <div style={stackStyle}>
          {message.connectorPermissionPrompts.map((prompt) => (
            <PermissionPromptCard
              key={prompt.request_id}
              prompt={prompt}
              onDecided={(policy) => {
                respondToChatPrompt(policy, prompt.respond_url)
                  .then(() => onPromptAnswered?.())
                  .catch(() => {})
                onPromptDecided?.(message.id, prompt.request_id, policy)
              }}
            />
          ))}
        </div>
      )}

      {message.chatPrompts && message.chatPrompts.length > 0 && (
        <div style={stackStyle}>
          {message.chatPrompts.map((prompt) => (
            <ChatPromptCard
              key={prompt.request_id}
              prompt={prompt}
              onDecided={(decision) => onPromptDecided?.(message.id, prompt.request_id, decision)}
              onAnswered={onPromptAnswered}
            />
          ))}
        </div>
      )}
    </>
  );
}
