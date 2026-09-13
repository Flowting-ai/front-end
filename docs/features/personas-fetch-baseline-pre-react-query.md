# Personas fetch/cache — behavior baseline (pre-React-Query migration)

Written down BEFORE any React Query migration code is touched, so the migration
has a concrete "must still do this" checklist instead of relying on memory.
Once the migration is verified against this doc, this file can be deleted or
archived — it's a scaffold, not permanent documentation.

## Files involved

- `src/lib/api/personas.ts` — `fetchPersonas()`, `getPersonaRepoWithCache()`, `bustPersonasCache()`
- `src/lib/api/teams.ts` — `fetchPersonaOwnerMap()`
- `src/components/layout/LeftSidebar.tsx` — three independent consumers:
  `PersonasSectionAll` (~L944), `PersonasSectionIndividual` (~L1249), `RecentAgentChatsSection` (~L1563)
- `src/lib/api/personas.test.ts` — one existing test (enrichment happy path only)

## `fetchPersonas()` — exact current behavior

1. **30s TTL cache** (`_personasCache`/`_personasCacheTime`, module-level, `PERSONAS_CACHE_TTL = 30_000`).
   A call within 30s of the last successful fetch returns the cached array
   synchronously wrapped in `Promise.resolve` — **no network call**.
2. **In-flight de-dupe** (`_fetchPersonasInFlight`). If a fetch is already
   underway, every concurrent caller gets the *same* Promise — only one HTTP
   request is made regardless of how many components call `fetchPersonas()`
   at once. This is what today's 3 independent `LeftSidebar` sections rely on
   to avoid tripling the network call on mount.
3. **N+1 enrichment for team-visibility personas.** The list endpoint
   (`GET /persona`) always returns `team_ids: []` for every persona to stay
   cheap. After the list resolves, every persona with `visibility === 'team'`
   gets a *second* request via `getPersonaRepoWithCache(p.id)` (parallelized
   with `Promise.all`, but `fetchPersonas()`'s own returned Promise does not
   resolve until all of them finish). A persona whose enrichment call throws
   keeps its original (empty) `teamIds` rather than failing the whole list.
   `visibility !== 'team'` personas are never enriched (no second call).
4. Only successful enrichment resolves are cached; the *whole* enriched array
   is what gets stored in `_personasCache`, not just the raw list.

## `getPersonaRepoWithCache(repoId)` — exact current behavior

- Same 30s TTL + in-flight-dedupe pattern, but keyed **per repoId** (a `Map`,
  not a single value). Independent cache lifetime from the list cache above.

## `bustPersonasCache()` — exact current behavior

- Clears the list cache, the per-repo detail cache, and the in-flight map for
  detail fetches (does NOT clear `_fetchPersonasInFlight` — an in-flight list
  fetch is allowed to finish and populate the now-cleared cache).
- Dispatches a plain `window.dispatchEvent(new Event(PERSONAS_LIST_UPDATED_EVENT))`
  (a bare `Event`, not `CustomEvent` — no `.detail` payload).
- Called from: `deletePersona`, `togglePause`, and the share-copy flow in
  `personas.ts`, plus (per grep) from `agents/page.tsx` and every
  `agent/configure/*` page/tab on publish/save.
- **Side effect in a different module**: `teams.ts` registers its own
  top-level `window.addEventListener(PERSONAS_LIST_UPDATED_EVENT, ...)` that
  clears `_ownerMapCache`/`_ownerMapInFlight` (teams.ts:615-619) — busting the
  personas cache transitively busts the owner-map cache too. Any replacement
  must preserve this cross-cache invalidation, not just the personas side.

## `fetchPersonaOwnerMap(orgId, teamIds)` — exact current behavior

- Same 30s TTL + in-flight dedupe, keyed by `` `${orgId}:${sortedTeamIds.join(',')}` ``
  (teams.ts:622-624) — changing team membership changes the cache key, not
  just invalidating a single fixed key.
- On per-team failure, that team's shares resolve to `[]` rather than
  rejecting the whole map (teams.ts:635, `.catch(() => [])`).

## The three `LeftSidebar.tsx` consumers (all independently, per component)

Each of `PersonasSectionAll`, `PersonasSectionIndividual`, `RecentAgentChatsSection`:

- Has its **own** `useState<boolean>(isLoading, true)`.
- Calls `fetchPersonas()` in a mount `useEffect` (benefits from the module
  cache/dedupe above, but each still runs its own `.then()`/`.catch()`/
  `.finally(() => setIsLoading(false))` independently).
- Registers its **own** `window.addEventListener(PERSONAS_LIST_UPDATED_EVENT, ...)`
  that re-runs its own fetch, and its own cleanup on unmount.
- `PersonasSectionAll` additionally: resolves `viewerUserId` via the org
  member list, fetches `fetchPersonaOwnerMap` in a **separate** effect keyed
  on `[orgId, teams]`, and derives `personas` via
  `isPersonaOwnedByViewer(p, personaOwnerMap, viewerUserId, currentUserRole === 'admin')`
  — a team-shared persona the viewer doesn't own must NOT appear here, even
  though `fetchPersonas()` itself returns it (ownership filtering happens
  client-side, in this component, not in the API layer).
- Loading-skeleton counts differ per section (3 vs 2 vs 3/2 rows) — cosmetic,
  but worth preserving exactly since it's what the UI shows during the
  loading state.

## Characterization tests (locked in, run against current code)

`src/lib/api/personas.test.ts` now has 8 passing tests against the *current*
implementation, run before any migration code was written:
empty-list handling, in-flight dedupe, TTL cache reuse, enrichment-failure
resilience, no-enrichment-for-non-team-personas, cache-bust-forces-refetch,
and an SSR-safety check (`bustPersonasCache()` doesn't throw when `window` is
undefined — this suite runs in vitest's `node` environment per
`vitest.config.ts`, so the actual cross-module fan-out into `teams.ts`'s
owner-map cache isn't exercised here; that's a real gap, noted below).

**Known gap**: no test currently exercises `teams.ts`'s
`window.addEventListener(PERSONAS_LIST_UPDATED_EVENT, ...)` owner-map-cache
invalidation in a real DOM context — this suite is node-environment-only by
existing project convention. If the migration touches that cross-cache
invalidation, it should be verified manually (per the smoke-test step) since
it isn't covered by an automated test today either.

## Explicit "must still be true after migration" checklist

- [ ] Concurrent mounts of the 3 sidebar sections → **1** network call to
      `GET /persona`, not 3 (currently guaranteed by in-flight dedupe).
- [ ] A second `fetchPersonas()`-equivalent call within the stale window
      returns cached data with **0** network calls.
- [ ] Team-visibility personas still get their `teamIds` enriched via the
      per-repo detail endpoint; a failed enrichment call still leaves that
      persona in the list (doesn't drop it, doesn't reject the whole list).
- [ ] Deleting/pausing/publishing a persona invalidates **both** the personas
      cache/query AND the owner-map cache/query (today's cross-module event
      side effect).
- [ ] `personasForTeamContext`/`isPersonaOwnedByViewer` filtering still
      happens with the same semantics (team-only visibility, per-viewer
      ownership, empty `teamIds` ≠ "all teams").
- [ ] A team-shared persona the viewer doesn't own still doesn't render in
      `PersonasSectionAll`.
- [ ] Owner-map cache key still varies by the *set* of team ids, not just org id.
- [ ] Per-repo detail cache (`getPersonaRepoWithCache`) still used by whatever
      replaces the /agents list page's instant-return-visit behavior.
