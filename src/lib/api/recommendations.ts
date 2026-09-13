import { apiFetchJson } from './client'
import { API_BASE_URL } from '../config'

const RECOMMENDATIONS = (surface: Surface) => `${API_BASE_URL}/recommendations/${surface}`

/** The empty screens that show starter cards. */
export type Surface = 'chat' | 'brain'

/**
 * The kind of work a card asks for. The backend picks one of these; the icon
 * and colour it maps to are a frontend concern (see RECOMMENDATION_ICONS).
 */
export type CardIcon =
  | 'research'
  | 'write'
  | 'plan'
  | 'compare'
  | 'schedule'
  | 'analyze'
  | 'summarize'
  | 'code'
  | 'automate'
  | 'connect'

export interface StarterCard {
  icon:   CardIcon
  /** The single line shown on the card. */
  label:  string
  /** What fills the input box when the card is clicked. */
  prompt: string
}

export interface Recommendations {
  surface:     Surface
  cards:       StarterCard[]
  /** Brain only — the three-beat line above its cards. */
  headline:    string | null
  generatedAt: string | null
  /** False while the backend's defaults show and the first generation runs. */
  personalized: boolean
}

export function fetchRecommendations(surface: Surface): Promise<Recommendations> {
  return apiFetchJson<Recommendations>(RECOMMENDATIONS(surface))
}
