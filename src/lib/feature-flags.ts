/**
 * Central feature switches.
 *
 * Pins (Pinboard) and Highlights are HIDDEN, not removed: all of their code is
 * still here, but it is switched off at every layer —
 *   • providers don't fetch, cache or hold any data and every action is a no-op,
 *   • the API wrappers refuse to call the backend,
 *   • no UI renders an entry point (buttons, menus, panels, chips, @-mentions),
 *   • chat / Brain requests never carry pin ids.
 *
 * Both default to OFF. To bring a feature back, set the matching env var to
 * "true" and rebuild (NEXT_PUBLIC_* values are inlined at build time):
 *   NEXT_PUBLIC_ENABLE_PINS=true
 *   NEXT_PUBLIC_ENABLE_HIGHLIGHTS=true
 *
 * Always read the flag from here — never inline `process.env` at a call site —
 * so there is exactly one place that decides.
 */
export const PINS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PINS === 'true'
export const HIGHLIGHTS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_HIGHLIGHTS === 'true'

/**
 * Dark theme (and the Light / Dark / System selector in Settings → Preferences).
 * OFF by default: with it off no attribute is ever set on <html>, no script is
 * injected, and the app renders exactly as before. Turn on with
 *   NEXT_PUBLIC_ENABLE_THEMING=true
 * The default choice is still Light, so enabling it changes nothing until a user
 * picks Dark or System.
 */
export const THEMING_ENABLED = process.env.NEXT_PUBLIC_ENABLE_THEMING === 'true'

/** Thrown by API wrappers when called while their feature is switched off. */
export class FeatureDisabledError extends Error {
  constructor(feature: 'Pins' | 'Highlights') {
    super(`${feature} are disabled in this build.`)
    this.name = 'FeatureDisabledError'
  }
}

/**
 * Settings → Preferences, Notifications, Security and Files. These pages are
 * designed but not wired: their values are local defaults that never load or
 * save, and Security lists invented sessions. OFF by default, so the routes
 * 404 and nothing links to them. Turn on with
 *   NEXT_PUBLIC_ENABLE_SETTINGS_PREVIEW=true
 * Remove a page from this switch once it reads and writes real data.
 */
export const SETTINGS_PREVIEW_ENABLED = process.env.NEXT_PUBLIC_ENABLE_SETTINGS_PREVIEW === 'true'

/**
 * Settings → Library (personal) and Workspace Library (Admin): auto-save, AI use of files, file
 * limits. Built, but the backend has no /library/prefs or /library/org-settings endpoints yet
 * (LIBRARY_FLOW_A_BACKEND_TICKET.md Part 1), so OFF by default: the routes 404 and the sidebar hides them.
 * Turn on with NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS=true.
 */
export const LIBRARY_SETTINGS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS === 'true'

/**
 * "Request access" on the locked file page and panel. The backend has
 * `POST /library/files/{id}/access-requests` since 25 Oct (back-end c03695a0), so ON by default.
 * NEXT_PUBLIC_ENABLE_LIBRARY_REQUEST_ACCESS=false turns it off.
 */
/**
 * Chatting with an agent: the @agent mention and "Add agent" in the composer, and "Use in chat". There
 * is no agent chat page; agents are only attached to a normal /chat. Every agent chat is a regular /chats chat sent with `persona_id` (an agent version id). Back-end
 * 9079f6e3 (22 Oct) had dropped `persona_id`; 4495366a (26 Oct) restored it on /chats/create and
 * /chats/{id}/stream (the old /persona/{id}/chats/* routes stay gone). Off unless
 * NEXT_PUBLIC_ENABLE_AGENT_CHAT=true (set in .env.local; deploy envs need it too). Creating, editing and
 * sharing agents does not depend on it.
 */
export const AGENT_CHAT_ENABLED = process.env.NEXT_PUBLIC_ENABLE_AGENT_CHAT === 'true'

/**
 * The composer's Web search switch and Use style menu. The backend no longer reads `web_search` (removed in
 * aa934dfe, 2 Oct; the model decides when to search) or `tone_id`, and the chat proxy strips both, so the
 * controls changed nothing. OFF by default; turn on with NEXT_PUBLIC_ENABLE_COMPOSER_WEB_SEARCH=true or
 * NEXT_PUBLIC_ENABLE_COMPOSER_STYLE=true once the backend reads the field again.
 */
export const COMPOSER_WEB_SEARCH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_COMPOSER_WEB_SEARCH === 'true'
export const COMPOSER_STYLE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_COMPOSER_STYLE === 'true'

export const LIBRARY_REQUEST_ACCESS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_LIBRARY_REQUEST_ACCESS !== 'false'
