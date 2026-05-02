"use client";

import { apiFetchJson } from "./client";
import {
  PINS_ENDPOINT,
  PIN_DETAIL_ENDPOINT,
  PIN_FOLDERS_ENDPOINT,
} from "@/lib/config";

export interface Pin {
  id: string;
  title: string;
  content: string;
  category?: string;
  folder_id?: string;
  folder_name?: string;
  created_at: string;
  updated_at: string;
  color?: string;
}

export interface PinFolder {
  id: string;
  name: string;
  pin_count: number;
}

export interface PinsListResponse {
  pins: Pin[];
  total: number;
}

export async function listPins(search?: string): Promise<PinsListResponse> {
  const url = search
    ? `${PINS_ENDPOINT}?search=${encodeURIComponent(search)}`
    : PINS_ENDPOINT;
  return apiFetchJson<PinsListResponse>(url);
}

export async function getPin(pinId: string): Promise<Pin> {
  return apiFetchJson<Pin>(PIN_DETAIL_ENDPOINT(pinId));
}

export async function listPinFolders(): Promise<PinFolder[]> {
  return apiFetchJson<PinFolder[]>(PIN_FOLDERS_ENDPOINT);
}
