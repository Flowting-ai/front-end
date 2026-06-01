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
 * separate `generatedFiles`, `images`, and `attachments` lists for the UIMessage.
 *
 * Generated image files (mime_type starts with "image/") are routed to `images`
 * for inline display; all other generated files go to `generatedFiles` (download
 * card). Uploaded files are restored into `attachments` with their backend URLs.
 */
function extractFileAttachments(raw: Message): Pick<UIMessage, "generatedFiles" | "images" | "attachments"> {
  const rawAtts = raw.file_attachments;
  if (!Array.isArray(rawAtts) || rawAtts.length === 0) return {};

  const generatedFiles: GeneratedFile[] = [];
  const generatedImages: import("@/hooks/use-chat-state").GeneratedImage[] = [];
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
      if (mimeType && mimeType.startsWith("image/")) {
        // Route generated images to msg.images so they render inline,
        // matching the behaviour of the `image` SSE event during streaming.
        generatedImages.push({ url });
      } else {
        generatedFiles.push({ url, filename, mimeType });
      }
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
    ...(generatedImages.length > 0 ? { images: generatedImages } : {}),
    ...(uploadedAttachments.length > 0 ? { attachments: uploadedAttachments } : {}),
  };
}

/** Converts a raw API Message into a UIMessage ready for rendering. */
export function toUIMessage(raw: Message): UIMessage {
  // ── modelName + modelMeta from model_name (or model) field ─────────────
  let modelName: string | undefined;
  let modelMeta: ModelSelectedMeta | undefined;
  const rawModelName = raw.model_name ?? raw.model;
  if (rawModelName) {
    modelName = rawModelName;
    modelMeta = {
      modelId: rawModelName,
      modelName: rawModelName,
      company: inferCompany(rawModelName),
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

  // ── images: merge image_links + generated image file_attachments ─────────
  // Two sources can contribute inline images after a page refresh:
  //   1. raw.image_links  — legacy/explicit image URL list from the backend
  //   2. fileData.images  — image/* files routed from file_attachments (e.g.
  //                         image-generation tools that store result as an
  //                         attachment with origin="generated" + image/* mime)
  // Merge both, deduplicating by URL so a URL that appears in both doesn't
  // render twice.
  const imageFromLinks = raw.image_links && raw.image_links.length > 0
    ? raw.image_links.map((url) => ({ url }))
    : [];
  const imageFromAtts = fileData.images ?? [];
  const seenImageUrls = new Set<string>();
  const mergedImages: import("@/hooks/use-chat-state").GeneratedImage[] = [];
  for (const img of [...imageFromLinks, ...imageFromAtts]) {
    if (!seenImageUrls.has(img.url)) {
      seenImageUrls.add(img.url);
      mergedImages.push(img);
    }
  }
  const restoredImages = mergedImages.length > 0 ? mergedImages : undefined;

  // ── response_blocks → responseBlocks ─────────────────────────────────────
  // Restore structured response blocks (tables, charts, steps, etc.) that were
  // produced during streaming via structured_block SSE events and persisted by
  // the backend in response_blocks. Without this, structured content disappears
  // on page refresh.
  const restoredResponseBlocks = Array.isArray(raw.response_blocks) && raw.response_blocks.length > 0
    ? (raw.response_blocks as import("@/hooks/use-chat-state").ResponseBlock[])
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
    ...(restoredResponseBlocks ? { responseBlocks: restoredResponseBlocks } : {}),
  }
}

export function toUIMessages(raw: Message[]): UIMessage[] {
  return raw.map(toUIMessage)
}
