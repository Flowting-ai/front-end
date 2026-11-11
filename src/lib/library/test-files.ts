// Tests only: a LibraryFile built the way the API builds one, with the fields a test cares about.

import { LibraryFile } from "./file";
import type { FileRowWire } from "./schemas";

export function testFile(overrides: Partial<FileRowWire> = {}): LibraryFile {
  return new LibraryFile({
    id: "f1",
    title: "Return policy",
    extension: "pdf",
    format: "pdf",
    source: "uploaded",
    owner: { id: "u1", name: "Avery" },
    access: "owner",
    adminCanManage: false,
    accessSummary: { everyone: false, people: [{ id: "u1", name: "Avery" }] },
    sizeBytes: 1,
    createdAt: "2026-10-01T00:00:00.000Z",
    lastActivityAt: "2026-10-01T00:00:00.000Z",
    lastActivityKind: "created",
    unread: false,
    life: "active",
    titleIsAiGenerated: false,
    processingPhase: "ready",
    ...overrides,
  });
}
