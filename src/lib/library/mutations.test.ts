import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PagedRows } from "./cache";
import { flattenPages } from "./cache";
import { libraryKeys } from "./keys";
import { DEFAULT_QUERY, toListParams } from "./query-params";
import type { AccessList, FileRowWire } from "./schemas";
import { testFile } from "./test-files";

const api = vi.hoisted(() => ({
  renameFile: vi.fn(),
  trashFile: vi.fn(),
  restoreFile: vi.fn(),
  addGrant: vi.fn(),
  revokeGrant: vi.fn(),
}));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));

vi.mock("./api", () => ({ libraryApi: api }));
vi.mock("sonner", () => ({ toast }));
vi.mock("./observability", () => ({ captureError: vi.fn() }));

import { renameFileOptions, revokeGrantOptions, shareFileOptions, trashFileOptions } from "./mutations";

const ORG = "org1";
const listKey = libraryKeys.list(ORG, toListParams(DEFAULT_QUERY));

function row(id: string, overrides: Partial<FileRowWire> = {}) {
  return testFile({ id, title: `File ${id}`, ...overrides });
}

function seeded() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const data: PagedRows = { pages: [{ items: [row("a"), row("b")], nextCursor: null }], pageParams: [null] };
  queryClient.setQueryData(listKey, data);
  return queryClient;
}

const titles = (queryClient: QueryClient) => flattenPages(queryClient.getQueryData<PagedRows>(listKey)).map((file) => file.title);
const ids = (queryClient: QueryClient) => flattenPages(queryClient.getQueryData<PagedRows>(listKey)).map((file) => file.id);

/** A promise the test settles by hand, to look at the cache while a request is in flight. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** Lets onMutate (which awaits cancelQueries) run before the test looks. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("rename", () => {
  it("shows the new name at once and keeps the server's row on success", async () => {
    const queryClient = seeded();
    const request = deferred<ReturnType<typeof row>>();
    api.renameFile.mockReturnValue(request.promise);
    const done = new MutationObserver(queryClient, renameFileOptions(queryClient, ORG))
      .mutate({ id: "a", title: " Policy ", previousTitle: "File a", previousAi: false });

    await flush();
    expect(titles(queryClient)).toEqual(["Policy", "File b"]);

    request.resolve(row("a", { title: "Policy v2" }));
    await done;
    expect(titles(queryClient)).toEqual(["Policy v2", "File b"]);
    expect(toast).toHaveBeenCalled();
  });

  it("puts the old name back and shows the error when the server refuses", async () => {
    const queryClient = seeded();
    api.renameFile.mockRejectedValue(new Error("nope"));
    await expect(
      new MutationObserver(queryClient, renameFileOptions(queryClient, ORG))
        .mutate({ id: "a", title: "Policy", previousTitle: "File a", previousAi: false }),
    ).rejects.toThrow("nope");
    expect(titles(queryClient)).toEqual(["File a", "File b"]);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});

describe("trash", () => {
  it("takes the row out at once and offers Restore on success", async () => {
    const queryClient = seeded();
    const request = deferred<{ daysLeft: number }>();
    api.trashFile.mockReturnValue(request.promise);
    const done = new MutationObserver(queryClient, trashFileOptions(queryClient, ORG)).mutate({ id: "a" });

    await flush();
    expect(ids(queryClient)).toEqual(["b"]);

    request.resolve({ daysLeft: 30 });
    await done;
    expect(toast).toHaveBeenCalledWith("File a.pdf moved to Trash", expect.objectContaining({ action: expect.objectContaining({ label: "Restore" }) }));
  });

  it("re-reads the lists and shows the error when the server refuses", async () => {
    const queryClient = seeded();
    api.trashFile.mockRejectedValue(new Error("nope"));
    await expect(new MutationObserver(queryClient, trashFileOptions(queryClient, ORG)).mutate({ id: "a" })).rejects.toThrow();
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});

const owner = { grantId: "g0", kind: "owner" as const, person: { id: "u1", name: "Avery" }, via: "owner" as const };
const maya = { grantId: "g1", kind: "user" as const, person: { id: "u2", name: "Maya" }, via: "direct" as const };

function withAccess(entries: AccessList["entries"]) {
  const queryClient = seeded();
  queryClient.setQueryData<AccessList>(libraryKeys.access(ORG, "a"), { entries, canManage: true });
  return queryClient;
}
const accessIds = (queryClient: QueryClient) =>
  queryClient.getQueryData<AccessList>(libraryKeys.access(ORG, "a"))?.entries.map((entry) => entry.grantId);

describe("share", () => {
  it("is not optimistic: access changes only when the server answers", async () => {
    const queryClient = withAccess([owner]);
    const request = deferred<AccessList>();
    api.addGrant.mockReturnValue(request.promise);
    const done = new MutationObserver(queryClient, shareFileOptions(queryClient, ORG))
      .mutate({ id: "a", targets: [{ target: { kind: "user", personId: "u2" }, label: "Maya" }] });

    await flush();
    expect(accessIds(queryClient)).toEqual(["g0"]);

    request.resolve({ entries: [owner, maya], canManage: true });
    await done;
    expect(accessIds(queryClient)).toEqual(["g0", "g1"]);
    expect(toast).toHaveBeenCalledWith("Shared with Maya", expect.anything());
  });

  it("adds one grant per person, in order", async () => {
    const queryClient = withAccess([owner]);
    api.addGrant.mockResolvedValue({ entries: [owner, maya], canManage: true });
    await new MutationObserver(queryClient, shareFileOptions(queryClient, ORG)).mutate({
      id: "a",
      targets: [
        { target: { kind: "user", personId: "u2" }, label: "Maya" },
        { target: { kind: "workspace" }, label: "everyone" },
      ],
    });
    expect(api.addGrant.mock.calls).toEqual([["a", { kind: "user", personId: "u2" }], ["a", { kind: "workspace" }]]);
  });

  it("re-reads access and shows the error when a grant fails", async () => {
    const queryClient = withAccess([owner]);
    api.addGrant.mockRejectedValue(new Error("nope"));
    await expect(
      new MutationObserver(queryClient, shareFileOptions(queryClient, ORG))
        .mutate({ id: "a", targets: [{ target: { kind: "user", personId: "u2" }, label: "Maya" }] }),
    ).rejects.toThrow();
    expect(accessIds(queryClient)).toEqual(["g0"]);
    expect(queryClient.getQueryState(libraryKeys.access(ORG, "a"))?.isInvalidated).toBe(true);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});

describe("revoke", () => {
  it("removes the person at once and puts them back if the server refuses", async () => {
    const queryClient = withAccess([owner, maya]);
    const request = deferred<AccessList>();
    api.revokeGrant.mockReturnValue(request.promise);
    const done = new MutationObserver(queryClient, revokeGrantOptions(queryClient, ORG)).mutate({ id: "a", grantId: "g1", label: "Maya" });

    await flush();
    expect(accessIds(queryClient)).toEqual(["g0"]);

    request.reject(new Error("nope"));
    await expect(done).rejects.toThrow();
    expect(accessIds(queryClient)).toEqual(["g0", "g1"]);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});
