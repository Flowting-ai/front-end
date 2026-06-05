# Persona Configure — End-to-End Logic

---

## 1. Entry: Template or Custom Selection

User lands on the persona creation wizard and picks either a **template** or a **custom (blank)** persona.

- Template personas come with a pre-written system instruction and a random avatar assigned automatically.
- Custom personas start with all fields empty.

---

## 2. Wizard Steps (Name → Purpose → Tone)

Three sequential pages before the configure tabs:

- **Name** — user sets the persona name. Back is always allowed. Continue is blocked with a toast if the field is empty.
- **Purpose / Description** — user writes a short purpose statement. Same back/continue rules.
- **Tone** — user picks a tone. On continue, the app calls `/persona/starter` in the background to generate an initial system instruction based on name + purpose + tone, then stores it in `sessionStorage` (`persona_wizard_starter`). The result is used to pre-populate the Instructions tab.

All three wizard values are saved to `sessionStorage` (`persona_wizard_draft`) on every step. They are read and cleared once when the Instructions tab initialises.

---

## 3. Configure Tabs

Five tabs: **Instructions · Profile · Knowledge · Connectors · Sharing**

All tabs share a common layout with:
- A tab bar centered in the header
- **Save version** and **Publish** buttons in the top-right
- A back arrow (top-left) that triggers the leave guard if the persona is unpublished
- Three collapsible side panels (Test Chat, AI Suggestions, Versions) accessible from the floating menu

---

### 3a. Instructions Tab *(Required)*

**Fields:** Model selector · System instruction textarea · Creativity (temperature) slider · Example conversations (optional, collapsible)

**Initial state:**
- Template persona → system instruction and model hint pre-populated from the template preset. Model selector is left unselected — user must explicitly choose a model.
- Custom persona → all fields empty. User must fill both model and instruction before switching to any other tab.
- Editing existing persona → all fields loaded from the saved version. Full navigation available immediately.

**Tab-switch guard:**
Switching to any other tab from Instructions is blocked if:
- No model is selected → toast: *"Please select a model before switching tabs."*
- System instruction is empty → toast: *"Please add system instructions before switching tabs."*

This guard only applies while leaving the Instructions tab outward — not when returning to it.

**State persistence (no backend call on tab switch):**
Every keystroke saves a draft to `sessionStorage` keyed as `persona_instructions_draft_{repoId}`. When the user returns to this tab, the draft is re-loaded automatically. No `updateVersion` API call is made on tab switch.

**Change tag auto-detection:**
- Editing the system instruction → adds `Instructions` tag to `pendingChangeTags`
- Changing model or temperature → adds `Model` tag

**Save Version:**
1. Validates model is selected → toast if missing
2. Validates instruction is not empty → toast if missing
3. Checks version limit (max 5) → toast if at limit
4. Calls `createVersion()` — creates an immutable snapshot
5. Updates URL with new `versionId`
6. Stamps `pendingChangeTags` onto the version, then clears them
7. Clears the sessionStorage draft
8. Opens the Versions panel and shows *"Version saved"* toast

**Publish:**
1. If `isDirty` (instruction / model / temperature changed since last save) → calls `updateVersion()` in-place on the current version (no new version created, no version card added)
2. Calls `setActiveVersion()` → makes the persona live
3. Stamps and clears `pendingChangeTags`
4. Busts the frontend personas cache
5. Stores published `versionId` in `sessionStorage`
6. Redirects to `/personas/published`

---

### 3b. Profile Tab *(Optional — always pre-filled)*

**Fields:** Avatar (upload / drag-drop / paste) · Name · Handle (read-only, auto-generated) · Description (120 char max) · Tags

Language field has been removed.

**Initial state:**
- Loaded from `sessionStorage` draft first (`persona_profile_{repoId}`). If no meaningful draft exists, falls back to API data from the active version.
- Avatar is always refreshed from the API to keep the test chat panel in sync.

**State persistence (no backend call on tab switch):**
Every field change writes to `sessionStorage`. No `updateVersion` API call on tab switch. Data survives tab switches and page reloads within the same browser session.

**Change tags:** Any field change adds `Profile` to `pendingChangeTags`.

**Save Version:**
1. Calls `updateVersion()` with name, description, avatar, image
2. Resets `isDirty`
3. Stamps and clears `pendingChangeTags`
4. Opens Versions panel and shows *"Profile saved"* toast

**Publish:**
1. If `isDirty` → calls `updateVersion()` in-place (same as Instructions tab — unsaved profile changes are flushed to the current version before going live)
2. Stamps and clears `pendingChangeTags`
3. Calls `setActiveVersion()` → persona goes live
4. Redirects to `/personas/published`

---

### 3c. Knowledge Tab *(Optional)*

**Fields:** File upload area · Uploaded files list with preview and delete

**Behaviour:**
- File uploads and deletes call the API immediately (`uploadDocument` / `deleteDocument`) — files are live in the version the moment they are added or removed.
- `isDirty` is set to `true` when any upload or delete succeeds, indicating the version's change tags have not been stamped yet.
- File sizes and blob preview URLs are cached in refs and `sessionStorage` so the MB counter and eye-icon previews survive API round-trips and tab switches.
- On returning to this tab, files are re-fetched from the API — no data is lost.

**Save Version:**
1. Calls `updateVersion()` (updates version name only — files are already in the API)
2. Stamps and clears `pendingChangeTags`
3. Opens Versions panel and shows *"Version saved"* toast

**Publish:**
1. If `isDirty` → calls `updateVersion()` in-place to stamp the version with pending changes before going live
2. Stamps and clears `pendingChangeTags`
3. Calls `setActiveVersion()`
4. Redirects to `/personas/published`

---

### 3d. Connectors Tab *(Optional)*

**Behaviour:**
- All connectors that are active (linked) in Settings are **enabled for the persona by default** when the tab first loads.
- User can **disable** individual connectors for this persona. This is persona-level only — it does not affect the connector in Settings or any other persona.
- Disabled connectors are tracked in `localStorage` (`persona_conn_removed_{versionId}`) so they do not auto-re-enable on subsequent loads.
- If a user re-enables a connector, it is removed from the disabled tracking list.
- Connector toggles call `setVersionConnectors()` immediately — no draft state, no dirty flag.

**UI sections:**
- **Connectors enabled for this persona** — all linked connectors that are currently on for this persona
- **Connectors disabled for this persona** — only shown when at least one connector has been toggled off; lists connectors the user has explicitly disabled

**Save Version:**
Calls `updateVersion()` (name only, connector state is already in the API) and stamps tags.

**Publish:**
1. Connector state is already in the API — nothing to flush
2. If `pendingChangeTags` is non-empty → calls `updateVersion()` to stamp them before going live
3. Calls `setActiveVersion()`
4. Redirects to `/personas/published`

---

### 3e. Sharing Tab *(Optional)*

**Visibility:** Locked to **Private** for individual plan (no UI to change this).

**Super Link:**
- User can generate a shareable URL that allows anyone to chat with this persona without an account
- User sets a token credit limit before generating
- Generates via `createShare({ share_type: 'link', credit_limit })`
- Token usage bar shows credits consumed
- Link can be revoked at any time via `revokeShare()`

**Email Invite:**
- User can send a personalised link to a specific email address
- Per-invite token limit
- Creates via `createShare({ share_type: 'email', recipient_emails: [...], credit_limit })`
- Existing invites listed with usage stats and individual revoke option

**Save Version / Publish:**
- Sharing actions (link generation, revocation, email invites) save to the API immediately — no dirty state
- Publish: if `pendingChangeTags` is non-empty → stamps them via `updateVersion()` before calling `setActiveVersion()`
- Redirects to `/personas/published`

---

## 4. Side Panels

Accessible from the floating action menu (right-centre of the configure layout). Only one panel can be open at a time.

### Test Chat Panel
Live chat against the current version. Used to test persona behaviour before publishing. Supports file attachments, web search toggle, and connector activity display. Expands to a full overlay on demand.

### AI Suggestions Panel
A guided chat that reads the current persona state and answers questions about improving the system instruction, tone, or coverage. Expands to a full overlay on demand.

### Versions Panel
Displays the last 5 saved versions, ordered newest-first. Each card shows:
- Persona name and handle
- Save date/time
- Change tags (Instructions, Model, Profile, Knowledge, Connectors, Sharing)
- **Current** badge on the active version
- **Restore** and **Delete** buttons on non-current versions

Restoring a version updates the editor with that version's content, updates the URL, and shows a toast. If the user is not on the Instructions tab, they are navigated there to see the restored content.

---

## 5. Save Version Logic

### Trigger
User explicitly clicks **Save version**.

### Validation (Instructions tab only — required fields)
- If no model selected → toast: *"Please select a model before saving a version."* — save blocked
- If instruction is empty → toast: *"Please add system instructions before saving a version."* — save blocked
- If 5 versions already exist → toast: *"Max version limit reached (5). Please delete an older version first."* — save blocked

### What happens on save
1. `createVersion()` is called — creates an **immutable snapshot** of the current instruction, model, temperature, avatar, and name
2. The URL is updated with the new `versionId`
3. `pendingChangeTags` are stamped onto the new version card and then cleared
4. The sessionStorage instruction draft is cleared
5. The Versions panel opens
6. Toast: *"Version saved"*

### What saving affects
- **Instructions** and **Profile** data are stored per version. Reverting to a version restores both.
- **Knowledge** files, **Connector** configuration, and **Sharing** settings are **not** per-version — they exist at the version level independently of the save action.

### What saving does in /personas
- Saving creates a **draft persona card** visible in `/personas`. It is shown as a draft — not available for use in chat, brain, or other features.

---

## 6. Publish Logic

### Trigger
User clicks **Publish** (or **Republish**) on any of the 5 tabs.

### Pre-publish auto-save (all tabs)
Before publishing, each tab flushes any unsaved local changes into the **current version in-place** (no new version is created, no version card appears):

| Tab | Condition | Action |
|---|---|---|
| Instructions | `isDirty` | `updateVersion()` with instruction, model, temperature |
| Profile | `isDirty` | `updateVersion()` with name, description, avatar |
| Knowledge | `isDirty` | `updateVersion()` with name (files already in API) |
| Connectors | `pendingChangeTags.length > 0` | `updateVersion()` (connector state already in API) |
| Sharing | `pendingChangeTags.length > 0` | `updateVersion()` (sharing state already in API) |

After flushing, `pendingChangeTags` are stamped onto the version and cleared.

### What happens on publish
1. Pre-publish flush (see above)
2. `setActiveVersion(repoId, versionId)` — this is what makes the persona live
3. Frontend personas cache is busted
4. Published `versionId` stored in `sessionStorage`
5. User is redirected to `/personas/published` with persona name, repoId, and versionId in the query

### What publishing does in /personas
- The persona card in `/personas` becomes fully live and usable — available to use in chat, brain, persona chat, and other features.

### Changing the live version
Two paths:
- **New version:** Make changes → Save version → Publish
- **Revert to older version:** Versions panel → Restore → Publish

---

## 7. State Persistence (sessionStorage)

Data is kept locally across tab switches and page reloads without any backend write:

| Key | Stores | Written by |
|---|---|---|
| `persona_instructions_draft_{repoId}` | `{ instruction, temperature, modelId }` | Instructions tab on every change |
| `persona_profile_{repoId}` | `{ avatarUrl, personaName, personaHandle, personaDescription, personaTags }` | Profile tab on every change |
| `persona_live_version_{repoId}` | Published `versionId` | Any tab on publish |
| `persona_wizard_draft` | `{ name, purpose, tone, template }` | Wizard steps |
| `persona_wizard_starter` | `{ system_instruction, persona_tags }` | Tone wizard page (AI-generated) |
| `persona_wizard_purpose_{repoId}` | Purpose string | Instructions tab on repo creation |
| `persona_file_sizes_{repoId}_{versionId}` | `{ filename: bytes }` | Knowledge tab on upload |
| `persona_model_cache_{repoId}` | `{ modelName, companyName }` | Instructions tab on model select |

---

## 8. Leave Guard

### Condition
The leave guard fires when **all** of the following are true:
- A persona repo has been created (`repoId` exists)
- The persona is not in a fully published and clean state
- The persona has content OR was previously published

Computed as: `!!repoId && !isPublished && (hasContent || !!publishedVersionId)`

This covers both:
- **First-time publish** — persona was created and has content but has never been published
- **Re-publish** — persona was published before but has since been changed

### When it fires
- Clicking the back arrow
- Navigating outside of `/persona/configure/` (e.g. to `/personas` or any other route)
- Browser tab close / page reload (native `beforeunload` warning)

Tab-to-tab navigation within `/persona/configure/` does **not** trigger the leave guard.

### Modal
Two buttons:

| Button | Action |
|---|---|
| **Stay** | Closes modal, user stays on the configure page |
| **Leave** | Navigates away without publishing |

There is no "Publish & leave" option — the user must publish explicitly.

---

## 9. Context (Shared State Across All 5 Tabs)

All tabs are wrapped in `PersonaConfigureProvider`. The context exposes:

| Value | Purpose |
|---|---|
| `personaInfo` | `repoId`, `versionId`, `personaName`, `imageUrl`, `connectorSlugs`, guide model/prompt |
| `updatePersonaInfo` | Partial patch to `personaInfo` |
| `needsRepublish` | Whether the leave guard should fire |
| `setNeedsRepublish` | Written by the Instructions tab; consumed by the guard logic |
| `leaveConfirmHref` | Non-null when the leave modal should be shown |
| `safeNavigate` | Navigation wrapper that checks `needsRepublish` before routing |
| `safeBack` | Back wrapper with same guard |
| `registerAutoSave` | Registers a tab-switch callback (currently no-ops — persistence is sessionStorage-only) |
| `pendingChangeTags` | Accumulated change tags across all tabs |
| `addPendingChangeTag` | Adds a tag if not already present |
| `setPendingChangeTags` | Replaces the entire tag list (used after stamping on save/publish) |
| `versions` | Last 5 saved versions |
| `refreshVersions` | Re-fetches the versions list |
| `handleRestoreVersion` | Restores a version and navigates to Instructions tab |
| `setVersionsOpen` | Opens/closes the Versions panel |
| Panel states | `testChatOpen`, `aiSuggestOpen`, `versionsOpen`, `anyPanelOpen` |

---

## 10. Key API Endpoints

| Operation | Method | Endpoint | When called |
|---|---|---|---|
| Create persona repo | POST | `/persona` | New persona wizard completion |
| Get repo | GET | `/persona/{repo_id}` | Instructions init (edit flow) |
| Create version | POST | `/persona/{repo_id}/versions` | Save Version button |
| Update version | PATCH | `/persona/{repo_id}/versions/{version_id}` | Pre-publish flush; Profile/Knowledge save |
| Set active version | PATCH | `/persona/{repo_id}/active` | Publish button (all tabs) |
| List versions | GET | `/persona/{repo_id}/versions` | Versions panel open / refresh |
| Get version | GET | `/persona/{repo_id}/versions/{version_id}` | Tab init; version restore |
| Delete version | DELETE | `/persona/{repo_id}/versions/{version_id}` | Versions panel delete button |
| Upload document | POST | `/persona/{repo_id}/versions/{version_id}/documents` | Knowledge tab file drop |
| Delete document | DELETE | `/persona/{repo_id}/versions/{version_id}/documents/{doc_id}` | Knowledge tab delete |
| Set version connectors | PUT | `/persona/{repo_id}/versions/{version_id}/connectors` | Connector toggle |
| Create share | POST | `/persona/{repo_id}/shares` | Super link generate; email invite |
| Revoke share | DELETE | `/persona/{repo_id}/shares/{share_id}` | Revoke link/invite |
