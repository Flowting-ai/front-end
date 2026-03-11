"use client";

import { USER_ENDPOINT } from "@/lib/config";
import { apiFetch } from "./client";

export interface UserProfile {
  id: string | number;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  planName?: string | null;
  budget?: string | null;
  budgetUsed?: string | null;
  budgetRemaining?: string | null;
  budgetConsumedPercent?: number | null;
  dailyQuotaEnabled?: boolean | null;
  dailyBudgetUsed?: string | null;
  dailyBudgetLimit?: string | null;
  dailyBudgetAvailable?: string | null;
  nextBillingDate?: string | null;
}

export async function fetchCurrentUser(): Promise<UserProfile | null> {
  const response = await apiFetch(USER_ENDPOINT, { method: "GET" });
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  return data as UserProfile;
}
