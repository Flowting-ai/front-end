/**
 * "Purpose in, agent out": turns one sentence (plus optional clarifications) into
 * a complete, editable {@link AgentDraft}.
 *
 * Network calls: `POST /persona/enhance-prompt` for the clarifying questions and
 * `POST /persona/starter` for the instructions, tone options and tags. Everything
 * else is derived by the pure rules in `agent-draft.ts`. Nothing is saved here.
 */

import { enhancePrompt, personaStarter } from '@/lib/api/personas'
import { stableKey } from '@/hooks/use-model-selection'
import { pickTemplateAvatar } from '@/lib/persona-template-avatars'
import type { AIModel } from '@/types/ai-model'
import type { PersonaSound } from '@/lib/api/persona-schemas'
import {
  FALLBACK_TONES,
  applyTone,
  buildGenerationBrief,
  deriveAgentNames,
  deriveDescription,
  pickModelForAgent,
  suggestTemperature,
  usableQuestions,
  type AgentDraft,
  type ClarifyingAnswer,
  type ClarifyingQuestion,
} from '@/lib/agent-draft'

/** The questions are a nicety — never let a slow model hold up creating an agent. */
export const QUESTIONS_TIMEOUT_MS = 12_000

/** A starting point supplied by a template card. */
export interface TemplateSeed {
  name:              string
  systemInstruction: string
  /** Index into {@link FALLBACK_TONES}; templates predate generated tone options. */
  toneIndex:         number | null
}

export interface GeneratedAgent {
  draft: AgentDraft
  /** Tone options for the editor: the generator's voices, else the built-in four. */
  tones: PersonaSound[]
}

/** The V1.5 template tone ids, in the order of {@link FALLBACK_TONES}. */
const TEMPLATE_TONE_IDS = ['direct', 'warm', 'precise', 'evidence'] as const

/** A template card's preset as a generation seed. */
export function seedFromPreset(preset: { name: string; systemInstruction: string; tone: string }): TemplateSeed {
  const index = TEMPLATE_TONE_IDS.indexOf(preset.tone as (typeof TEMPLATE_TONE_IDS)[number])
  return { name: preset.name, systemInstruction: preset.systemInstruction, toneIndex: index >= 0 ? index : null }
}

function modelIdOf(models: AIModel[]): string | null {
  const model = pickModelForAgent(models)
  return model ? stableKey(model) : null
}

function seedDraft(purpose: string, models: AIModel[], seed?: TemplateSeed): AgentDraft {
  return {
    name:         seed?.name ?? deriveAgentNames(purpose, 1)[0],
    description:  deriveDescription(purpose),
    instructions: '',
    modelId:      modelIdOf(models),
    temperature:  suggestTemperature(purpose),
    avatarUrl:    pickTemplateAvatar(),
    tags:         [],
  }
}

/**
 * Up to three clarifying questions, or none. Any failure or a timeout resolves to
 * none: the user simply goes straight to the editor.
 */
export async function requestClarifyingQuestions(purpose: string): Promise<ClarifyingQuestion[]> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<ClarifyingQuestion[]>(resolve => {
    timer = setTimeout(() => resolve([]), QUESTIONS_TIMEOUT_MS)
  })
  const request = enhancePrompt(purpose, [])
    .then(response => usableQuestions(response.questions))
    .catch(() => [] as ClarifyingQuestion[])
  try {
    return await Promise.race([request, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/** Generates every field. Throws if the instructions can't be generated. */
export async function generateAgentDraft(args: {
  purpose: string
  answers: readonly ClarifyingAnswer[]
  models:  AIModel[]
  seed?:   TemplateSeed
}): Promise<GeneratedAgent> {
  const { purpose, answers, models, seed } = args
  const draft = seedDraft(purpose, models, seed)

  const starter = await personaStarter({
    name:        draft.name,
    description: buildGenerationBrief(purpose, answers),
  })

  const tones = starter.sounds.length > 0 ? starter.sounds : FALLBACK_TONES
  let instructions = seed?.systemInstruction || starter.system_instruction
  const seededTone = seed?.toneIndex != null ? FALLBACK_TONES[seed.toneIndex] : undefined
  if (seededTone) instructions = applyTone(instructions, seededTone)

  return {
    draft: { ...draft, instructions, tags: starter.persona_tags },
    tones: seededTone && !tones.includes(seededTone) ? [seededTone, ...tones] : tones,
  }
}

/** Fresh instructions for an existing draft — the "regenerate" action on that field. */
export async function regenerateInstructions(args: {
  name:    string
  purpose: string
  answers: readonly ClarifyingAnswer[]
}): Promise<{ instructions: string; tones: PersonaSound[]; tags: string[] }> {
  const starter = await personaStarter({
    name:        args.name,
    description: buildGenerationBrief(args.purpose, args.answers),
  })
  return {
    instructions: starter.system_instruction,
    tones:        starter.sounds.length > 0 ? starter.sounds : FALLBACK_TONES,
    tags:         starter.persona_tags,
  }
}

/**
 * The "Fill in manually" fallback when generation fails: the same pre-filled
 * editor, with empty instructions for the user to write.
 */
export function manualAgentDraft(purpose: string, models: AIModel[], seed?: TemplateSeed): GeneratedAgent {
  return { draft: seedDraft(purpose, models, seed), tones: FALLBACK_TONES }
}
