"use client";

import { MESSAGE_REACTION_ENDPOINT } from "@/lib/config";
import { apiFetch } from "./client";

export type ReactionType =
  | "like"
  | "love"
  | "laugh"
  | "insightful"
  | "confused"
  | "sad"
  | "angry"
  | "dislike";

export async function addReaction({
  chatId,
  messageId,
  reaction,
  csrfToken,
}: {
  chatId: string;
  messageId: string;
  reaction: ReactionType;
  csrfToken?: string | null;
}) {
  const response = await apiFetch(
    MESSAGE_REACTION_ENDPOINT(chatId, messageId),
    {
      method: "PATCH",
      body: JSON.stringify({ reaction }),
    },
    csrfToken
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to add reaction");
  }

  return response.json() as Promise<{
    messageId: string;
    reaction: ReactionType;
    updatedAt?: string;
  }>;
}

export async function removeReaction({
  chatId,
  messageId,
  csrfToken,
}: {
  chatId: string;
  messageId: string;
  csrfToken?: string | null;
}) {
  const response = await apiFetch(
    MESSAGE_REACTION_ENDPOINT(chatId, messageId),
    { method: "DELETE" },
    csrfToken
  );

  if (!response.ok && response.status !== 204) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to remove reaction");
  }

  return;
}
