import { describe, expect, it, vi } from "vitest";
import { newUploadItem } from "./machine";
import { uploadStore } from "./store";

const finishes = new Map<string, () => void>();

vi.mock("./controller", () => ({
  getUploadController: () => ({
    start(file: File, options: { draftKey: string }) {
      const id = `u-${file.name}`;
      uploadStore.add(newUploadItem({ id, draftKey: options.draftKey, name: file.name, sizeBytes: file.size, mimeType: "", format: null, startedAt: 0 }));
      finishes.set(id, () => {
        uploadStore.dispatch(id, { type: "validated", format: "pdf" });
        if (file.name.includes("locked")) uploadStore.dispatch(id, { type: "server", phase: "failed", slow: false, failure: "password_protected" });
        else uploadStore.dispatch(id, { type: "server", phase: "ready", slow: false, fileId: `file-${file.name}` });
      });
      return id;
    },
    release(draftKey: string) {
      uploadStore.removeDraft(draftKey);
    },
  }),
}));

const { UploadFailed, uploadForSend } = await import("./send");

const file = (name: string) => new File([new Uint8Array(4)], name);

describe("uploadForSend", () => {
  it("resolves with every file id, in order, once all are ready", async () => {
    const sending = uploadForSend([file("a.pdf"), file("b.pdf")]);
    finishes.get("u-b.pdf")!();
    finishes.get("u-a.pdf")!();
    await expect(sending).resolves.toEqual(["file-a.pdf", "file-b.pdf"]);
  });

  it("rejects naming the file and why when any file is refused", async () => {
    const sending = uploadForSend([file("ok.pdf"), file("locked.pdf")]);
    finishes.get("u-ok.pdf")!();
    finishes.get("u-locked.pdf")!();
    await expect(sending).rejects.toBeInstanceOf(UploadFailed);
    await expect(sending).rejects.toThrow("locked.pdf: This file is password-protected, so it can't be added.");
  });

  it("sends nothing when there are no files", async () => {
    await expect(uploadForSend([])).resolves.toEqual([]);
  });
});
