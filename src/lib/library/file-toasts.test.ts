import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { addedGrantIds, cachedFileName, countTrashRows, findRowIn } from "./file-toasts";
import { libraryKeys } from "./keys";
import { FILE_MESSAGES } from "./messages";
import type { AccessList } from "./schemas";

const ORG = "org1";
const row = (id: string, title: string, extension = "pdf") => ({ id, title, extension });

describe("file toasts", () => {
  it("finds a row inside paged, suggested and detail data", () => {
    expect(findRowIn({ pages: [{ items: [row("a", "Alpha")] }] }, "a")?.title).toBe("Alpha");
    expect(findRowIn({ recent: [], generated: [row("b", "Beta")] }, "b")?.title).toBe("Beta");
    expect(findRowIn(row("c", "Gamma"), "c")?.title).toBe("Gamma");
    expect(findRowIn({ pages: [] }, "z")).toBeUndefined();
  });

  it("names a file from the cache, or the caller, or falls back", () => {
    const client = new QueryClient();
    client.setQueryData(libraryKeys.trash(ORG), { pages: [{ items: [row("a", "Return policy"), row("b", "Notes", "")] }], pageParams: [null] });
    expect(cachedFileName(client, ORG, "a")).toBe("Return policy.pdf");
    expect(cachedFileName(client, ORG, "b")).toBe("Notes");
    expect(cachedFileName(client, ORG, "a", "Given.pdf")).toBe("Given.pdf");
    expect(cachedFileName(client, ORG, "missing")).toBe("File");
    expect(countTrashRows(client, ORG)).toBe(2);
  });

  it("lists only the grants a share added", () => {
    const before: AccessList = { canManage: true, entries: [{ grantId: "o", kind: "owner", via: "owner" }, { grantId: "g1", kind: "user", via: "direct" }] };
    const after: AccessList = { ...before, entries: [...before.entries, { grantId: "g2", kind: "workspace", via: "workspace" }] };
    expect(addedGrantIds(before, after)).toEqual(["g2"]);
    expect(addedGrantIds(undefined, after)).toEqual(["g1", "g2"]);
  });

  it("uses the prototype wording", () => {
    expect(FILE_MESSAGES.movedToTrash("Notes.pdf")).toBe("Notes.pdf moved to Trash");
    expect(FILE_MESSAGES.filesDeletedForever(1)).toBe("1 file deleted forever");
    expect(FILE_MESSAGES.filesDeletedForever(3)).toBe("3 files deleted forever");
    expect(FILE_MESSAGES.sharedWith(["Maya", "everyone"])).toBe("Shared with Maya, everyone");
    expect(FILE_MESSAGES.removed("Workspace")).toBe("Workspace removed");
    expect(FILE_MESSAGES.freesUp("2 MB")).toBe("This frees up 2 MB and can't be undone.");
  });
});
