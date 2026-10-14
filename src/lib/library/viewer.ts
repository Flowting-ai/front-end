"use client";

// Who is looking and in which workspace: the two facts every Library key and every "You" label
// depends on.

import { useAuth } from "@/context/auth-context";
import { useOrgIdentity } from "@/context/org-context";
import { orgKeyOf } from "./keys";

export type LibraryViewer = {
  /** Matches the ids the API returns for people; undefined until the user has loaded. */
  viewerId: string | undefined;
  /** The workspace id the API needs; empty for an individual account. */
  orgId: string;
  /** The same, as a query-key segment ("personal" when there is no workspace). */
  orgKey: string;
  isAdmin: boolean;
  /**
   * The workspace and the user have loaded. Library queries wait for it: until then the workspace id is not
   * known, and a key built from a guess would fetch twice (once as "personal", once for the real workspace).
   */
  ready: boolean;
};

export function useLibraryViewer(): LibraryViewer {
  const { user } = useAuth();
  const { orgId, currentUserRole, orgReady } = useOrgIdentity();
  const authId = user?.auth0Id ?? (user?.id !== undefined && user?.id !== null ? String(user.id) : undefined);
  return {
    viewerId: authId,
    orgId: orgId ?? "",
    orgKey: orgKeyOf(orgId),
    isAdmin: currentUserRole === "admin",
    ready: orgReady && user !== null,
  };
}
