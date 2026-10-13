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

// ── Agent (persona) editor keys ──────────────────────────────────────────────
// Per-repo keys accumulate as agents are created/edited, so every one lives
// here and is swept by clearPersonaRepoStorage() when the agent is deleted.

export const PERSONA_WIZARD_REPO_KEY = "persona_wizard_repo";
export const PERSONA_WIZARD_STARTER_KEY = "persona_wizard_starter";
export const PENDING_PERSONA_KEY = "new-chat-pending-persona";

// ── Library ──────────────────────────────────────────────────────────────────
// When the person last dismissed the "an Admin changed Library settings" notice (an ISO time).
export const LIBRARY_SETTINGS_SEEN_KEY = "library:v1:settings-seen";

export const personaInitialVersionKey = (repoId: string) => `persona_initial_version_${repoId}`;
export const personaConfigureSavedKey = (repoId: string) => `persona_configure_saved_${repoId}`;
export const personaWizardPurposeKey = (repoId: string) => `persona_wizard_purpose_${repoId}`;
export const personaWizardNoModelKey = (repoId: string) => `persona_wizard_no_model_${repoId}`;
export const personaVisitedTabsKey = (repoId: string) => `persona_visited_tabs_${repoId || "new"}`;
export const personaModelCacheKey = (repoId: string) => `persona_model_cache_${repoId}`;
export const personaInstructionsDraftKey = (repoId: string) => `persona_instructions_draft_${repoId}`;
export const personaFileSizesKey = (repoId: string, versionId: string) => `persona_file_sizes_${repoId}_${versionId}`;

/** Removes every per-agent entry from local/session storage. Call after the
 *  agent is deleted so its keys don't pile up. Never throws. */
export function clearPersonaRepoStorage(repoId: string): void {
  if (!repoId || typeof window === "undefined") return;
  const exact = [
    personaTagsKey(repoId),
    personaProfileKey(repoId),
    personaInitialVersionKey(repoId),
    personaConfigureSavedKey(repoId),
    personaWizardPurposeKey(repoId),
    personaWizardNoModelKey(repoId),
    personaVisitedTabsKey(repoId),
    personaModelCacheKey(repoId),
    personaInstructionsDraftKey(repoId),
  ];
  const prefixes = [`persona_file_sizes_${repoId}_`];
  for (const getStore of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      const store = getStore();
      exact.forEach((k) => store.removeItem(k));
      const stale: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && prefixes.some((p) => k.startsWith(p))) stale.push(k);
      }
      stale.forEach((k) => store.removeItem(k));
    } catch { /* storage unavailable */ }
  }
}
