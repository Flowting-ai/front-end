// What a person may do with a file, derived from what the API says about their access. The server
// is the authority on every action (a hidden button is not security); these helpers only decide
// which controls to show, disable, or explain. Never derive a capability from a role alone.

import { sanitizeDisplayText } from "./format";
import type { LibraryFileRow, Person } from "./schemas";

type AccessFields = Pick<LibraryFileRow, "access" | "adminCanManage" | "life">;

export type Caps = {
  open: boolean;
  /** Rename, Share and Delete. Off for viewers (shown disabled with a tooltip) and for trashed files. */
  rename: boolean;
  share: boolean;
  delete: boolean;
  /** Restore and Delete forever on a trashed file. */
  restore: boolean;
  deleteForever: boolean;
  /** Admin acting over a workspace-shared file they do not own. */
  adminOver: boolean;
};

export function capsOf(file: AccessFields): Caps {
  const manages = file.access === "owner" || file.adminCanManage;
  const active = file.life === "active";
  return {
    open: active || file.access === "owner",
    rename: active && manages,
    share: active && manages,
    delete: active && manages,
    restore: !active && manages,
    deleteForever: !active && manages,
    adminOver: file.access !== "owner" && file.adminCanManage,
  };
}

export const ONLY_OWNER_TIP = "Only the owner can change this";

export function accessLabel(file: AccessFields): string {
  if (file.access === "owner") return "Owner";
  return file.adminCanManage ? "Admin, can manage" : "Viewer";
}

/** "You" for the viewer, the person's sanitised name otherwise. */
export function personName(person: Person, viewerId: string | undefined): string {
  if (viewerId !== undefined && person.id === viewerId) return "You";
  return sanitizeDisplayText(person.name) || "Someone";
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Tooltip for the Access column: "Only you", "Owner: You. Shared with Maya and Sam", "... the whole workspace". */
export function accessTip(file: Pick<LibraryFileRow, "owner" | "accessSummary">, viewerId: string | undefined): string {
  const owner = personName(file.owner, viewerId);
  const others = file.accessSummary.people.filter((person) => person.id !== file.owner.id).map((person) => personName(person, viewerId));
  if (!file.accessSummary.everyone && others.length === 0) return owner === "You" ? "Only you" : `Only ${owner}`;
  const withWho = file.accessSummary.everyone ? "the whole workspace" : joinNames(others);
  return `Owner: ${owner}. Shared with ${withWho}`;
}

/**
 * The avatars shown in the Access column, as in the prototype: the whole workspace is only the
 * building; one person is one avatar; two people are two avatars (owner first); three or more are
 * the owner's avatar and a "+N" circle for everyone else.
 */
export function accessAvatars(file: Pick<LibraryFileRow, "owner" | "accessSummary">): {
  shown: Person[];
  extra: number;
  everyone: boolean;
} {
  if (file.accessSummary.everyone) return { shown: [], extra: 0, everyone: true };
  const ordered = [file.owner, ...file.accessSummary.people.filter((person) => person.id !== file.owner.id)];
  if (ordered.length <= 2) return { shown: ordered, extra: 0, everyone: false };
  return { shown: [file.owner], extra: ordered.length - 1, everyone: false };
}

/** A file lives in Library lists only when it is active and ready; the list endpoints already guarantee it. */
export function isListable(file: Pick<LibraryFileRow, "life">): boolean {
  return file.life === "active";
}
