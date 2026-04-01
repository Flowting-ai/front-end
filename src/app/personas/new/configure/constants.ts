/**
 * Constants for Persona Configuration
 */

import type { PersonaModel } from './types';

export const MODELS: PersonaModel[] = [
  { value: "gpt-5", label: "OpenAI: GPT-5", company: "OpenAI" },
  { value: "gpt-4", label: "OpenAI: GPT-4", company: "OpenAI" },
  { value: "claude-3", label: "Anthropic: Claude 3", company: "Anthropic" },
  { value: "gemini", label: "Google: Gemini", company: "Google" },
];

export const TONE_OPTIONS = [
  "Friendly",
  "Formal",
  "Technical",
  "Witty",
  "Empathetic",
  "Direct",
] as const;

export const DEFAULT_TEMPERATURE = 0;
export const MIN_TEMPERATURE = 0;
export const MAX_TEMPERATURE = 1;
export const TEMPERATURE_STEP = 0.1;

export const ACCEPTED_FILE_TYPES = ".pdf,.png,.jpg,.jpeg,.gif,.webp, .txt,.md,.doc,.docx,.ppt,.pptx,.xls,.xlsx";
export const MAX_FILE_SIZE_MB = 30;
export const MAX_FILES = 10;

