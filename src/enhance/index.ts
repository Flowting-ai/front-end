// ── Types ─────────────────────────────────────────────────────────────────────

export type EnhanceMode = 'BUILD' | 'AUDIT'

export interface PersonaContext {
  knowledgeCount:    number
  connectorsEnabled: string[]
  sharing:           'private' | 'shared'
}

export interface QuestionOption {
  id:    string
  label: string
}

export interface Question {
  id:           string
  text:         string
  sub:          string
  options:      QuestionOption[]
  multiSelect?: boolean
  maxSelect?:   number
}

export type Answers = Record<string, string[]>

export interface DiffSegment {
  type: 'added' | 'removed' | 'unchanged'
  text: string
}

// ── Internal scan scores ───────────────────────────────────────────────────────

export interface PromptScores {
  length:         number
  hasRole:        boolean
  hasTone:        boolean
  hasGoal:        boolean
  hasConstraints: boolean
  hasBehavior:    boolean
  hasFormat:      boolean
  hasExamples:    boolean
}

// ── Question bank ──────────────────────────────────────────────────────────────

const QUESTION_BANK: Record<string, Question> = {
  role: {
    id:   'role',
    text: "What is this persona's primary expertise?",
    sub:  'Defines the core identity and knowledge domain.',
    options: [
      { id: 'research',  label: 'Research & analysis' },
      { id: 'technical', label: 'Technical / engineering' },
      { id: 'creative',  label: 'Creative & content' },
      { id: 'customer',  label: 'Customer support' },
      { id: 'custom',    label: 'Other' },
    ],
  },
  tone: {
    id:   'tone',
    text: 'What communication tone should it use?',
    sub:  'Sets the voice and style of all responses.',
    options: [
      { id: 'professional', label: 'Professional & formal' },
      { id: 'friendly',     label: 'Friendly & approachable' },
      { id: 'concise',      label: 'Concise & direct' },
      { id: 'custom',       label: 'Other' },
    ],
  },
  goal: {
    id:   'goal',
    text: "What is this persona's main goal?",
    sub:  "Clarifies the purpose and what success looks like.",
    options: [
      { id: 'answer',    label: 'Answer questions accurately' },
      { id: 'guide',     label: 'Guide through complex processes' },
      { id: 'generate',  label: 'Generate creative content' },
      { id: 'summarise', label: 'Summarise and synthesise information' },
      { id: 'custom',    label: 'Other' },
    ],
  },
  constraints: {
    id:          'constraints',
    text:        'Are there topics or behaviours to avoid?',
    sub:         'Sets boundaries to keep the persona focused and safe.',
    multiSelect: true,
    maxSelect:   3,
    options: [
      { id: 'offtopic',  label: 'Off-topic discussions' },
      { id: 'opinions',  label: 'Personal opinions' },
      { id: 'sensitive', label: 'Sensitive or political topics' },
      { id: 'custom',    label: 'Other' },
    ],
  },
  format: {
    id:   'format',
    text: 'What response format works best?',
    sub:  'Shapes how answers are presented to users.',
    options: [
      { id: 'prose',    label: 'Clear prose paragraphs' },
      { id: 'bullets',  label: 'Bullet lists' },
      { id: 'numbered', label: 'Step-by-step numbered lists' },
      { id: 'custom',   label: 'Other' },
    ],
  },
  examples: {
    id:          'examples',
    text:        'What kinds of interactions should it handle best?',
    sub:         'Helps tune behaviour for real-world usage patterns.',
    multiSelect: true,
    maxSelect:   2,
    options: [
      { id: 'qa',       label: 'Q&A and factual look-ups' },
      { id: 'drafting', label: 'Drafting and editing text' },
      { id: 'planning', label: 'Planning and brainstorming' },
      { id: 'custom',   label: 'Other' },
    ],
  },
}

// ── Public functions ───────────────────────────────────────────────────────────

export function scanPrompt(value: string): PromptScores {
  const lower = value.toLowerCase()
  const words = value.trim().split(/\s+/).filter(Boolean)

  return {
    length:         words.length,
    hasRole:        /\byou are\b|\byour role\b|\bact as\b|\bexpert\b|\bspecialist\b/.test(lower),
    hasTone:        /\btone\b|\bformal\b|\bcasual\b|\bfriendly\b|\bprofessional\b|\bconcise\b/.test(lower),
    hasGoal:        /\bgoal\b|\bobjective\b|\bhelp\b|\bassist\b|\bfocus on\b|\bpurpose\b/.test(lower),
    hasConstraints: /\bdo not\b|\bdon't\b|\bavoid\b|\bnever\b|\bonly\b|\balways\b|\blimit\b/.test(lower),
    hasBehavior:    /\bwhen\b|\bif\b|\brespond\b|\bshould\b|\bmust\b/.test(lower),
    hasFormat:      /\bformat\b|\blist\b|\bbullet\b|\bmarkdown\b|\bparagraph\b|\bstructure\b/.test(lower),
    hasExamples:    /\bexample\b|\bfor instance\b|\bsuch as\b/.test(lower),
  }
}

export function classifyMode(scores: PromptScores): EnhanceMode {
  const filledCount = [
    scores.hasRole,
    scores.hasTone,
    scores.hasGoal,
    scores.hasConstraints,
    scores.hasBehavior,
    scores.hasFormat,
  ].filter(Boolean).length

  if (scores.length >= 80 && filledCount >= 4) return 'AUDIT'
  return 'BUILD'
}

export function selectQuestions(
  mode: EnhanceMode,
  scores: PromptScores,
  _personaContext: PersonaContext,
): Question[] {
  if (mode === 'AUDIT') {
    return [QUESTION_BANK.constraints, QUESTION_BANK.examples]
  }

  const qs: Question[] = []
  if (!scores.hasRole)        qs.push(QUESTION_BANK.role)
  if (!scores.hasTone)        qs.push(QUESTION_BANK.tone)
  if (!scores.hasGoal)        qs.push(QUESTION_BANK.goal)
  if (!scores.hasConstraints) qs.push(QUESTION_BANK.constraints)
  if (!scores.hasFormat)      qs.push(QUESTION_BANK.format)

  // Always surface at least one question in BUILD mode
  if (qs.length === 0) qs.push(QUESTION_BANK.tone)

  return qs
}

export function buildRewrite(
  value: string,
  questions: Question[],
  answers: Answers,
): string {
  const additions: string[] = []

  for (const q of questions) {
    const ans = answers[q.id]
    if (!ans || ans.length === 0) continue

    switch (q.id) {
      case 'role':
        additions.push(`You specialise in ${ans.join(' and ')}.`)
        break
      case 'tone':
        additions.push(`Communicate in a ${ans[0].toLowerCase()} manner.`)
        break
      case 'goal':
        additions.push(`Your primary goal is to ${ans[0].toLowerCase()}.`)
        break
      case 'constraints':
        additions.push(`Avoid the following topics: ${ans.join(', ')}.`)
        break
      case 'format':
        additions.push(`Present responses as ${ans[0].toLowerCase()}.`)
        break
      case 'examples':
        additions.push(`Optimise for: ${ans.join(' and ')}.`)
        break
    }
  }

  if (additions.length === 0) return value

  const base = value.trim()
  return base
    ? `${base}\n\n${additions.join(' ')}`
    : additions.join(' ')
}

export function diffSentences(original: string, rewrite: string): DiffSegment[] {
  const split = (s: string) =>
    s.split(/(?<=[.!?])\s+/).flatMap(t => { const v = t.trim(); return v ? [v] : [] })

  const origSents = split(original)
  const newSents  = split(rewrite)
  const origSet   = new Set(origSents)
  const newSet    = new Set(newSents)

  const result: DiffSegment[] = []

  for (const s of origSents) {
    result.push({ type: newSet.has(s) ? 'unchanged' : 'removed', text: s })
  }
  for (const s of newSents) {
    if (!origSet.has(s)) result.push({ type: 'added', text: s })
  }

  return result
}

export function diffSummary(
  original: string,
  rewrite: string,
): { wordsAdded: number; guidelineGroups: number } {
  const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length
  const wordsAdded = Math.max(0, wordCount(rewrite) - wordCount(original))

  const segments = diffSentences(original, rewrite)
  let guidelineGroups = 0
  let inAdded = false
  for (const seg of segments) {
    if (seg.type === 'added' && !inAdded) { guidelineGroups++; inAdded = true }
    else if (seg.type !== 'added') inAdded = false
  }

  return { wordsAdded, guidelineGroups }
}
