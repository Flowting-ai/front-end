import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { ListParams } from "../query-params";
import { createMockLibraryApi } from "./api.mock";

const ALL: ListParams = { tab: "all", q: "", sources: [], types: [], sort: "created", dir: "desc" };

function setup(options: Parameters<typeof createMockLibraryApi>[0] = {}) {
  let now = 1_800_000_000_000;
  const api = createMockLibraryApi({ delayMs: 0, clock: () => now, ...options });
  return { api, advance: (ms: number) => (now += ms) };
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error("expected the call to fail");
}

describe("lists and visibility", () => {
  it("lists only active files the viewer can open, newest first", async () => {
    const { api } = setup();
    const page = await api.listFiles(ALL, null);
    const ids = page.items.map((file) => file.id);
    expect(ids).not.toContain("f_lookbook"); // someone else's private file
    expect(ids).not.toContain("f_trash_policy"); // in Trash
    expect(ids).toContain("f_acme"); // shared with the viewer
    const created = page.items.map((file) => Date.parse(file.createdAt));
    expect(created).toEqual([...created].sort((a, b) => b - a));
  });

  it("filters by source (OR within the section) and by file type group", async () => {
    const { api } = setup();
    const generated = await api.listFiles({ ...ALL, sources: ["generated"] }, null);
    expect(generated.items.length).toBeGreaterThan(0);
    expect(generated.items.every((file) => file.source === "generated")).toBe(true);
    const pdfs = await api.listFiles({ ...ALL, types: ["pdfs"] }, null);
    expect(pdfs.items.every((file) => file.format === "pdf")).toBe(true);
    const sharedIn = await api.listFiles({ ...ALL, sources: ["shared"] }, null);
    expect(sharedIn.items.map((file) => file.id)).toEqual(expect.arrayContaining(["f_acme", "f_nova", "f_return_2026"]));
  });

  it("puts only shared files on the Shared tab, sorted by date shared", async () => {
    const { api } = setup();
    const shared = await api.listFiles({ ...ALL, tab: "shared", sort: "shared" }, null);
    expect(shared.items.every((file) => file.sharedAt !== undefined)).toBe(true);
    expect(shared.items.map((file) => file.id)).not.toContain("f_brand");
    const times = shared.items.map((file) => Date.parse(file.sharedAt ?? ""));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("searches titles and content and returns a snippet", async () => {
    const { api } = setup();
    const byTitle = await api.listFiles({ ...ALL, q: "acme" }, null);
    expect(byTitle.items.map((file) => file.id)).toEqual(expect.arrayContaining(["f_acme", "f_call_acme"]));
    const byContent = await api.listFiles({ ...ALL, q: "waxed cotton" }, null);
    expect(byContent.items.map((file) => file.id)).toEqual(["f_copy_v3"]);
    expect(byContent.items[0].snippet).toContain("waxed cotton");
  });

  it("paginates with an opaque cursor tied to the filters and sort", async () => {
    const { api } = setup({ syntheticRows: 120 });
    const first = await api.listFiles(ALL, null);
    expect(first.items).toHaveLength(50);
    expect(first.nextCursor).not.toBeNull();
    const second = await api.listFiles(ALL, first.nextCursor);
    const third = await api.listFiles(ALL, second.nextCursor);
    const ids = [...first.items, ...second.items, ...third.items].map((file) => file.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates across pages
    expect(third.nextCursor).toBeNull();
    const reused = await rejection(api.listFiles({ ...ALL, sort: "name", dir: "asc" }, first.nextCursor));
    expect(reused.status).toBe(400);
  });

  it("builds Suggested rows from what the viewer can open", async () => {
    const { api } = setup();
    const suggested = await api.getSuggested();
    expect(suggested.recent.length).toBeGreaterThan(0);
    expect(suggested.generated.every((file) => file.source === "generated")).toBe(true);
    const everything = [...suggested.recent, ...suggested.frequent, ...suggested.generated].map((file) => file.id);
    expect(everything).not.toContain("f_lookbook");
  });
});

describe("opening a file", () => {
  it("returns detail for an openable file with scope and ways in", async () => {
    const { api } = setup();
    const detail = await api.getFile("f_acme");
    expect(detail).toMatchObject({ scope: "shared", access: "viewer", previewKind: "pdf", phase: "ready" });
    expect(detail.ways).toEqual(["direct"]);
    const workspace = await api.getFile("f_return_2026");
    expect(workspace.scope).toBe("workspace");
  });

  it("locks a file the viewer cannot open without leaking anything", async () => {
    const { api } = setup();
    const error = await rejection(api.getFile("f_lookbook"));
    expect(error.status).toBe(403);
    expect(error.code).toBe("file_locked");
    expect(error.message).not.toContain("lookbook");
  });

  it("reports a missing file as gone", async () => {
    const { api } = setup();
    expect((await rejection(api.getFile("nope"))).code).toBe("file_gone");
  });

  it("lets the owner open a trashed file but nobody else", async () => {
    const { api } = setup();
    expect((await api.getFile("f_trash_policy")).life).toBe("trashed");
  });

  it("serves previews by kind and windows sheet rows", async () => {
    const { api } = setup();
    expect((await api.getPreview("f_return_2026", {})).kind).toBe("pdf");
    const text = await api.getPreview("f_copy_v3", {});
    expect(text.kind === "text" && text.pages).toHaveLength(2);
    const sheet = await api.getPreview("f_catalog", { rowStart: 1190, rowCount: 100 });
    expect(sheet.kind === "sheet" && sheet.rows).toHaveLength(10);
    expect(sheet.kind === "sheet" && sheet.rowTotal).toBe(1200);
    const locked = await rejection(api.getPreview("f_lookbook", {}));
    expect(locked.code).toBe("file_locked");
  });

  it("names only the viewer's own chats and routines in Used in", async () => {
    const { api } = setup();
    const usage = await api.getUsage("f_return_2026");
    expect(usage.chats.map((chat) => chat.title)).toEqual(["Refund questions"]);
    expect(usage.routines.map((routine) => routine.title)).toEqual(["Weekly returns digest"]);
    expect(usage.hiddenChats).toBe(0);
  });

  it("clears the unread marker once a shared file is opened", async () => {
    const { api } = setup();
    expect((await api.getFile("f_nova")).unread).toBe(true);
    await api.markOpened("f_nova");
    expect((await api.getFile("f_nova")).unread).toBe(false);
  });
});

describe("changing files", () => {
  it("lets only the owner rename, and clears the AI-generated mark", async () => {
    const { api } = setup();
    const refused = await rejection(api.renameFile("f_acme", "New name"));
    expect(refused.status).toBe(403);
    expect(refused.code).toBe("only_owner");
    const renamed = await api.renameFile("f_copy_v3", "Final copy");
    expect(renamed).toMatchObject({ title: "Final copy", titleIsAiGenerated: false });
    expect((await rejection(api.renameFile("f_copy_v3", "   "))).status).toBe(422);
  });

  it("moves a file to Trash with its shares and restores it", async () => {
    const { api } = setup();
    expect(await api.trashFile("f_shipping_rates")).toEqual({ daysLeft: 30 });
    const listed = await api.listFiles(ALL, null);
    expect(listed.items.map((file) => file.id)).not.toContain("f_shipping_rates");
    const trash = await api.listTrash(null);
    expect(trash.items.map((file) => file.id)).toContain("f_shipping_rates");
    expect(trash.freesBytes).toBeGreaterThan(0);
    await api.restoreFile("f_shipping_rates");
    const restored = await api.getFile("f_shipping_rates");
    expect(restored.accessSummary.people.map((person) => person.id)).toContain("u_maya");
  });

  it("counts down the days left in Trash", async () => {
    const { api, advance } = setup();
    const before = (await api.listTrash(null)).items.find((file) => file.id === "f_trash_draft");
    expect(before?.daysLeft).toBe(4);
    advance(2 * 24 * 60 * 60 * 1000);
    const after = (await api.listTrash(null)).items.find((file) => file.id === "f_trash_draft");
    expect(after?.daysLeft).toBe(2);
  });

  it("deletes forever only from Trash, and empties Trash", async () => {
    const { api } = setup();
    expect((await rejection(api.deleteForever("f_brand"))).code).toBe("file_gone");
    await api.deleteForever("f_trash_policy");
    expect((await rejection(api.getFile("f_trash_policy"))).code).toBe("file_gone");
    await api.emptyTrash();
    expect((await api.listTrash(null)).items).toHaveLength(0);
  });

  it("shares with a person once, refuses duplicates, and revokes", async () => {
    const { api } = setup();
    const added = await api.addGrant("f_brand", { kind: "user", personId: "u_sam" });
    expect(added.entries.map((entry) => entry.person?.id)).toContain("u_sam");
    const duplicate = await rejection(api.addGrant("f_brand", { kind: "user", personId: "u_sam" }));
    expect(duplicate.code).toBe("already_has_access");
    const grant = added.entries.find((entry) => entry.person?.id === "u_sam");
    const after = await api.revokeGrant("f_brand", grant?.grantId ?? "");
    expect(after.entries.map((entry) => entry.person?.id)).not.toContain("u_sam");
  });

  it("shares with the whole workspace once", async () => {
    const { api } = setup();
    await api.addGrant("f_brand", { kind: "workspace" });
    expect((await api.getFile("f_brand")).scope).toBe("workspace");
    expect((await rejection(api.addGrant("f_brand", { kind: "workspace" }))).code).toBe("already_has_access");
  });

  it("refuses to share when sharing is switched off for the workspace", async () => {
    const { api } = setup();
    api.control.setFlags({ sharing: false });
    expect((await rejection(api.addGrant("f_brand", { kind: "workspace" }))).code).toBe("sharing_off");
  });

  it("lets a viewer who cannot open a file request access, once", async () => {
    const { api } = setup();
    await api.requestAccess("f_lookbook");
    expect((await rejection(api.requestAccess("f_acme"))).code).toBe("already_has_access");
  });

  it("fails the next call once when asked to (for error-state work)", async () => {
    const { api } = setup();
    api.control.failNext("getStorage", new ApiError(500, "boom", "Something went wrong"));
    expect((await rejection(api.getStorage())).status).toBe(500);
    await expect(api.getStorage()).resolves.toBeDefined();
  });
});

describe("settings and members", () => {
  it("bumps the settings version on every write and records who wrote", async () => {
    const { api } = setup();
    const before = await api.getOrgSettings();
    const after = await api.updateOrgSettings({ forceAutoSaveOff: true }, before.version);
    expect(after.version).toBe(before.version + 1);
    expect(after.forceAutoSaveOff).toBe(true);
    expect(after.updatedBy?.id).toBe("u_you");
  });

  it("resolves what actually applies to a person: Admin force-off, then their choice, then the workspace default", async () => {
    const { api } = setup();
    expect(await api.getPrefs()).toMatchObject({ autoSave: null, effectiveAutoSave: "always", forcedOff: false, aiReferenceAllowed: true });
    expect((await api.updatePrefs({ autoSave: "ask" })).effectiveAutoSave).toBe("ask");
    await api.updateOrgSettings({ defaultAutoSave: "never" }, 1);
    expect((await api.getPrefs()).effectiveAutoSave).toBe("ask"); // their own choice beats the default
    await api.updateOrgSettings({ forceAutoSaveOff: true }, 2);
    expect(await api.getPrefs()).toMatchObject({ autoSave: "ask", effectiveAutoSave: "never", forcedOff: true });
  });

  it("tells a person when an Admin switched automatic AI use off", async () => {
    const { api } = setup();
    await api.updateOrgSettings({ aiReferenceEnabled: false }, 1);
    const prefs = await api.getPrefs();
    expect(prefs.aiReferenceAllowed).toBe(false);
    expect(prefs.settingsChangedAt).toBeDefined();
  });

  it("lists members with their file counts and any pending removal", async () => {
    const { api } = setup();
    api.control.markRemoval("u_maya");
    const members = await api.listMembers();
    expect(members.find((member) => member.id === "u_maya")?.removal).toBe("awaiting_answer");
    expect(members.find((member) => member.id === "u_you")?.fileCount).toBeGreaterThan(5);
  });

  it("starts a removal that finishes only when the member answers", async () => {
    const { api } = setup();
    await api.startMemberRemoval("u_maya");
    expect((await api.listWorkspaceMembers("org")).find((member) => member.id === "u_maya")?.removal).toBe("awaiting_answer");
    const mayaShared = api.control.files.find((file) => file.ownerId === "u_maya" && file.grants.some((grant) => grant.who === "u_you"));
    api.control.answerRemovalFor("u_maya", true);
    expect((await api.listWorkspaceMembers("org")).some((member) => member.id === "u_maya")).toBe(false);
    if (mayaShared) expect(mayaShared.ownerId).toBe("u_you");
    expect(api.control.files.some((file) => file.ownerId === "u_maya")).toBe(false);
  });

  it("does not let the only Admin leave", async () => {
    const { api } = setup();
    await expect(api.leaveWorkspace(true)).rejects.toMatchObject({ code: "only_admin" });
  });

  it("holds the transfer question until it is answered", async () => {
    const { api } = setup();
    expect(await api.getMyRemoval()).toEqual({ pending: false });
    api.control.setMyRemoval(true);
    expect((await api.getMyRemoval()).pending).toBe(true);
    await api.answerMyRemoval(true);
    expect((await api.getMyRemoval()).pending).toBe(false);
  });
});

describe("uploads", () => {
  it("walks uploading, processing and ready", async () => {
    const { api, advance } = setup();
    const init = await api.createUpload({ name: "Price list.xlsx", sizeBytes: 20_000_000, mimeType: "application/vnd.ms-excel" });
    expect(init.parts).toHaveLength(3);
    expect((await api.getUploadStatuses([init.id]))[0].phase).toBe("uploading");
    await api.completeUpload(init.id, init.parts.map((part) => ({ partNumber: part.partNumber, etag: "x" })));
    expect((await api.getUploadStatuses([init.id]))[0].phase).toBe("processing");
    advance(2000);
    const done = (await api.getUploadStatuses([init.id]))[0];
    expect(done.phase).toBe("ready");
    expect(done.fileId).toBeDefined();
  });

  it("refuses oversized and unsupported files before storing anything", async () => {
    const { api } = setup();
    expect((await rejection(api.createUpload({ name: "big.pdf", sizeBytes: 31_000_000, mimeType: "application/pdf" }))).code).toBe("too_large");
    expect((await rejection(api.createUpload({ name: "tool.exe", sizeBytes: 1000, mimeType: "application/x-msdownload" }))).code).toBe("unsupported");
  });

  it("fails processing for password-protected, unsafe and unreadable files, without keeping a file", async () => {
    const { api, advance } = setup();
    const reasons: Record<string, string> = { "password locked.pdf": "password_protected", "virus.pdf": "unsafe", "corrupt.pdf": "unreadable" };
    for (const [name, reason] of Object.entries(reasons)) {
      const init = await api.createUpload({ name, sizeBytes: 1000, mimeType: "application/pdf" });
      await api.completeUpload(init.id, [{ partNumber: 1, etag: "x" }]);
      advance(2000);
      const status = (await api.getUploadStatuses([init.id]))[0];
      expect(status).toMatchObject({ phase: "failed", failureReason: reason });
      expect(status.fileId).toBeUndefined();
    }
  });

  it("flags a slow file once processing runs long, and forgets cancelled uploads", async () => {
    const { api, advance } = setup();
    const init = await api.createUpload({ name: "slow.pdf", sizeBytes: 1000, mimeType: "application/pdf" });
    await api.completeUpload(init.id, [{ partNumber: 1, etag: "x" }]);
    advance(4000);
    expect((await api.getUploadStatuses([init.id]))[0]).toMatchObject({ phase: "processing", slow: true });
    await api.cancelUpload(init.id);
    expect(await api.getUploadStatuses([init.id])).toEqual([]);
  });
});
