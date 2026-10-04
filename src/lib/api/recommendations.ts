import { z } from 'zod'
import { apiFetchJson } from './client'
import { API_BASE_URL } from '../config'

const RECOMMENDATIONS = `${API_BASE_URL}/recommendations`

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

const connectorPickSchema = cardAppSchema.extend({
  /** What pointed at the app — shown under its name. */
  reason:      z.string(),
  categories:  z.array(z.string()).default([]),
  /** The catalog's description of the app. */
  description: z.string().default(''),
})

const recommendationsSchema = z.object({
  cards:           z.array(starterCardSchema),
  /** Detected from their Slack workspace. */
  sureConnectors:  z.array(connectorPickSchema).default([]),
  /** Read off their memory profile. */
  maybeConnectors: z.array(connectorPickSchema).default([]),
  generatedAt:     z.string().nullable(),
  /** False while the backend's defaults show and the first generation runs. */
  personalized:    z.boolean(),
})

export type CardIcon = z.infer<typeof cardIconSchema>
export type CardApp = z.infer<typeof cardAppSchema>
export type StarterCard = z.infer<typeof starterCardSchema>
export type ConnectorPick = z.infer<typeof connectorPickSchema>
export type Recommendations = z.infer<typeof recommendationsSchema>

export async function fetchRecommendations(): Promise<Recommendations> {
  return recommendationsSchema.parse(await apiFetchJson<unknown>(RECOMMENDATIONS))
}
