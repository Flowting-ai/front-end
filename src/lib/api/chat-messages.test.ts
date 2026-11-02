import { describe, it, expect, vi } from "vitest";

vi.mock("./client", async (orig) => ({
  ...(await orig<typeof import("./client")>()),
  apiFetch: vi.fn(async () => new Response(JSON.stringify({ results: [
    { id: "t1", input: "write a story", output: "", created_at: "2026-10-26T00:00:00Z" },
  ] }), { status: 200 })),
}));

import { getChatMessages } from "./chat";
import { EMPTY_TURN_MESSAGE } from "@/lib/model-error";

describe("getChatMessages", () => {
  it("keeps a turn saved with no answer as an assistant placeholder that says so", async () => {
    const { messages } = await getChatMessages("c1");
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(messages[1]).toMatchObject({ id: "t1", content: "", errorNotice: EMPTY_TURN_MESSAGE });
  });
});
