// Files shared by asking in chat ("share the Weekly sales report with Maya"). The backend's
// `share_library_file` tool shares the file as Viewer and the stream says so with a `library_shared` event;
// the chat shows "Shared with Maya · Undo" (library-share-toast.ts), and Undo removes that grant.

export type LibraryShare = {
  fileId: string;
  grantId: string;
  /** The file's title as the tool named it. */
  label: string;
  personName: string;
};

export function parseLibraryShare(raw: unknown): LibraryShare | null {
  if (!raw || typeof raw !== "object") return null;
  const { fileId, grantId, label, personName } = raw as Record<string, unknown>;
  if (typeof fileId !== "string" || typeof grantId !== "string" || typeof label !== "string" || typeof personName !== "string") return null;
  return { fileId, grantId, label, personName };
}

