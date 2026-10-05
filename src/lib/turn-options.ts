/**
 * Request options for one chat turn — a send, the landing page's initial send,
 * an edit or a regenerate — built in one place so the paths can't drift apart
 * (regenerate used to drop web search, the agent, style and connectors).
 */

/** The composer's current settings; every turn is sent with them. */
export interface TurnSettings {
  webSearch?:              boolean
  /** Thinking effort; `null` is thinking off, `undefined` sends no thinking field. */
  reasoningEffort?:        string | null
  algorithm?:              'base' | 'pro' | null
  personaId?:              string | null
  systemPrompt?:           string | null
  temperature?:            number | null
  toneId?:                 string | null
  connectorSlugs?:         string[]
  chatOwnershipConfirmed?: boolean
  pinsEnabled:             boolean
  /** Pins in the folders selected in the add menu. */
  folderPinIds?:           string[]
}

/** What belongs to this turn alone. */
export interface TurnInput {
  /** Pins @-mentioned in the turn's message. */
  mentionedPinIds?:  string[]
  files?:            File[]
  userMessageId?:    string
  replaceMessageId?: string
  onUploadProgress?: (pct: number) => void
}

export interface TurnRequestOptions {
  webSearch?:              boolean
  enableReasoning?:        boolean
  reasoningEffort?:        string | null
  algorithm?:              'base' | 'pro' | null
  files?:                  File[]
  userMessageId?:          string
  pinIds?:                 string[]
  personaId?:              string
  systemPrompt?:           string
  temperature?:            number
  toneId?:                 string
  connectorSlugs?:         string[]
  chatOwnershipConfirmed?: boolean
  replaceMessageId?:       string
  onUploadProgress?:       (pct: number) => void
}

export function buildTurnOptions(settings: TurnSettings, turn: TurnInput = {}): TurnRequestOptions {
  const pinIds = settings.pinsEnabled
    ? [...new Set([...(settings.folderPinIds ?? []), ...(turn.mentionedPinIds ?? [])])]
    : []
  const files = turn.files && turn.files.length > 0 ? turn.files : undefined
  return {
    webSearch:              settings.webSearch,
    enableReasoning:        settings.reasoningEffort === undefined ? undefined : settings.reasoningEffort !== null,
    reasoningEffort:        settings.reasoningEffort,
    algorithm:              settings.algorithm,
    files,
    userMessageId:          turn.userMessageId,
    pinIds:                 pinIds.length > 0 ? pinIds : undefined,
    personaId:              settings.personaId ?? undefined,
    systemPrompt:           settings.systemPrompt ?? undefined,
    temperature:            settings.temperature ?? undefined,
    toneId:                 settings.toneId ?? undefined,
    connectorSlugs:         settings.connectorSlugs && settings.connectorSlugs.length > 0 ? settings.connectorSlugs : undefined,
    chatOwnershipConfirmed: settings.chatOwnershipConfirmed,
    onUploadProgress:       files ? turn.onUploadProgress : undefined,
    ...(turn.replaceMessageId ? { replaceMessageId: turn.replaceMessageId } : {}),
  }
}

/** Ids of the pins that live in any of `folders`. */
export function getFolderPinIds(
  pins: ReadonlyArray<{ id: string; folderId?: string | null }>,
  folders: ReadonlyArray<{ id: string }> | undefined,
): string[] {
  if (!folders || folders.length === 0) return []
  return pins.filter((p) => p.folderId && folders.some((f) => f.id === p.folderId)).map((p) => p.id)
}
