// The per-chat history store: what it serves back, when it calls itself stale,
// and how it bounds its own size.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readChatHistory,
  saveChatHistory,
  updateCachedMessages,
  dropChatHistory,
  clearChatHistories,
  isHistoryStale,
  HISTORY_STALE_MS,
} from "@/lib/chat/chat-message-cache";
import type { UIMessage } from "@/types/chat";

const msg = (id: string): UIMessage => ({
  id,
  role: "user",
  content: id,
  created_at: "2026-01-01T00:00:00Z",
  chat_id: "c1",
});

const page = (ids: string[], over: Partial<Parameters<typeof saveChatHistory>[1]> = {}) => ({
  messages: ids.map(msg),
  hasMore: false,
  cursor: undefined,
  pages: 1,
  ...over,
});

beforeEach(() => clearChatHistories());
afterEach(() => {
  vi.useRealTimers();
  clearChatHistories();
});

describe("read / save", () => {
  it("returns nothing for a chat that was never saved", () => {
    expect(readChatHistory("missing")).toBeUndefined();
  });

  it("round-trips messages and their pagination state", () => {
    saveChatHistory("c1", page(["a", "b"], { hasMore: true, cursor: "cur-1" }));
    const got = readChatHistory("c1");
    expect(got?.messages.map((m) => m.id)).toEqual(["a", "b"]);
    expect(got?.hasMore).toBe(true);
    expect(got?.cursor).toBe("cur-1");
    expect(got?.pages).toBe(1);
  });

  it("keeps chats apart", () => {
    saveChatHistory("c1", page(["a"]));
    saveChatHistory("c2", page(["b"]));
    expect(readChatHistory("c1")?.messages.map((m) => m.id)).toEqual(["a"]);
    expect(readChatHistory("c2")?.messages.map((m) => m.id)).toEqual(["b"]);
  });

  it("forgets a dropped chat", () => {
    saveChatHistory("c1", page(["a"]));
    dropChatHistory("c1");
    expect(readChatHistory("c1")).toBeUndefined();
  });
});

describe("freshness", () => {
  it("counts a just-saved history as fresh and an aged one as stale", () => {
    vi.useFakeTimers();
    saveChatHistory("c1", page(["a"]));
    expect(isHistoryStale(readChatHistory("c1")!)).toBe(false);

    vi.advanceTimersByTime(HISTORY_STALE_MS + 1);
    expect(isHistoryStale(readChatHistory("c1")!)).toBe(true);
  });

  it("does not let a local write-back pass as a server read", () => {
    vi.useFakeTimers();
    saveChatHistory("c1", page(["a"]));
    vi.advanceTimersByTime(HISTORY_STALE_MS + 1);

    // A finished reply updates the messages but must not reset freshness: the
    // next visit still owes the server a check.
    updateCachedMessages("c1", [msg("a"), msg("b")], { hasMore: false, cursor: undefined, pages: 1 });
    const got = readChatHistory("c1")!;
    expect(got.messages.map((m) => m.id)).toEqual(["a", "b"]);
    expect(isHistoryStale(got)).toBe(true);
  });

  it("treats a stream-built history (never fetched) as stale", () => {
    updateCachedMessages("c1", [msg("a")], { hasMore: false, cursor: undefined, pages: 1 });
    expect(isHistoryStale(readChatHistory("c1")!)).toBe(true);
  });

  it("drops an entry untouched for longer than the absolute age cap", () => {
    vi.useFakeTimers();
    saveChatHistory("c1", page(["a"]));
    vi.advanceTimersByTime(31 * 60_000);
    expect(readChatHistory("c1")).toBeUndefined();
  });

  it("keeps an old entry alive while it is still being read", () => {
    vi.useFakeTimers();
    saveChatHistory("c1", page(["a"]));
    // Reading every 20 min keeps it under the 30 min idle cap indefinitely.
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(20 * 60_000);
      expect(readChatHistory("c1")).toBeDefined();
    }
  });
});

describe("eviction", () => {
  it("keeps at most 20 chats, dropping the least recently used", () => {
    vi.useFakeTimers();
    for (let i = 0; i < 20; i++) {
      saveChatHistory(`c${i}`, page([`m${i}`]));
      vi.advanceTimersByTime(10);
    }
    expect(readChatHistory("c0")).toBeDefined();

    // Touch c0 so it is no longer the oldest, then overflow by one.
    vi.advanceTimersByTime(10);
    readChatHistory("c0");
    vi.advanceTimersByTime(10);
    saveChatHistory("c20", page(["m20"]));

    expect(readChatHistory("c20")).toBeDefined();
    expect(readChatHistory("c0")).toBeDefined();
    expect(readChatHistory("c1")).toBeUndefined();
  });
});
