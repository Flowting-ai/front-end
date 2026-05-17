import type { Message } from "@/types/chat"
import type { UIMessage, WebCitation, ActivityItem, ModelSelectedMeta, GeneratedFile } from "@/hooks/use-chat-state"

/** Infer company from a model name string for icon/logo display. */
function inferCompany(modelName: string): string | undefined {
  const l = modelName.toLowerCase();
  if (l.includes("gpt") || l.includes("o1") || l.includes("o3") || l.includes("o4") || l.includes("openai")) return "openai";
  if (l.includes("claude") || l.includes("anthropic")) return "anthropic";
  if (l.includes("gemini") || l.includes("google")) return "google";
  if (l.includes("llama") || l.includes("meta")) return "meta";
  if (l.includes("mistral")) return "mistral";
  if (l.includes("deepseek")) return "deepseek";
  if (l.includes("souvenir") || l.includes("muse")) return "souvenir";
  return undefined;
}

/** Extract a filename from a URL path. */
function filenameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    return decodeURIComponent(path.split("/").pop() ?? "") || "file";
  } catch {
    return url.split("/").pop() ?? "file";
  }
}

/**
 * Normalise the `file_attachments` array from a backend message into
 * separate `generatedFiles` and `attachments` lists for the UIMessage.
 */
function extractFileAttachments(raw: Message): Pick<UIMessage, "generatedFiles" | "attachments"> {
  const rawAtts = raw.file_attachments;
  if (!Array.isArray(rawAtts) || rawAtts.length === 0) return {};

  const generatedFiles: GeneratedFile[] = [];
  const uploadedAttachments: import("@/types/chat").Attachment[] = [];

  for (const att of rawAtts) {
    const url = (att.file_link ?? att.url ?? att.link ?? "").trim();
    if (!url) continue;

    const mimeType = att.mime_type ?? undefined;
    const origin = att.origin ?? null;
    const name = att.file_name ?? att.name;
    const filename = typeof name === "string" && name.trim()
      ? name.trim()
      : filenameFromUrl(url);

    if (origin === "generated") {
      generatedFiles.push({ url, filename, mimeType });
    } else if (origin === "uploaded" || origin === "user") {
      // Populate the user message bubble with the actual backend URL after a page refresh.
      uploadedAttachments.push({
        id: `att-${filename}-${url.slice(-8)}`,
        file_name: filename,
        file_type: mimeType ?? "application/octet-stream",
        file_size: 0,
        url,
      });
    }
  }

  return {
    ...(generatedFiles.length > 0 ? { generatedFiles } : {}),
    ...(uploadedAttachments.length > 0 ? { attachments: uploadedAttachments } : {}),
  };
}

/** Converts a raw API Message into a UIMessage ready for rendering. */
export function toUIMessage(raw: Message): UIMessage {
  // ── modelName + modelMeta from model_name field ──────────────────────────
  let modelName: string | undefined;
  let modelMeta: ModelSelectedMeta | undefined;
  if (raw.model_name) {
    modelName = raw.model_name;
    modelMeta = {
      modelId: raw.model_name,
      modelName: raw.model_name,
      company: inferCompany(raw.model_name),
    };
  }

  // ── webCitations + activity row from persisted sources ───────────────────
  let webCitations: WebCitation[] | undefined;
  let activities: ActivityItem[] | undefined;

  if (raw.sources && raw.sources.length > 0) {
    webCitations = raw.sources.map((s) => ({
      title: s.title,
      url: s.url,
      domain: s.url ? (() => { try { return new URL(s.url).hostname.replace(/^www\./, ""); } catch { return undefined; } })() : undefined,
    }));

    // Synthesise a completed web-search activity row so "Searching the web" shows on refresh.
    // Use the query from web_searches if available, otherwise leave blank.
    const firstQuery = raw.web_searches?.[0]?.query;
    activities = [{
      id: `${raw.id}-websearch`,
      type: "web-search",
      label: "Searching the web",
      detail: firstQuery,
      status: "done",
      results: raw.sources.map((s) => ({
        title: s.title,
        url: s.url,
        domain: s.url ? (() => { try { return new URL(s.url).hostname.replace(/^www\./, ""); } catch { return undefined; } })() : undefined,
      })),
    }];
  }

  // ── file_attachments → generatedFiles + uploaded attachment URLs ─────────
  const fileData = extractFileAttachments(raw);

  // Merge uploaded attachment URLs (from file_attachments) into any existing
  // attachments from raw.attachments, so a page refresh shows file chips with links.
  const existingAtts = raw.attachments ?? [];
  const uploadedFromFileAtts = fileData.attachments ?? [];
  let mergedAttachments: typeof existingAtts | undefined;
  if (uploadedFromFileAtts.length > 0) {
    if (existingAtts.length > 0) {
      // Patch URLs into matching existing entries (match by file_name)
      mergedAttachments = existingAtts.map((a) => {
        const match = uploadedFromFileAtts.find((u) => u.file_name === a.file_name);
        return match && !a.url ? { ...a, url: match.url } : a;
      });
    } else {
      mergedAttachments = uploadedFromFileAtts;
    }
  }

  // ── image_links → images ─────────────────────────────────────────────────
  // Restore generated images from the persisted image_links field so they
  // display correctly after a page refresh (no new stream needed).
  const restoredImages = raw.image_links && raw.image_links.length > 0
    ? raw.image_links.map((url) => ({ url }))
    : undefined;

  return {
    ...raw,
    isLoading: false,
    isThinkingInProgress: false,
    ...(modelName ? { modelName } : {}),
    ...(modelMeta ? { modelMeta } : {}),
    ...(webCitations ? { webCitations } : {}),
    ...(activities ? { activities } : {}),
    ...(mergedAttachments ? { attachments: mergedAttachments } : {}),
    ...(fileData.generatedFiles ? { generatedFiles: fileData.generatedFiles } : {}),
    ...(restoredImages ? { images: restoredImages } : {}),
  }
}

export function toUIMessages(raw: Message[]): UIMessage[] {
  return raw.map(toUIMessage)
}
