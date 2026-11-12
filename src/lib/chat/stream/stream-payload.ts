import type { GeneratedFile, GeneratedImage, WebCitation } from "@/types/chat"

// Pure readers for stream event payloads. Each takes the `parsed` record of an
// app event (lib/agui/to-app-event) and returns plain values; nothing here
// touches React state.

export type Attachment = Record<string, unknown>

/** A user-side file the backend saved, as read from `file_attachments`. */
export interface UploadedAttachment {
  filename: string
  url: string
  mimeType: string
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined
}

export function extractChatId(parsed: Record<string, unknown>): string | null {
  const raw = parsed.chat_id ?? parsed.chatId ?? null
  if (raw === null || raw === undefined) return null
  const resolved = String(raw).trim()
  return resolved.length > 0 ? resolved : null
}

/** `file_attachments` from the payload itself or its `message`, or null when neither has a list. */
export function eventAttachments(parsed: Record<string, unknown>): Attachment[] | null {
  if (Array.isArray(parsed.file_attachments)) return parsed.file_attachments as Attachment[]
  const message = parsed.message as Record<string, unknown> | undefined
  return Array.isArray(message?.file_attachments) ? (message.file_attachments as Attachment[]) : null
}

function attachmentUrl(a: Attachment): string {
  return (
    typeof a.file_link === "string" ? a.file_link
    : typeof a.url === "string" ? a.url
    : typeof a.link === "string" ? a.link
    : ""
  ).trim()
}

function attachmentName(a: Attachment, url: string): string {
  const rawName =
    typeof a.file_name === "string" ? a.file_name
    : typeof a.name === "string" ? a.name
    : undefined
  return rawName?.trim() || url.split("/").pop() || "file"
}

/**
 * Generated attachments, split for display: image/* → inline images
 * (msg.images, as the `image` event does), anything else → file cards
 * (msg.generatedFiles). Uploaded files are left out.
 */
export function generatedOutputs(atts: Attachment[]): { files: GeneratedFile[]; images: GeneratedImage[] } {
  const files: GeneratedFile[] = []
  const images: GeneratedImage[] = []
  for (const a of atts) {
    if (a.origin !== "generated") continue
    const url = attachmentUrl(a)
    if (!url) continue
    const mimeType = typeof a.mime_type === "string" ? a.mime_type : undefined
    if (mimeType && mimeType.startsWith("image/")) {
      images.push({ url })
    } else {
      files.push({ url, filename: attachmentName(a, url), mimeType })
    }
  }
  return { files, images }
}

/** Generated attachments on the `done` frame. Unlike generatedOutputs, every
 *  one is a file card (images included) and a bare `link` isn't read. */
export function doneGeneratedFiles(atts: Attachment[]): GeneratedFile[] {
  return atts.flatMap((a) => {
    if (a.origin !== "generated") return []
    const url = (
      typeof a.file_link === "string" ? a.file_link :
      typeof a.url === "string" ? a.url : ""
    ).trim()
    if (!url) return []
    return [{ url, filename: attachmentName(a, url), mimeType: typeof a.mime_type === "string" ? a.mime_type : undefined }]
  })
}

/** Files the user sent that the backend has now stored, with their real links. */
export function uploadedAttachments(atts: Attachment[]): UploadedAttachment[] {
  return atts.flatMap((a) => {
    // The complement of generatedOutputs above: anything the backend did not mark
    // as generated is the user's upload, including a row that omits `origin`.
    // Requiring the exact word left those chips without their link.
    if (a.origin === "generated" || a.origin === "assistant") return []
    const url = attachmentUrl(a)
    if (!url) return []
    const mimeType = typeof a.mime_type === "string" ? a.mime_type : "application/octet-stream"
    return [{ filename: attachmentName(a, url), url, mimeType }]
  })
}

/** message_saved `sources` → the reply's web citations. Entries with neither a url nor a title are dropped. */
export function citationsFromSources(rawSources: Array<Record<string, unknown>>): WebCitation[] {
  return rawSources.flatMap((s) => s.url || s.title ? [{
    title: asString(s.title) ?? asString(s.url) ?? "",
    url: asString(s.url),
    domain: asString(s.domain) ?? (() => {
      try { return new URL(asString(s.url) ?? "").hostname.replace(/^www\./, "") } catch { return undefined }
    })(),
  }] : [])
}

