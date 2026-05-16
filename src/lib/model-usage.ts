import type { AIModel } from "@/types/ai-model";

const USAGE_COUNTS_KEY = "souvenir_model_usage_counts";
const RECENT_MODELS_KEY = "souvenir_model_recent_keys";
const MAX_RECENT_STORED = 50;

function modelKey(model: AIModel): string {
  return `${model.companyName}::${model.modelName}`;
}

export function recordModelUsage(model: AIModel): void {
  if (typeof window === "undefined") return;

  const countsRaw = localStorage.getItem(USAGE_COUNTS_KEY);
  const counts: Record<string, number> = countsRaw ? JSON.parse(countsRaw) : {};
  const key = modelKey(model);
  counts[key] = (counts[key] ?? 0) + 1;
  localStorage.setItem(USAGE_COUNTS_KEY, JSON.stringify(counts));

  const recentsRaw = localStorage.getItem(RECENT_MODELS_KEY);
  const recents: string[] = recentsRaw ? JSON.parse(recentsRaw) : [];
  const filtered = recents.filter((k) => k !== key);
  filtered.unshift(key);
  localStorage.setItem(
    RECENT_MODELS_KEY,
    JSON.stringify(filtered.slice(0, MAX_RECENT_STORED)),
  );
}

export function getTopUsedModels(allModels: AIModel[], n = 5): AIModel[] {
  if (typeof window === "undefined") return [];
  const countsRaw = localStorage.getItem(USAGE_COUNTS_KEY);
  if (!countsRaw) return [];
  const counts: Record<string, number> = JSON.parse(countsRaw);
  return allModels
    .filter((m) => counts[modelKey(m)] !== undefined)
    .sort((a, b) => (counts[modelKey(b)] ?? 0) - (counts[modelKey(a)] ?? 0))
    .slice(0, n);
}

export function getRecentModels(allModels: AIModel[], n = 5): AIModel[] {
  if (typeof window === "undefined") return [];
  const recentsRaw = localStorage.getItem(RECENT_MODELS_KEY);
  if (!recentsRaw) return [];
  const recents: string[] = JSON.parse(recentsRaw);
  return recents
    .map((key) => allModels.find((m) => modelKey(m) === key))
    .filter((m): m is AIModel => m !== undefined)
    .slice(0, n);
}
