// Shared localStorage/sessionStorage key names for values read or written
// from more than one file. A key duplicated as an inline literal in two
// places can drift silently (rename one, forget the other) with no
// compiler check — centralize those here.
//
// Keys used in only one file should stay defined locally in that file.

export const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";

export const personaTagsKey = (repoId: string) => `persona_tags_${repoId}`;

export const personaProfileKey = (repoId: string) => `persona_profile_${repoId || "new"}`;
