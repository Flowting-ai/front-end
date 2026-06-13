/**
 * Pure decision logic for the agent (persona) versioning + publishing flow.
 *
 * These functions hold the rules that the configure tabs and the API layer
 * depend on. They are deliberately free of React / network / storage so they
 * can be unit-tested in isolation and reused by every tab — giving us a single
 * source of truth for "is this published?", "should saving fork a new version?",
 * and "which version do we open for editing?".
 *
 * Background (see the bug reports this fixes):
 *  - The wizard creates the repo + version 001 atomically on the backend. The
 *    FIRST explicit "Save version" must therefore UPDATE that provisional 001
 *    in place rather than minting a 002 — otherwise a brand-new agent ends up
 *    with two versions. Every save AFTER that creates a new version.
 *  - Publication state must be derived from the backend's `published_version_id`,
 *    never from client-only storage, so that opening an already-published agent
 *    never shows a spurious "not published yet" warning or "Unpublished" chip.
 */

export type SaveMode = "update-in-place" | "create-new";

/**
 * Decide whether an explicit "Save version" should update the version currently
 * being edited in place, or create a brand-new version.
 *
 * It updates in place only for the *provisional initial* version — the one the
 * wizard created and that the user has neither saved over nor published yet.
 * In every other case (subsequent saves, or editing a version that is already
 * live) a new version is created, which then inherits the prior version's files.
 */
export function resolveSaveMode(args: {
  /** The version currently loaded in the editor. */
  currentVersionId: string;
  /** The wizard-created version id, while it is still the untouched initial draft. Null once consumed. */
  initialVersionId: string | null;
  /** The backend's currently published version id (source of truth). */
  publishedVersionId: string | null;
}): SaveMode {
  const { currentVersionId, initialVersionId, publishedVersionId } = args;
  const isProvisionalInitial =
    !!initialVersionId &&
    currentVersionId === initialVersionId &&
    publishedVersionId !== currentVersionId; // never been published
  return isProvisionalInitial ? "update-in-place" : "create-new";
}

/**
 * Publication status of the version currently being edited, derived purely from
 * the backend's published version id plus local unsaved/pending state. Used by all
 * five configure tabs so they agree on "Live" vs "Unpublished" and on whether
 * the leave-guard dialog should fire.
 */
export function derivePublicationState(args: {
  repoId: string;
  versionId: string;
  publishedVersionId: string | null;
  /** True when there are unsaved edits or pending change tags on the current tab. */
  hasUnsavedChanges: boolean;
}): { isPublished: boolean; needsRepublish: boolean } {
  const { repoId, versionId, publishedVersionId, hasUnsavedChanges } = args;
  const isPublished =
    !!publishedVersionId && publishedVersionId === versionId && !hasUnsavedChanges;
  // Needs (re)publishing whenever we have a real version that isn't the live one
  // with no pending edits. Covers first-time publish and re-publish alike.
  const needsRepublish = !!repoId && !!versionId && !isPublished;
  return { isPublished, needsRepublish };
}

/**
 * Pick which version to open when the user clicks "Edit" without specifying a
 * version. Prefer the published version so the user edits what is live
 * and the publication state reads as "Live" — falling back to the most-recent
 * version only when nothing is published yet.
 */
export function pickVersionToEdit(args: {
  publishedVersionId: string | null;
  /** Version ids sorted newest-first. */
  versionsByRecency: string[];
}): string | null {
  const { publishedVersionId, versionsByRecency } = args;
  if (publishedVersionId && versionsByRecency.includes(publishedVersionId)) {
    return publishedVersionId;
  }
  return versionsByRecency[0] ?? publishedVersionId ?? null;
}

/** Minimal shape of a knowledge item needed to decide inheritance. */
export interface KnowledgeItemLike {
  id: string;
  document_filename: string;
  source_url?: string | null;
}

/**
 * Given a source version's knowledge and the (possibly already-populated) target
 * version's knowledge, return the items that still need to be carried over.
 *
 * De-duplicates by filename (documents) and URL (links) so this is safe to run
 * even if the backend already cloned files when the new version was created —
 * in that case nothing is carried and we make no redundant uploads.
 */
export function diffKnowledgeForInheritance(args: {
  sourceDocuments: KnowledgeItemLike[];
  sourceLinks: KnowledgeItemLike[];
  targetDocuments: KnowledgeItemLike[];
  targetLinks: KnowledgeItemLike[];
}): { documentsToCarry: KnowledgeItemLike[]; linksToCarry: KnowledgeItemLike[] } {
  const { sourceDocuments, sourceLinks, targetDocuments, targetLinks } = args;

  const norm = (s: string) => s.trim().toLowerCase();
  const linkKey = (i: KnowledgeItemLike) => norm(i.source_url ?? i.document_filename);

  const targetDocNames = new Set(targetDocuments.map(d => norm(d.document_filename)));
  const targetLinkKeys = new Set(targetLinks.map(linkKey));

  const documentsToCarry = sourceDocuments.filter(
    d => !targetDocNames.has(norm(d.document_filename)),
  );
  const linksToCarry = sourceLinks.filter(l => !targetLinkKeys.has(linkKey(l)));

  return { documentsToCarry, linksToCarry };
}
