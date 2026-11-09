import { describe, expect, it } from "vitest";
import type { UIMessage } from "@/types/chat";
import {
  estimateMessageSize,
  getComposerPlaceholder,
  getQueuePausedReason,
  getQueueStatus,
} from "./chat-interface-helpers";

const msg = (m: Partial<UIMessage>): UIMessage => ({ id: "m", role: "assistant", content: "", ...m }) as UIMessage;

describe("estimateMessageSize", () => {
  it("falls back for a missing row", () => {
    expect(estimateMessageSize(undefined)).toBe(200);
  });

  it("uses a fixed height for agent cards", () => {
    expect(estimateMessageSize(msg({ agentCard: {} as UIMessage["agentCard"] }))).toBe(190);
  });

  it("grows user bubbles by 16px per 80 characters", () => {
    expect(estimateMessageSize(msg({ role: "user", content: "" }))).toBe(80);
    expect(estimateMessageSize(msg({ role: "user", content: "a".repeat(80) }))).toBe(96);
    expect(estimateMessageSize(msg({ role: "user", content: "a".repeat(81) }))).toBe(112);
  });

  it("grows assistant replies by 20px per 60 characters, plus room for blocks, capped at 2000", () => {
    expect(estimateMessageSize(msg({ content: "" }))).toBe(120);
    expect(estimateMessageSize(msg({ content: "a".repeat(60) }))).toBe(140);
    expect(estimateMessageSize(msg({ content: "", responseBlocks: [{}] as UIMessage["responseBlocks"] }))).toBe(420);
    expect(estimateMessageSize(msg({ content: "a".repeat(100_000) }))).toBe(2000);
  });
});

describe("getQueuePausedReason", () => {
  const none = { creditsBlocked: false, poolPaused: false, personaConfigLoading: false };

  it("is null when nothing holds the queue", () => {
    expect(getQueuePausedReason(none)).toBeNull();
  });

  it("prefers credits, then the workspace pool, then the agent loading", () => {
    expect(getQueuePausedReason({ creditsBlocked: true, poolPaused: true, personaConfigLoading: true })).toBe("paused, out of credits");
    expect(getQueuePausedReason({ ...none, poolPaused: true, personaConfigLoading: true })).toBe("paused, workspace out of credits");
    expect(getQueuePausedReason({ ...none, personaConfigLoading: true })).toBe("waiting for the agent to load");
  });
});

describe("getQueueStatus", () => {
  const base = { pausedReason: null, waitingOnReply: false, queuedCount: 1, askingSave: false, hookBusy: false };

  it("shows a pause reason first", () => {
    expect(getQueueStatus({ ...base, pausedReason: "paused, out of credits", waitingOnReply: true })).toBe("paused, out of credits");
  });

  it("describes waiting on the reply, singular and plural", () => {
    expect(getQueueStatus({ ...base, waitingOnReply: true })).toBe("sends when this reply finishes");
    expect(getQueueStatus({ ...base, waitingOnReply: true, queuedCount: 2 })).toBe("sent in order as each reply finishes");
  });

  it("then the save question, then another chat's reply, then sending", () => {
    expect(getQueueStatus({ ...base, askingSave: true, hookBusy: true })).toBe("waiting for your answer about saving files");
    expect(getQueueStatus({ ...base, hookBusy: true })).toBe("waiting for your reply in another chat");
    expect(getQueueStatus(base)).toBe("sending next…");
  });
});

describe("getComposerPlaceholder", () => {
  const base = { readOnly: false, poolPaused: false, creditsBlocked: false, personaConfigLoading: false, queuedCount: 0, sendQueues: false };

  it("defaults to the greeting", () => {
    expect(getComposerPlaceholder(base)).toBe("How can I help you today?");
  });

  it("asks for a follow-up once the chat has messages", () => {
    expect(getComposerPlaceholder({ ...base, hasMessages: true })).toBe("Ask a follow-up…");
  });

  it("orders blocking states from most to least blocking", () => {
    const all = { readOnly: true, poolPaused: true, creditsBlocked: true, personaConfigLoading: true, queuedCount: 1, sendQueues: true };
    expect(getComposerPlaceholder(all)).toBe("Create your own copy to continue this chat.");
    expect(getComposerPlaceholder({ ...all, readOnly: false })).toBe("Workspace out of credits. Contact your admin.");
    expect(getComposerPlaceholder({ ...all, readOnly: false, poolPaused: false })).toBe("Credits exhausted. Buy a top-up to continue.");
    expect(getComposerPlaceholder({ ...base, personaConfigLoading: true, queuedCount: 1 })).toBe("Loading agent…");
  });

  it("invites queueing while a reply runs", () => {
    expect(getComposerPlaceholder({ ...base, queuedCount: 2, sendQueues: true })).toBe("Queue another message…");
    expect(getComposerPlaceholder({ ...base, sendQueues: true })).toBe("Queue a follow-up…");
  });
});
