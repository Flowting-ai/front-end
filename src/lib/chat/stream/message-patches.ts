import type { ImageHints } from "@/lib/activity-detail"
import type { ReasoningTimelineItem } from "@/lib/reasoning"
import type {
  ActivityItem,
  ActivityStatus,
  GeneratedFile,
  GeneratedImage,
  UIMessage,
} from "@/types/chat"
import type { UploadedAttachment } from "./stream-payload"

// Pure message reducers for the streaming reply: each returns the next message
// (or the same object when nothing changes). The hook hands them to
// setMessages through updateMessage.
//
// Reasoning timelines are passed as a getter, read when React runs the
// updater, so the row always shows the trace as of that commit.

type Patch = (msg: UIMessage) => UIMessage
type Timeline = () => ReasoningTimelineItem[]

/** A setMessages updater that applies `patch` to the message with this id. */
export function updateMessage(id: string, patch: Patch): (prev: UIMessage[]) => UIMessage[] {
  return (prev) => prev.map((msg) => (msg.id === id ? patch(msg) : msg))
}

/** Adds generated files and images, skipping urls the message already has. */
export function mergeGeneratedOutputs(files: GeneratedFile[], images: GeneratedImage[]): Patch {
  return (msg) => {
    let updated = msg
    if (files.length > 0) {
      const existingUrls = new Set((msg.generatedFiles ?? []).map((f) => f.url))
      const toAdd = files.filter((f) => !existingUrls.has(f.url))
      if (toAdd.length > 0) {
        updated = { ...updated, generatedFiles: [...(updated.generatedFiles ?? []), ...toAdd] }
      }
    }
    if (images.length > 0) {
      const existingUrls = new Set((msg.images ?? []).map((i) => i.url))
      const toAdd = images.filter((i) => !existingUrls.has(i.url))
      if (toAdd.length > 0) {
        updated = { ...updated, images: [...(updated.images ?? []), ...toAdd] }
      }
    }
    return updated
  }
}

/** Generated files from the `done` frame, merged with any set by generated_file events. */
export function mergeDoneFiles(files: GeneratedFile[]): Patch {
  return (msg) => {
    const existing = msg.generatedFiles ?? []
    const existingUrls = new Set(existing.map((f) => f.url))
    const toAdd = files.filter((f) => !existingUrls.has(f.url))
    return toAdd.length > 0
      ? { ...msg, generatedFiles: [...existing, ...toAdd] }
      : msg
  }
}

/**
 * Gives the optimistic user message's attachments their stored links, so the
 * chip in the user bubble becomes a proper link. Matches by filename first,
 * then by position for backends that don't return file_name (e.g. persona
 * chat). A message with no attachments yet (initial-prompt path) gets them
 * fresh from the backend data.
 */
export function applyUploadedAttachments(uploaded: UploadedAttachment[]): Patch {
  return (msg) => {
    const existing = msg.attachments ?? []
    const updated = existing.map((att, idx) => {
      const match = uploaded.find((u) => u.filename === att.file_name)
      if (match) return { ...att, url: match.url, uploading: false }
      // Positional fallback: if no name match and this slot has no URL yet
      if (!att.url && uploaded[idx]) return { ...att, url: uploaded[idx].url, uploading: false }
      return att
    })
    const merged = existing.length > 0 ? updated : uploaded.map((u, i) => ({
      id: `srv-att-${i}-${Date.now()}`,
      file_name: u.filename,
      file_type: u.mimeType,
      file_size: 0,
      url: u.url,
    }))
    return { ...msg, attachments: merged }
  }
}

/** Appends an activity row and refreshes the reasoning timeline. */
export function appendActivity(activity: ActivityItem, timeline: Timeline): Patch {
  return (msg) => ({
    ...msg,
    activities: [...(msg.activities ?? []), activity],
    reasoningTimeline: timeline(),
  })
}

/** Updates one activity row in place. */
export function patchActivity(activityId: string, patch: (a: ActivityItem) => ActivityItem): Patch {
  return (msg) => ({
    ...msg,
    activities: (msg.activities ?? []).map((a) => (a.id === activityId ? patch(a) : a)),
  })
}

/** A web search's row, with its results merged into webCitations (deduped by url). */
export function addWebSearch(activity: ActivityItem, timeline: Timeline): Patch {
  return (msg) => {
    const existing = msg.webCitations ?? []
    const newCitations = (activity.results ?? [])
      .flatMap((r) => r.url && !existing.some((c) => c.url === r.url)
        ? [{ title: r.title, url: r.url, domain: r.domain ?? "" }]
        : [])
    return {
      ...msg,
      activities: [...(msg.activities ?? []), activity],
      reasoningTimeline: timeline(),
      webCitations: newCitations.length > 0 ? [...existing, ...newCitations] : existing,
    }
  }
}

export interface ToolProgress {
  activityId: string
  type: ActivityItem["type"]
  toolName: string
  label?: string
  status: ActivityStatus
  filename?: string
  progressMessage?: string
  codePreview?: string
}

/** tool_progress: updates the tool's row, or creates it when tool_executing was missed. */
export function upsertToolProgress(p: ToolProgress, timeline: Timeline): Patch {
  return (msg) => {
    const existing = (msg.activities ?? []).find((a) => a.id === p.activityId)
    if (existing) {
      return {
        ...msg,
        activities: (msg.activities ?? []).map((a) =>
          a.id === p.activityId
            // The detail (e.g. the search query) came from the tool's
            // args; a progress label must not replace it.
            ? { ...a, status: p.status, label: p.label ?? a.label, detail: a.detail ?? p.label, progressMessage: p.progressMessage, codePreview: p.codePreview }
            : a,
        ),
        reasoningTimeline: timeline(),
      }
    }
    const newActivity: ActivityItem = {
      id: p.activityId,
      type: p.type,
      toolName: p.toolName,
      label: p.label,
      detail: p.label || p.progressMessage || p.filename || p.toolName,
      status: p.status,
      filename: p.filename,
      progressMessage: p.progressMessage,
      codePreview: p.codePreview,
    }
    return {
      ...msg,
      activities: [...(msg.activities ?? []), newActivity],
      reasoningTimeline: timeline(),
    }
  }
}

export interface ToolExecuting {
  label?: string
  detail?: string
  generatesImage?: true
  imageHints?: ImageHints
}

/** Upgrades the preliminary activity in place (replacing its id when the
 *  preliminary one was synthetic) and marks it executing. */
export function upgradeToExecuting(previousId: string, toolCallId: string, e: ToolExecuting, timeline: Timeline): Patch {
  return (msg) => ({
    ...msg,
    activities: (msg.activities ?? []).map((a) =>
      a.id === previousId
        ? { ...a, id: toolCallId, status: "executing" as const, label: e.label ?? a.label, detail: e.detail ?? a.detail, generatesImage: e.generatesImage ?? a.generatesImage, imageHints: e.imageHints ?? a.imageHints }
        : a,
    ),
    reasoningTimeline: timeline(),
  })
}

export interface DocxProgress {
  activityId: string
  status: ActivityStatus
  filename: string
  progressMessage: string
  codePreview?: string
}

/** docx_progress: updates the document's row, or creates it on the first step. */
export function upsertDocxProgress(p: DocxProgress, timeline: Timeline): Patch {
  return (msg) => {
    const existing = (msg.activities ?? []).find((a) => a.id === p.activityId)
    if (existing) {
      return {
        ...msg,
        activities: (msg.activities ?? []).map((a) =>
          a.id === p.activityId
            ? { ...a, status: p.status, detail: p.progressMessage || a.detail, progressMessage: p.progressMessage, codePreview: p.codePreview }
            : a,
        ),
        reasoningTimeline: timeline(),
      }
    }
    const newActivity: ActivityItem = {
      id: p.activityId,
      type: "docx-progress",
      toolName: "docx",
      detail: p.progressMessage || `Generating ${p.filename}`,
      status: p.status,
      filename: p.filename,
      progressMessage: p.progressMessage,
      codePreview: p.codePreview,
    }
    return {
      ...msg,
      activities: [...(msg.activities ?? []), newActivity],
      reasoningTimeline: timeline(),
    }
  }
}

/** Adds an item to one of the message's prompt lists unless one with its request_id is there. */
export function addUniqueByRequestId<K extends "connectorConnectPrompts" | "connectorPermissionPrompts">(
  key: K,
  item: NonNullable<UIMessage[K]>[number],
): Patch {
  return (msg) => {
    const existing = (msg[key] ?? []) as Array<{ request_id: string }>
    if (existing.some((p) => p.request_id === item.request_id)) return msg
    return { ...msg, [key]: [...existing, item] }
  }
}
