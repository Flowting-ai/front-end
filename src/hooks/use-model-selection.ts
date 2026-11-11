"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { modelsQuery } from "@/lib/ai-models";
import { queryKeys } from "@/lib/query-keys";
import type { AIModel } from "@/types/ai-model";
import { toast } from "sonner";
import { trackBrowserEvent } from "@/lib/analytics/events";
import {
  getSelectionSnapshot,
  getServerSelectionSnapshot,
  resolveSelection,
  stableKey,
  subscribeSelection,
  writeSelection,
} from "@/lib/models/model-selection-store";

// Kept here for the many model-selection sites that import it from this hook.
export { stableKey } from "@/lib/models/model-selection-store";

interface UseModelSelectionResult {
  models: AIModel[];
  selectedModel: AIModel | null;
  isLoading: boolean;
  error: string | null;
  selectModel: (model: AIModel) => void;
  refreshModels: () => Promise<void>;
}

const NO_MODELS: AIModel[] = [];

/**
 * The chat model catalogue and the user's selection. The catalogue is the
 * shared ["models"] query, so a model blocked or unblocked in /settings/ai
 * (bustModelsCache → invalidation, in every tab) shows up here without an
 * event. The selection is an id in localStorage (lib/models/model-selection-store.ts),
 * resolved against the catalogue on every change and synced across tabs.
 */
export function useModelSelection(): UseModelSelectionResult {
  const qc = useQueryClient();
  const modelsQ = useQuery(modelsQuery());
  const models = modelsQ.data ?? NO_MODELS;
  const stored = useSyncExternalStore(subscribeSelection, getSelectionSnapshot, getServerSelectionSnapshot);
  const resolved = useMemo(() => resolveSelection(models, stored), [models, stored]);

  // Re-key storage to the current stable id, persist a default, and say so
  // once when a retired or blocked model was replaced.
  const toastedFor = useRef<string | null>(null);
  useEffect(() => {
    if (resolved.persist) writeSelection(resolved.persist);
    if (resolved.replacedName && resolved.model && toastedFor.current !== stored.key) {
      toastedFor.current = stored.key;
      trackBrowserEvent("model_fallback", { from_model_id: stored.key ?? undefined, to_model_id: stableKey(resolved.model) ?? undefined });
      toast.info(`${resolved.replacedName} is no longer available — switched to ${resolved.model.modelName}.`);
    }
  }, [resolved, stored.key]);

  return {
    models,
    selectedModel: resolved.model,
    isLoading: modelsQ.isPending,
    error: modelsQ.isError && models.length === 0 ? "Failed to load models" : null,
    selectModel: (model) => {
      if (stableKey(model) !== stored.key) trackBrowserEvent("model_selected", { model_id: stableKey(model) ?? undefined });
      writeSelection(model);
    },
    refreshModels: async () => {
      await qc.refetchQueries({ queryKey: queryKeys.models.all(), exact: true });
    },
  };
}
