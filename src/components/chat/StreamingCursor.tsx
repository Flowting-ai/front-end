"use client";

import { BreathingDot } from "@/components/BreathingDot";

interface StreamingCursorProps {
  isVisible: boolean;
}

/**
 * A subtle breathing dot that appears at the end of streaming content
 * to indicate the AI is still generating. Matches souvenir-chat-preview's BreathingDot.
 */
export function StreamingCursor({ isVisible }: StreamingCursorProps) {
  if (!isVisible) return null;

  return <BreathingDot style={{ marginLeft: 4, backgroundColor: "#826B60" }} />;
}
