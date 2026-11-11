import { z } from "zod";

// Mirrors the backend GetModels / GetModelsWithStatus wire types
// (GET /llm/models, /llm/models/all). Optional lists default to empty; a model
// missing its id, name or provider fails and is dropped on its own, so one bad
// row never empties the catalogue.

const stringList = z.array(z.string()).nullish().transform(v => v ?? []);
const optionalNumber = z.number().nullish();

export const modelWireSchema = z.object({
  model_id:               z.string().min(1),
  model_name:             z.string().min(1),
  model_provider:         z.string().min(1),
  model_inputs:           stringList,
  model_outputs:          stringList,
  model_context_window:   optionalNumber,
  model_output_size:      optionalNumber,
  model_input_cost:       optionalNumber,
  model_output_cost:      optionalNumber,
  model_plan_type:        z.string().nullish().transform(v => v ?? ""),
  model_description:      z.string().nullish().transform(v => v ?? ""),
  model_thinking_efforts: z.array(z.string()).nullish().transform(v => v ?? undefined),
  model_tags:             z.array(z.string()).nullish().transform(v => v ?? undefined),
});

export const modelWithStatusSchema = modelWireSchema.extend({
  blocked: z.boolean().nullish().transform(v => v ?? false),
});

export const blockResultSchema = z.object({ blocked: z.boolean() });

/** Parses a model list item by item; malformed rows are dropped and counted. */
export function parseModelList<T>(schema: z.ZodType<T>, raw: unknown): { models: T[]; dropped: number } {
  if (!Array.isArray(raw)) throw new Error("Unexpected models response: expected a list");
  const models: T[] = [];
  let dropped = 0;
  for (const item of raw) {
    const parsed = schema.safeParse(item);
    if (parsed.success) models.push(parsed.data);
    else dropped++;
  }
  if (dropped > 0) console.warn(`[models] dropped ${dropped} malformed model(s)`);
  return { models, dropped };
}
