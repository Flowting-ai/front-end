"use client";

import { BUDGET_ENDPOINT } from "@/lib/config";
import { apiFetch } from "./client";

export interface BudgetStats {
  budget: string;
  budgetUsed: string;
  budgetRemaining: string;
  budgetConsumedPercent: number;
  dailyQuotaEnabled: boolean;
  dailyBudgetUsed: string;
  dailyBudgetLimit: string;
  dailyBudgetAvailable: string;
  nextBillingDate: string;
}

export async function fetchBudgetStats(): Promise<BudgetStats | null> {
  const response = await apiFetch(BUDGET_ENDPOINT, { method: "GET" });
  if (!response.ok) return null;
  return response.json();
}
