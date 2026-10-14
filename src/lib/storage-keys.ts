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

/** Last resolved org id per user (OrgProvider), so a reload doesn't wait on the org list. */
export const ORG_ID_CACHE_PREFIX = "souvenir:org-id:";
export const orgIdCacheKey = (userId: string) => `${ORG_ID_CACHE_PREFIX}${userId}`;

/** Drops every cached org id; called on sign-out so the next account starts clean. */
export function clearOrgIdCache(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(ORG_ID_CACHE_PREFIX)) localStorage.removeItem(key);
    }
  } catch { /* storage unavailable */ }
}

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

// ── Projects ─────────────────────────────────────────────────────────────────
// File sizes by filename, until project documents carry size_bytes (backend gap).
export const projectFileSizesKey = (projectId: string) => `project-file-sizes:${projectId}`;

// ── Model selection ──────────────────────────────────────────────────────────
// The chosen model's stable id, plus a small display copy (name, company) so the
// composer can paint before the catalogue loads. See lib/models/model-selection-store.ts.
export const MODEL_SELECTION_KEY = "souvenir_selected_model";
export const MODEL_SELECTION_CACHE_KEY = "souvenir_selected_model_cache";
// Auto-routing tier choice and per-model reasoning effort (context/model-selector-context.tsx).
export const MODEL_ALGORITHM_KEY = "souvenir_selected_algorithm";
export const MODEL_EFFORT_KEY = "souvenir_reasoning_effort";
// Settings → Account default model, until the backend stores one (gap).
export const SETTINGS_DEFAULT_MODEL_KEY = "souvenir:settings:default-model";

// ── Global search ────────────────────────────────────────────────────────────
// The last few results opened from Cmd/Ctrl+K, shown before typing.
export const SEARCH_RECENT_OPENED_KEY = "souvenir:search-recent-opened:v1";

/** Forget recent search results (chat and agent titles) on logout. */
export function clearSearchRecents(): void {
  try { localStorage.removeItem(SEARCH_RECENT_OPENED_KEY); } catch { /* storage unavailable */ }
}

// ── Schedules ────────────────────────────────────────────────────────────────
// schedule id → chat id, until GET /automations rows carry chat_id (backend gap).
export const SCHEDULE_CHAT_LINKS_KEY = "schedule_chat_links_v1";
// sessionStorage: the prompt handed from /schedules to /chat?fromSchedule=.
export const schedulePendingPromptKey = (scheduleId: string) => `schedule_pending_prompt:${scheduleId}`;

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
