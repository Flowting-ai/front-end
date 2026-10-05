/** Standard/Pro are resolved by the backend to their routing catalog rows. */
export type RoutingTier = "base" | "pro"

export function appendChatModelSelection(
  form: FormData,
  modelId: string | number | null | undefined,
  algorithm: RoutingTier | null | undefined,
  modelField: "model_id" | "modelId",
): void {
  if (algorithm) form.set("algorithm", algorithm)
  else if (modelId != null) form.set(modelField, String(modelId))
}
