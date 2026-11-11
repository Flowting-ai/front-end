# Projects Feature: System Design Audit

> **Status (Oct 14 2026): Phase 1 done; Phase 2 done except item 6 (moves with Chat) and item 4 (backend). Phase 3 items 1, 3, 4 done (Oct 14); item 2 open.** Phase 4 open.
>
> Phase 3 (Oct 14 2026):
> 1. `project/[id]/page.tsx` (1,123 lines) is now an 11-line route that renders `components/Projects/project-page/ProjectScreen` keyed by project id; the remount replaces the hand-written 13-state reset on project switch. Hooks: `use-project-team-chats` (team chat list, optimistic publish), `use-project-composer` (draft, chips, agent, send) and `use-project-panels` (one open panel as an enum instead of three booleans, the shared-slot content). Sections: `ProjectHeader`, `ProjectComposer`, `ProjectChatList`, and `ProjectSections` (frame, skeleton, tools menu, modals; dialogs are one `dialog` state). No file is over 152 lines. Checked in the running app on a Personal project (title, composer, Instructions & Files open by default, Agents panel swap, options menu, no console errors); the Workspace/Shared view (tabs, Members) was not exercised, since the test account has no team project.
> 3. The create/edit form uses `useZodForm` (decision D9) with `lib/projects/project-form.ts` (`projectFormSchema`, `addTag`; 4 tests). The parsed values are what `onSave` sends. The name shows "Enter a name" inline and Save disables while it is invalid (checked in the app).
> 4. `ProjectsProvider` now provides data (`projects`, `chats`, `loading`, lookups) and actions (stable writes and loads) as two contexts: `useProjectsData()` and `useProjectActions()`; `useProjects()` still returns both. The new-project page and the panels hook use actions only.
> Phase 3 open: 2 (one chat-page controller for `/chat` and project chat; both pages are large and the dev backend's chat stream was unreliable for live checks).
>
> Done (Phase 1):
> 1. Route files: `projects/loading.tsx`, `project/[id]/loading.tsx`, `project/[id]/not-found.tsx` (shared views in `components/Projects/ProjectRouteStates.tsx`; the detail page's bare "Project not found." text now uses the same view, with a link back). `(app)/error.tsx` already covers errors. The instructions, files and member panels are each wrapped in `BlockErrorBoundary`.
> 2. Lazy modals: `components/Projects/lazy-modals.tsx` loads Edit, Delete, Share and Move-to-project the first time each opens and keeps it mounted afterwards, so exit animations still play; Leave is a plain dynamic import. All 11 import sites now use it, including the sidebar and every chat history row.
> 3. Zod: `lib/api/project-schemas.ts` validates every project, project chat and member response; list rows that fail are dropped with one warning instead of failing the whole list. Tests in `project-schemas.test.ts`.
> 4. URL state was already in place (`scope`, `view`, `sort`, `q`); search filtering now uses `useDeferredValue`.
> 5. A11y: all five project modals have `role="dialog"`, `aria-modal`, a label and `useFocusTrap` (focus moves in, Tab is trapped, focus returns on close, Esc closes). `useFocusTrap` now reads `onEscape` through a ref, so an inline callback no longer re-runs the trap on every render.
> 6. Analytics: `project_deleted`, `project_left`, `project_member_added` and `chat_moved_to_project` fire after the server succeeds, in `lib/api/projects.ts`. They are added to `events.ts` and the Mixpanel doc.
>
> Phase 2 (Oct 14 2026):
> 1. `ProjectsProvider` keeps its API but holds no server state of its own: the list and the flat chat list are React Query entries (`queryKeys.projects.list/chats/chatLoad(user)`), so they clear on logout and refetch on focus. Every optimistic write (update, delete, upload, remove file, add/remove chat) first cancels the in-flight list fetch so a late response can't overwrite it, and still rolls back only the item it changed. `loadProjectChats` dedupes through `fetchQuery` (replacing `chatLoadsRef`); `refreshProjects` is a refetch that rejects on failure. Mappers and merge rules (`mergeSummaries`, `mergeProjectChats`, `upsertProject`, `toApiPatch`) moved to `lib/projects/project-model.ts` with tests; the provider shrank 586 → ~330 lines and lost its mojibake comments. Shared `optimisticUpdate` helper in `lib/query-invalidation.ts` (tested against a late response).
> 2. `memberListVersion`/`refreshKey`/`onMemberAdded` removed: `ProjectMembersPanel`, `ProjectAddMembersList` and `LeaveProjectModal` share `projectMembersQuery` (`lib/projects/project-queries.ts`); adding or removing a member invalidates it.
> 3. The six hand-rolled `res.ok`/`ApiError` blocks in `lib/api/projects.ts` now use the existing `apiFetchVoid` (errors carry the backend `detail` through `buildApiError`).
> 5. `canProject(action, project, orgId)` in `lib/projects/project-permissions.ts` (edit-content, delete, leave, manage-members, change-visibility) replaces the copies in `/projects` and `/project/[id]`; tested.
> 4. The file-size localStorage key is registered as `projectFileSizesKey` in `storage-keys.ts`; the cache and HEAD requests stay until the backend returns sizes.
>
> Open: item 6 (normalise chats by id, shared with chat history) moves with the Chat Phase 2 migration; page splits; keyboard test of the scope/sort dropdowns; shared-project collaborator edit rights need the member list.
>
> Backend gaps: `size_bytes` on project documents, so the client stops sending HEAD requests and caching sizes in localStorage.

Scope: `app/(app)/projects` (list, new), `app/(app)/project/[id]` (detail, `chat/[chatId]`), `context/projects-context.tsx`, `context/project-panel-context.tsx`, `lib/api/projects.ts`, `lib/project-*.ts`, `components/ProjectCard`, `EditProjectModal`, `DeleteProjectModal`, `LeaveProjectModal`, `MoveToProjectModal`, `FlatSidebarProjectGroup`. About 6,100 lines.
Method: structural scan (sizes, greps, key sections), not a line-by-line review. Items marked (verify) need a closer look.
Scoring: 1 = applied, 0.5 = partial, 0 = absent, applicable principles only.

## Overall efficiency: ~42% (15.0 / 36 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 3 | 1.3 | 43% |
| 2. Architecture | 8 | 3.3 | 41% |
| 3. Component Patterns | 3 | 1.3 | 43% |
| 4. Data Model | 8 | 3.5 | 44% |
| 5. Interfaces and APIs | 6 | 3.8 | 63% |
| 6. Optimizations | 8 | 1.8 | 23% |

Not applicable: SSG, ISR, RSC, Monorepo, HOC, Polymorphic, Redux vs MobX, tRPC, WebSocket, PWA, cursor pagination, real-time state, list virtualisation (project counts are small).

---

## 1. Already applied well

| Principle | Evidence |
|---|---|
| API-layer separation (#40, #45) | All HTTP in `lib/api/projects.ts` via `apiFetch`/`apiFetchJson`; `ApiError` surfaced with backend `detail` |
| Non-2xx guard | Delete, link/unlink chat, invite, remove member check `res.ok` explicitly |
| Optimistic updates (#33) | Create/update/delete in `ProjectsProvider` apply the change first and roll back on failure |
| Provider pattern (#24) | `ProjectsProvider` + `useProjects()` guard hook; `ProjectPanelProvider` is small (46 lines) |
| Stable refs for async | `projectsRef`, `chatLoadsRef` (in-flight chat load dedupe) prevent stale closures and duplicate loads |
| Pure helpers separated | `project-filters.ts`, `project-list-utils.ts` |
| Reuse of chat | Project chat page renders the shared `ChatInterface` rather than a copy |
| Separated modals | Edit/Delete/Leave/Move modals are their own components |
| Auth / BFF (#41, #42) | Goes through the app proxy with the Auth0 session |
| Role-aware UI | Owner/member/workspace capability checks via `useOrg()` caps |
| Test | `lib/api/projects.test.ts` |

## 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Component architecture (#12) | `project/[id]/page.tsx` 1,129 lines with 26 `useState` + 11 `useEffect`; `project/[id]/chat/[chatId]/page.tsx` 838 lines with 27 + 13 | Container hooks (`useProjectDetail`, `useProjectMembers`) + sections (header, files, chats, members, instructions) |
| Container/Presentation (#22) | Pages mix permission derivation, data loading, effects and markup | Extract `useProjectPermissions(project, org)` and presentational panels |
| Provider scope (#24) | One 586-line context holds list, details, chats, files, sizes, optimistic ops, localStorage; any change re-renders all consumers (verify) | Split reads (list/detail) from actions; selector-based access, or move reads to React Query |
| Error boundaries (#19) | Only in the project chat page; none on list/detail/modals | Boundary per section; add `error.tsx` |
| Accessibility (#20) | Few `aria-*` (7 in detail page, 3 in list, 0 in the context-driven sidebar group); multi-select and filters need keyboard/label review (verify) | Roles for tabs/filters, labelled modals, focus return |
| Storage (#32) | `storageSizesKey(projectId)` in localStorage keeps file sizes per project, outside `storage-keys.ts`, never expires | Centralise; see "wrong" below |
| Filtering (#53/#54) | List filtering and search run synchronously in render (`filter` + `includes`) | `useDeferredValue` for search; debounce if server-side later |
| URL as state (#34) | Route carries project id; the scope filter and search on the list page are local state (verify) | Put `scope`, `q`, `sort` in search params so views are shareable and survive reload |
| Observability (#55) | 3 track calls in the context, 1 in detail page, none in list | Track create/delete/leave/share/move events with the typed helpers |

## 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| No response validation | `apiFetchJson<ProjectSummary[]>(...)` is a type cast, not a check; personas use Zod, projects do not, so a backend change fails silently in the UI | Zod schemas for `ProjectSummary`, `ProjectResponse`, members, chats; `safeParse` at the API boundary |
| Hand-rolled server cache in context | Fetching, loading flags, refresh, per-project chat load tracking, and a fetch-on-demand of sizes live in a context instead of a query cache | React Query: `["projects"]`, `["project", id]`, `["project", id, "chats"]`, `["project", id, "members"]` with mutations and `onMutate` rollback (the optimistic code already exists, just move it) |
| File sizes via HEAD requests + localStorage | The context makes background HEAD requests for each document and stores sizes in localStorage because the server size is sometimes missing (lines ~151, ~388) | Have the backend return `size_bytes` always (backend is read-only for us, so request it); until then, a query with cache instead of localStorage |
| Counting and filtering on the client | `personalCount`/`workspaceCount`/`sharedCount` recomputed from full list in the page | Derive once in a selector, or take counts from the API |
| `memberListVersion` counter | Page bumps a number to force the member list to refetch (line ~141) | Query invalidation |
| Duplicate-prone API pattern | Many near-identical `apiFetch` + `res.ok` + error-parse blocks (invite, remove, link, unlink) | One `apiRequest()` helper that throws `ApiError` on non-2xx |
| Project chat page duplicates chat page wiring | 838 lines of pin mentions, initial prompt hand-off and model selection overlap with `chat/page.tsx` (1,017 lines) | Share a `useChatPageController` between both routes |

## 4. Missing, to add

| Principle | Add |
|---|---|
| Code splitting (#46, #48) | No `dynamic()` in the project surface: lazy-load Edit/Delete/Leave/Move modals, members/sharing panel, project chat route |
| `useTransition` (#54) | Switching scope tabs, search |
| Form state (#35) | React Hook Form + Zod for create/edit project (name, description, instructions, files, visibility) |
| Suspense / loading (#7) | `loading.tsx` and skeletons for list/detail |
| `error.tsx` / `not-found.tsx` | Missing or deleted project (404), no access (403) states |
| Core Web Vitals / perf budget (#8, #56) | Budget for project routes |
| Data normalisation (#31) | Projects by id; chats referenced by id from project and chat history so renames show everywhere (today `renameChat` is in the projects context while chat history lives in another hook, risk of drift, verify) |
| Permissions helper | One `can(user, action, project)` for owner/member/workspace rules, currently inline comments plus several booleans in the page |
| Test coverage | Optimistic rollback paths, permissions, filters, Move-to-project flow |
| Pagination | Projects and project chats are fetched as full lists; add paging if counts grow |

---

## Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week.

### Phase 1: Quick wins (S, 42% → ~55%)
1. Add `error.tsx`, `loading.tsx`, `not-found.tsx` for `projects` and `project/[id]`; boundaries around member and file panels. (+1.0)
2. Lazy-load the four modals, members/sharing panel and project chat route. (+1.0)
3. Zod schemas on every project API response. (+1.0)
4. Search/filter state in URL params; `useDeferredValue` for search. (+1.0)
5. Aria roles, labelled dialogs, focus return; keyboard test of filters. (+1.0)
6. Typed analytics for create/delete/leave/share/move. (+0.5)

### Phase 2: Data layer (M, → ~70%)
1. Move list, detail, chats, members to React Query; port the existing optimistic/rollback logic into mutations; delete the corresponding context code. (+2.5)
2. Replace `memberListVersion` and manual refresh flags with invalidation. (+0.5)
3. Single `apiRequest` helper for the repeated fetch + error blocks. (+0.5)
4. Remove localStorage file-size cache once the backend returns sizes (request the field). (+0.5)
5. Shared `can()` permission helper. (+0.5)
6. Normalise chats by id shared with chat history. (+0.5)

### Phase 3: Components (M-L, → ~88%)
1. Split `project/[id]/page.tsx` and the project chat page into container hooks + presentational sections, none above about 400 lines. (+2.0)
2. Share a chat-page controller between `/chat` and project chat routes. (+1.0)
3. React Hook Form + Zod for create/edit forms. (+1.0)
4. Slim `ProjectsProvider` to actions only (or retire it). (+1.0)

### Phase 4: Governance (S-M, → 100%)
1. Web Vitals and route performance budgets in CI. (+1.0)
2. Tests: optimistic rollback, permissions, filters, move flow, API schema failures. (+1.0)
3. Pagination for projects and project chats. (+0.5)
4. Accessibility audit (axe plus screen reader). (+0.5)
5. `useTransition` for tab/scope switches. (+0.5)

Re-score after each phase and settle all "(verify)" items first.
