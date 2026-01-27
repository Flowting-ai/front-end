import type { AIModel } from "@/types/ai-model";

type BackendModel = {
  id?: number | string;
  modelId?: number | string;
  companyName?: string;
  modelName?: string;
  name?: string;
  providerName?: string;
  provider?: string;
  planType?: string;
  plan?: string;
  callType?: string;
  inputLimit?: number;
  outputLimit?: number;
  providerId?: number | string;
  sdkLibrary?: string;
  huggingfaceProvider?: string;
  deploymentName?: string;
  inputModalities?: string[];
  outputModalities?: string[];
  version?: string;
};

const normalizeModelType = (planType?: string, callType?: string) => {
  const normalized = `${planType ?? ""} ${callType ?? ""}`.toLowerCase();
  if (normalized.includes("free")) return "free";
  if (normalized.includes("paid") || normalized.includes("pro")) return "paid";
  return "paid";
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeModel = (model: BackendModel): AIModel => ({
  id: model.id ?? model.modelId,
  modelId: model.modelId ?? model.id,
  companyName:
    model.companyName ?? model.providerName ?? model.provider ?? "Unknown",
  modelName: model.modelName ?? model.name ?? "Unknown Model",
  modelType: normalizeModelType(model.planType ?? model.plan, model.callType),
  inputLimit: toNumber(model.inputLimit, 0),
  outputLimit: toNumber(model.outputLimit, 0),
  version: model.version,
  planType: model.planType ?? model.plan,
  callType: model.callType,
  providerId: model.providerId,
  sdkLibrary: model.sdkLibrary,
  huggingfaceProvider: model.huggingfaceProvider,
  deploymentName: model.deploymentName,
  inputModalities: model.inputModalities,
  outputModalities: model.outputModalities,
});

export const normalizeModels = (payload: unknown): AIModel[] => {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { results?: unknown[] })?.results)
    ? (payload as { results: unknown[] }).results
    : Array.isArray((payload as { models?: unknown[] })?.models)
    ? (payload as { models: unknown[] }).models
    : [];

  return list.map((model) => normalizeModel(model as BackendModel));
};
