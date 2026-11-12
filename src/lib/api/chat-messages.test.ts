import { describe, it, expect, vi } from "vitest";

const run = (id: string, status: string) => ({ id, status, segments: 1, startedAt: "2026-10-26T00:00:00Z" });
const question = {
  event: "question_prompt", prompt_id: "q1", respond_url: "/chats/c1/questions/q1",
  questions: [{ id: "which", question: "Which store?", type: "text" }],
};

vi.mock("./client", async (orig) => ({
  ...(await orig<typeof import("./client")>()),
  apiFetch: vi.fn(async () => new Response(JSON.stringify({ results: [
    { id: "t1", input: "write a story", output: "", created_at: "2026-10-26T00:00:00Z" },
    { id: "t2", input: "connect shopify", output: "", created_at: "2026-10-26T00:01:00Z", run: run("t2", "waiting"), prompts: [question] },
    { id: "t3", input: "summarise it", output: "", created_at: "2026-10-26T00:02:00Z", run: run("t3", "failed") },
    { id: "t4", input: "and now?", output: "", created_at: "2026-10-26T00:03:00Z", run: run("t4", "running") },
  ] }), { status: 200 })),
}));

import { getChatMessages } from "./chat";
import { EMPTY_TURN_MESSAGE } from "@/lib/model-error";
import { INTERRUPTED_MESSAGE } from "@/lib/turn-outcome";

describe("getChatMessages", () => {
  it("keeps a turn saved with no answer as an assistant placeholder that says so", async () => {
    const { messages } = await getChatMessages("c1");
    expect(messages.slice(0, 2).map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(messages[1]).toMatchObject({ id: "t1", content: "", errorNotice: EMPTY_TURN_MESSAGE });
    expect(messages[1].run).toBeUndefined();
  });

  it("reads a turn waiting on a card as waiting, with its card and no notice", async () => {
    const { messages } = await getChatMessages("c1");
    expect(messages[3]).toMatchObject({ id: "t2", run: { status: "waiting" }, prompts: [{ card: "chat", request_id: "q1" }] });
    expect(messages[3].errorNotice).toBeUndefined();
  });

  it("says a turn whose run failed was interrupted, and leaves a running one without a notice", async () => {
    const { messages } = await getChatMessages("c1");
    expect(messages[5]).toMatchObject({ id: "t3", run: { status: "failed" }, errorNotice: INTERRUPTED_MESSAGE });
    expect(messages[7]).toMatchObject({ id: "t4", run: { status: "running" } });
    expect(messages[7].errorNotice).toBeUndefined();
  });
});
