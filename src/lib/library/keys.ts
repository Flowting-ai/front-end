// One key factory for every Library query. Every key starts with the active workspace id, so a
// workspace switch can never show the previous workspace's rows, and a prefix invalidation
// (`libraryKeys.all(org)`) reaches everything Library owns. Inputs the query function reads are
// part of the key (params, ids), never held in a closure.

import type { ListParams } from "./query-params";
import type { FormatGroup, PreviewRequest } from "./schemas";

export type PickerParams = { q: string; types: FormatGroup[]; generatedOnly: boolean };

export const libraryKeys = {
  all: (org: string) => ["library", org] as const,
  lists: (org: string) => [...libraryKeys.all(org), "list"] as const,
  list: (org: string, params: ListParams) => [...libraryKeys.lists(org), params] as const,
  suggested: (org: string) => [...libraryKeys.all(org), "suggested"] as const,
  hasShared: (org: string) => [...libraryKeys.all(org), "has-shared"] as const,
  detail: (org: string, id: string) => [...libraryKeys.all(org), "file", id] as const,
  preview: (org: string, id: string, request: PreviewRequest) => [...libraryKeys.detail(org, id), "preview", request] as const,
  usage: (org: string, id: string) => [...libraryKeys.detail(org, id), "usage"] as const,
  access: (org: string, id: string) => [...libraryKeys.detail(org, id), "access"] as const,
  trash: (org: string) => [...libraryKeys.all(org), "trash"] as const,
  storage: (org: string) => [...libraryKeys.all(org), "storage"] as const,
  picker: (org: string, params: PickerParams) => [...libraryKeys.all(org), "picker", params] as const,
  people: (org: string, query: string) => [...libraryKeys.all(org), "people", query] as const,
  uploads: (org: string) => [...libraryKeys.all(org), "uploads"] as const,
  prefs: (org: string) => [...libraryKeys.all(org), "prefs"] as const,
  orgSettings: (org: string) => [...libraryKeys.all(org), "org-settings"] as const,
  members: (org: string) => [...libraryKeys.all(org), "members"] as const,
  myRemoval: (org: string) => [...libraryKeys.all(org), "my-removal"] as const,
  limits: (org: string) => [...libraryKeys.all(org), "limits"] as const,
  flags: (org: string) => [...libraryKeys.all(org), "flags"] as const,
};

/** A person with no workspace (an individual account) uses one fixed key. */
export function orgKeyOf(orgId: string | null | undefined): string {
  return orgId ? orgId : "personal";
}
