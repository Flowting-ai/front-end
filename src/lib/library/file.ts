// One Library file as every screen sees it: parsed once from the API (schemas.ts transforms each row
// and detail into these), carrying the rules that decide what the viewer may do and how its name and
// access read. Screens use the getters; none of them derives a capability or a label on its own.

import { personName } from "./access";
import { formatGroupOf, sanitizeDisplayText } from "./format";
import type { FileDetailWire, FileRowWire, Person } from "./schemas";

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

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export class LibraryFile {
  declare readonly id: FileRowWire["id"];
  declare readonly title: FileRowWire["title"];
  declare readonly extension: FileRowWire["extension"];
  declare readonly format: FileRowWire["format"];
  declare readonly source: FileRowWire["source"];
  declare readonly owner: FileRowWire["owner"];
  declare readonly access: FileRowWire["access"];
  declare readonly adminCanManage: FileRowWire["adminCanManage"];
  declare readonly accessSummary: FileRowWire["accessSummary"];
  declare readonly sizeBytes: FileRowWire["sizeBytes"];
  declare readonly createdAt: FileRowWire["createdAt"];
  declare readonly lastActivityAt: FileRowWire["lastActivityAt"];
  declare readonly lastActivityKind: FileRowWire["lastActivityKind"];
  declare readonly unread: FileRowWire["unread"];
  declare readonly life: FileRowWire["life"];
  declare readonly trashedAt: FileRowWire["trashedAt"];
  declare readonly trashedBy: FileRowWire["trashedBy"];
  declare readonly daysLeft: FileRowWire["daysLeft"];
  declare readonly sharedAt: FileRowWire["sharedAt"];
  declare readonly sharedBy: FileRowWire["sharedBy"];
  declare readonly generatedFrom: FileRowWire["generatedFrom"];
  declare readonly openCount: FileRowWire["openCount"];
  declare readonly thumbnailUrl: FileRowWire["thumbnailUrl"];
  declare readonly snippet: FileRowWire["snippet"];
  declare readonly titleIsAiGenerated: FileRowWire["titleIsAiGenerated"];

  constructor(wire: FileRowWire) {
    Object.assign(this, wire);
  }

  /** A copy with some fields changed, of the same class. Caches never mutate a file. */
  with(patch: Partial<FileRowWire>): this {
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this, patch);
  }

  /** The name people see: "Return policy 2026.pdf". */
  get name(): string {
    const title = sanitizeDisplayText(this.title) || "Untitled";
    return this.extension ? `${title}.${this.extension}` : title;
  }

  get group() {
    return formatGroupOf(this.format);
  }

  /**
   * Which controls to show, disable, or explain. The server is the authority on every action (a
   * hidden button is not security); never derive a capability from a role alone.
   */
  get caps(): Caps {
    const manages = this.access === "owner" || this.adminCanManage;
    const active = this.life === "active";
    return {
      open: active || this.access === "owner",
      rename: active && manages,
      share: active && manages,
      delete: active && manages,
      restore: !active && manages,
      deleteForever: !active && manages,
      adminOver: this.access !== "owner" && this.adminCanManage,
    };
  }

  get accessLabel(): string {
    if (this.access === "owner") return "Owner";
    return this.adminCanManage ? "Admin, can manage" : "Viewer";
  }

  /**
   * The avatars shown in the Access column: the whole workspace is only the building; one person is
   * one avatar; two people are two avatars (owner first); three or more are the owner's avatar and a
   * "+N" circle for everyone else.
   */
  get accessAvatars(): { shown: Person[]; extra: number; everyone: boolean } {
    if (this.accessSummary.everyone) return { shown: [], extra: 0, everyone: true };
    const ordered = [this.owner, ...this.accessSummary.people.filter((person) => person.id !== this.owner.id)];
    if (ordered.length <= 2) return { shown: ordered, extra: 0, everyone: false };
    return { shown: [this.owner], extra: ordered.length - 1, everyone: false };
  }

  /** Tooltip for the Access column: "Only you", "Owner: You. Shared with Maya and Sam", "... the whole workspace". */
  accessTip(viewerId: string | undefined): string {
    const owner = personName(this.owner, viewerId);
    const others = this.accessSummary.people.filter((person) => person.id !== this.owner.id).map((person) => personName(person, viewerId));
    if (!this.accessSummary.everyone && others.length === 0) return owner === "You" ? "Only you" : `Only ${owner}`;
    return `Owner: ${owner}. Shared with ${this.accessSummary.everyone ? "the whole workspace" : joinNames(others)}`;
  }
}

export class LibraryFileDetail extends LibraryFile {
  declare readonly phase: FileDetailWire["phase"];
  declare readonly scope: FileDetailWire["scope"];
  declare readonly provenance: FileDetailWire["provenance"];
  declare readonly mimeType: FileDetailWire["mimeType"];
  declare readonly updatedAt: FileDetailWire["updatedAt"];
  declare readonly ways: FileDetailWire["ways"];
  declare readonly previewKind: FileDetailWire["previewKind"];
  declare readonly runInputs: FileDetailWire["runInputs"];

  constructor(wire: FileDetailWire) {
    super(wire);
  }
}
