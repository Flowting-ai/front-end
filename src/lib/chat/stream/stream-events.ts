import { toast } from "sonner"
import { parseChatPrompt, parsePermissionPrompt } from "@/lib/api/prompts"
import { CHAT_MESSAGES } from "@/lib/library/messages"
import { parseLibraryShare } from "@/lib/library/library-shares"
import { parseLibraryCitations } from "@/components/Library/chat/library-citations"
import { showLibraryShareToast } from "@/components/Library/chat/library-share-toast"
import { extractThinkingContent } from "@/lib/parsers/content-parser"
import { friendlyModelError } from "@/lib/model-error"
import { eventRoundIndex, reasoningEventText } from "@/lib/reasoning"
import { responseBlockFromEventPayload } from "@/lib/response-blocks"
import type { DecodedSSEEvent } from "@/lib/sse-decoder"
import { mergeStreamingText } from "@/lib/streaming"
import { toPlan } from "@/lib/plan"
import {
  addUniqueByRequestId,
  applyUploadedAttachments,
  mergeDoneFiles,
  mergeGeneratedOutputs,
  updateMessage,
} from "./message-patches"
import { SESSION_EXPIRED_MESSAGE, dispatchSessionExpired, isAuthErrorText } from "./stream-errors"
import {
  asString,
  citationsFromSources,
  doneGeneratedFiles,
  eventAttachments,
  extractChatId,
  generatedOutputs,
  parseConnectPrompt,
  uploadedAttachments,
  type Attachment,
} from "./stream-payload"
import { finishTurn, startReasoningClock, stopReasoningClock, type StreamEventContext, type StreamTurn } from "./stream-turn"
import {
  handleAgentStarted,
  handleAgentUpdate,
  handleDocxProgress,
  handleToolCallsStreaming,
  handleToolComplete,
  handleToolError,
  handleToolExecuting,
  handleToolProgress,
  handleWebSearch,
} from "./tool-events"

// Applies decoded stream events to the reply, in arrival order. Text and
// reasoning go through ctx.queueUpdate (batched); everything else is a
// setMessages call of its own.

type Payload = Record<string, unknown>

export function processStreamEvents(ctx: StreamEventContext, turn: StreamTurn, decodedEvents: DecodedSSEEvent[]) {
  for (const decoded of decodedEvents) {
    if (decoded.event.type === "RUN_STARTED") {
      // threadId is the chat id. This is the primary id source for new
      // chats on direct streams: the X-Chat-Id response header is not
      // CORS-exposed, so cross-origin JS can't read it.
      ctx.adoptChatId(decoded.event.threadId)
      ctx.onRunStarted()
    }
    // The reasoning phase is over when AG-UI closes its thinking span.
    if (decoded.event.type === "THINKING_END") {
      ctx.queueUpdate({ isThinkingInProgress: false }, true)
    }

    if (!decoded.appEvent) continue
    const { eventName, parsed } = decoded.appEvent
    // Run before any specific handler so file links are captured
    // regardless of which SSE event the backend places them in.
    applyEventAttachments(ctx, turn, parsed)
    handleAppEvent(ctx, turn, eventName, parsed)
  }
}

/** Generated files and images in any event's `file_attachments`. */
function applyEventAttachments(ctx: StreamEventContext, turn: StreamTurn, parsed: Payload) {
  const msgId = ctx.messageId()
  const atts = eventAttachments(parsed)
  if (!msgId || !atts) return
  const { files, images } = generatedOutputs(atts)
  if (files.length > 0 || images.length > 0) {
    turn.receivedRenderableOutput = true
    ctx.setMessages(updateMessage(msgId, mergeGeneratedOutputs(files, images)))
  }
}

/** Routes one app event to its handler. Order matters: the `parsed.type`
 *  fallbacks only apply when no earlier event name matched. */
export function handleAppEvent(ctx: StreamEventContext, turn: StreamTurn, eventName: string, parsed: Payload) {
  const is = (name: string) => eventName === name || parsed.type === name
  if (eventName === "metadata" || eventName === "title") return handleTitle(ctx, turn, parsed)
  if (eventName === "reasoning_heading" || eventName === "reasoning_body") return handleReasoning(ctx, turn, eventName, parsed)
  if (eventName === "content") return handleContent(ctx, turn, parsed)
  if (eventName === "model_selected") return handleModelSelected(ctx, parsed)
  if (eventName === "message_saved") return handleMessageSaved(ctx, turn, parsed)
  if (eventName === "library_files") {
    // Which attached files the server listed in Library and which stayed in the chat. The server
    // decides (Admin force-off, the chat's "Don't save"), so when it kept files out that this
    // browser meant to save, say so; a send that already asked not to save was told before it went.
    const chatOnly = Array.isArray(parsed.chatOnlyFileIds) ? parsed.chatOnlyFileIds : []
    if (chatOnly.length > 0 && ctx.saveToLibrary !== false) toast(CHAT_MESSAGES.notSavedAsk)
    return
  }
  if (eventName === "library_shared") {
    // A file shared by asking ("share the Weekly sales report with Maya"): "Shared with Maya · Undo", as the Share dialog says.
    const share = parseLibraryShare(parsed)
    if (share) showLibraryShareToast(share)
    return
  }
  if (eventName === "library_citations") {
    // Which Library file and place each [[L1]] marker in the answer points to (LIBRARY_FLOW_A_BACKEND_TICKET.md Part 2 BE-4).
    const libraryCitations = parseLibraryCitations(parsed.citations)
    const msgId = ctx.messageId()
    if (msgId && libraryCitations.length > 0) ctx.setMessages(updateMessage(msgId, (msg) => ({ ...msg, libraryCitations })))
    return
  }
  if (eventName === "web_search") return handleWebSearch(ctx, turn, parsed)
  if (eventName === "structured_block" || eventName === "block") {
    // Accept both the app envelope ({ block: ResponseBlock }) and the
    // chat-preview contract where the ResponseBlock is the payload.
    const block = responseBlockFromEventPayload(parsed)
    if (!block) return
    turn.receivedRenderableOutput = true
    const msgId = ctx.messageId()
    if (msgId) ctx.setMessages(updateMessage(msgId, (msg) => ({ ...msg, responseBlocks: [...(msg.responseBlocks ?? []), block] })))
    return
  }
  if (eventName === "tool_progress") return handleToolProgress(ctx, turn, parsed)
  if (is("tool_executing")) return handleToolExecuting(ctx, turn, parsed)
  if (is("tool_calls_streaming")) return handleToolCallsStreaming(ctx, turn, parsed)
  if (eventName === "tool_connect_prompt") {
    const prompt = parseConnectPrompt(parsed)
    const msgId = ctx.messageId()
    if (msgId) ctx.setMessages(updateMessage(msgId, addUniqueByRequestId("connectorConnectPrompts", prompt)))
    turn.receivedRenderableOutput = true
    return
  }
  if (eventName === "user_prompt" || eventName === "question_prompt" || eventName === "approval_prompt") {
    return handleChatPrompt(ctx, turn, eventName, parsed)
  }
  if (eventName === "permission_prompt") {
    // Backend emits `prompt_id` + `respond_url` (spec fields). POST to respond_url
    // (or /chats/prompts/{prompt_id}) with {"response":"allow"|"allow_once"|"block"}
    // to unblock the stream. parsePermissionPrompt zod-validates the payload and
    // returns the canonical permission-prompt shape.
    const prompt = parsePermissionPrompt(parsed)
    if (!prompt) return
    const msgId = ctx.messageId()
    if (msgId) ctx.setMessages(updateMessage(msgId, addUniqueByRequestId("connectorPermissionPrompts", prompt)))
    turn.receivedRenderableOutput = true
    return
  }
  if (is("tool_complete")) return handleToolComplete(ctx, turn, parsed)
  if (is("tool_error")) return handleToolError(ctx, turn, parsed)
  if (is("image")) return handleImage(ctx, turn, parsed)
  if (eventName === "generated_file") {
    // Generated file - schema: {url, s3_key, filename, mime_type}
    turn.receivedRenderableOutput = true
    const msgId = ctx.messageId()
    if (msgId) {
      const file = {
        url: asString(parsed.url) ?? "",
        s3Key: asString(parsed.s3_key),
        filename: asString(parsed.filename) ?? "file",
        mimeType: asString(parsed.mime_type),
      }
      ctx.setMessages(updateMessage(msgId, (msg) => ({ ...msg, generatedFiles: [...(msg.generatedFiles ?? []), file] })))
    }
    return
  }
  if (eventName === "docx_progress") return handleDocxProgress(ctx, turn, parsed)
  if (eventName === "agent_started") return handleAgentStarted(ctx, turn, parsed)
  if (eventName === "agent_content" || eventName === "agent_finished") return handleAgentUpdate(ctx, turn, eventName, parsed)
  if (eventName === "plan_updated") {
    // The turn's whole plan, re-sent in full on every change (see PlanItem).
    const plan = toPlan(parsed.items)
    const msgId = ctx.messageId()
    if (plan && msgId) ctx.setMessages(updateMessage(msgId, (msg) => ({ ...msg, plan })))
    return
  }
  if (eventName === "browser_view") {
    const url = asString(parsed.url)
    const msgId = ctx.messageId()
    if (url && msgId) {
      const browserView = { url, pageUrl: asString(parsed.page_url) ?? "", control: parsed.control === true }
      ctx.setMessages(updateMessage(msgId, (msg) => ({ ...msg, browserView })))
    }
    return
  }
  if (eventName === "memory_updated") {
    // Settings and memory-aware surfaces can refresh without coupling
    // the stream hook to their cache implementation.
    window.dispatchEvent(new CustomEvent("souvenir:memory-updated", { detail: parsed }))
    return
  }
  if (eventName === "done") return handleDone(ctx, turn, parsed)
  // stream_heartbeat: a server-sent elapsed-time ping during long/silent generations
  // (e.g. extended thinking). No UI action needed — the proxy's keepalive handles the connection.
  if (eventName === "error") return handleError(ctx, turn, parsed)
}

// ── Text, reasoning, chat metadata ────────────────────────────────────────────

function handleTitle(ctx: StreamEventContext, turn: StreamTurn, parsed: Payload) {
  const evtChatId = extractChatId(parsed)
  if (evtChatId) ctx.adoptChatId(evtChatId)
  const title = asString(parsed.title ?? parsed.chat_title)
  const chatId = ctx.chatId()
  if (title && chatId) {
    turn.titleWasSet = true
    ctx.onTitleUpdate?.(chatId, title)
  }
}

function handleReasoning(ctx: StreamEventContext, turn: StreamTurn, eventName: "reasoning_heading" | "reasoning_body", parsed: Payload) {
  const { reasoning } = turn
  const wasEmpty = reasoning.isEmpty()
  startReasoningClock(turn)
  reasoning.event(eventName, reasoningEventText(parsed), eventRoundIndex(parsed))
  const sections = reasoning.sections()
  ctx.queueUpdate({
    thinking: reasoning.text(),
    isThinkingInProgress: true,
    isLoading: true,
    ...(sections.length > 0 ? { reasoning_sections: sections } : {}),
    reasoningTimeline: reasoning.timeline(),
  }, wasEmpty)  // flush immediately on first reasoning chunk
}

function handleContent(ctx: StreamEventContext, turn: StreamTurn, parsed: Payload) {
  const delta = typeof parsed.content === "string" ? parsed.content : ""
  const wasEmpty = !turn.assistantContent
  turn.assistantContent = mergeStreamingText(turn.assistantContent, delta)
  // Only a leading <think> block is reasoning; while it is open,
  // everything after it is reasoning too.
  const { visibleText, thinkingText, thinkingOpen } = extractThinkingContent(turn.assistantContent)
  if (thinkingText || thinkingOpen) startReasoningClock(turn)
  ctx.queueUpdate({
    content: visibleText,
    thinking: turn.reasoning.text() || thinkingText || undefined,
    isThinkingInProgress: thinkingOpen && !turn.reasoning.text(),
    isLoading: true,
    // The first answer token ends the reasoning time.
    ...(visibleText ? stopReasoningClock(turn) : {}),
  }, wasEmpty)  // flush immediately on first content chunk
}

function handleModelSelected(ctx: StreamEventContext, parsed: Payload) {
  const modelName = asString(parsed.model_name)
  if (!modelName) return
  ctx.queueUpdate({
    modelName,
    modelMeta: {
      modelId: asString(parsed.model_id) ?? modelName,
      modelName,
      deploymentName: asString(parsed.deployment_name),
      company: asString(parsed.company),
    },
  }, true)
}

// ── Saved message, end of turn ────────────────────────────────────────────────

/** Backend confirmed the message was persisted. */
function handleMessageSaved(ctx: StreamEventContext, turn: StreamTurn, parsed: Payload) {
  const evtChatId = extractChatId(parsed)
  if (evtChatId) ctx.adoptChatId(evtChatId)

  const msgId = ctx.messageId()

  // ── Replace temp ID with the real backend message ID ─────────────
  // The backend sends message_id in this event. Without this, the
  // temp "loading-assistant-…" ID is never replaced and features
  // like pinning will fail because the backend doesn't know that ID.
  const realMessageId = asString(parsed.message_id)
  if (realMessageId && msgId && realMessageId !== msgId) {
    // Commit text held under the temp id before the id changes.
    ctx.flushPending()
    ctx.setMessageId(realMessageId)
    ctx.setMessages(updateMessage(msgId, (msg) => ({ ...msg, id: realMessageId })))
  }

  // ── sources / citations ──────────────────────────────────────────
  // Use the (possibly updated) real message ID.
  const currentMsgId = ctx.messageId()
  const rawSources = Array.isArray(parsed.sources) ? parsed.sources : null
  if (rawSources && rawSources.length > 0 && currentMsgId) {
    const hydratedCitations = citationsFromSources(rawSources as Array<Record<string, unknown>>)
    if (hydratedCitations.length > 0) {
      ctx.setMessages(updateMessage(currentMsgId, (msg) => ({ ...msg, webCitations: hydratedCitations })))
    }
  }

  // ── file_attachments → generatedFiles / images ────────────────────
  // The backend returns uploaded + generated files in `file_attachments`.
  // origin === "generated" + image/* mime → inline image display (msg.images)
  // origin === "generated" + other       → downloadable file card (msg.generatedFiles)
  if (!currentMsgId) return
  const rawAtts = Array.isArray(parsed.file_attachments) ? (parsed.file_attachments as Attachment[]) : []
  const { files, images } = generatedOutputs(rawAtts)
  if (files.length > 0 || images.length > 0) {
    turn.receivedRenderableOutput = true
    ctx.setMessages(updateMessage(currentMsgId, mergeGeneratedOutputs(files, images)))
  }
  // origin === "uploaded" → the user message's chips get their real links.
  applyUploads(ctx, rawAtts)
}

function applyUploads(ctx: StreamEventContext, atts: Attachment[]) {
  const userMsgId = ctx.userMessageId()
  if (!userMsgId) return
  const uploaded = uploadedAttachments(atts)
  if (uploaded.length > 0) ctx.setMessages(updateMessage(userMsgId, applyUploadedAttachments(uploaded)))
}

function handleImage(ctx: StreamEventContext, turn: StreamTurn, parsed: Payload) {
  // Image event - either inline from LLM ({images: string[]}) or named ({url, s3_key})
  const msgId = ctx.messageId()
  if (!msgId) return
  const newImages = Array.isArray(parsed.images)
    ? (parsed.images as string[]).map((url) => ({ url }))
    : parsed.url
      ? [{ url: asString(parsed.url) ?? "", s3Key: asString(parsed.s3_key) }]
      : null
  if (!newImages) return
  turn.receivedRenderableOutput = true
  ctx.setMessages(updateMessage(msgId, (msg) => ({ ...msg, images: [...(msg.images ?? []), ...newImages] })))
}

function handleChatPrompt(ctx: StreamEventContext, turn: StreamTurn, eventName: "user_prompt" | "question_prompt" | "approval_prompt", parsed: Payload) {
  const prompt = parseChatPrompt(eventName, parsed)
  if (!prompt) return
  const promptId = prompt.request_id
  // A card is the turn's output as much as text is: a turn that ends
  // on one isn't empty or interrupted.
  turn.receivedRenderableOutput = true
  // Mark in the reasoning trace where the turn stopped to ask, so
  // reasoning after the answer reads as a new stretch.
  if (!turn.promptMarkerIds.has(promptId)) {
    turn.promptMarkerIds.add(promptId)
    turn.reasoning.prompt({ promptId, title: prompt.questions?.[0]?.question || prompt.title })
  }
  ctx.flushPending()
  const msgId = ctx.messageId()
  if (msgId) {
    ctx.setMessages(updateMessage(msgId, (msg) => {
      const existing = msg.chatPrompts ?? []
      return existing.some((item) => item.request_id === promptId)
        ? msg
        : { ...msg, chatPrompts: [...existing, prompt], reasoningTimeline: turn.reasoning.timeline() }
    }))
  }
}

function handleDone(ctx: StreamEventContext, turn: StreamTurn, parsed: Payload) {
  const isToolCallRound = asString(parsed.finish_reason) === "tool_calls"

  const doneChatId = extractChatId(parsed)
  if (doneChatId) ctx.adoptChatId(doneChatId)

  const doneTitle = asString(parsed.title ?? parsed.chat_title)
  const titleChatId = ctx.chatId()
  if (doneTitle && !turn.titleWasSet && titleChatId) ctx.onTitleUpdate?.(titleChatId, doneTitle)

  ctx.flushPending()

  // The backend contract allows a terminal error to be followed by
  // done + message_saved. Preserve the error state; treating that
  // cleanup frame as a successful empty answer is what exposed raw
  // reasoning with Pin/Copy controls after request-limit failures.
  if (turn.terminalErrorSeen) {
    turn.streamFinished = true
    return
  }

  if (isToolCallRound) {
    // Agentic intermediate round - tool calls are about to execute.
    // More content rounds are coming; do not finalise the message.
    ctx.queueUpdate({ isThinkingInProgress: false }, true)
    return
  }

  // Final round (finish_reason: "stop", "length", etc.)
  const chatId = ctx.chatId()
  if (chatId) ctx.onChatMoveToTop?.(chatId)

  // Generated files in the done payload, merged with any already set via generated_file events.
  const doneAttachments = Array.isArray(parsed.file_attachments) ? (parsed.file_attachments as Attachment[]) : []
  const files = doneGeneratedFiles(doneAttachments)
  const msgId = ctx.messageId()
  if (files.length > 0) turn.receivedRenderableOutput = true
  if (msgId && files.length > 0) ctx.setMessages(updateMessage(msgId, mergeDoneFiles(files)))

  // Update user message attachments with real backend URLs for uploaded files
  applyUploads(ctx, doneAttachments)

  finishTurn(ctx, turn, "done")
}

function handleError(ctx: StreamEventContext, turn: StreamTurn, parsed: Payload) {
  const rawError = typeof parsed.error === "string" ? parsed.error : "Unexpected error from model"

  ctx.flushPending()
  turn.terminalErrorSeen = true

  if (isAuthErrorText(rawError.toLowerCase())) {
    ctx.queueUpdate({ content: SESSION_EXPIRED_MESSAGE, isLoading: false, isError: true }, true)
    dispatchSessionExpired()
  } else {
    finishTurn(ctx, turn, "error", friendlyModelError(rawError))
  }

  turn.streamFinished = true
}
