export interface AIModel {
  id: string | number | undefined;
  modelId: string | number | undefined;
  companyName: string;
  modelName: string;
  modelType: "free" | "paid";
  inputLimit: number;
  outputLimit: number;
  version?: string;
  description?: string;
  planType?: string;
  callType?: string;
  providerId?: number | string;
  sdkLibrary?: string;
  huggingfaceProvider?: string;
  deploymentName?: string;
  inputModalities?: string[];
  outputModalities?: string[];
}
