"use client";

import { useState, useEffect } from "react";
import { fetchPersonas as fetchPersonasApi } from "@/lib/api/personas";
import { API_BASE_URL } from "@/lib/config";
import type { Persona } from "@/components/layout/app-layout";

/**
 * Fetches the list of active personas once when the `user` becomes available
 * and exposes them together with a setter for optimistic local updates.
 *
 * Only personas with `status === "test"` are included (backend's term for
 * "published / active" personas).  Avatar URLs are normalised to absolute
 * form using `API_BASE_URL` so they work everywhere in the app.
 *
 * @param user - The authenticated user object (or `null` when unauthenticated).
 *               The fetch is skipped until this is truthy. Only the object's
 *               truthiness matters — no specific fields are read by this hook.
 */
export function useActivePersonas(
  user: object | null | undefined,
): [Persona[], React.Dispatch<React.SetStateAction<Persona[]>>] {
  const [activePersonas, setActivePersonas] = useState<Persona[]>([]);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      try {
        const backendPersonas = await fetchPersonasApi(undefined);
        const mapped = backendPersonas
          .filter((bp) => bp.status === "test")
          .map((bp) => {
            const rawUrl = bp.imageUrl ?? bp.image_url ?? null;
            const avatar = rawUrl
              ? rawUrl.startsWith("http") ||
                rawUrl.startsWith("data:") ||
                rawUrl.startsWith("blob:")
                ? rawUrl
                : `${API_BASE_URL}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`
              : null;

            return {
              id: bp.id,
              name: bp.name,
              avatar,
              prompt: bp.prompt,
              modelId: bp.modelId ?? bp.model_id ?? null,
              modelName: bp.modelName ?? bp.model_name ?? null,
              providerName: bp.providerName ?? bp.provider_name ?? null,
              status: "active" as const,
            };
          });
        setActivePersonas(mapped);
      } catch (error) {
        console.error("[useActivePersonas] Failed to load personas:", error);
        setActivePersonas([]);
      }
    };

    void load();
  }, [user]);

  return [activePersonas, setActivePersonas];
}
