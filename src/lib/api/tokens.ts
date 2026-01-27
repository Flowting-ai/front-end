"use client";

import { TOKENS_ENDPOINT } from "@/lib/config";
import { apiFetch } from "./client";

export interface TokenStats {
  availableTokens: number;
  totalTokensUsed: number;
}

export async function fetchTokenStats(
  csrfToken?: string | null
): Promise<TokenStats> {
  const response = await apiFetch(TOKENS_ENDPOINT, { method: "GET" }, csrfToken);
  if (!response.ok) {
    throw new Error("Failed to load token stats");
  }
  const data = await response.json();
  return {
    availableTokens: Number(data?.availableTokens ?? 0),
    totalTokensUsed: Number(data?.totalTokensUsed ?? 0),
  };
}
