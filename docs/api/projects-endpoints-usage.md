# Projects Endpoints — Frontend Usage Map

Cross-references every "projects" backend endpoint against how the front-end calls it: `config.ts` constant, wrapper function, and every UI location that triggers it. Sibling doc to [`chat-endpoints-usage.md`](./chat-endpoints-usage.md), [`persona-endpoints-usage.md`](./persona-endpoints-usage.md), [`persona-shares-endpoints-usage.md`](./persona-shares-endpoints-usage.md), [`pins-endpoints-usage.md`](./pins-endpoints-usage.md), [`highlights-endpoints-usage.md`](./highlights-endpoints-usage.md), [`users-endpoints-usage.md`](./users-endpoints-usage.md), and [`stripe-endpoints-usage.md`](./stripe-endpoints-usage.md).

This doc covers 11 endpoints. `GET/POST/DELETE /projects/{project_id}/chats(/{chat_id})` are **not** repeated here — they're already covered in [`chat-endpoints-usage.md`](./chat-endpoints-usage.md#5-project-chats-projectsproject_idchats) §5. **All 11 are actively used** — a third fully-live group, alongside `highlights` and `stripe`. Most wrappers live in `src/lib/api/projects.ts`; the 3 org-nested member endpoints live in `src/lib/api/teams.ts`.

Almost everything routes through `src/context/projects-context.tsx` (`ProjectsProvider`/`useProjects()`), which owns optimistic-update + rollback logic for create/update/delete/upload/remove-file. The one exception is project visibility, which the project detail page calls directly — `useProjects()` exposes no visibility action.

---

## `GET /projects` (List Projects)
- **`config.ts`**: `PROJECTS_ENDPOINT`
- **Wrapper**: `fetchProjects()` (`projects.ts`)
- **Used by**:
  - `projects-context.tsx`'s bootstrap effect — fires once whenever `ProjectsProvider` mounts, i.e. on entering the authenticated app shell, not tied to a specific click.
  - `souvenir-slack/page.tsx` — an org admin opening the Slack integration settings page (with Slack already connected), to list org-shared projects for channel-mapping.
  - `settings/(org)/members/page.tsx` — an org admin clicking **Invite members**, to populate the project picker in the invite dialog.

## `POST /projects` (Create Project)
- **`config.ts`**: `PROJECTS_ENDPOINT` (same constant, POST verb)
- **Wrapper**: `createProjectApi(params)` (`projects.ts`, multipart, direct-upload to skip the proxy's 4.5MB cap) — accepts `title`/`description`/`system_instruction`/`tags`/`organization_id`/`files`.
- **Context**: `createProject(name, description, teamId?)` (`projects-context.tsx`) — optimistically prepends the new project to state, fires `project_created` analytics.
- **Used by**: `projects/new/page.tsx`'s `handleCreate()` — filling in a name (required) + optional description and clicking **Create project**.
- **Nuance**: the only real caller passes just `(name, description)` — no `teamId`, no `files`. Every project is created **private** with nothing attached; org-sharing only happens afterward via the visibility flow (below). `createProjectApi`'s `files`/`teamId` params and the wrapper's multipart file-upload branch are fully typed and wired but never actually exercised by any current UI path.

## `GET /projects/{project_id}` (Get Project)
- **`config.ts`**: `PROJECT_DETAIL_ENDPOINT(projectId)`
- **Wrapper**: `fetchProject(projectId)` (`projects.ts`)
- **Context**: `loadProject(id)` (`projects-context.tsx`) — merges cached file-size metadata from `localStorage`, background-`HEAD`s any file URL still missing a size.
- **Used by**:
  - `project/[id]/page.tsx` — mounting/navigating to a project's detail page (loaded in parallel with its chat list).
  - `project/[id]/page.tsx`'s `handleSaveVisibility()` — re-fetched right after a successful visibility PATCH, to refresh `teamId`/`visibility` from the server.
  - `project/[id]/chat/[chatId]/page.tsx` — opening a specific chat inside a project, so the project sidebar/header has data on that route too.

## `PATCH /projects/{project_id}` (Update Project)
- **`config.ts`**: `PROJECT_DETAIL_ENDPOINT(projectId)` (same constant, PATCH verb)
- **Wrapper**: `updateProjectApi(projectId, params)` (`projects.ts`, form-urlencoded)
- **Context**: `updateProject(id, patch)` (`projects-context.tsx`) — optimistic patch with rollback on failure; fires `project_instructions_added` analytics when instructions are part of the patch.
- **Used by**:
  - `project/[id]/page.tsx`'s `EditProjectModal` — **"⋮" menu → Edit** on the project detail page, saving name/description/tags.
  - `project/[id]/page.tsx`'s `SystemInstructionsModal` — opening the Instructions & Files panel's instructions editor and saving.
  - `projects/page.tsx`'s inline edit modal — picking **Edit** on a project card in the `/projects` list.

## `DELETE /projects/{project_id}` (Delete Project)
- **`config.ts`**: `PROJECT_DETAIL_ENDPOINT(projectId)`
- **Wrapper**: `deleteProjectApi(projectId)` (`projects.ts`)
- **Context**: `deleteProject(id)` (`projects-context.tsx`) — guards on `canEdit` (toasts and bails if the viewer lacks permission), optimistic remove with rollback.
- **Used by**:
  - `project/[id]/page.tsx` — **"⋮" menu → Delete** on the project detail page, then navigates back to the projects list.
  - `projects/page.tsx`'s `handleDelete()` — the delete action on a `/projects` list row; if the project has any chats, opens a confirmation dialog instead of deleting immediately.
  - `projects/page.tsx`'s `handleDeleteConfirm()` — confirming that dialog's **Delete** button.

## `PUT /projects/{project_id}/files` (Add Project Files)
- **`config.ts`**: `PROJECT_FILES_ENDPOINT(projectId)`
- **Wrapper**: `addProjectFilesApi(projectId, files)` (`projects.ts`, multipart, direct-upload)
- **Context**: `uploadFiles(projectId, files)` (`projects-context.tsx`) — tracks per-file byte sizes in `localStorage` since the backend doesn't reliably return `size_bytes` immediately.
- **Used by**: `project/[id]/page.tsx`'s `ProjectFilesPanel` (only wired when `project.canEdit`), inside the project's **Instructions & Files** side panel — either dragging files onto the panel, or clicking the attach icon to open a file picker.

## `DELETE /projects/{project_id}/files/{document_id}` (Remove Project File)
- **`config.ts`**: `PROJECT_FILE_ENDPOINT(projectId, documentId)`
- **Wrapper**: `removeProjectDocumentApi(projectId, documentId)` (`projects.ts`)
- **Context**: `removeFile(projectId, fileId)` (`projects-context.tsx`) — optimistic removal, explicitly re-checks the response no longer contains the deleted id (guards against a false-200), clears the cached size.
- **Used by**: `project/[id]/page.tsx`'s `ProjectFilesPanel` (gated by `canEdit`) — clicking the hover-revealed remove/trash control on a file card in the Instructions & Files panel.

## `PATCH /projects/{project_id}/visibility` (Set Project Visibility)
- **`config.ts`**: `PROJECT_VISIBILITY_ENDPOINT(projectId)`
- **Wrapper**: `setProjectVisibility(projectId, visibility, teamId?)` (`projects.ts`) — sends `{visibility: 'private'|'org', organizationId?}`; the endpoint returns `204`, so the wrapper manually checks `res.ok` rather than using the JSON-parsing helper (a prior bug silently swallowed a non-owner's 403 by trying to parse an empty body).
- **Called directly from the page** — not via `projects-context.tsx`; `useProjects()` has no visibility action.
- **Used by**: `project/[id]/page.tsx`'s `handleSaveVisibility()` — clicking the share/visibility icon in the project header (shown only when `project.canManageVisibility`), picking Private/Shared in the modal, and clicking **Save**. On success it also re-fetches the project (`loadProject`, above) and toasts confirmation.

## `GET /organizations/{organization_id}/projects/{project_id}/members` (List Project Members)
- **`config.ts`**: `ORG_PROJECT_MEMBERS_ENDPOINT(orgId, projectId)`
- **Wrapper**: `listProjectMembers(orgId, projectId)` (`teams.ts`)
- **Used by**: `components/ProjectMembersPanel/index.tsx` — mounts alongside the org roster fetch whenever the panel opens. Reached by clicking **Team** in the project detail page's floating side menu (only shown when the project has a `teamId`, i.e. is org-shared) → `ProjectTeamPanel` → `ProjectMembersPanel` (only rendered when `canEdit`). Lists everyone with a direct per-project grant, filtering out org owners/admins and invite-pending users who already have implicit access.

## `POST /organizations/{organization_id}/projects/{project_id}/members` (Add Project Member)
- **`config.ts`**: `ORG_PROJECT_MEMBERS_ENDPOINT(orgId, projectId)` (same constant, POST verb)
- **Wrapper**: `addProjectMember(orgId, projectId, userId)` (`teams.ts`)
- **Used by**: `ProjectMembersPanel/index.tsx`'s `handleAdd()` — clicking **Add member**, selecting an eligible org member from the dropdown (owners/admins/already-added/invite-pending users are filtered out), and confirming.

## `DELETE /organizations/{organization_id}/projects/{project_id}/members/{member_id}` (Remove Project Member)
- **`config.ts`**: `ORG_PROJECT_MEMBER_ENDPOINT(orgId, projectId, memberId)`
- **Wrapper**: `removeProjectMember(orgId, projectId, memberId)` (`teams.ts`)
- **Used by**: `ProjectMembersPanel/index.tsx`'s `handleRemove()` — clicking **Remove** next to a listed member's row.

---

## Summary

| Endpoint | Status |
|---|---|
| `GET /projects` | Live — `fetchProjects()`, 3 call sites |
| `POST /projects` | Live — `createProjectApi()`; `files`/`teamId` params unused by the sole caller |
| `GET /projects/{id}` | Live — `fetchProject()`, 3 call sites |
| `PATCH /projects/{id}` | Live — `updateProjectApi()`, 3 call sites |
| `DELETE /projects/{id}` | Live — `deleteProjectApi()`, 3 call sites |
| `PUT /projects/{id}/files` | Live — `addProjectFilesApi()` |
| `DELETE /projects/{id}/files/{document_id}` | Live — `removeProjectDocumentApi()` |
| `PATCH /projects/{id}/visibility` | Live — `setProjectVisibility()`, called directly (bypasses context) |
| `GET /organizations/{org}/projects/{id}/members` | Live — `listProjectMembers()` |
| `POST /organizations/{org}/projects/{id}/members` | Live — `addProjectMember()` |
| `DELETE /organizations/{org}/projects/{id}/members/{member_id}` | Live — `removeProjectMember()` |

No dead endpoints or wrappers in this group. The only thing worth flagging: `POST /projects`'s `files`/`teamId` parameters are fully implemented but never populated by the single real call site — new projects are always created private with no attached files, with sharing and file upload both happening as separate follow-up actions.
