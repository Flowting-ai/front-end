import { describe, expect, it } from "vitest";
import { accessAvatars, accessLabel, accessTip, capsOf, personName } from "./access";
import type { LibraryFileRow, Person } from "./schemas";

const you: Person = { id: "u1", name: "Avery Stone" };
const maya: Person = { id: "u2", name: "Maya Rios" };
const sam: Person = { id: "u3", name: "Sam Okafor" };

function row(overrides: Partial<LibraryFileRow> = {}): LibraryFileRow {
  return {
    id: "f1",
    title: "Return policy",
    extension: "pdf",
    format: "pdf",
    source: "uploaded",
    owner: you,
    access: "owner",
    adminCanManage: false,
    accessSummary: { everyone: false, people: [you] },
    sizeBytes: 1000,
    createdAt: "2026-10-01T00:00:00.000Z",
    lastActivityAt: "2026-10-01T00:00:00.000Z",
    lastActivityKind: "created",
    unread: false,
    life: "active",
    titleIsAiGenerated: false,
    ...overrides,
  };
}

describe("capsOf", () => {
  it("lets the owner rename, share and delete an active file", () => {
    expect(capsOf(row())).toMatchObject({ open: true, rename: true, share: true, delete: true, restore: false, adminOver: false });
  });

  it("shows a viewer a file they cannot change", () => {
    expect(capsOf(row({ access: "viewer" }))).toMatchObject({ open: true, rename: false, share: false, delete: false });
  });

  it("lets an Admin manage a workspace-shared file they do not own", () => {
    expect(capsOf(row({ access: "viewer", adminCanManage: true }))).toMatchObject({ rename: true, share: true, delete: true, adminOver: true });
  });

  it("only offers restore and delete forever on a trashed file, and only to someone who manages it", () => {
    expect(capsOf(row({ life: "trashed" }))).toMatchObject({ rename: false, share: false, delete: false, restore: true, deleteForever: true });
    expect(capsOf(row({ life: "trashed", access: "viewer" }))).toMatchObject({ restore: false, deleteForever: false, open: false });
  });
});

describe("labels and names", () => {
  it("labels the access level", () => {
    expect(accessLabel(row())).toBe("Owner");
    expect(accessLabel(row({ access: "viewer" }))).toBe("Viewer");
    expect(accessLabel(row({ access: "viewer", adminCanManage: true }))).toBe("Admin, can manage");
  });

  it("says You for the viewer and sanitises other names", () => {
    expect(personName(you, "u1")).toBe("You");
    expect(personName(maya, "u1")).toBe("Maya Rios");
    expect(personName({ id: "x", name: "   " }, "u1")).toBe("Someone");
  });
});

describe("access tooltip and avatars", () => {
  it("describes a private file", () => {
    expect(accessTip(row(), "u1")).toBe("Only you");
    expect(accessTip(row({ owner: maya, accessSummary: { everyone: false, people: [maya] } }), "u1")).toBe("Only Maya Rios");
  });

  it("lists who a file is shared with", () => {
    const shared = row({ accessSummary: { everyone: false, people: [you, maya, sam] } });
    expect(accessTip(shared, "u1")).toBe("Owner: You. Shared with Maya Rios and Sam Okafor");
  });

  it("describes a workspace share", () => {
    expect(accessTip(row({ accessSummary: { everyone: true, people: [you] } }), "u1")).toBe("Owner: You. Shared with the whole workspace");
  });

  it("shows the owner alone, two people as two avatars, and three or more as the owner and a count", () => {
    expect(accessAvatars(row())).toEqual({ shown: [you], extra: 0, everyone: false });
    expect(accessAvatars(row({ accessSummary: { everyone: false, people: [maya, you] } }))).toEqual({ shown: [you, maya], extra: 0, everyone: false });
    expect(accessAvatars(row({ accessSummary: { everyone: false, people: [maya, you, sam] } }))).toEqual({ shown: [you], extra: 2, everyone: false });
  });

  it("shows only the building for a workspace share", () => {
    expect(accessAvatars(row({ accessSummary: { everyone: true, people: [you, maya] } }))).toEqual({ shown: [], extra: 0, everyone: true });
  });
});
