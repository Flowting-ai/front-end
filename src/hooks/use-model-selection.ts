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

export function useModelSelection(): UseModelSelectionResult {
  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadModels = async (force = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const fetched = await fetchModelsWithCache({ force });
      setModels(fetched);

      // Restore persisted selection
      if (!selectedModel && fetched.length > 0) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const found = fetched.find(
            (m) =>
              String(m.id) === stored || String(m.modelId) === stored,
          );
          if (found) {
            setSelectedModel(found);
          } else {
            setSelectedModel(fetched[0]);
          }
        } else {
          setSelectedModel(fetched[0]);
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
