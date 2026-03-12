"use client";

// Message reactions are not available in the current backend — stubbed.

export type ReactionType =
  | "like"
  | "love"
  | "laugh"
  | "insightful"
  | "confused"
  | "sad"
  | "angry"
  | "dislike";

export async function addReaction(_params: {
  chatId: string;
  messageId: string;
  reaction: ReactionType;
}): Promise<{ messageId: string; reaction: ReactionType; updatedAt?: string }> {
  throw new Error("Message reactions are not supported in the current backend.");
}

export async function removeReaction(_params: {
  chatId: string;
  messageId: string;
}): Promise<void> {}
