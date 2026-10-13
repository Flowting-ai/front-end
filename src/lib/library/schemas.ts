// Wire shapes for the Library API (docs v2/library/04-backend-requirements.md section 5) and the
// UI types inferred from them. Every response is parsed with these schemas at the data-function
// boundary (lib/library/api.real.ts), so a contract drift fails loudly in one place instead of as
// an undefined deep inside a component. Field names are camelCase, like services/projects.

import { z } from "zod";

// ── Vocabulary ────────────────────────────────────────────────────────────────

/** Finer than the five filter groups: the PRD supports PDF, DOCX, XLSX/CSV, PPTX, text, html, email, audio, images. */
export const FORMATS = ["pdf", "document", "sheet", "slides", "text", "web", "email", "image", "audio"] as const;
export const formatSchema = z.enum(FORMATS);
export type Format = z.infer<typeof formatSchema>;

/** The five groups the Filter panel offers (Images, Documents, Spreadsheets, PDFs, Audio). */
export const FORMAT_GROUPS = ["images", "documents", "spreadsheets", "pdfs", "audio"] as const;
export const formatGroupSchema = z.enum(FORMAT_GROUPS);
export type FormatGroup = z.infer<typeof formatGroupSchema>;

export const SOURCES = ["uploaded", "generated"] as const;
export type Source = (typeof SOURCES)[number];

/** Filter values: a file's source, plus "shared" (shared with me). */
export const SOURCE_FILTERS = ["uploaded", "generated", "shared"] as const;
export const sourceFilterSchema = z.enum(SOURCE_FILTERS);
export type SourceFilter = z.infer<typeof sourceFilterSchema>;

export const AUTO_SAVE_MODES = ["always", "ask", "never"] as const;
export const autoSaveSchema = z.enum(AUTO_SAVE_MODES);
export type AutoSave = z.infer<typeof autoSaveSchema>;

/** Why an upload was refused. The UI maps each to fixed copy (messages.ts); the message never names the file. */
export const UPLOAD_FAILURE_REASONS = [
  "too_large",
  "unsupported",
  "password_protected",
  "unsafe",
  "unreadable",
  "network",
] as const;
export const uploadFailureReasonSchema = z.enum(UPLOAD_FAILURE_REASONS);
export type UploadFailureReason = z.infer<typeof uploadFailureReasonSchema>;

// ── People and access ────────────────────────────────────────────────────────

export const personSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatarUrl: z.string().optional(),
});
export type Person = z.infer<typeof personSchema>;

/** Who can open a file, owner first. `everyone` is true when the whole workspace has a grant. */
export const accessSummarySchema = z.object({
  everyone: z.boolean(),
  people: z.array(personSchema),
});
export type AccessSummary = z.infer<typeof accessSummarySchema>;

// ── Files ─────────────────────────────────────────────────────────────────────

export const fileRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** Lower-case, no dot: "pdf", "xlsx". Empty when the file has none. */
  extension: z.string(),
  format: formatSchema,
  source: z.enum(SOURCES),
  owner: personSchema,
  access: z.enum(["owner", "viewer"]),
  /** An Admin may rename/share/delete a workspace-shared file without owning it; never open a private one. */
  adminCanManage: z.boolean().default(false),
  accessSummary: accessSummarySchema,
  sizeBytes: z.number().nonnegative(),
  createdAt: z.string(),
  lastActivityAt: z.string(),
  lastActivityKind: z.enum(["created", "opened", "modified", "shared"]),
  unread: z.boolean().default(false),
  life: z.enum(["active", "trashed"]),
  trashedAt: z.string().optional(),
  /** Trash only: who moved the file to Trash, when it was not the owner (an Admin over a workspace share). */
  trashedBy: personSchema.optional(),
  daysLeft: z.number().int().nonnegative().optional(),
  sharedAt: z.string().optional(),
  sharedBy: personSchema.optional(),
  /**
   * Generated files only: where Souvenir made it, for the sparkle's tooltip. `label` is the chat or
   * routine name; the server leaves it out when the viewer may not see that chat's title.
   */
  generatedFrom: z.object({ kind: z.enum(["chat", "routine"]), label: z.string().optional() }).optional(),
  /** How many times the viewer opened the file (Suggested's "Frequently used"). */
  openCount: z.number().int().nonnegative().optional(),
  /** Small private rendition (<= 20 KB). Absent for formats without one: the UI shows the type icon. */
  thumbnailUrl: z.string().optional(),
  /** Search only: the matched passage. */
  snippet: z.string().optional(),
  /** True for a title Souvenir chose, until the owner renames it. */
  titleIsAiGenerated: z.boolean().default(false),
});
export type LibraryFileRow = z.infer<typeof fileRowSchema>;

export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}
export type Page<T> = { items: T[]; nextCursor: string | null };

export const trashPageSchema = pageSchema(fileRowSchema).extend({ freesBytes: z.number().nonnegative() });
export type TrashPage = z.infer<typeof trashPageSchema>;

export const provenanceSchema = z.object({
  kind: z.enum(["chat", "routine", "slack", "upload"]),
  /** Snapshot of the source name so provenance survives the source being deleted ("Weekly sales report"). */
  label: z.string(),
  via: z.enum(["web", "slack", "routine"]),
  chatId: z.string().optional(),
  routineId: z.string().optional(),
  isTestRun: z.boolean().default(false),
  /** Who uploaded it, when that is not the owner shown elsewhere (optional: older servers omit it). */
  by: personSchema.optional(),
  /** True when the viewer can open the source chat; the chat is a link only then. */
  canOpenChat: z.boolean().optional(),
  /** Which run made it, as the run is labelled in the routine's history ("Oct 6"). */
  runLabel: z.string().optional(),
});
export type Provenance = z.infer<typeof provenanceSchema>;

/** A file a routine run read, as its output shows it: open, deleted, or one the viewer can't open (never named then). */
export const runInputSchema = z.object({
  id: z.string(),
  state: z.enum(["open", "deleted", "locked"]),
  title: z.string().optional(),
  format: formatSchema.optional(),
});
export type RunInput = z.infer<typeof runInputSchema>;

export const PREVIEW_KINDS = ["pdf", "text", "sheet", "image", "audio", "none"] as const;

export const fileDetailSchema = fileRowSchema.extend({
  phase: z.enum(["uploading", "processing", "ready"]),
  scope: z.enum(["private", "shared", "workspace"]),
  provenance: provenanceSchema,
  mimeType: z.string(),
  updatedAt: z.string(),
  /** How the viewer gets in: "Shared directly", "Whole workspace". Empty for the owner. */
  ways: z.array(z.enum(["direct", "workspace"])).default([]),
  previewKind: z.enum(PREVIEW_KINDS),
  /** Run outputs only: the files that run used ("Files this run used"). */
  runInputs: z.array(runInputSchema).optional(),
});
export type LibraryFileDetail = z.infer<typeof fileDetailSchema>;

// ── Preview payloads ──────────────────────────────────────────────────────────

export const previewSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pdf"), url: z.string(), pageCount: z.number().int().positive() }),
  z.object({
    kind: z.literal("text"),
    pages: z.array(z.object({ label: z.string(), text: z.string() })),
  }),
  z.object({
    kind: z.literal("sheet"),
    sheets: z.array(z.string()),
    sheet: z.string(),
    columns: z.array(z.string()),
    rows: z.array(z.array(z.string())),
    rowStart: z.number().int().nonnegative(),
    rowTotal: z.number().int().nonnegative(),
  }),
  z.object({ kind: z.literal("image"), url: z.string(), caption: z.string().optional() }),
  z.object({
    kind: z.literal("audio"),
    url: z.string(),
    durationMs: z.number().nonnegative(),
    lines: z.array(z.object({ startMs: z.number().nonnegative(), text: z.string() })),
  }),
]);
export type Preview = z.infer<typeof previewSchema>;

export type PreviewRequest = { sheet?: string; rowStart?: number; rowCount?: number };

/** Where a citation points: a page label, a sheet row, or a time in a recording. */
export type CiteLocator = { type: "page" | "row" | "time"; value: string; /** The cited sentence or passage on that page, when known. */ passage?: string };

// ── Access list, usage ────────────────────────────────────────────────────────

export const accessEntrySchema = z.object({
  grantId: z.string(),
  kind: z.enum(["owner", "user", "workspace"]),
  person: personSchema.optional(),
  via: z.enum(["owner", "direct", "workspace"]),
});
export type AccessEntry = z.infer<typeof accessEntrySchema>;

export const accessListSchema = z.object({
  entries: z.array(accessEntrySchema),
  /** Owner, or Admin over a workspace-shared file. */
  canManage: z.boolean(),
});
export type AccessList = z.infer<typeof accessListSchema>;

export const usageSchema = z.object({
  chats: z.array(z.object({ id: z.string(), title: z.string() })),
  routines: z.array(z.object({ id: z.string(), title: z.string() })),
  /** Uses the caller cannot see are counted, never named. */
  hiddenChats: z.number().int().nonnegative().default(0),
  hiddenRoutines: z.number().int().nonnegative().default(0),
});
export type Usage = z.infer<typeof usageSchema>;

// ── Suggested, storage, limits, flags ─────────────────────────────────────────

export const suggestedSchema = z.object({
  recent: z.array(fileRowSchema),
  frequent: z.array(fileRowSchema),
  generated: z.array(fileRowSchema),
});
export type Suggested = z.infer<typeof suggestedSchema>;

export const storageSchema = z.object({
  usedBytes: z.number().nonnegative(),
  /** Null in Phase 1: there is no storage cap (open question OQ-1). */
  limitBytes: z.number().nonnegative().nullable(),
  breakdown: z.object({
    filesBytes: z.number().nonnegative(),
    imagesBytes: z.number().nonnegative(),
    audioBytes: z.number().nonnegative(),
  }),
  /** How many files make up each row of the breakdown. Optional: shown only when the server sends it. */
  counts: z.object({
    files: z.number().int().nonnegative(),
    images: z.number().int().nonnegative(),
    audio: z.number().int().nonnegative(),
  }).optional(),
});
export type Storage = z.infer<typeof storageSchema>;

export const limitsSchema = z.object({
  maxFileBytes: z.number().positive(),
  allowedFormats: z.array(formatSchema),
  maxFilesPerMessage: z.number().int().positive(),
});
export type Limits = z.infer<typeof limitsSchema>;

/** Per-workspace kill switches (04 section 9). A false value disables the feature without deleting any file. */
export const flagsSchema = z.object({
  library: z.boolean(),
  autoSave: z.boolean(),
  aiUse: z.boolean(),
  sharing: z.boolean(),
});
export type Flags = z.infer<typeof flagsSchema>;

// ── Settings ──────────────────────────────────────────────────────────────────

export const prefsSchema = z.object({
  /** The person's own choice. Null until they choose: the workspace default applies. */
  autoSave: autoSaveSchema.nullable(),
  /** "Let Souvenir use my Library" (the person's own switch). */
  aiReferenceEnabled: z.boolean(),
  /** What saving actually does for this person: Admin force-off, then their choice, then the workspace default. */
  effectiveAutoSave: autoSaveSchema,
  /** An Admin forced auto-save off for everyone: the personal control is disabled. */
  forcedOff: z.boolean(),
  /** False when an Admin turned automatic AI use of Library off for the workspace. */
  aiReferenceAllowed: z.boolean(),
  /** When an Admin last changed a Library setting, for the one-time "what changed" notice. */
  settingsChangedAt: z.string().optional(),
  /** What an Admin changed, one line each, newest last (the notice lists the unseen ones). */
  settingsChanges: z.array(z.object({ key: z.string(), at: z.string(), text: z.string() })).optional(),
});
export type Prefs = z.infer<typeof prefsSchema>;
/** The only fields a person can change. */
export type PrefsPatch = Partial<Pick<Prefs, "autoSave" | "aiReferenceEnabled">>;

export const orgSettingsSchema = z.object({
  defaultAutoSave: autoSaveSchema,
  forceAutoSaveOff: z.boolean(),
  aiReferenceEnabled: z.boolean(),
  maxFileBytes: z.number().positive(),
  allowedFormats: z.array(formatSchema),
  /** Bumped on every write; PATCH sends it as If-Match so two Admins never overwrite silently. */
  version: z.number().int().nonnegative(),
  updatedBy: personSchema.optional(),
  updatedAt: z.string().optional(),
});
export type OrgSettings = z.infer<typeof orgSettingsSchema>;

export type OrgSettingsPatch = Partial<
  Pick<OrgSettings, "defaultAutoSave" | "forceAutoSaveOff" | "aiReferenceEnabled" | "maxFileBytes" | "allowedFormats">
>;

export const memberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().optional(),
  avatarUrl: z.string().optional(),
  role: z.enum(["admin", "member"]),
  fileCount: z.number().int().nonnegative(),
  /** Set while an Admin removed them and they have not answered the transfer question yet. */
  removal: z.enum(["awaiting_answer"]).optional(),
});
export type Member = z.infer<typeof memberSchema>;

// ── Uploads ───────────────────────────────────────────────────────────────────

export const uploadStatusSchema = z.object({
  id: z.string(),
  phase: z.enum(["uploading", "processing", "ready", "failed"]),
  /** True once processing has run past the "taking longer than usual" mark (10 minutes). */
  slow: z.boolean().default(false),
  failureReason: uploadFailureReasonSchema.optional(),
  /** Set when ready: the staged LibraryFile id the chat send refers to. */
  fileId: z.string().optional(),
});
export type UploadStatus = z.infer<typeof uploadStatusSchema>;

export const uploadInitSchema = z.object({
  id: z.string(),
  partSize: z.number().int().positive(),
  parts: z.array(z.object({ partNumber: z.number().int().positive(), url: z.string() })),
});
export type UploadInit = z.infer<typeof uploadInitSchema>;

export type UploadInitRequest = { name: string; sizeBytes: number; mimeType: string; chatId?: string };
export type UploadPartEtag = { partNumber: number; etag: string };
