import { z } from 'zod'
import { apiFetchJson } from './client'
import { API_BASE_URL } from '../config'

const RECOMMENDATIONS = (surface: Surface) => `${API_BASE_URL}/recommendations/${surface}`

/** The empty screens that show starter cards. */
export type Surface = 'chat' | 'brain'

/**
 * The kind of work a card asks for. The backend picks one of these; the icon
 * and colour it maps to are a frontend concern (see RECOMMENDATION_ICONS).
 */
const cardIconSchema = z.enum([
  'research',
  'write',
  'plan',
  'compare',
  'schedule',
  'analyze',
  'summarize',
  'code',
  'automate',
  'connect',
])

const cardAppSchema = z.object({
  slug:    z.string(),
  name:    z.string(),
  logoUrl: z.string().nullable().default(null),
})

const starterCardSchema = z.object({
  icon:   cardIconSchema,
  /** The single line shown on the card. */
  label:  z.string(),
  /** What fills the input box when the card is clicked. */
  prompt: z.string(),
  /** One line under the label — what the person gets back. */
  detail: z.string().nullable().default(null),
  /** The connected apps the card runs against; their logos lead the card. */
  apps:   z.array(cardAppSchema).default([]),
})

const recommendationsSchema = z.object({
  surface:      z.enum(['chat', 'brain']),
  cards:        z.array(starterCardSchema),
  /** Brain only — the three-beat line above its cards. */
  headline:     z.string().nullable(),
  generatedAt:  z.string().nullable(),
  /** False while the backend's defaults show and the first generation runs. */
  personalized: z.boolean(),
})

export type CardIcon = z.infer<typeof cardIconSchema>
export type CardApp = z.infer<typeof cardAppSchema>
export type StarterCard = z.infer<typeof starterCardSchema>
export type Recommendations = z.infer<typeof recommendationsSchema>

export async function fetchRecommendations(surface: Surface): Promise<Recommendations> {
  return recommendationsSchema.parse(await apiFetchJson<unknown>(RECOMMENDATIONS(surface)))
}
