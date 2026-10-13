import { describe, expect, it, vi } from "vitest";
import { newUploadItem } from "./machine";
import { createUploadStore } from "./store";

const make = (id: string, draftKey = "new") => newUploadItem({ id, draftKey, name: `${id}.pdf`, sizeBytes: 10, mimeType: "application/pdf", format: "pdf", startedAt: 0 });

describe("upload store", () => {
  it("holds attachments per draft in the order they were added", () => {
    const store = createUploadStore();
    store.add(make("a"));
    store.add(make("b"));
    store.add(make("c", "chat-2"));
    expect(store.forDraft("new").map((item) => item.id)).toEqual(["a", "b"]);
    expect(store.forDraft("chat-2").map((item) => item.id)).toEqual(["c"]);
    expect(store.forDraft("nothing")).toEqual([]);
  });

  it("returns the same array reference until that draft changes (so selectors do not re-render)", () => {
    const store = createUploadStore();
    store.add(make("a"));
    store.add(make("c", "chat-2"));
    const first = store.forDraft("new");
    expect(store.forDraft("new")).toBe(first);
    store.dispatch("c", { type: "validated" }); // another draft changes
    expect(store.forDraft("new")).toBe(first);
    store.dispatch("a", { type: "validated" });
    expect(store.forDraft("new")).not.toBe(first);
  });

  it("notifies subscribers only when something actually changed", () => {
    const store = createUploadStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.add(make("a"));
    expect(listener).toHaveBeenCalledTimes(1);
    store.dispatch("a", { type: "progress", value: 0.5 }); // not uploading yet: no change
    expect(listener).toHaveBeenCalledTimes(1);
    store.dispatch("a", { type: "validated" });
    expect(listener).toHaveBeenCalledTimes(2);
    store.dispatch("missing", { type: "validated" });
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.remove("a");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("removes one attachment, a whole draft, or everything", () => {
    const store = createUploadStore();
    store.add(make("a"));
    store.add(make("b"));
    store.add(make("c", "chat-2"));
    store.remove("a");
    expect(store.get("a")).toBeUndefined();
    store.removeDraft("new");
    expect(store.forDraft("new")).toEqual([]);
    expect(store.all().map((item) => item.id)).toEqual(["c"]);
    store.clear();
    expect(store.all()).toEqual([]);
  });
});
