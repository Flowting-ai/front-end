// Shared localStorage/sessionStorage key names for values read or written
// from more than one file. A key duplicated as an inline literal in two
// places can drift silently (rename one, forget the other) with no
// compiler check — centralize those here.
//
// Keys used in only one file should stay defined locally in that file.

// Also the name of the cookie that mirrors it: the (app) layout reads the
// cookie on the server so the sidebar's first render matches the client's
// (localStorage isn't readable during SSR). LeftSidebar writes both.
export const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";

/** Parses the stored sidebar-collapsed value; anything but "true" (including
 *  a missing cookie) means expanded. */
export function parseSidebarCollapsed(value: string | null | undefined): boolean {
  return value === "true";
}

export const personaTagsKey = (repoId: string) => `persona_tags_${repoId}`;

export const personaProfileKey = (repoId: string) => `persona_profile_${repoId || "new"}`;
