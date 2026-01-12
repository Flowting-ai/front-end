export interface AIModel {
  companyName: string;
  modelName: string;
  modelType: "free" | "paid";
  inputLimit: number;
  outputLimit: number;
}
