import { normalizeActivityStatus, toolNameToType, webSearchResults } from "@/lib/activity"
import { argsGenerateImage, argsImageHints, deriveActivityDetail } from "@/lib/activity-detail"
import { eventRoundIndex } from "@/lib/reasoning"
import type { ActivityItem, ActivityStatus } from "@/types/chat"
import {
  addWebSearch,
  appendActivity,
  patchActivity,
  updateMessage,
  upgradeToExecuting,
  upsertDocxProgress,
  upsertToolProgress,
} from "./message-patches"
import { asString } from "./stream-payload"
import type { StreamEventContext, StreamTurn } from "./stream-turn"

// Activity rows: web searches, tool calls, document generation and sub-agents.
// Each handler takes one app event's payload; row-creating events flush the
// batched text first so the row lands after the text streamed before it.

type Payload = Record<string, unknown>

export function handleWebSearch(ctx: StreamEventContext, turn: StreamTurn, parsed: Payload) {
  // Web search activity - schema: {query, links[], results[]}
  const query = asString(parsed.query) ?? ""
  const results = webSearchResults(parsed.links, parsed.results)

  const activity: ActivityItem = {
    id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "web-search",
    detail: query,
    status: "done",
    results,
  }
  turn.reasoning.activity(activity.id, eventRoundIndex(parsed))
  ctx.flushPending()

  const msgId = ctx.messageId()
  if (msgId) ctx.setMessages(updateMessage(msgId, addWebSearch(activity, () => turn.reasoning.timeline())))
}

export function handleToolProgress(ctx: StreamEventContext, turn: StreamTurn, parsed: Payload) {
  // Tool progress - schema: {tool, label, status, filename, step?, message?, code_preview?}
  const toolName = asString(parsed.tool) ?? "unknown"
  const label = asString(parsed.label)
  const status = normalizeActivityStatus(asString(parsed.status))
  const filename = asString(parsed.filename)
  const progressMessage = asString(parsed.message)
  const codePreview = asString(parsed.code_preview)
  // Prefer the activityId linked from tool_executing; fall back to constructed key
  const activityId = turn.toolCallIdByName.get(toolName) ?? `tp-${toolName}-${filename ?? "default"}`
  if (status === "error") turn.erroredToolNames.add(toolName)

  const activityType = toolNameToType(toolName)
  turn.reasoning.activity(activityId, eventRoundIndex(parsed))
  ctx.flushPending()

  const msgId = ctx.messageId()
  if (msgId) {
    ctx.setMessages(updateMessage(msgId, upsertToolProgress(
      { activityId, type: activityType, toolName, label, status, filename, progressMessage, codePreview },
      () => turn.reasoning.timeline(),
    )))
  }
}

export function handleToolExecuting(ctx: StreamEventContext, turn: StreamTurn, parsed: Payload) {
  // Tool is about to execute - schema: {content (tool name), label, tool_call: {name, arguments, ...}}
  const toolCall = parsed.tool_call as Record<string, unknown> | undefined
  const toolName = asString(toolCall?.name) ?? asString(parsed.content) ?? "tool"
  const label = asString(parsed.label)
  const toolCallId = asString(toolCall?.tool_call_id) ?? `te-${toolName}-${Date.now()}`

  // Check if tool_calls_streaming already created a preliminary activity
  const existingActivityId = turn.toolCallIdByName.get(toolName)

  // Register the real tool_call_id so subsequent tool_progress/tool_complete events can find it
  turn.toolCallIdByName.set(toolName, toolCallId)

  const activityType = toolNameToType(toolName)
  // What the call was given (its query, URL…), not the tool's name again.
  const detail = deriveActivityDetail(toolName, toolCall?.arguments)
  const generatesImage = argsGenerateImage(toolCall?.arguments) || undefined
  const imageHints = generatesImage ? argsImageHints(toolCall?.arguments) : undefined
  if (existingActivityId) {
    turn.reasoning.renameActivity(existingActivityId, toolCallId)
  } else {
    turn.reasoning.activity(toolCallId, eventRoundIndex(parsed))
  }
  ctx.flushPending()

  const msgId = ctx.messageId()
  if (!msgId) return
  const timeline = () => turn.reasoning.timeline()
  if (existingActivityId) {
    ctx.setMessages(updateMessage(msgId, upgradeToExecuting(existingActivityId, toolCallId, { label, detail, generatesImage, imageHints }, timeline)))
  } else {
    // No preliminary activity — create a new one
    const activity: ActivityItem = {
      id: toolCallId,
      type: activityType,
      toolName,
      label,
      detail,
      generatesImage,
      imageHints,
      status: "executing",
    }
    ctx.setMessages(updateMessage(msgId, appendActivity(activity, timeline)))
  }
}

export function handleToolCallsStreaming(ctx: StreamEventContext, turn: StreamTurn, parsed: Payload) {
  // Model is streaming tool call arguments — show early activity indicator
  const toolCall = parsed.tool_call as Record<string, unknown> | undefined
  const toolName = asString(toolCall?.name) ?? asString(parsed.content) ?? ""
  if (!toolName) return
  const existingId = turn.toolCallIdByName.get(toolName)
  if (!existingId) {
    // First streaming chunk for this tool — create a preliminary activity.
    // AG-UI streams carry the provider's real tool_call_id; keep the
    // synthetic fallback for payloads without one.
    const callId = asString(toolCall?.tool_call_id) ?? `tcs-${toolName}-${Date.now()}`
    turn.toolCallIdByName.set(toolName, callId)
    const activityType = toolNameToType(toolName)
    const label = asString(parsed.label) ?? undefined
    const activity: ActivityItem = {
      id: callId,
      type: activityType,
      toolName,
      label,
      detail: deriveActivityDetail(toolName, toolCall?.arguments),
      status: "start",
    }
    turn.reasoning.activity(callId, eventRoundIndex(parsed))
    ctx.flushPending()
    const msgId = ctx.messageId()
    if (msgId) ctx.setMessages(updateMessage(msgId, appendActivity(activity, () => turn.reasoning.timeline())))
  } else if (argsGenerateImage(toolCall?.arguments)) {
    // The code is still streaming: flag the image call now so the
    // preview starts while the model writes it, and refine its
    // shape/tint as the prompt arrives.
    const hints = argsImageHints(toolCall?.arguments)
    const hintsKey = `${hints.aspect ?? ""}|${hints.prompt?.length ?? 0}`
    const msgId = ctx.messageId()
    if (msgId && turn.imageHintsSeen.get(existingId) !== hintsKey) {
      turn.imageHintsSeen.set(existingId, hintsKey)
      ctx.setMessages(updateMessage(msgId, patchActivity(existingId, (a) => ({ ...a, generatesImage: true, imageHints: hints }))))
    }
  }
}

export function handleToolComplete(ctx: StreamEventContext, turn: StreamTurn, parsed: Payload) {
  // Tool finished - schema: {content (tool name), label, tool_call: {name, tool_call_id, result, duration_s}}
  const toolCall = parsed.tool_call as Record<string, unknown> | undefined
  const label = asString(parsed.label)
  const durationS = typeof toolCall?.duration_s === "number" ? toolCall.duration_s : undefined
  const toolName = asString(toolCall?.name) ?? asString(parsed.content)
  // Fall back to the id registered by tool_executing when the provider streamed no tool_call id
  const toolCallId = asString(toolCall?.tool_call_id) ?? (toolName ? turn.toolCallIdByName.get(toolName) : undefined)
  const hadError = toolName ? turn.erroredToolNames.has(toolName) : false
  if (toolName) {
    turn.toolCallIdByName.delete(toolName)
    turn.erroredToolNames.delete(toolName)
  }

  if (toolCallId && !hadError) {
    const msgId = ctx.messageId()
    if (msgId) {
      ctx.setMessages(updateMessage(msgId, patchActivity(toolCallId, (a) => ({ ...a, status: "done" as const, durationS, ...(label ? { label } : {}) }))))
    }
  }
}

export function handleToolError(ctx: StreamEventContext, turn: StreamTurn, parsed: Payload) {
  // Tool handler raised - schema: {content (tool name), error}
  const toolName = asString(parsed.content)
  const errorMessage = asString(parsed.error) ?? "Tool failed"
  const toolCallId = toolName ? turn.toolCallIdByName.get(toolName) : undefined
  if (toolName) turn.erroredToolNames.add(toolName)

  if (toolCallId) {
    const msgId = ctx.messageId()
    if (msgId) {
      ctx.setMessages(updateMessage(msgId, patchActivity(toolCallId, (a) => ({ ...a, status: "error" as const, detail: errorMessage }))))
    }
  }
}

export function handleDocxProgress(ctx: StreamEventContext, turn: StreamTurn, parsed: Payload) {
  // Document generation progress - schema: {step, message, filename, code_preview?}
  const step = asString(parsed.step) ?? "start"
  const filename = asString(parsed.filename) ?? "document"
  const progressMessage = asString(parsed.message) ?? ""
  const activityId = `docx-${filename}`
  turn.reasoning.activity(activityId, eventRoundIndex(parsed))
  ctx.flushPending()

  const msgId = ctx.messageId()
  if (msgId) {
    const status: ActivityStatus = step === "done" ? "done" : step === "error" ? "error" : "executing"
    ctx.setMessages(updateMessage(msgId, upsertDocxProgress(
      { activityId, status, filename, progressMessage, codePreview: asString(parsed.code_preview) },
      () => turn.reasoning.timeline(),
    )))
  }
}

export function handleAgentStarted(ctx: StreamEventContext, turn: StreamTurn, parsed: Payload) {
  const agent = asString(parsed.agent)
  const msgId = ctx.messageId()
  if (!agent || !msgId) return
  const activityId = `agent-${agent}-${Date.now()}`
  turn.agentActivityIds.set(agent, activityId)
  turn.reasoning.activity(activityId, eventRoundIndex(parsed))
  ctx.flushPending()
  const activity: ActivityItem = {
    id: activityId,
    type: "agent",
    toolName: "ask_agent",
    label: agent,
    detail: asString(parsed.task),
    agentHandle: asString(parsed.handle),
    status: "executing",
  }
  ctx.setMessages(updateMessage(msgId, appendActivity(activity, () => turn.reasoning.timeline())))
}

/** agent_content appends the sub-agent's output; agent_finished closes its row. */
export function handleAgentUpdate(ctx: StreamEventContext, turn: StreamTurn, eventName: "agent_content" | "agent_finished", parsed: Payload) {
  const agent = asString(parsed.agent)
  const activityId = agent ? turn.agentActivityIds.get(agent) : undefined
  const msgId = ctx.messageId()
  if (!activityId || !msgId) return
  const content = typeof parsed.content === "string" ? parsed.content : ""
  const failed = eventName === "agent_finished" && Boolean(asString(parsed.error))
  if (eventName === "agent_finished") turn.agentActivityIds.delete(agent!)
  ctx.setMessages(updateMessage(msgId, patchActivity(activityId, (a) =>
    eventName === "agent_content"
      ? { ...a, output: (a.output ?? "") + content }
      : { ...a, status: failed ? "error" as const : "done" as const },
  )))
}
