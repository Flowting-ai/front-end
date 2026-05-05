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

// Helper to get initial model from localStorage
function getInitialModelFromStorage(): Partial<AIModel> | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    // Store minimal info to show correct icon immediately
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
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(
    getInitialModelFromStorage() as AIModel | null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          const found = fetched.find(
            (m) =>
              String(m.id) === stored || String(m.modelId) === stored,
          );
          if (found) {
            setSelectedModel(found);
            // Update cache with full model data
            const cacheData = {
              id: found.id,
              modelId: found.modelId,
              modelName: found.modelName,
              companyName: found.companyName,
            };
            localStorage.setItem(`${STORAGE_KEY}_cache`, JSON.stringify(cacheData));
          } else {
            // Stored model not found, fallback to first
            setSelectedModel(fetched[0]);
            localStorage.setItem(STORAGE_KEY, String(fetched[0].id));
            const cacheData = {
              id: fetched[0].id,
              modelId: fetched[0].modelId,
              modelName: fetched[0].modelName,
              companyName: fetched[0].companyName,
            };
            localStorage.setItem(`${STORAGE_KEY}_cache`, JSON.stringify(cacheData));
          }
        } else if (!selectedModel) {
          // No stored selection and no cached model, use first
          setSelectedModel(fetched[0]);
          localStorage.setItem(STORAGE_KEY, String(fetched[0].id));
          const cacheData = {
            id: fetched[0].id,
            modelId: fetched[0].modelId,
            modelName: fetched[0].modelName,
            companyName: fetched[0].companyName,
          };
          localStorage.setItem(`${STORAGE_KEY}_cache`, JSON.stringify(cacheData));
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
    if (model.id) {
      localStorage.setItem(STORAGE_KEY, String(model.id));
      // Cache minimal model info for instant icon display on reload
      const cacheData = {
        id: model.id,
        modelId: model.modelId,
        modelName: model.modelName,
        companyName: model.companyName,
      };
      localStorage.setItem(`${STORAGE_KEY}_cache`, JSON.stringify(cacheData));
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
