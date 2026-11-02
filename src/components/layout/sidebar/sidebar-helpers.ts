import type { Persona } from "@/lib/api/personas";
import { emitAgentsSeeAll } from "@/hooks/use-sidebar-events";
import { toast } from "sonner";
import { personaProfileKey } from "@/lib/storage-keys";
import { AGENTS_ROUTE } from "@/lib/routes";

// -- Draft avatar fallback ------------------------------------------------------
// Draft agents' active version often has no persisted image_url yet — the
// configure flow stashes the in-progress avatar in sessionStorage (same key the
// /agents grid reads) before it's reflected in the fetched persona record.
// `isClient` (useIsClient) keeps the sessionStorage read out of the server render
// and hydration pass.
export function personaAvatarUrl(persona: Persona, isClient: boolean): string | null {
  if (persona.imageUrl) return persona.imageUrl;
  if (!isClient) return null;
  try {
    const raw = sessionStorage.getItem(personaProfileKey(persona.id));
    const draft = JSON.parse(raw ?? "null") as Record<string, unknown> | null;
    const draftAvatar = draft?.avatarUrl;
    return typeof draftAvatar === "string" && draftAvatar ? draftAvatar : null;
  } catch {
    return null;
  }
}

// The sidebar shows a quick-glance slice of the agent list, not the whole
// library — /agents is where the full set lives, same "See all" pattern as
// projects/chats/schedules above.
export const AGENT_LIST_LIMIT = 10

// Shared by every "See all agents" row below — same already-there guard as
// handleNewChat's "Already on new chat" toast, so clicking it while already
// on /agents surfaces feedback instead of a silent no-op navigation. Always
// lands on the "My Agents" tab specifically: a fresh /agents mount already
// defaults there, but an already-mounted page won't reset its own tab state
// from a same-URL push, so that case also emits AGENTS_SEE_ALL_EVENT for the
// page to act on.
export function goToAgentsLibrary(pathname: string | null, push: (href: string) => void) {
  if (pathname === AGENTS_ROUTE) {
    toast.info("Already showing agent library", { id: 'nav' })
    emitAgentsSeeAll()
    return
  }
  toast.info("Opening Agents", { id: 'nav' })
  push(AGENTS_ROUTE)
}

// Orgs are auto-named "<X>'s Organisation" / "<X>'s Workspace" at provisioning.
// The badge + account row should show just the "<X>" part, not the redundant
// possessive suffix. A real custom name (no trailing organisation/workspace
// descriptor) is left untouched.
export function orgDisplayName(name: string | undefined | null): string | undefined {
  if (!name) return name ?? undefined
  const match = name.match(/^(.+?)['’]s\s+(organi[sz]ation|workspace)\s*$/i)
  return match ? match[1]!.trim() : name
}
