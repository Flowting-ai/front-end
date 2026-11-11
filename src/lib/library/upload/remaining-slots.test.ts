import { describe, expect, it } from "vitest";
import { newUploadItem, remainingSlots, type UploadItem } from "./machine";

const item = (id: string, status: UploadItem["status"]): UploadItem => ({
  ...newUploadItem({ id, draftKey: "new", name: `${id}.pdf`, sizeBytes: 1, mimeType: "application/pdf", format: "pdf", startedAt: 0 }),
  status,
});

describe("remainingSlots", () => {
  it("counts every attachment that is still part of the draft", () => {
    expect(remainingSlots([item("a", "uploading"), item("b", "ready"), item("c", "processing")], 10)).toBe(7);
  });

  it("does not count failed or cancelled attachments, which have left the draft", () => {
    expect(remainingSlots([item("a", "failed"), item("b", "cancelled"), item("c", "ready")], 10)).toBe(9);
  });

  it("never goes below zero", () => {
    expect(remainingSlots([item("a", "ready"), item("b", "ready")], 1)).toBe(0);
  });
});
