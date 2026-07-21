import { describe, expect, it } from "vitest";
import { friendlyModelError, stripResponseInterruptedMarker } from "./model-error";

describe("friendlyModelError", () => {
  it("maps a known status code to its specific message", () => {
    expect(friendlyModelError("", 429)).toBe(
      "This model is receiving too many requests right now. Please wait a moment and try again.",
    );
  });

  it("returns a specific message for a 'chat not found' backend error, not the generic 404 copy", () => {
    const msg = friendlyModelError('{"detail":"Chat not found"}', 404);
    expect(msg).toContain("chat no longer exists");
    expect(msg).not.toBe(
      "This model is unresponsive right now. Please try again or switch to another model.",
    );
  });

  it("detects 'chat not found' even without an explicit status code", () => {
    const msg = friendlyModelError("Chat not found");
    expect(msg).toContain("chat no longer exists");
  });

  it("falls back to the unresponsive message for known connection-drop wording", () => {
    expect(friendlyModelError("stream error: connection reset")).toBe(
      "This model is unresponsive right now. Please try again or switch to another model.",
    );
  });

  it("falls back to the generic message only for genuinely unrecognized text", () => {
    expect(friendlyModelError("some totally unrecognized provider error")).toBe(
      "Something went wrong generating a response. Please try again.",
    );
  });

  it("does not re-derive a specific reason from already-friendly text (documents why callers must not double-translate)", () => {
    const first = friendlyModelError("", 429);
    const second = friendlyModelError(first);
    expect(second).toBe("Something went wrong generating a response. Please try again.");
  });
});

describe("stripResponseInterruptedMarker", () => {
  it("replaces a trailing [Response interrupted: ...] marker with friendly copy", () => {
    const content = "Partial answer so far.\n\n[Response interrupted: Chat not found]";
    const result = stripResponseInterruptedMarker(content);
    expect(result).toContain("Partial answer so far.");
    expect(result).toContain("chat no longer exists");
    expect(result).not.toContain("[Response interrupted");
  });

  it("is a no-op when no marker is present", () => {
    expect(stripResponseInterruptedMarker("Just a normal message.")).toBe("Just a normal message.");
  });
});
