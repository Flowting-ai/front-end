import { describe, expect, it } from "vitest";
import { personName } from "./access";
import { fileRowSchema, type FileRowWire, type Person } from "./schemas";
import { LibraryFile, LibraryFileDetail } from "./file";
import { testFile } from "./test-files";

const you: Person = { id: "u1", name: "Avery Stone" };
const maya: Person = { id: "u2", name: "Maya Rios" };
const sam: Person = { id: "u3", name: "Sam Okafor" };

function row(overrides: Partial<FileRowWire> = {}): LibraryFile {
  return testFile({ owner: you, accessSummary: { everyone: false, people: [you] }, ...overrides });
}

describe("caps", () => {
  it("lets the owner rename, share and delete an active file", () => {
    expect(row().caps).toMatchObject({ open: true, rename: true, share: true, delete: true, restore: false, adminOver: false });
  });

  it("shows a viewer a file they cannot change", () => {
    expect(row({ access: "viewer" }).caps).toMatchObject({ open: true, rename: false, share: false, delete: false });
  });

  it("lets an Admin manage a workspace-shared file they do not own", () => {
    expect(row({ access: "viewer", adminCanManage: true }).caps).toMatchObject({ rename: true, share: true, delete: true, adminOver: true });
  });

  it("only offers restore and delete forever on a trashed file, and only to its owner", () => {
    expect(row({ life: "trashed" }).caps).toMatchObject({ rename: false, share: false, delete: false, restore: true, deleteForever: true });
    expect(row({ life: "trashed", access: "viewer" }).caps).toMatchObject({ restore: false, deleteForever: false, open: false });
    // The server's Trash actions are owner-only, admins included.
    expect(row({ life: "trashed", access: "viewer", adminCanManage: true }).caps).toMatchObject({ restore: false, deleteForever: false, open: false });
  });
});

describe("labels and names", () => {
  it("labels the access level", () => {
    expect(row().accessLabel).toBe("Owner");
    expect(row({ access: "viewer" }).accessLabel).toBe("Viewer");
    expect(row({ access: "viewer", adminCanManage: true }).accessLabel).toBe("Admin, can manage");
  });

  it("says You for the viewer and sanitises other names", () => {
    expect(personName(you, "u1")).toBe("You");
    expect(personName(maya, "u1")).toBe("Maya Rios");
    expect(personName({ id: "x", name: "   " }, "u1")).toBe("Someone");
  });
});

describe("access tooltip and avatars", () => {
  it("describes a private file", () => {
    expect(row().accessTip("u1")).toBe("Only you");
    expect(row({ owner: maya, accessSummary: { everyone: false, people: [maya] } }).accessTip("u1")).toBe("Only Maya Rios");
  });

  it("lists who a file is shared with", () => {
    const shared = row({ accessSummary: { everyone: false, people: [you, maya, sam] } });
    expect(shared.accessTip("u1")).toBe("Owner: You. Shared with Maya Rios and Sam Okafor");
  });

  it("describes a workspace share", () => {
    expect(row({ accessSummary: { everyone: true, people: [you] } }).accessTip("u1")).toBe("Owner: You. Shared with the whole workspace");
  });

  it("shows the owner alone, two people as two avatars, and three or more as the owner and a count", () => {
    expect(row().accessAvatars).toEqual({ shown: [you], extra: 0, everyone: false });
    expect(row({ accessSummary: { everyone: false, people: [maya, you] } }).accessAvatars).toEqual({ shown: [you, maya], extra: 0, everyone: false });
    expect(row({ accessSummary: { everyone: false, people: [maya, you, sam] } }).accessAvatars).toEqual({ shown: [you], extra: 2, everyone: false });
  });

  it("shows only the building for a workspace share", () => {
    expect(row({ accessSummary: { everyone: true, people: [you, maya] } }).accessAvatars).toEqual({ shown: [], extra: 0, everyone: true });
  });
});

describe("parsing", () => {
  it("turns every row the API sends into a LibraryFile, and patches keep the class", () => {
    const wire = { ...testFile({ id: "f9", title: "Notes", extension: "md", format: "text" }) };
    const parsed = fileRowSchema.parse(wire);
    expect(parsed).toBeInstanceOf(LibraryFile);
    expect(parsed.name).toBe("Notes.md");
    const renamed = parsed.with({ title: "Notes v2" });
    expect(renamed).toBeInstanceOf(LibraryFile);
    expect(renamed.name).toBe("Notes v2.md");
    expect(parsed.title).toBe("Notes");
  });

  it("rejects a row that breaks the contract", () => {
    expect(fileRowSchema.safeParse({ id: "f9" }).success).toBe(false);
  });
});


describe("Library processing", () => {
  it.each(["queued", "processing", "ocr"] as const)("keeps the original usable during %s", (processingPhase) => {
    const file = row({ processingPhase });
    expect(file.processingPending).toBe(true);
    expect(file.caps.open).toBe(true);
  });

  it("keeps a failed original usable and stops polling a settled attempt", () => {
    const file = row({ processingPhase: "failed", processingFailure: "unreadable" });
    expect(file.processingPending).toBe(false);
    expect(file.caps.open).toBe(true);
    expect(file.with({ processingPhase: "queued" }).processingPending).toBe(true);
    expect(row().processingPending).toBe(false);
  });

  it.each([
    ["pdf", "pdf", false], ["docx", "pdf", true], ["md", "text", true],
    ["xlsx", "sheet", false], ["png", "image", false],
  ] as const)("only waits for processing when the %s preview needs derivatives", (extension, previewKind, expected) => {
    const file = new LibraryFileDetail({
      ...row({ extension }), phase: "ready", scope: "private", mimeType: "application/octet-stream",
      updatedAt: "2026-10-01T00:00:00.000Z", ways: [], previewKind,
      provenance: { kind: "upload", label: "Upload", via: "web", isTestRun: false },
    });
    expect(file.requiresProcessedPreview).toBe(expected);
  });
});
