import type { UIMessage } from "@/types/chat";

export interface SeedModel {
  modelName: string;
  companyName?: string;
  modelId?: string | number | null;
  id?: string | number | null;
}

/**
 * Fills model logo + name on assistant messages that have thinking content but no model
 * identity (the history API does not always return model_name). Derived at render, so it
 * never writes back to message state. Returns `messages` itself when nothing needs it.
 */
export function seedModelMeta(messages: UIMessage[], model: SeedModel | null | undefined): UIMessage[] {
  if (!model) return messages;
  const needs = (m: UIMessage) => m.role === "assistant" && !!m.thinking && !m.modelName && !m.modelMeta;
  if (!messages.some(needs)) return messages;
  const modelName = model.modelName;
  const company = model.companyName;
  const modelId = String(model.modelId ?? model.id ?? "");
  return messages.map((m) => (needs(m) ? { ...m, modelName, modelMeta: { modelId, modelName, company } } : m));
}
