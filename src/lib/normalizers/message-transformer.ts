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
function extractFileAttachments(raw: Message): Pick<UIMessage, "generatedFiles"> {
  const rawAtts = raw.file_attachments;
  if (!Array.isArray(rawAtts) || rawAtts.length === 0) return {};

  const generatedFiles: GeneratedFile[] = [];

  for (const att of rawAtts) {
    const url = (att.file_link ?? att.url ?? att.link ?? "").trim();
    if (!url) continue;

    const mimeType = att.mime_type ?? undefined;
    const origin = att.origin ?? null;
    const name = att.file_name ?? att.name;
    const filename = typeof name === "string" && name.trim()
      ? name.trim()
      : filenameFromUrl(url);

    // "generated" origin → render as a downloadable file in the assistant bubble
    if (origin === "generated") {
      generatedFiles.push({ url, filename, mimeType });
    }
    // "uploaded" origin is the user's own file already shown in the user bubble's attachments
  }

  return {
    ...(generatedFiles.length > 0 ? { generatedFiles } : {}),
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

  // ── file_attachments → generatedFiles ────────────────────────────────────
  const fileData = extractFileAttachments(raw);

  return {
    ...raw,
    isLoading: false,
    isThinkingInProgress: false,
    ...(modelName ? { modelName } : {}),
    ...(modelMeta ? { modelMeta } : {}),
    ...(webCitations ? { webCitations } : {}),
    ...(activities ? { activities } : {}),
    ...fileData,
  }
}

export function toUIMessages(raw: Message[]): UIMessage[] {
  return raw.map(toUIMessage)
}
