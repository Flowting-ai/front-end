"use client";

// Members in Library settings: the Admin's roster with Remove, and a person leaving the workspace. Both
// end in the same transfer question (MyRemovalPrompt / LeaveDialog). Never optimistic: the server decides
// (only_admin, already pending), and the screen shows what it says.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getLibraryApi } from "./api";
import { libraryErrorMessage, libraryRetry } from "./errors";
import { libraryKeys } from "./keys";
import { MESSAGES } from "./messages";
import { captureError } from "./observability";
import type { Member } from "./schemas";
import { useLibraryViewer } from "./viewer";

const workspaceMembersKey = (org: string) => [...libraryKeys.all(org), "workspace-members"] as const;

function fail(error: unknown, action: string): void {
  captureError(error, { boundary: "mutation", action });
  toast.error(libraryErrorMessage(error, MESSAGES.genericFailure));
}

/** Everyone in the workspace, with any pending removal. Admins see it in Library settings; anyone may read it to name an Admin. */
export function useWorkspaceMembers(enabled = true) {
  const { orgKey, orgId, ready } = useLibraryViewer();
  return useQuery({
    queryKey: workspaceMembersKey(orgKey),
    queryFn: async ({ signal }) => (await getLibraryApi()).listWorkspaceMembers(orgId, signal),
    enabled: enabled && ready && orgId !== "",
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    retry: libraryRetry,
  });
}

/** True when `viewerId` is the only Admin left (a pending removal does not count). Undefined while unknown. */
export function isOnlyAdmin(members: Member[] | undefined, viewerId: string | undefined): boolean | undefined {
  if (!members || !viewerId) return undefined;
  const admins = members.filter((member) => member.role === "admin" && !member.removal);
  return admins.length === 1 && admins[0].id === viewerId;
}

/** Admin: start removing a member. The row then waits for their answer. */
export function useStartMemberRemoval() {
  const queryClient = useQueryClient();
  const { orgKey } = useLibraryViewer();
  return useMutation({
    mutationKey: [...libraryKeys.all(orgKey), "start-removal"],
    mutationFn: async (vars: { member: Member }) => (await getLibraryApi()).startMemberRemoval(vars.member.id),
    onSuccess: (_result, vars) => {
      toast(`Waiting for ${vars.member.name} to answer`);
      void queryClient.invalidateQueries({ queryKey: workspaceMembersKey(orgKey) });
      void queryClient.invalidateQueries({ queryKey: libraryKeys.members(orgKey) });
    },
    onError: (error) => fail(error, "start-removal"),
  });
}

/** The signed-in person leaves the workspace. On success the caller moves them out of the app. */
export function useLeaveWorkspace() {
  const queryClient = useQueryClient();
  const { orgKey } = useLibraryViewer();
  return useMutation({
    mutationKey: [...libraryKeys.all(orgKey), "leave"],
    mutationFn: async (vars: { transfer: boolean }) => (await getLibraryApi()).leaveWorkspace(vars.transfer),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: libraryKeys.all(orgKey) }),
    onError: (error) => fail(error, "leave"),
  });
}
