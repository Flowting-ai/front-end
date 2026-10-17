import { describe, expect, it } from "vitest";
import {
  applySourceEvents,
  askSaveTitle,
  attachmentRowText,
  buildSourceRows,
  citationHref,
  citationLabel,
  citedFileIds,
  deleteChatToast,
  runKindLabel,
  saveOutcome,
  savedFilesLine,
  sentFileView,
  sourcesCount,
  toggleSourceOff,
  unavailableNote,
  type FileRef,
} from "./sources";

const open = (id: string, title: string, extra: Partial<Extract<FileRef, { state: "open" }>> = {}): FileRef => ({ id, state: "open", title, format: "pdf", ...extra });

describe("citations", () => {
  it("links to the File page with the locator", () => {
    expect(citationHref("f_a")).toBe("/library/files/f_a");
    expect(citationHref("f_a", { type: "row", value: "Rates!14" })).toBe("/library/files/f_a?cite=row%3ARates%2114");
    expect(citationHref("f_a", { type: "time", value: "42000" })).toBe("/library/files/f_a?cite=time%3A42000");
    expect(citationHref("f_a", { type: "page", value: "2", passage: "net 30 days" })).toBe("/library/files/f_a?cite=page%3A2&passage=net+30+days");
  });

  it("shows the name only, with a time for audio, and never a title for locked or deleted", () => {
    expect(citationLabel(open("a", "Return policy 2026"), { type: "page", value: "2" })).toBe("Return policy 2026");
    expect(citationLabel(open("a", "Supplier call - Acme", { format: "audio" }), { type: "time", value: "42000" })).toBe("Supplier call - Acme, 0:42");
    expect(citationLabel({ id: "a", state: "locked" })).toBe("Locked file");
    expect(citationLabel({ id: "a", state: "deleted" })).toBe("File deleted");
  });

  it("applies source events without touching other files", () => {
    const refs = { a: open("a", "A"), b: open("b", "B") };
    const next = applySourceEvents(refs, [{ fileId: "a", state: "removed" }, { fileId: "c", state: "locked" }]);
    expect(next.a).toEqual({ id: "a", state: "deleted" });
    expect(next.b).toBe(refs.b);
    expect(next.c).toEqual({ id: "c", state: "locked" });
    expect(applySourceEvents(refs, [])).toBe(refs);
  });

  it("lists cited files once, in order", () => {
    expect(citedFileIds([{ fileId: "b" }, { fileId: "a" }, { fileId: "b" }])).toEqual(["b", "a"]);
  });
});

describe("sources panel", () => {
  const refs: Record<string, FileRef> = {
    cited: open("cited", "Return policy 2026"),
    att: open("att", "Shipping rates"),
    found: open("found", "Brand guidelines"),
    proc: open("proc", "Catalog", { phase: "processing" }),
    lock: { id: "lock", state: "locked" },
    gone: { id: "gone", state: "deleted" },
  };

  it("marks each file the way the prototype does", () => {
    const rows = buildSourceRows({
      scopeIds: ["att", "found", "proc", "lock", "gone"],
      citedIds: ["cited", "att"],
      attachedIds: ["att"],
      offIds: ["found"],
      refs,
    });
    expect(rows.map((row) => row.id)).toEqual(["att", "found", "proc", "lock", "gone", "cited"]);
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    expect(byId.att.detail).toBe("Cited in answer");
    expect(byId.cited.status).toBe("cited");
    expect(byId.found).toMatchObject({ off: true, detail: "Off for this chat", canToggle: true });
    expect(byId.proc.detail).toBe("Processing");
    expect(byId.lock).toMatchObject({ name: "Locked file", detail: "You can't open this file", canToggle: false });
    expect(byId.gone).toMatchObject({ name: "File deleted", detail: "Deleted", canToggle: false });
  });

  it("treats an unknown file as deleted and only an open file can be off", () => {
    const rows = buildSourceRows({ scopeIds: ["x", "lock"], citedIds: [], attachedIds: [], offIds: ["x", "lock"], refs });
    expect(rows[0]).toMatchObject({ status: "deleted", off: false });
    expect(rows[1]).toMatchObject({ status: "locked", off: false });
  });

  it("tells two files with the same name apart by when they were added", () => {
    const now = Date.parse("2026-10-13T12:00:00Z");
    const rows = buildSourceRows({
      scopeIds: ["a", "b"],
      citedIds: [],
      attachedIds: [],
      offIds: [],
      refs: { a: open("a", "Notes", { createdAt: "2026-10-13T09:05:00Z" }), b: open("b", "Notes", { createdAt: "2026-10-12T09:05:00Z" }) },
      now,
      timeZone: "UTC",
    });
    expect(rows[0].detail).toBe("Found in Library · Today, 9:05 AM");
    expect(rows[1].detail).toBe("Found in Library · Yesterday, 9:05 AM");
  });

  it("counts and toggles", () => {
    expect(sourcesCount(["a", "b"], ["b", "c"])).toBe(3);
    expect(toggleSourceOff([], "a")).toEqual(["a"]);
    expect(toggleSourceOff(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("sent files, saving, delete chat", () => {
  it("shows sent files as open, deleted or locked", () => {
    expect(sentFileView(open("a", "A"))).toEqual({ kind: "open", label: "A", status: null });
    expect(sentFileView(open("a", "A", { phase: "uploading" }))).toMatchObject({ status: "Uploading" });
    expect(sentFileView(undefined)).toEqual({ kind: "deleted", label: "File deleted" });
    expect(sentFileView({ id: "a", state: "locked" })).toEqual({ kind: "locked", label: "Locked file" });
  });

  it("titles the save prompt", () => {
    expect(askSaveTitle(1)).toBe("Save 1 file to Library?");
    expect(askSaveTitle(3)).toBe("Save 3 files to Library?");
  });

  it("decides what a send does with staged files", () => {
    expect(saveOutcome({ mode: "always", forcedOff: false, dontSaveChat: false })).toEqual({ action: "save", message: null });
    expect(saveOutcome({ mode: "ask", forcedOff: false, dontSaveChat: false })).toEqual({ action: "ask", message: null });
    expect(saveOutcome({ mode: "never", forcedOff: false, dontSaveChat: false }).message).toBe("Not saved. Auto-save is Never.");
    expect(saveOutcome({ mode: "always", forcedOff: true, dontSaveChat: false }).message).toBe("Your Admin has turned auto-save off");
    expect(saveOutcome({ mode: "always", forcedOff: true, dontSaveChat: true }).message).toBe("Not saved. This chat doesn't save files.");
  });

  it("words the delete chat dialog and toast", () => {
    expect(savedFilesLine(1)).toBe("1 saved file stays in Library.");
    expect(savedFilesLine(2)).toBe("2 saved files stay in Library.");
    expect(deleteChatToast(0, true)).toBe("Chat deleted");
    expect(deleteChatToast(2, true)).toBe("Chat deleted. 2 files in Trash.");
    expect(deleteChatToast(1, false)).toBe("Chat deleted. 1 file stays in Library.");
  });
});

describe("routines", () => {
  it("names unavailable files and says the next run skips them", () => {
    expect(unavailableNote([{ id: "a", state: "ok", title: "A" }])).toBeNull();
    expect(unavailableNote([{ id: "a", state: "trashed", title: "Return policy 2026" }])).toBe("Return policy 2026 is unavailable. The next run skips it.");
    expect(unavailableNote([{ id: "a", state: "deleted" }, { id: "b", state: "locked", title: "B" }])).toBe("A deleted file, B are unavailable. The next run skips them.");
  });

  it("words attached rows", () => {
    const name = () => "PDF";
    expect(attachmentRowText({ id: "a", state: "ok", title: "A", format: "pdf" }, name)).toEqual({ name: "A", detail: "PDF" });
    expect(attachmentRowText({ id: "a", state: "trashed", title: "A" }, name)).toEqual({ name: "A (in Trash)", detail: "Next run skips it" });
    expect(attachmentRowText({ id: "a", state: "deleted" }, name)).toEqual({ name: "A deleted file", detail: "Next run skips it" });
  });

  it("labels runs", () => {
    expect(runKindLabel("fail")).toBe("Failed");
    expect(runKindLabel("output")).toBe("Saved a Run output");
    expect(runKindLabel("message")).toBe("Message sent");
    expect(runKindLabel("test")).toBe("Test run");
  });
});
