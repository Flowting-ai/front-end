/**
 * Pure rules behind the V2 "purpose in, agent out" flow.
 *
 * The backend has no single "generate an agent" endpoint: `POST /persona/starter`
 * produces the instructions (plus tone options and tags) from a name + description,
 * and `POST /persona/enhance-prompt` produces the clarifying questions. Everything
 * else a new agent needs — a name, a card blurb, a model, a creativity level, an
 * avatar — is derived here, deterministically and without a network call, so the
 * editor always opens pre-filled and every field stays editable / regenerable.
 *
 * Nothing in this file touches React, the network or storage.
 */

import type { AIModel } from '@/types/ai-model'
import type { PersonaSound } from '@/lib/api/persona-schemas'
import { pickDefaultModel, sortModels } from '@/lib/ai-models'

// ── Limits ────────────────────────────────────────────────────────────────────

/** The purpose is one sentence; the longer ceiling leaves room for context. */
export const PURPOSE_MAX = 300
export const NAME_MAX = 60
/** The card blurb — same ceiling as the V1.5 profile description. */
export const DESCRIPTION_MAX = 120
/** Question cards shown per creation (Fix 3: "at most 3"). */
export const MAX_QUESTION_CARDS = 3

export const DEFAULT_TEMPERATURE = 0.5
export const FALLBACK_AGENT_NAME = 'New Agent'

// ── The editable draft ────────────────────────────────────────────────────────

export interface AgentDraft {
  name:         string
  description:  string
  instructions: string
  /** Backend model id (`stableKey` of the catalog model). */
  modelId:      string | null
  temperature:  number
  /** A static `/persona-avatars/…` path, a `data:` URL, or a stored remote URL. */
  avatarUrl:    string | null
  tags:         string[]
}

export type DraftProblem = 'name' | 'instructions' | 'model'

/** What stops a draft from being saved. Empty means it can be saved. */
export function draftProblems(draft: Pick<AgentDraft, 'name' | 'instructions' | 'modelId'>): DraftProblem[] {
  const problems: DraftProblem[] = []
  if (!draft.name.trim()) problems.push('name')
  if (!draft.instructions.trim()) problems.push('instructions')
  if (!draft.modelId) problems.push('model')
  return problems
}

/**
 * Identity of an avatar for change detection. Stored avatars come back as
 * time-limited signed URLs whose query string differs on every fetch, so remote
 * URLs are compared by origin + path only; pool paths and `data:` URLs as is.
 */
export function avatarKey(url: string | null): string | null {
  if (!url) return null
  if (!/^https?:\/\//i.test(url)) return url
  const query = url.indexOf('?')
  return query < 0 ? url : url.slice(0, query)
}

/** The slider moves in steps of 0.01; a stored float may come back slightly off. */
const TEMPERATURE_EPSILON = 0.005

/** Line endings and trailing whitespace are not edits (a server may normalise them). */
function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n').trimEnd()
}

export function isDraftDirty(current: AgentDraft, baseline: AgentDraft): boolean {
  return (
    current.name.trim()          !== baseline.name.trim() ||
    current.description.trim()   !== baseline.description.trim() ||
    normalizeText(current.instructions) !== normalizeText(baseline.instructions) ||
    current.modelId              !== baseline.modelId ||
    Math.abs(current.temperature - baseline.temperature) > TEMPERATURE_EPSILON ||
    avatarKey(current.avatarUrl) !== avatarKey(baseline.avatarUrl)
  )
}

// ── Handle (mirrors the backend's slugify / allocate_handler) ─────────────────

export function slugifyHandle(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'persona'
}

/** Preview only — the backend allocates the real handle under a row lock. */
export function previewHandle(name: string, takenHandles: ReadonlySet<string>): string {
  const base = slugifyHandle(name)
  if (!takenHandles.has(base)) return base
  let n = 2
  while (takenHandles.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

// ── Description ───────────────────────────────────────────────────────────────

/** The card blurb: the purpose, trimmed to fit, cut at a sentence or word edge. */
export function deriveDescription(purpose: string, max = DESCRIPTION_MAX): string {
  const text = purpose.replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text

  const window = text.slice(0, max)
  const sentenceEnd = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '))
  if (sentenceEnd >= Math.floor(max * 0.5)) return window.slice(0, sentenceEnd + 1)

  const room = window.slice(0, max - 1)
  const wordEdge = room.lastIndexOf(' ')
  const cut = wordEdge >= Math.floor(max * 0.5) ? room.slice(0, wordEdge) : room
  return `${cut.replace(/[\s,;:.-]+$/, '')}…`
}

// ── Name ──────────────────────────────────────────────────────────────────────

const ROLE_BY_VERB: ReadonlyArray<readonly [RegExp, string]> = [
  [/^(review|check|audit|inspect|proofread|evaluate|assess|analy[sz]e|critique)/, 'Reviewer'],
  [/^(summari[sz]e|condense|digest|recap)/, 'Summarizer'],
  [/^(write|draft|compose|generate|create|produce|author)/, 'Writer'],
  [/^(research|find|search|gather|collect|look)/, 'Researcher'],
  [/^(triage|sort|classif|categori[sz]e|route|prioriti[sz]e|label|tag)/, 'Triage'],
  [/^(plan|schedule|organi[sz]e|coordinate)/, 'Planner'],
  [/^(track|monitor|watch|report)/, 'Tracker'],
  [/^(translate)/, 'Translator'],
  [/^(explain|teach|tutor|coach|mentor|guide|train)/, 'Coach'],
  [/^(code|debug|program|develop|refactor|build)/, 'Developer'],
  [/^(answer|respond|reply|support|help|handle|resolve|assist|advise)/, 'Assistant'],
]

/** Words that end the "what it works on" phrase. */
const OBJECT_STOP = new Set([
  'and', 'or', 'but', 'then', 'so', 'that', 'which', 'who', 'when', 'while', 'where', 'because',
  'in', 'on', 'at', 'for', 'to', 'from', 'with', 'by', 'into', 'about', 'of', 'using', 'via',
  'every', 'each', 'daily', 'weekly', 'monthly', 'before', 'after', 'if', 'as',
])

/** Words skipped at the start of the phrase. */
const OBJECT_SKIP = new Set([
  'the', 'a', 'an', 'my', 'our', 'your', 'their', 'its', 'all', 'any', 'some', 'incoming', 'new',
  'me', 'us', 'them', 'it', 'these', 'those', 'this', 'that', 'plain',
])

const LEADING_AGENT_PREFIX =
  /^(?:please\s+)?(?:(?:make|create|build|design)\s+(?:me\s+)?)?(?:(?:an?|the|this|my|your)\s+)?(?:ai\s+)?(?:agent|assistant|bot|helper|persona)\s+(?:that|which|who|to|for|can|will|should)\s+/i

const ROLE_WORDS = new Set([
  'assistant', 'reviewer', 'summarizer', 'writer', 'researcher', 'triage', 'planner', 'tracker',
  'translator', 'coach', 'developer', 'helper', 'agent', 'bot', 'advisor', 'analyst', 'manager',
  'specialist', 'expert', 'tutor', 'guide', 'editor',
])

function titleCase(word: string): string {
  return word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word
}

/** Naive singular for the last word of the object phrase ("contracts" → "contract"). */
function singularize(word: string): string {
  const w = word.toLowerCase()
  if (w.length <= 3) return w
  if (w.endsWith('ies') && w.length > 4) return `${w.slice(0, -3)}y`
  if (/(ss|us|is)$/.test(w)) return w
  if (/(sses|xes|ches|shes)$/.test(w)) return w.slice(0, -2)
  if (w.endsWith('s')) return w.slice(0, -1)
  return w
}

/** Plural nouns that open a purpose ("Sales assistant for…") and are not verbs. */
const PLURAL_NOUNS = new Set(['sales', 'analytics', 'operations', 'news', 'business', 'success', 'logistics', 'finance', 'process'])

/** A third-person verb form ("qualifies", "greets") — only used when no role matched. */
function looksLikeVerb(token: string): boolean {
  return token.length >= 5 && /(?:ies|es|s)$/.test(token) && !/(?:ss|us|is)$/.test(token) && !PLURAL_NOUNS.has(token)
}

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? []
}

function cleanName(raw: string): string {
  const name = raw.replace(/\s+/g, ' ').trim()
  if (name.length <= NAME_MAX) return name
  const cut = name.slice(0, NAME_MAX)
  const edge = cut.lastIndexOf(' ')
  return (edge > 0 ? cut.slice(0, edge) : cut).trim()
}

/**
 * Up to `count` distinct, ready-to-use names for a purpose, best first. Always
 * returns at least one — falls back to {@link FALLBACK_AGENT_NAME}.
 *
 * "Reviews contracts and flags risks in plain English" → "Contract Reviewer",
 * "Contract Assistant", "Contract Helper".
 */
export function deriveAgentNames(purpose: string, count = 3): string[] {
  const clause = purpose
    .replace(LEADING_AGENT_PREFIX, '')
    .split(/[.,;:!?\n]| - | — /)[0]
  const tokens = words(clause)
  if (tokens.length === 0) return [FALLBACK_AGENT_NAME]

  const rule = ROLE_BY_VERB.find(([pattern]) => pattern.test(tokens[0]))
  // "Qualifies leads…": a verb we have no role for is still the verb, not part of the name.
  const unknownVerb = !rule && tokens.length > 1 && !OBJECT_STOP.has(tokens[1]) && looksLikeVerb(tokens[0])
  const rest = rule || unknownVerb ? tokens.slice(1) : tokens

  const phrase: string[] = []
  for (const token of rest) {
    if (OBJECT_STOP.has(token)) {
      if (phrase.length > 0) break
      continue
    }
    if (phrase.length === 0 && OBJECT_SKIP.has(token)) continue
    phrase.push(token)
    if (phrase.length === 2) break
  }

  // A trailing role word already in the phrase ("sales assistant") is not repeated.
  const object = phrase.length > 0
    ? [...phrase.slice(0, -1), singularize(phrase[phrase.length - 1])].map(titleCase)
    : []

  if (object.length === 0) return [FALLBACK_AGENT_NAME]

  const role = rule?.[1] ?? 'Assistant'
  const objectHasRole = ROLE_WORDS.has(object[object.length - 1].toLowerCase())
  const stem = objectHasRole ? object.slice(0, -1) : object

  const candidates = [
    objectHasRole ? object.join(' ') : `${object.join(' ')} ${role}`,
    `${stem.join(' ') || object.join(' ')} Assistant`,
    `${stem.join(' ') || object.join(' ')} Helper`,
  ]
    .map(cleanName)
    .filter(name => name.length > 0)

  const unique: string[] = []
  for (const name of candidates) {
    if (!unique.some(u => u.toLowerCase() === name.toLowerCase())) unique.push(name)
  }
  return unique.slice(0, Math.max(1, count))
}

/** The next name to offer after `current`, cycling through the derived options. */
export function nextAgentName(purpose: string, current: string): string {
  const options = deriveAgentNames(purpose, 3)
  const at = options.findIndex(name => name.toLowerCase() === current.trim().toLowerCase())
  return options[(at + 1) % options.length]
}

// ── Model (rules, not free-form AI choice) ────────────────────────────────────

/**
 * Starter-tier models perform poorly on agentic work, and a model the user has
 * disabled can't run — neither is ever picked automatically, and the picker
 * shows them disabled with the reason.
 */
export function agentModelRestriction(model: AIModel): 'tier' | 'blocked' | null {
  if (model.blocked) return 'blocked'
  const tier = (model.planType ?? model.callType ?? model.modelType ?? '').toLowerCase()
  if (tier === 'free' || tier === 'starter') return 'tier'
  return null
}

/** The catalog's recommended model among those an agent may use, else the first. */
export function pickModelForAgent(models: AIModel[]): AIModel | null {
  const allowed = sortModels(models.filter(model => agentModelRestriction(model) === null))
  return pickDefaultModel(allowed)
}

// ── Creativity (a.k.a. temperature — one control, one value) ──────────────────

const CREATIVE_WORK = /\b(brainstorm\w*|creative|stor(?:y|ies)|writ(?:e|es|ing)|copy(?:writing)?|marketing|ideas?|poems?|blogs?|content|slogans?|campaigns?|fiction|narrative)\b/i
const PRECISE_WORK = /\b(support|tickets?|triage|legal|contracts?|polic(?:y|ies)|compliance|invoices?|financ\w*|account\w*|data|extract\w*|classif\w*|summari[sz]\w*|review\w*|audit\w*|medical|fact\w*|reconcil\w*|inquir\w*|billing)\b/i

/** Lower for factual / support work, higher for writing and brainstorming. */
export function suggestTemperature(purpose: string): number {
  if (CREATIVE_WORK.test(purpose)) return 0.7
  if (PRECISE_WORK.test(purpose)) return 0.3
  return DEFAULT_TEMPERATURE
}

export function temperatureLabel(value: number): string {
  if (value <= 0.12) return 'Very precise'
  if (value <= 0.37) return 'Precise'
  if (value <= 0.62) return 'Balanced'
  if (value <= 0.87) return 'Creative'
  return 'Very creative'
}

export function clampTemperature(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TEMPERATURE
  return Math.min(1, Math.max(0, value))
}

// ── Tone ──────────────────────────────────────────────────────────────────────
//
// The backend stores no tone field and its starter endpoint ignores a tone hint,
// so a tone is applied where it can actually take effect: as one managed
// `Tone: …` line inside the instructions. "Default" means no such line.

const TONE_LINE = /^Tone:[ \t].*$/m

/** Used when the generator returned no voices (and on the edit screen). */
export const FALLBACK_TONES: PersonaSound[] = [
  { name: 'Direct & confident',     description: 'Gets to the point. No filler.' },
  { name: 'Warm & approachable',    description: 'Human first, solution second.' },
  { name: 'Precise & professional', description: 'Formal, structured, no ambiguity.' },
  { name: 'Evidence-based & clear', description: 'Reasoned, grounded, neutral.' },
]

export function toneLine(tone: PersonaSound): string {
  return `Tone: ${tone.name} — ${tone.description}`
}

export type ToneReading =
  | { kind: 'default' }
  | { kind: 'known'; tone: PersonaSound }
  | { kind: 'custom'; line: string }

export function readTone(instructions: string, tones: readonly PersonaSound[]): ToneReading {
  const line = instructions.match(TONE_LINE)?.[0]
  if (!line) return { kind: 'default' }
  const known = tones.find(tone => toneLine(tone) === line)
  return known ? { kind: 'known', tone: known } : { kind: 'custom', line }
}

/** Sets (or, with `null`, removes) the managed tone line, leaving the rest untouched. */
export function applyTone(instructions: string, tone: PersonaSound | null): string {
  const isToneLine = (line: string) => /^Tone:[ \t]/.test(line)
  const lines = instructions.split('\n')
  const first = lines.findIndex(isToneLine)

  if (tone === null) {
    if (first < 0) return instructions
    return lines.filter(line => !isToneLine(line)).join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
  }
  if (first >= 0) {
    // Replace the first tone line in place and drop any further ones.
    return lines
      .flatMap((line, index) => (index === first ? [toneLine(tone)] : isToneLine(line) ? [] : [line]))
      .join('\n')
  }
  const body = instructions.trimEnd()
  return body ? `${body}\n\n${toneLine(tone)}` : toneLine(tone)
}

// ── Question cards ────────────────────────────────────────────────────────────

export interface ClarifyingQuestion {
  question:    string
  multiSelect: boolean
  options:     Array<{ label: string; description: string }>
}

export interface ClarifyingAnswer {
  question: string
  answer:   string
}

/**
 * Keeps only questions a card can show (a question and at least two options),
 * capped at {@link MAX_QUESTION_CARDS}.
 */
export function usableQuestions(
  raw: ReadonlyArray<{
    question: string
    multi_select?: boolean
    options: ReadonlyArray<{ label: string; description: string }>
  }>,
): ClarifyingQuestion[] {
  return raw
    .filter(q => q.question.trim() && q.options.filter(o => o.label.trim()).length >= 2)
    .slice(0, MAX_QUESTION_CARDS)
    .map(q => ({
      question:    q.question.trim(),
      multiSelect: q.multi_select === true,
      options:     q.options.filter(o => o.label.trim()).map(o => ({ label: o.label.trim(), description: o.description.trim() })),
    }))
}

/** The description handed to the generator: the purpose plus what the user clarified. */
export function buildGenerationBrief(purpose: string, answers: readonly ClarifyingAnswer[]): string {
  const base = purpose.replace(/\s+/g, ' ').trim()
  const given = answers.filter(a => a.answer.trim())
  if (given.length === 0) return base
  return `${base}\n\nClarifications:\n${given.map(a => `- ${a.question} → ${a.answer}`).join('\n')}`
}
