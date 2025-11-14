export interface AIModel {
  companyName: string;
  modelName: string;
  version: string;
  modelType: 'free' | 'paid';
  inputLimit: number;
  outputLimit: number;
}
