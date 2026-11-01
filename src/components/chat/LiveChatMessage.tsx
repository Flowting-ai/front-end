"use client"

import React from "react"
import { ChatMessageMemo } from "./ChatMessage"
import { useLiveMessage } from "@/hooks/use-live-message"

type ChatMessageProps = React.ComponentProps<typeof ChatMessageMemo>

/**
 * A chat row that also shows the in-flight stream fields of its message
 * (use-streaming-chat `liveOverlay`). Only the streaming row re-renders per
 * frame; the list and the composer don't.
 */
export function LiveChatMessage(props: ChatMessageProps) {
  const message = useLiveMessage(props.message)
  return <ChatMessageMemo {...props} message={message} />
}
