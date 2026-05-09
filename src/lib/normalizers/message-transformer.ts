import type { Message } from "@/types/chat"
import type { UIMessage, WebCitation, ActivityItem } from "@/hooks/use-chat-state"

/** Converts a raw API Message into a UIMessage ready for rendering. */
export function toUIMessage(raw: Message): UIMessage {
  // Hydrate webCitations from persisted sources so citation cards survive refresh
  let webCitations: WebCitation[] | undefined;
  let activities: ActivityItem[] | undefined;

  if (raw.sources && raw.sources.length > 0) {
    webCitations = raw.sources.map((s) => ({
      title: s.title,
      url: s.url,
      domain: s.url ? (() => { try { return new URL(s.url).hostname.replace(/^www\./, ""); } catch { return undefined; } })() : undefined,
    }));

    // Synthesise a completed web-search activity row so "Searching the web" shows on refresh
    activities = [{
      id: `${raw.id}-websearch`,
      type: "web-search",
      label: "Searching the web",
      status: "done",
      results: raw.sources.map((s) => ({
        title: s.title,
        url: s.url,
        domain: s.url ? (() => { try { return new URL(s.url).hostname.replace(/^www\./, ""); } catch { return undefined; } })() : undefined,
      })),
    }];
  }

  return {
    ...raw,
    isLoading: false,
    isThinkingInProgress: false,
    ...(webCitations ? { webCitations } : {}),
    ...(activities ? { activities } : {}),
  }
}

export function toUIMessages(raw: Message[]): UIMessage[] {
  return raw.map(toUIMessage)
}
