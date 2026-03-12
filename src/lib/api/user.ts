"use client";

import { USER_ENDPOINT, USER_CREATE_ENDPOINT } from "@/lib/config";
import { apiFetch } from "./client";

export interface UserProfile {
  auth0_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  plan_type: "standard" | "paid" | "pro";
  created_at: string;
  active: boolean;
}

export async function fetchCurrentUser(): Promise<UserProfile | null> {
  const response = await apiFetch(USER_ENDPOINT, { method: "GET" });
  if (!response.ok) return null;
  return (await response.json()) as UserProfile;
}

export async function createUser(): Promise<UserProfile | null> {
  const response = await apiFetch(USER_CREATE_ENDPOINT, { method: "POST" });
  if (!response.ok) return null;
  return (await response.json()) as UserProfile;
}

export async function updateUser(payload: {
  first_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
}): Promise<UserProfile | null> {
  const response = await apiFetch(USER_ENDPOINT, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!response.ok) return null;
  return (await response.json()) as UserProfile;
}

export async function deleteUser(): Promise<void> {
  await apiFetch(USER_ENDPOINT, { method: "DELETE" });
}
