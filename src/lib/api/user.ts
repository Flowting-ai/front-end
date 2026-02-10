"use client";

import { USER_ENDPOINT } from "@/lib/config";
import { apiFetch } from "./client";

export interface UserProfile {
  id: string | number;
  username?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  planName?: string | null;
  availableTokens?: number;
  totalTokensUsed?: number;
}

export async function fetchCurrentUser(
  csrfToken?: string | null
): Promise<UserProfile | null> {
  const response = await apiFetch(USER_ENDPOINT, { method: "GET" }, csrfToken);
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  return data as UserProfile;
}
