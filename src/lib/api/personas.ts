"use client";

import { apiFetch, apiFetchJson } from "./client";
import {
  PERSONAS_ENDPOINT,
  PERSONA_DETAIL_ENDPOINT,
} from "@/lib/config";

export type PersonaStatus = "draft" | "test" | "completed";

export interface BackendPersona {
  id: string;
  name: string;
  prompt: string;
  status: PersonaStatus;
  is_active: boolean;
  model_id: string | null;
  image_url: string | null;
  temperature?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Persona {
  id: string;
  name: string;
  handle: string;
  description: string;
  imageUrl: string | null;
  tags: string[];
  temperature: number | null;
  isActive: boolean;
  status: PersonaStatus;
  createdAt: string;
  updatedAt: string;
}

function toHandle(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_");
}

function normalize(p: BackendPersona): Persona {
  return {
    id: p.id,
    name: p.name,
    handle: `@${toHandle(p.name)}`,
    description: p.prompt?.slice(0, 140) || "",
    imageUrl: p.image_url,
    tags: [],
    temperature: p.temperature ?? null,
    isActive: p.is_active,
    status: p.status,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export async function fetchPersonas(status?: PersonaStatus): Promise<Persona[]> {
  const url = status ? `${PERSONAS_ENDPOINT}?status=${status}` : PERSONAS_ENDPOINT;
  const list = await apiFetchJson<BackendPersona[]>(url);
  return list.map(normalize);
}

export async function deletePersona(id: string): Promise<void> {
  await apiFetch(PERSONA_DETAIL_ENDPOINT(id), { method: "DELETE" });
}
