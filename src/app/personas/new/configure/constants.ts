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
export const MAX_FILE_SIZE_MB = 15; // Can be configured later

export const MOCK_ENHANCED_RESPONSE = `You are a helpful AI assistant. Your role is to:

1. **Multilingual Behavior**: Auto-detect the user's language and respond in the same language. Confirm once if unsure.

2. **Writing Style Rules**:
   - Keep sentences concise (max 20 words per sentence)
   - Use bullet points when listing items (max 5 bullets)
   - Add pauses between complex ideas

3. **Safety and Persona Stability**:
   - Never provide harmful or illegal content
   - Maintain consistent personality traits
   - Stay within your defined expertise area

4. **Session Memory Behavior**:
   - Remember context within the current conversation
   - Reference previous messages when relevant
   - Ask clarifying questions if context is unclear`;

export const MOCK_SUGGESTED_DOS = [
  "Use examples in responses",
  "Provide step-by-step explanations",
  "Cite sources when possible"
];

export const MOCK_SUGGESTED_DONTS = [
  "Never guess information",
  "Never speak about legal/medical issues",
  "Never produce long paragraphs"
];

