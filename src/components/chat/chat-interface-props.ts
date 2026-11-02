import type React from "react";
import type { ChatInputProps } from "./ChatInput";
import type { PinFolder } from "@/lib/api/pins";
import type { SelectedPersonaInfo } from "@/lib/chat-personas";
import type { UIMessage } from "@/types/chat";

export interface ChatInterfaceProps {
  chatId: string | undefined;
  /** Project a new chat is created in; sent on the first turn so the project context applies to it. */
  projectId?: string | null;
  onChatCreated?: (chatId: string) => void;
  onTitleUpdate?: (chatId: string, title: string) => void;
  onChatMoveToTop?: (chatId: string) => void;
  selectedModel?: string;
  /** Provider the model button's logo resolves from; defaults to the model name. */
  selectedModelIcon?: string | null;
  selectedModelId?: string | number | null;
  /** Souvenir's own auto-routing tier ('base'/'pro'), when the composer's
   *  model menu has that selected instead of a direct `selectedModelId`. The
   *  two are mutually exclusive (see ModelSelectorContext), so this and
   *  `selectedModelId` are never both set. */
  algorithm?: 'base' | 'pro' | null;
  onModelClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** Dropdown content for the `+` add button in ChatInput. */
  addMenu?: React.ReactNode;
  /** Dropdown content for the model selector button in ChatInput. */
  modelMenu?: React.ReactNode;
  /** If provided, ChatInterface auto-sends this message on mount (new chat). */
  initialPrompt?: string | null;
  /** Prefills the input for the user to review and send. */
  draft?: string | null;
  /** Whether web search is currently enabled (controlled by parent). */
  webSearchEnabled?: boolean;
  /** Thinking effort for the turn; `null` is thinking off, `undefined` sends no thinking field. */
  reasoningEffort?: string | null;
  /** Files selected via the add-menu file picker (controlled by parent). */
  addMenuFiles?: File[];
  /** Called after send to let the parent clear its add-menu file list. */
  onClearAddMenuFiles?: () => void;
  /** Files attached in the new-chat input before the first send (initial prompt only). */
  initialFiles?: File[];
  /** Called after the initial prompt is sent to clear the initial file list. */
  onClearInitialFiles?: () => void;
  /** Chip elements rendered in the ChatInput footer (web search, file chips…). */
  chips?: React.ReactNode;
  /** Pin folders selected in the add menu — their pins are sent as context on every send. */
  selectedFolders?: PinFolder[];
  /**
   * @-mentioned pins (id + label) from the new-chat landing page before the first send.
   * These are one-shot: only used by the initial auto-send when ChatInterface mounts.
   */
  initialMentionedPins?: Array<{ id: string; label: string }>;
  /** Persona version id sent as `persona_id` on the regular /chats endpoint
   *  to apply the persona as an overlay on top of style / web search / etc. */
  selectedPersonaId?: string | null;
  /** System instruction for the selected persona, forwarded explicitly to the backend. */
  selectedPersonaSystemPrompt?: string | null;
  /** Temperature override from the selected persona. */
  selectedPersonaTemperature?: number | null;
  /**
   * True while a just-selected persona's active version (system prompt,
   * temperature, model) is still being fetched. Selecting an agent doesn't
   * arrive with that data — the caller resolves it async right after — so
   * sending immediately after picking an agent raced that fetch and sent
   * `systemPrompt: undefined`, breaking only the first turn (subsequent
   * sends always had it by then). Blocks sending until it resolves instead.
   */
  personaConfigLoading?: boolean;
  /** Style/tone ID to send with every message (e.g. "professional", "teaching"). */
  selectedStyleId?: string | null;
  /**
   * When set, scrolls to the message with this ID once the chat finishes
   * loading. Navigated here from the pinboard "Show in chat" button.
   */
  scrollToMessageId?: string | null;
  /**
   * When true, the model selector button is shown but non-interactive.
   * Use when a persona's model is locked and should not be changed.
   */
  disabledModelSelector?: boolean;
  /**
   * Override the SSE proxy endpoint. Defaults to "/api/chat".
   */
  endpoint?: string;
  /**
   * Custom backend stop handler. When provided, called instead of the default
   * POST /chats/{id}/stop. Use for persona stop endpoints.
   */
  onStopBackend?: (chatId: string) => void;
  /**
   * Connector slugs forwarded to the backend on every send.
   * Used by persona chats that have connectors wired to a specific version.
   */
  connectorSlugs?: string[];
  /**
   * Rendered when the message list is empty and not loading.
   * Use to show a persona avatar / greeting instead of nothing.
   */
  emptyState?: React.ReactNode;
  /**
   * Override the default message fetcher (getChatMessages).
   * When provided, called with the chatId on mount; must return UIMessage[].
   * Pagination is disabled when this is set.
   */
  loadMessages?: (chatId: string) => Promise<UIMessage[]>;
  /**
   * When true, hide the pin @-mention dropdown and chips.
   * Persona chats don't use pins.
   */
  hidePinActions?: boolean;
  /** Readable shared chat whose original is owned by somebody else. */
  readOnly?: boolean;
  /**
   * This chat's own visibility is "archived" (see Chat.visibility / the
   * /chats page's Archived tab). Distinct from `readOnly` — an archived chat
   * is still owned by the current user, so unlike a shared/not-owned chat it
   * must NOT offer a "Create a copy" affordance; there's no unarchive
   * endpoint yet either, so the composer just stays disabled.
   */
  archived?: boolean;
  /**
   * True only once the caller has positively confirmed (e.g. via the chat
   * list's own `can_edit` field) that this chat belongs to the current user.
   * `undefined`/omitted means "unknown" (e.g. this chat hasn't loaded into
   * the sidebar's chat-history list yet) — NOT the same as `false`. Gates
   * whether the streaming hook is allowed to bypass the proxy and hit the
   * backend directly; see `chatOwnershipConfirmed` in use-streaming-chat.ts.
   */
  chatOwnershipConfirmed?: boolean;
  /**
   * Lets the host take over a message before it is sent (e.g. "Create an agent
   * that…" starting the agent-creation flow). Return true to say the host has
   * handled it: nothing is sent and the input is cleared. `sendAnyway` sends the
   * same text as an ordinary message, skipping this check.
   */
  onBeforeSend?: (text: string, sendAnyway: () => void) => boolean;
  /** Turns on `@agent` mentions in the input — see ChatInput. */
  agentMention?: ChatInputProps["agentMention"];
  /**
   * Messages that exist only in this browser (never sent to the backend), to be
   * appended to the thread once — e.g. the card of an agent just created from chat.
   * The host clears them via `onInjectedMessagesConsumed` after they are added.
   */
  injectedMessages?: UIMessage[] | null;
  onInjectedMessagesConsumed?: () => void;
  /** "Use now" on an agent card: attach that agent to the chat. */
  onUseAgent?: (agent: SelectedPersonaInfo) => void;
}
