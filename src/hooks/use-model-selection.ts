"use client";

import { useState, useEffect } from "react";
import { fetchModelsWithCache } from "@/lib/ai-models";
import type { AIModel } from "@/types/ai-model";
import { logger } from "@/lib/logger";

const STORAGE_KEY = "souvenir_selected_model";

interface UseModelSelectionResult {
  models: AIModel[];
  selectedModel: AIModel | null;
  isLoading: boolean;
  error: string | null;
  selectModel: (model: AIModel) => void;
  refreshModels: () => Promise<void>;
}

// Prefer the semantic string modelId over the numeric database id for stable storage.
// Exported so other model-selection sites (e.g. persona configure) use the same key format.
export function stableKey(model: Pick<AIModel, "modelId" | "id">): string | null {
  if (model.modelId != null && String(model.modelId) !== "undefined") return String(model.modelId);
  if (model.id != null && String(model.id) !== "undefined") return String(model.id);
  return null;
}

// Helper to get initial model from localStorage
function getInitialModelFromStorage(): Partial<AIModel> | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    // Minimal cached info for instant icon/name display before the fetch completes
    const cachedModel = localStorage.getItem(`${STORAGE_KEY}_cache`);
    if (cachedModel) {
      return JSON.parse(cachedModel);
    }
    return null;
  } catch {
    return null;
  }
}

export function useModelSelection(): UseModelSelectionResult {
  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = getInitialModelFromStorage();
    if (cached) setSelectedModel(cached as AIModel);
  }, []);

  const loadModels = async (force = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const fetched = await fetchModelsWithCache({ force });
      setModels(fetched);

      // Restore or upgrade persisted selection
      if (fetched.length > 0) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          // 1st: match by modelId (semantic string, most stable)
          // 2nd: match by id (numeric DB key, may change)
          let found = fetched.find(
            (m) =>
              (m.modelId != null && String(m.modelId) === stored) ||
              (m.id != null && String(m.id) === stored),
          );

          // 3rd: match by modelName + companyName from cache (guards against API id changes)
          if (!found) {
            const cachedRaw = localStorage.getItem(`${STORAGE_KEY}_cache`);
            if (cachedRaw) {
              try {
                const cached = JSON.parse(cachedRaw) as Partial<AIModel>;
                if (cached.modelName && cached.companyName) {
                  found = fetched.find(
                    (m) =>
                      m.modelName === cached.modelName &&
                      m.companyName === cached.companyName,
                  );
                }
              } catch {}
            }
          }

          if (found) {
            setSelectedModel(found);
            // Re-key storage to the current stable modelId so future lookups succeed
            const newKey = stableKey(found);
            if (newKey && newKey !== stored) {
              localStorage.setItem(STORAGE_KEY, newKey);
            }
            localStorage.setItem(
              `${STORAGE_KEY}_cache`,
              JSON.stringify({
                id: found.id,
                modelId: found.modelId,
                modelName: found.modelName,
                companyName: found.companyName,
              }),
            );
          }
          // If no match found at all: keep the current selectedModel (cached partial)
          // rather than clobbering it with an arbitrary fetched[0].
        } else if (!selectedModel) {
          // No stored selection and no cached model at all — default to first model
          setSelectedModel(fetched[0]);
          const key = stableKey(fetched[0]);
          if (key) localStorage.setItem(STORAGE_KEY, key);
          localStorage.setItem(
            `${STORAGE_KEY}_cache`,
            JSON.stringify({
              id: fetched[0].id,
              modelId: fetched[0].modelId,
              modelName: fetched[0].modelName,
              companyName: fetched[0].companyName,
            }),
          );
        }
      }
    } catch (err) {
      logger.error("[useModelSelection] Failed to load models", err);
      setError("Failed to load models");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  const selectModel = (model: AIModel) => {
    setSelectedModel(model);
    // Use the semantic modelId as the primary key (more stable than numeric id)
    const key = stableKey(model);
    if (key) {
      localStorage.setItem(STORAGE_KEY, key);
      // Cache minimal model info for instant icon/name display on next load
      localStorage.setItem(
        `${STORAGE_KEY}_cache`,
        JSON.stringify({
          id: model.id,
          modelId: model.modelId,
          modelName: model.modelName,
          companyName: model.companyName,
        }),
      );
    }
  };

  const refreshModels = async () => {
    await loadModels(true);
  };

  return {
    models,
    selectedModel,
    isLoading,
    error,
    selectModel,
    refreshModels,
  };
}
