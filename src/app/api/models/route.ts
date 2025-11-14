import { NextResponse } from 'next/server';
import type { AIModel } from '@/types/model';

const models: AIModel[] = [
  {
    companyName: 'OpenAI',
    modelName: 'GPT-5',
    version: '5',
    modelType: 'paid',
    inputLimit: 128000,
    outputLimit: 4096,
  },
  {
    companyName: 'Anthropic',
    modelName: 'Claude 3 Opus',
    version: '3.0',
    modelType: 'paid',
    inputLimit: 200000,
    outputLimit: 4096,
  },
    {
    companyName: 'Anthropic',
    modelName: 'Claude 3 Sonnet',
    version: '3.0',
    modelType: 'free',
    inputLimit: 200000,
    outputLimit: 4096,
  },
  {
    companyName: 'Google',
    modelName: 'Gemini Pro',
    version: '1.0',
    modelType: 'paid',
    inputLimit: 30720,
    outputLimit: 2048,
  },
  {
    companyName: 'Google',
    modelName: 'Gemini 2.5 Flash',
    version: '2.5',
    modelType: 'paid',
    inputLimit: 1000000,
    outputLimit: 8192,
  },
  {
    companyName: 'Mistral AI',
    modelName: 'Mistral Large',
    version: '1.0',
    modelType: 'free',
    inputLimit: 32000,
    outputLimit: 4096,
  },
];

export async function GET() {
  return NextResponse.json(models);
}
