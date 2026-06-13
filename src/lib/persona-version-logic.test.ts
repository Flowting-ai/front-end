import { describe, it, expect } from "vitest";
import {
  resolveSaveMode,
  derivePublicationState,
  pickVersionToEdit,
  diffKnowledgeForInheritance,
  type KnowledgeItemLike,
} from "./persona-version-logic";

// Regression coverage for the agent versioning / publishing / file-persistence
// fixes. See agent-version-save-semantics for the rules these enforce.

describe("resolveSaveMode — duplicate-version prevention (issue #2)", () => {
  it("updates the wizard-created v001 in place on the first save (never published yet)", () => {
    // Wizard created v001; nothing published. First Save must NOT mint v002.
    expect(
      resolveSaveMode({
        currentVersionId: "v001",
        initialVersionId: "v001",
        publishedVersionId: null,
      }),
    ).toBe("update-in-place");
  });

  it("creates a new version on every save AFTER the initial one (marker consumed)", () => {
    // After the first save the marker is cleared (initialVersionId becomes null),
    // so subsequent saves fork a new version.
    expect(
      resolveSaveMode({
        currentVersionId: "v001",
        initialVersionId: null,
        publishedVersionId: null,
      }),
    ).toBe("create-new");
  });

  it("creates a new version when editing a version that is already published", () => {
    // v001 is live; editing + saving it forks v002 (explicit user action).
    expect(
      resolveSaveMode({
        currentVersionId: "v001",
        initialVersionId: "v001",
        publishedVersionId: "v001",
      }),
    ).toBe("create-new");
  });

  it("creates a new version when the current version differs from the initial marker", () => {
    expect(
      resolveSaveMode({
        currentVersionId: "v002",
        initialVersionId: "v001",
        publishedVersionId: null,
      }),
    ).toBe("create-new");
  });
});

describe("derivePublicationState — publish status from backend truth (issues #3, #4)", () => {
  it("an already-published agent opened with no changes reads as Live (no false warning)", () => {
    const s = derivePublicationState({
      repoId: "r1",
      versionId: "v001",
      publishedVersionId: "v001",
      hasUnsavedChanges: false,
    });
    expect(s.isPublished).toBe(true);
    expect(s.needsRepublish).toBe(false);
  });

  it("a published agent with unsaved edits needs republishing", () => {
    const s = derivePublicationState({
      repoId: "r1",
      versionId: "v001",
      publishedVersionId: "v001",
      hasUnsavedChanges: true,
    });
    expect(s.isPublished).toBe(false);
    expect(s.needsRepublish).toBe(true);
  });

  it("a never-published draft needs publishing", () => {
    const s = derivePublicationState({
      repoId: "r1",
      versionId: "v001",
      publishedVersionId: null,
      hasUnsavedChanges: false,
    });
    expect(s.isPublished).toBe(false);
    expect(s.needsRepublish).toBe(true);
  });

  it("viewing a draft newer than the live version is not 'published'", () => {
    const s = derivePublicationState({
      repoId: "r1",
      versionId: "v002",
      publishedVersionId: "v001",
      hasUnsavedChanges: false,
    });
    expect(s.isPublished).toBe(false);
    expect(s.needsRepublish).toBe(true);
  });

  it("never reports state without a real repo + version", () => {
    expect(
      derivePublicationState({ repoId: "", versionId: "", publishedVersionId: null, hasUnsavedChanges: false }),
    ).toEqual({ isPublished: false, needsRepublish: false });
  });
});

describe("pickVersionToEdit — Edit opens the published version (issue #3)", () => {
  it("prefers the published version over the most-recent draft", () => {
    expect(
      pickVersionToEdit({ publishedVersionId: "v001", versionsByRecency: ["v002", "v001"] }),
    ).toBe("v001");
  });

  it("falls back to the most-recent version when nothing is published", () => {
    expect(
      pickVersionToEdit({ publishedVersionId: null, versionsByRecency: ["v002", "v001"] }),
    ).toBe("v002");
  });

  it("falls back to the published id even if it isn't in the recency list", () => {
    expect(
      pickVersionToEdit({ publishedVersionId: "v009", versionsByRecency: [] }),
    ).toBe("v009");
  });

  it("returns null when there is nothing to open", () => {
    expect(
      pickVersionToEdit({ publishedVersionId: null, versionsByRecency: [] }),
    ).toBeNull();
  });
});

describe("diffKnowledgeForInheritance — files carried across versions (issue #5)", () => {
  const doc = (id: string, name: string): KnowledgeItemLike => ({ id, document_filename: name });
  const link = (id: string, url: string): KnowledgeItemLike => ({ id, document_filename: url, source_url: url });

  it("carries all source files when the target version is empty", () => {
    const { documentsToCarry, linksToCarry } = diffKnowledgeForInheritance({
      sourceDocuments: [doc("a", "guide.pdf"), doc("b", "spec.docx")],
      sourceLinks: [link("l1", "https://x.com")],
      targetDocuments: [],
      targetLinks: [],
    });
    expect(documentsToCarry.map(d => d.document_filename)).toEqual(["guide.pdf", "spec.docx"]);
    expect(linksToCarry).toHaveLength(1);
  });

  it("does NOT re-carry files the target already has (idempotent if backend cloned them)", () => {
    const { documentsToCarry, linksToCarry } = diffKnowledgeForInheritance({
      sourceDocuments: [doc("a", "Guide.pdf")],
      sourceLinks: [link("l1", "https://x.com")],
      targetDocuments: [doc("a2", "guide.pdf")], // same name, different id, case-insensitive match
      targetLinks: [link("l2", "https://x.com")],
    });
    expect(documentsToCarry).toHaveLength(0);
    expect(linksToCarry).toHaveLength(0);
  });

  it("carries only the missing subset", () => {
    const { documentsToCarry } = diffKnowledgeForInheritance({
      sourceDocuments: [doc("a", "one.pdf"), doc("b", "two.pdf")],
      sourceLinks: [],
      targetDocuments: [doc("a2", "one.pdf")],
      targetLinks: [],
    });
    expect(documentsToCarry.map(d => d.document_filename)).toEqual(["two.pdf"]);
  });
});
