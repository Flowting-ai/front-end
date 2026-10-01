/**
 * Spotting "create an agent that…" in a chat message, so the composer can start
 * the creation flow instead of sending it to the model as ordinary chat.
 *
 * Deliberately conservative: a false positive swallows a normal message (the flow
 * always offers "send as a normal message" as an escape), a false negative just
 * means the model answers it as usual. Anything that looks like a coding or
 * writing request about an "assistant" or "bot" is left alone.
 */

import { PURPOSE_MAX } from '@/lib/agent-draft'

/** Messages longer than this are never treated as a creation request. */
const MAX_MESSAGE_LENGTH = 400

const POLITE = String.raw`(?:(?:hey|hi|hello|ok|okay|so|please|kindly|can you|could you|would you|will you|i want you to|i need you to|i'd like you to|i would like you to)[\s,]+)*`
const WANT = String.raw`(?:(?:i want|i need|i'd like|i would like|we need|we want)[\s,]+(?:to\s+(?:make|create|build|set up|design)\s+)?)?`
const VERB = String.raw`(?:make|create|build|set up|setup|design|spin up|generate)`
const ARTICLE = String.raw`(?:me\s+)?(?:(?:an?|my|our|the)\s+)?(?:new\s+|custom\s+|ai\s+)*`
const NOUN = String.raw`(?:agent|assistant)`
const CONNECTOR = String.raw`(?:that|which|who|to|for|so that|that can|that will|that should)`

// "create an agent …" / "I want an agent …" — verb form first, then the noun form.
const CREATE_VERB = new RegExp(String.raw`^${POLITE}${VERB}\s+${ARTICLE}${NOUN}\b(.*)$`, 'is')
const WANT_NOUN = new RegExp(String.raw`^${POLITE}(?:i want|i need|i'd like|i would like|we need|we want)\s+${ARTICLE}${NOUN}\b(.*)$`, 'is')
const TAIL = new RegExp(String.raw`^(?:\s+(?:called|named)\s+["“']?[\w &-]{1,40}["”']?)?\s*(?:${CONNECTOR})\s+(.+)$`, 'is')

export interface CreateAgentIntent {
  /** What the agent should do, cleaned up. Empty when the message named no purpose. */
  purpose: string
}

function tidy(purpose: string): string {
  const text = purpose.replace(/\s+/g, ' ').replace(/[\s.!?]+$/, '').trim()
  if (!text) return ''
  return (text[0].toUpperCase() + text.slice(1)).slice(0, PURPOSE_MAX)
}

export function detectCreateAgentIntent(message: string): CreateAgentIntent | null {
  const text = message.trim()
  if (!text || text.length > MAX_MESSAGE_LENGTH || text.includes('```')) return null

  const match = CREATE_VERB.exec(text) ?? WANT_NOUN.exec(text)
  if (!match) return null

  const tail = match[1]
  if (/^\s*$/.test(tail)) return { purpose: '' }

  const withPurpose = TAIL.exec(tail)
  if (withPurpose) {
    const purpose = tidy(withPurpose[1])
    return purpose ? { purpose } : { purpose: '' }
  }

  // "create an agent called Foo" / "create an agent please" — wants an agent, names no job.
  if (/^\s*(?:called|named)\s+\S/i.test(tail) || /^\s*(?:for me|please|now|today|quickly)?\s*$/i.test(tail)) return { purpose: '' }

  // "create an assistant class in TypeScript" etc.: not a request for an agent.
  return null
}
