# Persona (Agent) — End-to-End Logic Specification

> **Purpose of this document:** Canonical source of truth for all persona/agent feature work. Every implementation decision must align with this document. When in doubt, this document wins. Do not remove or simplify any logic described here without explicit user sign-off.

---

## Phase 0 — Agents Library (`/personas`)

### What the page shows
- All personas belonging to the user: draft, active (published), and paused cards.
- Shared personas (personas shared with the user by someone else) also appear here.
- Only **published** (active/paused) personas show as usable cards. Draft personas appear with a visual draft indicator.
- **Saved versions are never shown on this page.** Saved versions exist only inside the Versions Panel within the persona configure page.

### Card content (fetched from Profile tab data)
Each card must display:
- Avatar image (from profile tab) with fallback initials if no image.
- Persona name (from profile tab → name field).
- Tags (from profile tab → tags field — unique per persona, auto-generated + user-added).
- Status badge: `draft`, `active`, or `paused`.

### Shared persona cards
- A persona shared with the user renders identically to owned personas except:
  - **No edit button** on the card.
  - **No edit access** in the persona chat page for that persona.
  - The card is clearly marked as "Shared".

### Filtering
All filter controls on this page must work correctly:
- Filter by status: all / draft / active / paused / shared.
- Filter by tag.
- Search by name.

### Card grid
- Grid overflow and card layout are already working — do not change this.

---

## Phase 1 — Creation Wizard

### Step 0 — Template or Custom selection page

The user clicks **New Persona** (or equivalent CTA) and lands on a selection page with two paths:

| Option | Behaviour |
|---|---|
| **Custom (Start from scratch)** | All wizard fields (purpose, name, tone) start empty. User fills them in manually. |
| **Template card** | A template is pre-selected. Purpose, name, and tone are pre-filled from the template preset. User can review and edit before continuing. |

Both paths lead into the same three-step basics wizard below.

---

### Step 1 — Purpose page (`/agents/basics/purpose`)

**Field:** "What should this agent do?" — free-text input.

**Back button behaviour (unique to this page):**
- Clicking Back opens a confirmation modal:
  > *"Are you sure you want to cancel agent creation?"*
  - **Cancel creation** → discard all wizard data and navigate to `/personas`.
  - **Keep editing** → close modal, stay on this page.

**Cancel button (top-right, present on all three wizard pages):**
- On this page: identical behaviour to the Back button — opens the cancel creation modal.

**Continue button:**
- Disabled until the purpose field contains at least one character.
- On click: saves purpose to persistent wizard state (see [State Persistence](#wizard-state-persistence)) and navigates to the Name page.

**Data persistence:**
- If the user navigates forward and then comes back to this page, the purpose field must be re-populated from saved state — it must never appear empty when the user previously entered a value.

---

### Step 2 — Name page (`/agents/basics/name`)

**Field:** "What should we call it?" — free-text input.

**Back button behaviour:**
- Navigates to the Purpose page.
- The purpose field on the Purpose page must be populated from saved state — no data loss.

**Cancel button (top-right):**
- Opens the cancel creation modal (same as Purpose page back button).

**Continue button:**
- Disabled until the name field contains at least one character.
- On click: saves name to persistent wizard state and navigates to the Tone page.

**Data persistence:**
- If the user returns to this page, the name field must be pre-populated from saved state.

---

### Step 3 — Tone page (`/agents/basics/tone`)

**Field:** "How should {name} sound?" — tone selection (radio or card selection, not free text).

**Back button behaviour:**
- Navigates to the Name page.
- The name field on the Name page must be populated from saved state — no data loss.

**Cancel button (top-right):**
- Opens the cancel creation modal (same as above).

**Continue button:**
- Disabled until the user has selected a tone option.
- On click:
  1. Saves tone to persistent wizard state.
  2. Calls `POST /persona/starter` (or equivalent) in the background with `{ name, purpose, tone }`.
  3. The API response provides: pre-generated system instructions and 4 auto-generated tags.
  4. Both are stored in wizard state (see below).
  5. Creates the persona repo via `POST /persona` — this yields `repoId`.
  6. Creates an initial version via `POST /persona/{repoId}/versions`.
  7. Navigates to `/persona/configure/instructions?repoId={repoId}&versionId={versionId}`.

> **Critical:** Once the user enters the configure tabs, they **cannot return** to the wizard pages. The Back button inside configure means "save draft and exit to /personas" — not "go back to tone/name/purpose". The wizard pages become inaccessible once configure is entered.

---

### Wizard State Persistence

All three wizard values must persist across forward/backward navigation and survive a page refresh within the same session.

Storage key: `persona_wizard_draft` in `sessionStorage`.

Shape:
```json
{
  "purpose": "string",
  "name": "string",
  "tone": "string",
  "template": "string | null"
}
```

API-generated starter data (from tone page continue action):

Storage key: `persona_wizard_starter` in `sessionStorage`.

Shape:
```json
{
  "system_instruction": "string",
  "persona_tags": ["tag1", "tag2", "tag3", "tag4"]
}
```

Both keys are read once when the Instructions tab initialises and then cleared from sessionStorage after being applied.

---

## Phase 2 — (Reserved for additional phases as defined by user)

---

## Phase 3 — Configure Tabs

Five tabs: **Instructions · Profile · Knowledge · Connectors · Sharing**

All tabs share:
- Tab bar in the header.
- **Save version** and **Publish** buttons (top-right).
  - **Save version** is enabled when `pendingChangeTags.length > 0`.
  - **Publish** is enabled only when there are **no unsaved changes** (`pendingChangeTags.length === 0`) AND the agent is not already in a fully published + clean state (`needsRepublish` is true). The user must save a version before they can publish.
- Back arrow (top-left) → triggers leave guard (see [Leave Guard](#leave-guard)).
- Three collapsible side panels: **Test Chat**, **AI Suggestions**, **Versions** — accessible from the floating action menu.

### Panel lock rules (critical checkpoint)
**Test Chat** and **AI Suggestions** panels are **locked** until both of the following conditions are met:
1. All required fields have valid values (model selected, system instructions non-empty).
2. At least one version has been saved (i.e. `createVersion()` has been called at least once for this persona).

When a user tries to open a locked panel, display an inline info card or modal explaining:
> *"Complete setup first: select a model, add system instructions, and save a version before testing your persona."*

**Versions Panel** is always available from the first entry into configure. It is never locked.

---

### Tab 3a — Instructions Tab *(Required fields)*

#### Header section
- **Name:** Populated from the wizard name page (Step 2). Read-only display in the header.
- **Avatar:** Randomly assigned image from `public/persona-avatars` on creation. Falls back to initials if no image resolves. The avatar shown here is always in sync with the Profile tab avatar.
- **Tags:** Populated from the Profile tab's tags field (auto-generated + user-added). Tags update here whenever the Profile tab tags change. Tags are read-only in this header — they are edited in the Profile tab.

#### Fields

**a. Model Selection Dropdown** *(Required — starts empty for custom, pre-set for template)*
- Custom creation: dropdown is empty. User must select a model.
- Template creation: the model best suited for the template is pre-assigned. User can change it.
- Selecting a model sets `isDirty = true` and adds `Model` to `pendingChangeTags`.
- Model selection is persisted to `sessionStorage` (`persona_model_cache_{repoId}`) on change.

**b. System Instructions** *(Required — pre-generated for both custom and template)*
- For custom: auto-generated in detail from `{ purpose, name, tone }` via the `POST /persona/starter` call on the tone page continue action. This text is pre-populated when the user arrives at this tab.
- For template: pre-written system instruction from the template preset.
- User can edit, add to, or replace this text.
- **Undo / Redo:** Full undo/redo history is maintained for this textarea via `use-instruction-history`. Keyboard shortcuts apply (Ctrl+Z / Ctrl+Shift+Z).
- Every keystroke persists to `sessionStorage` (`persona_instructions_draft_{repoId}`) and sets `isDirty = true`, adds `Instructions` to `pendingChangeTags`.

**c. Creativity Level (Temperature)** *(Required — defaults to 0.5)*
- Slider from 0 to 1. Default value is `0.5` on first creation.
- Changing it sets `isDirty = true` and adds `Model` to `pendingChangeTags`.

**d. Example Conversations** *(Optional)*
- A collapsible section where the user can define example input/output pairs.
- These are appended to the system instructions to show the model how the persona should respond.
- Adding or editing examples sets `isDirty = true` and adds `Instructions` to `pendingChangeTags`.

#### Navigation guard (outbound from Instructions tab)
Switching to any other tab from Instructions is blocked if either required field is missing:
- No model selected → toast: *"Please select a model before switching tabs."*
- System instruction is empty → toast: *"Please add system instructions before switching tabs."*

This guard only applies when **leaving** Instructions — not when returning to it.

#### Auto-save on tab switch
When the user switches **away** from the Instructions tab (and the guard is satisfied):
- The current state is written to `sessionStorage` — no API call is made.
- A toast is shown: *"Auto-saved: [list of changed fields]"*
  - Example: *"Auto-saved: Model, System Instructions"*
- The **current version is NOT recreated**. Tab switching only persists to session storage. A new version is only created when the user explicitly clicks **Save version**.
- The version card in the Versions panel is NOT changed on tab switch.

When the user returns to this tab, state is reloaded from `sessionStorage`.

#### Save version
1. Validate model is selected → toast if missing, block save.
2. Validate instruction is not empty → toast if missing, block save.
3. Check version limit (max 5) → toast if at limit, block save.
4. Call `createVersion()` — creates an immutable snapshot.
5. Update URL with new `versionId`.
6. Stamp `pendingChangeTags` onto the new version card, then clear them.
7. Clear the `sessionStorage` instruction draft.
8. Open Versions panel, show toast: *"Version saved"*.

#### Publish
1. If `isDirty`: call `updateVersion()` in-place (flush to current version, no new version created).
2. Stamp and clear `pendingChangeTags`.
3. Call `setActiveVersion(repoId, versionId)`.
4. Bust personas cache.
5. Store published `versionId` in `sessionStorage` (`persona_live_version_{repoId}`).
6. Redirect to `/personas/published`.

---

### Tab 3b — Profile Tab *(Pre-filled, some fields required)*

#### Fields

**a. Avatar Image** *(Optional — pre-assigned)*
- A random avatar from `public/persona-avatars` is assigned at persona creation.
- User can upload a custom image from their device.
- Any change sets `isDirty = true` and adds `Profile` to `pendingChangeTags`.

**b. Name** *(Required — pre-set from wizard)*
- Pre-populated from the wizard Name page (Step 2).
- User can rename the persona here.
- Change sets `isDirty = true`, adds `Profile` to `pendingChangeTags`.
- Name change here must propagate to the Instructions tab header in real-time (or on next tab load).

**c. Handle** *(Required — pre-set, auto-generated from name)*
- Auto-generated slug from the wizard name (e.g. "Customer Support" → `customer-support`).
- Pre-populated from the wizard Name page.
- Handle is shown for reference. Editability is per existing implementation — if currently read-only, keep it read-only.

**d. Description** *(Required — pre-set from wizard)*
- Pre-populated from the wizard Purpose page (Step 1).
- Max 120 characters.
- Change sets `isDirty = true`, adds `Profile` to `pendingChangeTags`.

**e. Tags** *(Optional — pre-generated)*
- 4 tags are auto-generated by the backend (from the `POST /persona/starter` call) and pre-populated here.
- User can add new tags or remove existing tags.
- Any change sets `isDirty = true`, adds `Profile` to `pendingChangeTags`.

**Tags propagation (critical — two destinations):**
1. **Instructions tab header:** The tags displayed below the persona name in the Instructions tab header must always reflect the current state of tags from the Profile tab.
2. **Persona card on `/personas` page:** The tags shown on each persona card in the library must also reflect the profile tags for that persona. Each persona card shows its own unique tags.

#### Auto-save on tab switch
Same behaviour as Instructions tab:
- Write to `sessionStorage` (`persona_profile_{repoId}`) on tab switch — no API call.
- Toast: *"Auto-saved: [changed fields]"* — example: *"Auto-saved: Avatar, Tags"*
- Do NOT create new versions on tab switch.
- Version card in Versions panel is NOT changed on tab switch.

When the user returns to the Profile tab, state is reloaded from `sessionStorage`. If no draft exists in session, fall back to API data.

#### Save version
1. Call `updateVersion()` with name, description, avatar, tags.
2. Reset `isDirty`.
3. Stamp and clear `pendingChangeTags`.
4. Open Versions panel, show toast: *"Profile saved"*.

#### Publish
1. If `isDirty`: call `updateVersion()` in-place.
2. Stamp and clear `pendingChangeTags`.
3. Call `setActiveVersion(repoId, versionId)`.
4. Redirect to `/personas/published`.

---

### Tab 3c — Knowledge Tab *(Optional)*

#### Supported content types

| Type | Behaviour |
|---|---|
| **File upload** | User uploads a file from their device via file picker or drag-and-drop |
| **Link** | User pastes a URL; the backend fetches and indexes its content |

Both files and links are added and removed independently. Both types are sent to the backend immediately on add — they are not held in local draft state.

#### File behaviour
- Upload: calls `uploadDocument()` immediately. The file is live in the version as soon as the upload succeeds.
- Delete: calls `deleteDocument()` immediately. Deletion is permanent for this version.
- If upload fails, show an error toast and do not add the item to the list.
- `isDirty` is set to `true` on any successful upload or delete.
- File sizes and blob preview URLs are cached in refs and `sessionStorage` (`persona_file_sizes_{repoId}_{versionId}`) so the MB counter and preview icon survive tab switches.
- **Size display rule:** If a document's size is less than `0.1 MB` (i.e. less than ~102 400 bytes), display the size in **kilobytes** (e.g. `45 KB`). At or above `0.1 MB`, display in **megabytes** (e.g. `1.2 MB`).

#### Link behaviour
- User pastes a URL into a dedicated link input field.
- Adding a link calls the same upload/document endpoint with a URL payload (or a dedicated link endpoint, per backend API).
- Removing a link calls the delete endpoint for that document entry.
- Links appear in the same list as files, visually distinguished (e.g. link icon vs file icon).
- `isDirty` is set to `true` on any successful link add or remove.

#### Data persistence
- On returning to this tab, the full document + link list is re-fetched from the API — no local draft is needed because all changes are already in the backend.
- File size cache in `sessionStorage` is used to restore the MB counter without an extra API round-trip.

#### How the agent uses this knowledge
- All uploaded documents and indexed links are injected as context when the agent responds in chat or test chat.
- The agent can reference, summarise, and reason over this content.

#### Auto-save on tab switch
No draft to save — files and links are already in the API. If `pendingChangeTags` includes `Knowledge`, the toast shows: *"Auto-saved: Knowledge"*.

#### Save version
1. Call `updateVersion()` (version name only — files and links are already in the API).
2. Stamp and clear `pendingChangeTags`.
3. Show toast: *"Version saved"*.

#### Publish
1. If `isDirty`: call `updateVersion()` in-place.
2. Stamp and clear `pendingChangeTags`.
3. Call `setActiveVersion()`.
4. Redirect to `/personas/published`.

---

### Tab 3d — Connectors Tab *(Optional)*

#### Architecture: block-list model
The backend stores a `blocked_connectors` list per version. Every linked connector in Settings is **implicitly enabled** for the agent unless its slug appears in that block-list. There is no separate "enabled" list to maintain — only the block-list matters.

#### Exactly two UI sections
1. **Connectors enabled for this agent** — all linked connectors whose slugs are NOT in `blocked_connectors`.
2. **Connectors disabled for this agent** — connectors whose slugs ARE in `blocked_connectors`. This section is hidden when the block-list is empty.

There are no other sections or states.

#### Connector card content
Each connector row must display:
- Connector logo/avatar image (from `ConnectorCatalogEntry.icon_url` or the `CONNECTOR_LOGO_MAP`).
- Connector display name (`ConnectorCatalogEntry.display_name`).
- Connector description/permissions (`ConnectorCatalogEntry.description`).
- A toggle switch: ON = enabled for this agent, OFF = disabled for this agent.

Only connectors that are **linked** in Settings appear here. Unlinked connectors are not shown.

#### Enable/disable behaviour
- **Disable a connector (move to blocked):** Calls `setVersionBlockedConnectors(repoId, versionId, [...updatedBlockList])` immediately. Updates `blocked_connectors` on the version. Saves user preference to `localStorage` (`persona_conn_removed_{versionId}`). Moves the card to the "Connectors disabled" section.
- **Enable a connector (remove from blocked):** Calls `unblockVersionConnector(repoId, versionId, slug)` immediately (DELETE on `/blocked-connectors/{slug}`). Removes from `localStorage` preference. Moves the card back to the "Connectors enabled" section.
- Both actions are live API calls with no dirty flag and no draft state. Optimistic UI updates revert on error.

#### Effect of disabling a connector
When a connector is in the block-list for this agent, the agent has **no access to that connector's tools** during any chat or test chat. The blocked slugs are passed to the backend as `disabled_connectors` on every stream request, and the backend excludes those connectors from the agent's available tool set.

#### Data persistence
- On load: fetches `listConnectors()` (full catalog) and `getVersion(repoId, versionId)` (to read `blocked_connectors`). No local draft — the API is always the source of truth.
- On returning to this tab after a tab switch: re-fetches from the API to ensure state is current.

#### Auto-save on tab switch
No draft to save — all connector changes are already in the API. If `pendingChangeTags` includes `Connectors`, the toast shows: *"Auto-saved: Connectors"*.

#### Save version
Call `updateVersion()` (name only — connector state is already in the API). Stamp and clear `pendingChangeTags`.

#### Publish
1. Connector state is already in API — nothing to flush.
2. If `pendingChangeTags` non-empty: call `updateVersion()` to stamp them.
3. Call `setActiveVersion()`.
4. Redirect to `/personas/published`.

---

#### Connector logic in Test Chat panel (configure page)

The Test Chat side panel uses `ConnectorTogglesPanel` — a compact version of the connector UI.

**Load:** Fetches `listConnectors()` + `getVersion()` to get `blocked_connectors`. Builds the enabled set as all linked connectors NOT in the block-list.

**Toggle chips:** Each linked connector appears as a chip (logo + name). Clicking toggles between enabled and blocked. Calls `unblockVersionConnector` or `setVersionBlockedConnectors` immediately.

**State sync:** The enabled connector slugs and the blocked slugs are stored in `PersonaConfigureContext` as `connectorSlugs` and `disabledConnectorSlugs` respectively.

**Stream request:** When the user sends a test message, both `connectorSlugs` (enabled) and `disabledConnectors` (blocked) are forwarded to `testVersionStream()`, which appends them to the POST body as `connector_slugs` and `disabled_connectors` fields. The backend uses these to scope the agent's tool access for that test run.

**Connector prompts during test chat:**
- `tool_connect_prompt` SSE event → displays a `ConnectPromptCard` inline in the chat. The user can go through OAuth or enter an API key to link the connector mid-session.
- `permission_prompt` SSE event → displays a `PermissionPromptCard` asking the user to Allow / Allow once / Block for a specific tool call. The decision is saved to the connector's permission policy in the background.

---

#### Connector logic in final agent chat page (`/agents/[personaId]/chat`)

The final chat page (`PersonaChatInterface`) does **not** present a connector toggle UI to the user. Connector access is fully governed by the published version's `blocked_connectors` list, which was set in the Connectors tab during configuration.

During chat, the same SSE events apply:
- `tool_executing` → shows an `ActivityRow` with an animated spinner, the connector's action verb (e.g. "Searching the web", "Running tool"), and optional label/detail text.
- `tool_progress` → updates the activity row with progress message or status (`executing` / `reading`).
- `tool_complete` → marks the activity row as done, shows duration.
- `tool_connect_prompt` → displays `ConnectPromptCard` inline if the connector isn't linked yet.
- `permission_prompt` → displays `PermissionPromptCard` for per-tool permission decisions.

**Activity row display:**

| Activity type | Verb shown | Icon |
|---|---|---|
| `web-search` | "Searching the web" | Web browsing icon |
| `read-pages` | "Reading document" | PDF icon |
| `csv-execute` | "Analysing data" | Sheets icon |
| `fetch-resource` | "Fetching resource" | Link icon |
| `tool-call` | "Running tool" | Code icon |
| `doc-execute` | "Generating document" | Doc icon |
| `skills` | "Loading skill" | Skills icon |
| `other` | "Processing" | Generic icon |

Status indicators: spinner while active, checkmark when done, error icon on failure. Duration shown on completion.

---

### Tab 3e — Sharing Tab *(Optional)*

**Visibility:** Locked to Private for individual plan — no UI to change visibility level.

#### Credit limit input (Super Link & Email Invite)

The credit limit field governs how many tokens a recipient can consume via a shared link or invite.

**Rules:**
- The **default value** pre-filled in the credit limit input is `50%` of the user's total plan credits.
- The **maximum allowed value** is dynamically set to the user's **remaining credits** in their plan (total plan credits minus credits already spent/allocated). This value must be fetched from the backend on tab load and must reflect real-time remaining credits, not a static cap.
- The tab must display the user's **remaining credits** clearly so they can make an informed decision about how many credits to allocate.
- If remaining credits are zero, the credit input should be disabled and the user shown an appropriate message.
- If the remaining credit count changes (e.g. due to another share being created or revoked), the UI should reflect the updated value.

#### Super Link
- User sets a token credit limit (within the dynamic max described above), then generates a shareable URL — no account required for the recipient to use it.
- Creates via `createShare({ share_type: 'link', credit_limit })`.
- Shows a token usage bar: credits consumed vs. the limit set for this link.
- Link can be revoked at any time via `revokeShare()`.

#### Email Invite
- User sets a per-invite token limit and enters one or more email addresses.
- Creates via `createShare({ share_type: 'email', recipient_emails: [...], credit_limit })`.
- Existing invites are listed with per-invite usage stats and individual revoke buttons.

#### Auto-save on tab switch
No draft — sharing actions (link generation, email invites, revocations) save to API immediately.

#### Save Version / Publish
- If `pendingChangeTags` non-empty: stamp via `updateVersion()` before calling `setActiveVersion()`.
- Redirect to `/personas/published`.

---

## Published Page (`/personas/published`)

### When this page is shown
The user is redirected here immediately after a successful `setActiveVersion()` call (i.e. after clicking Publish from any configure tab).

### What the page must display
- The **agent's name** prominently and cleanly — this is the primary piece of information on the page.
- The name must come from the `personaName` value passed in the redirect query string (`?personaName=...`), or fetched from the persona data if not in the query.
- Supporting content (e.g. a success message, next-step links) may appear below, but the agent name is the focal point.

### What the page must NOT do
- Must not show a generic success screen with no agent identity.
- Must not show a blank name or "undefined".

---

## Auto-Save Toast Specification

When the user switches away from any tab that has `pendingChangeTags` or local draft state, a toast is shown. The toast must be **dynamic** — it lists the specific fields that changed.

Format: *"Auto-saved — [Tab name]: [changed fields]"*

Examples:
- *"Auto-saved — Instructions: Model, System Instructions"*
- *"Auto-saved — Profile: Avatar, Tags"*
- *"Auto-saved — Instructions: Creativity Level"*

Rules:
- One toast per tab switch.
- Do NOT create a new version or new version card on auto-save.
- The existing current version is updated in `sessionStorage` only (no API call for Instructions/Profile).
- Version cards in the Versions panel are NOT added or modified by tab switching.

---

## Version Card Tags

Each version card in the Versions panel shows the **change tags** that were stamped at the time of saving. These tags come from `pendingChangeTags` and represent what changed since the previous version.

Available tags: `Instructions` · `Model` · `Profile` · `Knowledge` · `Connectors` · `Sharing`

Tags are stamped when:
- User clicks **Save version** (explicit save).
- User clicks **Publish** (pre-publish flush stamps any remaining pending tags).

Tags are **never** stamped on tab switch or auto-save.

---

## Leave Guard

### Condition
Fires when all of the following are true:
- `repoId` exists (persona was created).
- Persona is not in a fully published and clean state.
- Persona has content OR was previously published.

Computed as: `!!repoId && !isPublished && (hasContent || !!publishedVersionId)`

### When it fires
- Clicking the back arrow in configure.
- Navigating outside `/persona/configure/**`.
- Browser tab close / page reload (native `beforeunload`).

Tab-to-tab navigation within `/persona/configure/**` does **not** trigger the leave guard.

### Modal
| Button | Action |
|---|---|
| **Stay** | Close modal, remain on configure page |
| **Leave** | Save the current state as a draft version (if unsaved) and navigate to `/personas` |

No "Publish & leave" option — user must publish explicitly.

### Effect of leaving without publishing
- If the user leaves via the leave guard ("Leave" button), the current version state is saved as a **draft**.
- The agent appears on `/personas` as a **draft card** — not available for use in chat, brain, or other features.
- Draft cards are visually distinct from active (published) cards.

---

## State Persistence (sessionStorage Reference)

| Key | Stores | Written by |
|---|---|---|
| `persona_wizard_draft` | `{ purpose, name, tone, template }` | Each wizard step on continue |
| `persona_wizard_starter` | `{ system_instruction, persona_tags }` | Tone page on continue (AI-generated) |
| `persona_instructions_draft_{repoId}` | `{ instruction, temperature, modelId }` | Instructions tab on every change |
| `persona_profile_{repoId}` | `{ avatarUrl, personaName, personaHandle, personaDescription, personaTags }` | Profile tab on every change |
| `persona_live_version_{repoId}` | Published `versionId` | Any tab on publish |
| `persona_wizard_purpose_{repoId}` | Purpose string | Instructions tab on repo creation |
| `persona_file_sizes_{repoId}_{versionId}` | `{ filename: bytes }` | Knowledge tab on upload |
| `persona_model_cache_{repoId}` | `{ modelName, companyName }` | Instructions tab on model select |

---

## Save Version Logic (Explicit)

### Trigger
User explicitly clicks **Save version**.

### Validation (Instructions tab — required)
- No model selected → toast, block.
- Instruction empty → toast, block.
- 5 versions already exist → toast, block.

### What happens
1. `createVersion()` — immutable snapshot.
2. URL updated with new `versionId`.
3. `pendingChangeTags` stamped onto version card, then cleared.
4. sessionStorage instruction draft cleared.
5. Versions panel opens.
6. Toast: *"Version saved"*.

---

## Publish Logic

### Pre-publish condition (all tabs)
Publish is blocked when `pendingChangeTags.length > 0`. The user must first click **Save version** to clear pending changes before the Publish button becomes active. This enforces the intent that the published artifact is always a clean, explicitly saved version — not a mix of saved and unsaved state.

### Pre-publish flush (all tabs)

| Tab | Condition | Action |
|---|---|---|
| Instructions | `isDirty` | `updateVersion()` with instruction, model, temperature |
| Profile | `isDirty` | `updateVersion()` with name, description, avatar, tags |
| Knowledge | `isDirty` | `updateVersion()` (files already in API) |
| Connectors | `pendingChangeTags.length > 0` | `updateVersion()` (connector state already in API) |
| Sharing | `pendingChangeTags.length > 0` | `updateVersion()` (sharing state already in API) |

### What happens on publish
1. Pre-publish flush (above).
2. `setActiveVersion(repoId, versionId)`.
3. Bust personas cache.
4. Store published `versionId` in sessionStorage.
5. Redirect to `/personas/published` with `personaName`, `repoId`, `versionId` in query.

### Effect on `/personas` library
- Before publish: persona shows as draft card.
- After publish: persona shows as active card with full info (name, avatar, tags from profile).

---

## Context (Shared State Across All 5 Tabs)

All configure tabs are wrapped in `PersonaConfigureProvider`. Context exposes:

| Value | Purpose |
|---|---|
| `personaInfo` | `repoId`, `versionId`, `personaName`, `imageUrl`, `connectorSlugs` |
| `updatePersonaInfo` | Partial patch to `personaInfo` |
| `needsRepublish` | Whether leave guard should fire |
| `setNeedsRepublish` | Written by Instructions tab |
| `leaveConfirmHref` | Non-null when leave modal should show |
| `safeNavigate` | Navigation wrapper that checks `needsRepublish` |
| `safeBack` | Back wrapper with same guard |
| `pendingChangeTags` | Accumulated change tags across all tabs |
| `addPendingChangeTag` | Adds a tag if not already present |
| `setPendingChangeTags` | Replaces the entire tag list (used after stamping) |
| `versions` | Last 5 saved versions |
| `refreshVersions` | Re-fetches versions list |
| `handleRestoreVersion` | Restores a version and navigates to Instructions tab |
| `setVersionsOpen` | Opens/closes Versions panel |
| Panel states | `testChatOpen`, `aiSuggestOpen`, `versionsOpen`, `anyPanelOpen` |
| `testChatLocked` | `true` until required fields set AND a version saved |
| `aiSuggestLocked` | `true` until required fields set AND a version saved |

---

## API Endpoints Reference

| Operation | Method | Endpoint | When called |
|---|---|---|---|
| Create persona repo | POST | `/persona` | Tone page continue |
| Get repo | GET | `/persona/{repo_id}` | Instructions init (edit flow) |
| Create version | POST | `/persona/{repo_id}/versions` | Save Version button |
| Update version | PATCH | `/persona/{repo_id}/versions/{version_id}` | Pre-publish flush; explicit save (Profile/Knowledge) |
| Set active version | PATCH | `/persona/{repo_id}/active` | Publish button (all tabs) |
| List versions | GET | `/persona/{repo_id}/versions` | Versions panel open / refresh |
| Get version | GET | `/persona/{repo_id}/versions/{version_id}` | Tab init; version restore |
| Delete version | DELETE | `/persona/{repo_id}/versions/{version_id}` | Versions panel delete |
| Upload document | POST | `/persona/{repo_id}/versions/{version_id}/documents` | Knowledge tab file drop |
| Delete document | DELETE | `/persona/{repo_id}/versions/{version_id}/documents/{doc_id}` | Knowledge tab delete |
| Set version connectors | PUT | `/persona/{repo_id}/versions/{version_id}/connectors` | Connector toggle (legacy — prefer block-list API) |
| Set blocked connectors | PATCH | `/persona/{repo_id}/versions/{version_id}/blocked-connectors` | Disable connector(s) for this version |
| Unblock single connector | DELETE | `/persona/{repo_id}/versions/{version_id}/blocked-connectors/{slug}` | Re-enable a specific connector |
| Test version stream | POST | `/persona/{repo_id}/versions/{version_id}/test` | Test chat send (includes connector_slugs + disabled_connectors) |
| Create share | POST | `/persona/{repo_id}/shares` | Super link generate; email invite |
| Revoke share | DELETE | `/persona/{repo_id}/shares/{share_id}` | Revoke link/invite |
| Persona starter | POST | `/persona/starter` | Tone page continue (generates sys inst + tags) |
| List connectors | GET | `/connectors` | Connectors tab and test chat panel load |

---

## UI Terminology Rule

All user-facing text in the UI must use **"agent"** (singular) and **"agents"** (plural), not "persona" or "personas".

This applies to:
- Button labels, headings, descriptions, placeholder text, toasts, modals, empty states, tooltips.
- Any copy the user reads in the interface.

This does NOT apply to:
- URL paths (keep `/personas`, `/persona/configure/**`, etc. unchanged).
- API endpoint paths and payload keys.
- Internal code identifiers (variable names, function names, type names, sessionStorage keys).
- File names.

When implementing or reviewing any UI copy, do a final pass: replace every visible "persona" / "personas" with "agent" / "agents".

---

## Implementation Rules (Regression Prevention)

1. **Wizard data must survive forward/backward navigation.** Never clear `persona_wizard_draft` until the configure tabs load. Never put `sessionStorage.removeItem` calls inside `useState` lazy initializers — React 18 StrictMode calls them twice, causing the second invocation to silently delete draft state. All sessionStorage side-effects must live in a `useEffect` with a `useRef` guard.
2. **Tab switching never creates a new version.** `createVersion()` is only called from the Save Version button.
3. **Tab switching never makes an API call for Instructions or Profile.** Only `sessionStorage` is written.
4. **Knowledge and Connectors tabs write to the API immediately** (not on save version or publish).
5. **Tags from Profile tab propagate to two places:** Instructions tab header AND agent card on `/personas`.
6. **Test Chat and AI Suggestions panels are locked** until required fields are complete AND a version has been saved.
7. **Versions panel is always available** — never locked.
8. **Shared agent cards never have an edit button** — in the library and in the agent chat page.
9. **Published agents show on `/personas`; saved (draft) versions do not create a separate card — draft card comes from the repo itself.**
10. **Auto-save toast is dynamic** — lists the specific fields that changed, not a generic message.
11. **Version card change tags are stamped only on explicit Save or Publish** — not on tab switch.
12. **Back button in configure always navigates to `/agents`** via `safeNavigate('/agents')`. The leave guard still fires if `needsRepublish` is true. It must never use `router.back()` (browser history) — the destination must always be `/agents`.
13. **Leaving without publishing saves a draft and shows a draft card** on `/personas` — the agent is not usable until published.
14. **Publish = active card on `/personas`** — the agent becomes fully live.
15. **Knowledge file size display:** below 0.1 MB → show in KB; at or above 0.1 MB → show in MB.
16. **Knowledge and link deletions are immediate API calls** — no undo, no draft.
17. **Connectors tab uses the block-list model** — only `blocked_connectors` is stored; all other linked connectors are implicitly enabled.
18. **Blocked connectors are excluded from the agent's tool access** in both test chat and production chat — passed as `disabled_connectors` in every stream request.
19. **Sharing credit limit max is dynamic** — always the user's current remaining plan credits, fetched on tab load.
20. **Published page must show the agent's name** prominently — never a blank or "undefined" name.
21. **All UI copy uses "agent/agents"** — never "persona/personas" in any user-visible text. URLs and API identifiers are unchanged.
22. **Publish button is always labelled "Publish"** — never "Republish", regardless of whether the agent was previously published. The distinction is internal.
23. **Publish requires a clean saved state** — the Publish button is disabled whenever `pendingChangeTags.length > 0`. The user must explicitly save a version first.

---

## Fixes Log

### Session — 2026-06-09

**Fix 1 — Knowledge file size display (KB/MB)**
- **File:** `agent/configure/knowledge/page.tsx`
- **Problem:** All file sizes were always displayed in MB regardless of actual size (e.g. "0.0 MB" for a 200 KB file).
- **Fix:** Added `formatFileSize(bytes)` helper: returns `X KB` when `bytes < 1 MB`, otherwise `X.X MB`. Applied to 4 locations: `docsToFiles`, `docsToFilesWithSizes`, `uploadFiles` placeholder, and reload-after-upload callback.

**Fix 2 — Profile description seeding overwritten by API**
- **File:** `agent/configure/profile/page.tsx`
- **Problem:** The `getPersonaRepo` load effect assigned `v.prompt` (the system instruction) to the description field, overwriting the wizard-purpose value that was correctly seeded from `sessionStorage.persona_wizard_purpose_{repoId}` during `useState` initialisation.
- **Fix:** Removed the `v.prompt → description` assignment from the load effect. Description is now exclusively seeded from sessionStorage (wizard flow) and only updated via user input thereafter.

**Fix 3 — `personaStarter` moved to tone page with tone parameter**
- **Files:** `agents/basics/name/page.tsx`, `agents/basics/tone/page.tsx`, `lib/api/personas.ts`
- **Problem:** `personaStarter` was called on the name page, before the user had selected a tone. The API therefore generated instructions without considering tone, making tone selection cosmetic.
- **Fix:** Removed the call from name page entirely. Added it to tone page `handleContinue`, passing `{ name, description, tone: selectedTone }`. Extended `PersonaStarterRequest` interface with `tone?: string`.

**Fix 4 — Cancel creation modal (X button in wizard)**
- **Files:** `agents/_components/CancelCreationModal.tsx` (new), `agents/_components/WizardShell.tsx`
- **Problem:** The X button in the wizard shell navigated immediately to `/agents`, silently discarding all in-progress wizard data.
- **Fix:** Created `CancelCreationModal` with "Keep creating" / "Yes, cancel" actions (Escape key + backdrop click both dismiss). Wired to WizardShell X button via `cancelOpen` state — navigation only happens after explicit confirmation.

**Fix 5 — Double `getVersion` call on instructions tab**
- **File:** `agent/configure/context.tsx`
- **Problem:** The context bootstrap `useEffect` called `getVersion` on every configure tab mount, and the instructions tab independently called `getVersion` on its own mount — causing a redundant duplicate fetch on the instructions tab.
- **Fix:** Added `if (pathname.includes('/configure/instructions')) return` guard at the top of the context bootstrap effect. Context also now seeds `guidePrompt` from the fetched version (using `prev.guidePrompt || vPrompt` to never overwrite a user-edited value).

**Fix 6 — Redundant API calls removed from profile tab**
- **File:** `agent/configure/profile/page.tsx`
- **Problem:** Profile tab called both `getPersonaRepo` and `getVersion`, but `getVersion` was only used to extract `currentPrompt` to set `guidePrompt` — a value already managed by the context. This caused an extra network round-trip.
- **Fix:** Removed the standalone `getVersion` call, `currentPrompt` / `setCurrentPrompt` state, and the `updatePersonaInfo({ guidePrompt })` call from the profile tab. Context owns guidePrompt.

**Fix 7 — Auto-save toast shows changed field names**
- **File:** `agent/configure/context.tsx`
- **Problem:** Tab-switch auto-save gave no feedback about what was saved, and a stale closure inside `safeNavigate` meant `pendingChangeTags` was always empty at the time the toast would have fired.
- **Fix:** Added `pendingChangeTagsRef` (kept in sync with state via `useEffect`). `safeNavigate` reads the ref (never stale), and when navigating between configure tabs with pending changes, shows `toast.success("Draft saved: <field list>")` before navigating.

**Fix 8 — Panel lock for Test Chat and AI Suggestions**
- **File:** `agent/configure/context.tsx`, `agent/configure/layout.tsx`
- **Problem:** Test Chat and AI Suggestions panels could be opened even on a brand-new agent with no model, no instructions, and no saved version — producing a broken experience.
- **Fix:** Derived `panelsLocked = !guideModelId || !guidePrompt.trim() || versions.length === 0`. Toggle functions (`toggleTestChat`, `toggleAiSuggest`) check `panelsLockedRef.current` and show an error toast instead of opening. Layout renders a tooltip on locked menu items.

**Fix 9 — Profile tags shown in instructions tab header**
- **File:** `agent/configure/instructions/page.tsx`
- **Problem:** Tags entered on the profile tab (stored in `sessionStorage.persona_profile_{repoId}`) were never read by the instructions tab, so the header showed no tags.
- **Fix:** Added `profileTags` state initialised from sessionStorage at mount, plus a `useEffect` that re-reads tags once `repoId` resolves (for new-agent flow where repoId isn't known until after creation). Tags render as chips in the agent header bar.

**Fix 10 — Published page agent name fallback**
- **File:** `agents/published/page.tsx`
- **Problem:** `searchParams.get('name') ?? 'Persona'` fell back to the word "Persona" as a visible heading if the name param was absent.
- **Fix:** Changed fallback to `'Your Agent'`.

**Fix 14 — Auto-save toast missing tab name and wrong prefix**
- **File:** `agent/configure/context.tsx`
- **Problem:** `safeNavigate` showed `"Draft saved: Model, Instructions"` — missing the tab name and using the wrong prefix. Spec requires `"Auto-saved — [Tab name]: [changed fields]"`.
- **Fix:** Added `getTabName(path)` helper that maps pathname segments to display names (Instructions / Profile / Knowledge / Connectors / Sharing). Added `pathnameRef` to read the current tab name stalelessly inside `safeNavigate`. Toast now shows e.g. `"Auto-saved — Instructions: Model, System Instructions"`.

**Fix 15 — Sharing tab credit limit defaulted to 100% instead of 50%**
- **File:** `agent/configure/components/SharingTab.tsx`
- **Problem:** Both `tokenLimit` and `emailTokenLimit` initialised to `maxTokenLimit` (100% of plan's share allocation). Spec requires the default to be 50% of total plan credits.
- **Fix:** Changed `useState(maxTokenLimit)` → `useState(Math.floor(maxTokenLimit / 2))` for both link and email token limits, and updated the plan-resolve `useEffect` sync accordingly.

**Fix 16 — Custom agent creation gets no avatar**
- **File:** `agent/configure/instructions/page.tsx`
- **Problem:** `pickTemplateAvatar()` was only called when `wizardTemplate` was truthy. Custom creation (no template) left the avatar as `null`, showing initials forever until the user manually uploads one. Spec says a random avatar is assigned for all new persona creations regardless of creation path.
- **Fix:** Removed the `if (wizardTemplate)` guard. `pickTemplateAvatar()` now runs unconditionally for every new creation (both custom and template).

**Fix 12 — Cancel creation does not clear wizard sessionStorage**
- **File:** `agents/_components/WizardShell.tsx`
- **Problem:** Confirming cancel in the modal called `push('/agents')` without removing `persona_wizard_draft` or `persona_wizard_starter` from sessionStorage. Starting a new wizard flow would pre-populate fields from a previous abandoned creation.
- **Fix:** `onCancel` handler now removes both keys before navigating.

**Fix 13 — Purpose page Back button skipped cancel modal**
- **Files:** `agents/basics/purpose/page.tsx`
- **Problem:** The Back button on the purpose page navigated directly to `/agents/templates` instead of opening the cancel creation modal as required by spec (Step 1 back button behaviour).
- **Fix:** Added `cancelOpen` state and imported `CancelCreationModal`. Back button now calls `setCancelOpen(true)`. The modal's `onCancel` clears both wizard sessionStorage keys before navigating to `/agents`.

**Fix 11 — UI terminology sweep (persona → agent in all visible strings)**
- **Files affected:** `agent/configure/context.tsx`, `agent/configure/layout.tsx`, `agent/configure/instructions/page.tsx`, `agent/configure/profile/page.tsx`, `agent/configure/components/ExampleConversationModal.tsx`, `agent/configure/components/ExampleConversationDialog.tsx`, `agent/configure/components/SharingTab.tsx`, `agents/page.tsx`, `agents/published/page.tsx`
- **Problem:** Numerous user-visible strings still contained "persona" or "Persona" after the routing rename.
- **Fix:** Replaced all user-visible occurrences. Specifically: toast messages, button labels, heading copy, placeholder text, help panel descriptions, confirmation dialogs, and error strings. URL paths, API endpoint paths, sessionStorage keys, variable names, function names, and file names were left unchanged per project constraint.

---

### Session — 2026-06-10

**Fix 17 — `handleRestoreVersion` used `window.history.replaceState` instead of `router.replace()`**
- **File:** `agent/configure/context.tsx`
- **Problem:** After a version restore, `handleRestoreVersion` updated the URL with `window.history.replaceState`. This silently changes the browser URL but does NOT update `useSearchParams` in Next.js App Router — so any tab that reads `versionId` from the URL would still see the old value. Root cause of knowledge files disappearing after version restore and after publish.
- **Fix:** Added `replace` to the `useRouter()` destructure. Changed `window.history.replaceState(...)` to `router.replace(\`${window.location.pathname}?${params.toString()}\`)`. Updated the `useCallback` deps array to include `replace`.

**Fix 18 — Cursor style on non-navigable profile tab items**
- **File:** `agent/configure/profile/page.tsx` (line ~359)
- **Problem:** Tab item cursor was computed as `TAB_ROUTES[tab] || !isActive ? 'pointer' : 'default'`. The `|| !isActive` clause made items without a route show `pointer` whenever they were inactive — misleading the user into clicking a non-navigable element.
- **Fix:** Simplified to `TAB_ROUTES[tab] ? 'pointer' : 'default'`. Cursor is `pointer` only when a tab route exists.

**Fix 19 — `handleSaveVersion` guard in knowledge tab diverged from button's disabled condition**
- **File:** `agent/configure/knowledge/page.tsx`
- **Problem:** The Save Version button was disabled when `pendingChangeTags.length === 0`, but `handleSaveVersion` guarded with `!isDirty || !repoId || !versionId`. These conditions were not equivalent — in scenarios where `pendingChangeTags` was empty but `isDirty` was true (or vice versa), the button and the handler disagreed, allowing a no-op save to fire.
- **Fix:** Changed guard to `if (pendingChangeTags.length === 0 || !repoId || !versionId) return`, exactly matching the button's `disabled` condition.

**Fix 20 — Filter system on `/agents` page (Status / Visibility / Super Link / Model)**
- **File:** `agents/page.tsx`
- **Problem:** The Filter button was disabled and no filtering logic existed beyond a tag-based filter.
- **Fix:** Replaced the old `filterTags` state with a typed `AgentFilters` state (`{ status: Set, visibility: Set, superLink: Set, models: Set }`). Added `availableModels` state fetched via `fetchModelsWithCache()` and `allSharesForFilter` state fetched via `listShares()` (loaded once on my-personas tab mount). Derived `visibilityForPersona` from active shares (community = link share, team = email share, private = neither). Built `modelIdToName` Map from `AIModel.modelId → AIModel.modelName`. Added filter pipeline: `statusFiltered → filterPanelFiltered → filtered` (OR within each section, AND between sections). Filter button shows active count badge and uses `default` variant when filters are active. Dropdown has four checkbox sections: Status (Live / Draft / Paused), Visibility (Private / Team / Community), Super Link (Has active link / No link), Model (dynamic from unique model names on the user's agents — section hidden when empty).

**Fix 21 — Chat URL reverted to `/personas/` after first message**
- **File:** `components/layout/PersonaChatInterface.tsx` (line ~151)
- **Problem:** When a user navigated to `/agents/{id}/chat` and sent the first message, the URL changed to `/personas/{id}/chat?chatId=...`. This was the only remaining hardcoded `/personas/` frontend navigation URL. It also broke the left sidebar active state and the model selector button because those components keyed off the pathname.
- **Fix:** Changed `window.history.replaceState(null, "", \`/personas/${personaIdRef.current}/chat?chatId=${chatId}\`)` → `window.history.replaceState(null, "", \`/agents/${personaIdRef.current}/chat?chatId=${chatId}\`)`. All other navigation in the codebase was already using `/agents/`.

**Fix 22 — "Filters" header label removed from filter dropdown**
- **File:** `agents/page.tsx`
- **Problem:** The filter dropdown opened with a non-interactive `Dropdown.Item variant="header" label="Filters"` as its first item — redundant given the button already says "Filter".
- **Fix:** Removed the header item entirely. The "Clear all filters" action is now a plain `Dropdown.Item` that only renders when `activeFilterCount > 0`, positioned above the first section.

**Fix 23 — Model names in filter dropdown showed derived IDs instead of display names**
- **File:** `agents/page.tsx`
- **Problem:** The Model section of the filter dropdown showed IDs derived by regex (e.g. `claude-3-5-sonnet`) rather than human-readable display names (e.g. `Claude 3.5 Sonnet`). This was because `modelDisplayName()` was a regex fallback with no access to actual model metadata.
- **Fix:** Imported `fetchModelsWithCache` from `@/lib/ai-models`. On my-personas tab mount, fetches the model list and builds a `modelIdToName = Map<string, string>` (keyed by `AIModel.modelId`). `resolveModelName(modelId)` tries the map first, falls back to the regex helper only for unknown IDs. `uniqueModelNames` memo uses `resolveModelName` per agent's `modelId`.

**Fix 24 — Wizard data persistence broken in React 18 StrictMode (purpose → name → tone → back → back → forward)**
- **File:** `agents/basics/purpose/page.tsx`
- **Problem:** React 18 StrictMode (enabled by default in Next.js App Router dev mode) calls `useState` lazy initializers **twice**. The purpose page's initializer (1) read the `persona_wizard_going_back` flag, found it set, removed it, and returned the draft purpose correctly — but (2) the second invocation found the flag already gone, fell through to the "fresh start" branch, and deleted `persona_wizard_draft` from sessionStorage. When the user then clicked Continue, `handleContinue` read an empty `existing` object, computed `purposeChanged = true`, and wrote `name: undefined, tone: undefined` — wiping all downstream wizard state. This caused the name field to appear empty when navigating forward after a back sequence, and the tone selection to be lost.
- **Fix:** Removed all `sessionStorage.removeItem` calls from the `useState` initializer — it now only reads (idempotent). Added a `useEffect` with an `initDoneRef = useRef(false)` guard that performs the flag removal and conditional draft-clearing exactly once per mount. The `useRef` value persists across StrictMode's simulated unmount/remount, so the guard prevents the cleanup from running twice even under StrictMode's double-effect invocation.

**Fix 25 — Save Version button always disabled on Connectors and Sharing tabs**
- **Files:** `agent/configure/connectors/page.tsx`, `agent/configure/sharing/page.tsx`
- **Problem:** Both tabs had `disabled={true}` hardcoded on the Save Version button (both the full `Button` and the `IconButton` panel-mode variant). This meant that even when another tab had accumulated `pendingChangeTags` (e.g. model changed on Instructions tab), the Save Version button remained permanently greyed out on Connectors and Sharing — inconsistent with the other three tabs which correctly reflect shared context state.
- **Fix:** Replaced `disabled={true}` with `disabled={pendingChangeTags.length === 0 || !repoId || !versionId || isSaving}` on both button variants in both files. This matches the exact condition already used by Profile and Knowledge tabs. Since `pendingChangeTags` is shared context, any change on any tab now enables Save Version everywhere.

**Fix 26 — Back button on configure tabs used browser history instead of always navigating to `/agents`**
- **Files:** `agent/configure/instructions/page.tsx`, `agent/configure/profile/page.tsx`, `agent/configure/knowledge/page.tsx`, `agent/configure/connectors/page.tsx`, `agent/configure/sharing/page.tsx`
- **Problem:** The top-left back arrow on all 5 configure tabs called `safeBack()`, which invoked `router.back()` — browser history back. This meant the destination depended on wherever the user came from (could be any page, including mid-wizard pages or external pages). There was no guarantee it would land on `/agents`.
- **Fix:** Changed all 5 back button `onClick` handlers from `safeBack()` / `onClick={safeBack}` to `() => safeNavigate('/agents')`. The leave guard still fires correctly — `safeNavigate` checks `needsRepublish` and shows the "This agent isn't published yet" modal before leaving if needed. The only change is the fixed destination: always `/agents`.

**Fix 27 — Live/Unpublished badge missing from Profile, Knowledge, Connectors, and Sharing tabs**
- **Files:** `agent/configure/profile/page.tsx`, `agent/configure/knowledge/page.tsx`, `agent/configure/connectors/page.tsx`, `agent/configure/sharing/page.tsx`
- **Problem:** The green "Live" / amber "Unpublished" status badge below the tab bar existed only on the Instructions tab. The other 4 configure tabs had no visual feedback about the agent's publish state, making it impossible for the user to know if the agent was live without switching to Instructions.
- **Fix:** Added `isPublished` and `needsRepublish` computed constants to all 4 tabs:
  - `isPublished = !!publishedVersionId && publishedVersionId === versionId && pendingChangeTags.length === 0`
  - `needsRepublish = !!repoId && !!versionId && !isPublished`
  - All required variables (`repoId`, `versionId`, `publishedVersionId`, `pendingChangeTags`) were already in scope in every tab.
  - Inserted identical badge JSX (`position: absolute`, `top: 100%`, centered) inside each tab's `position: relative` nav row container, between the action buttons close `</div>` and the nav row's own close `</div>`.
  - Also added `position: 'relative'` to the Sharing tab's nav row `<div>` — it was the only tab missing this required positioning context for the absolutely-placed badge.

**Fix 29 — "Republish" button label renamed to "Publish" on all configure tabs**
- **Files:** `agent/configure/instructions/page.tsx`, `agent/configure/profile/page.tsx`, `agent/configure/knowledge/page.tsx`, `agent/configure/connectors/page.tsx`, `agent/configure/sharing/page.tsx`
- **Problem:** When an agent had previously been published, the Publish button rendered the label "Republish" (the ternary `publishedVersionId ? 'Republish' : 'Publish'`). This introduced unnecessary terminology variation — the action is always "Publish".
- **Fix:** Collapsed the ternary to a flat `{isPublishing ? 'Publishing…' : 'Publish'}` on all five tabs. The button always says "Publish".

**Fix 30 — Publish button unlocked while unsaved changes exist**
- **Files:** `agent/configure/instructions/page.tsx`, `agent/configure/profile/page.tsx`, `agent/configure/knowledge/page.tsx`, `agent/configure/connectors/page.tsx`, `agent/configure/sharing/page.tsx`
- **Problem:** The Publish button was enabled as soon as `needsRepublish` was true — even while the user had unsaved changes (`pendingChangeTags.length > 0`). A user could publish a partially-edited state without explicitly saving a version first.
- **Fix:**
  - Instructions tab: added `&& pendingChangeTags.length === 0` to the `canPublish` computed constant.
  - All other 4 tabs: added `|| pendingChangeTags.length > 0` to the button's `disabled` prop.
  - Publish is now only available when `needsRepublish && !isPublishing && pendingChangeTags.length === 0`.

**Fix 31 — Agent final chat (`PersonaChatInterface`) showed wrong model due to premature `versionsLoaded` flag and wrong model passed to inference**
- **File:** `components/layout/PersonaChatInterface.tsx`
- **Problem (part A):** `setVersionsLoaded(true)` was called inside the outer `listVersions().then()` callback, before `getVersion()` had resolved. The model sync `useEffect` (gated on `versionsLoaded`) therefore ran before `v.model_id` was available from `getVersion`. Since `PersonaVersionListItem` may not include `model_id`, `latestVersionModelId` stayed null and the effect fell back to `persona.modelId` — the published version's model, not the latest draft version's model.
- **Problem (part B):** `fetchAiResponse` was passed `stableKey(selectedModel)` as the 4th arg (`modelId`). This forwarded the UI's current displayed model to the proxy as `model_id`, overriding the backend's own version-configured model. When the displayed model was stale (wrong model shown while loading), the wrong model was also used for inference.
- **Fix (part A):** Moved `setVersionsLoaded(true)` from the outer `listVersions().then()` into the `getVersion().then()` callback. Also added `if (v.model_id) setLatestVersionModelId(v.model_id)` there — so the model sync effect always reads the authoritative model_id from the full version response. Added fallback paths: `getVersion().catch()` sets `latestVersionModelId` from the list item (best-effort) and marks loaded; a missing latest version also unblocks the effect.
- **Fix (part B):** Changed `fetchAiResponse` 4th arg from `selectedModel ? stableKey(selectedModel) : null` back to `null`. Backend determines the inference model from the agent's configured version; UI model display is read-only.

**Fix 28 — Auto-save toast fired on every tab switch once any change had ever been made**
- **File:** `agent/configure/context.tsx`
- **Problem:** The toast condition in `safeNavigate` was `pendingChangeTags.length > 0`. Since `pendingChangeTags` accumulates across all tabs and is never cleared on a plain tab switch (only on Save Version / Publish), the toast would fire on every subsequent tab navigation even with zero changes made on the current tab. For example: change model on Instructions → switch to Profile (toast correct) → switch to Knowledge without touching anything (toast fires incorrectly).
- **Fix:** Added `tagsCountOnTabArrivalRef = useRef(0)` to snapshot how many tags existed when the user arrived on the current tab. A `useEffect([pathname])` updates this baseline on every tab navigation. `setPendingChangeTags` also resets it so the baseline stays accurate after a mid-visit Save/Publish clears the list. The toast condition changed from `tags.length > 0` to `tags.length > tagsCountOnTabArrivalRef.current` — it now fires only if the tag count actually grew during the current tab visit, meaning a real change was made.

---

## Session — Versioning / Publishing / File-persistence / Timezone Root-Cause Fixes

> **Unifying root cause (Fixes 32–35):** Agent publication & version state was tracked in client-side storage (`sessionStorage persona_live_version_*`, `localStorage persona_needs_publish_*`) instead of being derived from the backend's authoritative `repo.active_version_id`. Each of the 5 configure tabs computed it differently and drifted out of sync. The fix centralizes publication state on the backend value and pulls the version/publish decision rules into a pure, unit-tested module: `src/lib/persona-version-logic.ts` (functions `resolveSaveMode`, `derivePublicationState`, `pickVersionToEdit`, `diffKnowledgeForInheritance`). Tests: `src/lib/persona-version-logic.test.ts`, `src/lib/utils/format-utils.test.ts` (vitest added to devDeps; `npm run test`).

**Decision recorded (Save semantics):** The wizard creates the repo + version 001 atomically on the backend (cannot be split without backend changes). Therefore the **first** explicit "Save version" UPDATES the provisional v001 in place (stays v001 — no duplicate v002); **every save after that creates a new version**; new versions **inherit** the prior version's knowledge files; files are never modified unless the user does it manually; publishing/republishing never creates a version and never drops files.

**Fix 32 — Saving a new agent created duplicate versions 001 AND 002**
- **Files:** `lib/persona-version-logic.ts` (new), `agent/configure/instructions/page.tsx`, `agents/basics/tone/page.tsx`
- **Problem:** The wizard's `createPersonaRepo` already creates v001 atomically; the first "Save version" then called `createVersion` → v002. One user save yielded two versions.
- **Fix:** The wizard stamps a provisional-initial marker `sessionStorage persona_initial_version_${repoId} = v001`. `executeSave` calls `resolveSaveMode({ currentVersionId, initialVersionId, activeVersionId })`: when the current version is the never-published provisional initial, it calls `updateVersion` (stays v001) and consumes the marker; otherwise it calls `createVersion` (a new version). The marker is also cleared on publish (a published version, when later edited, must fork). The `MAX_VERSIONS` limit check is skipped for the update-in-place path.

**Fix 33 — Knowledge files lost across versions / after republishing**
- **Files:** `lib/api/personas.ts` (new `inheritKnowledge` + `documentToFile`), `lib/persona-version-logic.ts` (`diffKnowledgeForInheritance`), `agent/configure/instructions/page.tsx`
- **Problem:** `createVersion` sent no files, so the spuriously-created v002 (Fix 32) was empty and files uploaded to v001 "disappeared." Version history did not retain file associations.
- **Fix:** With Fix 32, the common new-agent flow keeps files on v001 (update-in-place). When a save genuinely forks a new version, `executeSave` calls `inheritKnowledge(repoId, sourceVersionId, newVersionId)` which copies documents (re-download via `download_url` → re-upload) and links (`addKnowledgeUrl`) from the source version, de-duplicated via `diffKnowledgeForInheritance` (idempotent — a no-op if the backend already cloned files). Best-effort: files that can't be re-downloaded are counted and the user is warned to re-add them. Sequential uploads to avoid overwhelming the endpoint.

**Fix 34 — "This agent isn't published yet" dialog shown for an already-published agent with no changes**
- **Files:** `agent/configure/context.tsx`, `agent/configure/instructions/page.tsx`, `lib/persona-version-logic.ts`
- **Problem (A):** Publication state on Profile/Knowledge/Connectors/Sharing was read from `sessionStorage persona_live_version_*`, which is empty on a fresh open of a published agent → `isPublished=false` → leave-guard dialog + "Unpublished" chip fired wrongly. **Problem (B):** "Edit" from the library navigates to instructions WITHOUT a `versionId`, so it loaded the *most-recent* version rather than the *live* one — if a newer draft existed, `activeVersionId !== versionId` → false "not published" warning.
- **Fix (A):** Centralized `activeVersionId` in `context.tsx` (fetched via `getPersonaRepo` on repoId change) + `markPublished(versionId)` (optimistic update after publish) + `refreshActiveVersion()`. All 5 tabs now compute `{ isPublished, needsRepublish }` via `derivePublicationState({ repoId, versionId, activeVersionId, hasUnsavedChanges })` instead of reading sessionStorage. **Fix (B):** the instructions repoId-only branch uses `pickVersionToEdit({ activeVersionId, versionsByRecency })` to prefer the published version, falling back to the most-recent only when nothing is published.

**Fix 35 — "Unpublished" chip persisted on the agents library after a successful publish**
- **File:** `agents/page.tsx`
- **Problem:** The library chip relied on the stale `localStorage persona_needs_publish_*` flag, which could linger after publish.
- **Fix:** On list load, the flag is now reconciled against backend truth — whenever `persona.activeVersionId` is set (the agent is live), the stale flag is cleared and the override ignored. The chip only shows for genuinely-unpublished (no active version) agents.

**Fix 36 — Timestamps displayed in UTC instead of the user's local timezone**
- **Files:** `lib/utils/format-utils.ts` (new `parseServerDate`, `formatServerDateTime`; `formatDate` hardened), `agent/configure/layout.tsx`, `agent/configure/knowledge/page.tsx`
- **Problem:** The `X-User-Timezone` / `X-User-Locale` headers were already sent on the fetch path (`lib/api/client.ts`) and the XHR streaming path (`hooks/use-streaming-chat.ts`). The display gap was parsing: backend timestamps that arrive WITHOUT a timezone designator (e.g. `2026-06-10T12:00:00`) were parsed by `new Date()` as LOCAL time, so they appeared "stuck in UTC."
- **Fix:** `parseServerDate` appends `Z` to tz-less datetimes so they parse as UTC, then renders in the user's local zone. Version timestamps (`layout.tsx formatVersionDate`) and knowledge-file dates (`knowledge/page.tsx fmtFileDate`) now use the UTC-aware formatter. Unit-tested across Z / numeric-offset / space-separated / epoch-ms / invalid inputs.

**Fix 37 — Agent creation failed with `422 body.model_id: Field required`**
- **File:** `agents/basics/tone/page.tsx`
- **Problem:** For custom (non-template) agents the wizard sent an empty `model_id`, and `createPersonaRepo` only appends `model_id` when truthy, so the field was omitted and the backend (which requires it) returned 422 — surfacing as the "Failed to create agent" toast.
- **Fix:** The wizard now always sends a valid `model_id` — seeding the first available model for custom agents — while keeping the existing `persona_wizard_no_model_${repoId}` flag so the Instructions tab still opens with NO model selected, forcing the user to choose explicitly (the seeded value is overwritten on their first save). The Instructions baseline snapshot also uses an empty `modelId` when `isCustomNoModel` so a freshly-opened custom agent does not start in a spurious "Unsaved" state.
- **Note:** A separate `502 ECONNRESET` on `GET /llm/models/all` in the same session was transient upstream (dev backend) unavailability, not a frontend defect; no proxy timeout was added because that route also carries minutes-long SSE streams.

**Fix 38 — Persona card tags and avatars not showing on `/agents` page**
- **Files:** `agents/page.tsx`, `agent/configure/profile/page.tsx`
- **Root cause:** The list endpoint (`GET /persona`) returns `active_version: null` for every persona. `normalizeRepo()` reads `v?.persona_tags` where `v = repo.active_version`, so `persona.tags` was always `[]` and `persona.imageUrl` always `null`.
- **Problem (part A — wrong field in enrichment):** The `/agents` page enrichment fetched `listVersions(p.id)` to find the best version, then called `getVersion(p.id, best.id)` for `image_url` but used `best.persona_tags` (from the list item) for tags. The `PersonaVersionListItem` may not have `persona_tags` populated by the backend even though the TypeScript interface declares it. Result: tags always `[]`.
- **Fix (part A):** Changed the enrichment to use `detail.persona_tags` (from the full `getVersion` response) for tags — this endpoint always returns `persona_tags` since it's also what the profile tab uses. Added `console.error` to the catch block so failures are never silent.
- **Problem (part B — tags never saved to backend):** The Profile tab's `registerAutoSave` callback was a no-op. When users set tags and navigated to another tab (or `/agents`), tags were only in `sessionStorage`. After a browser refresh (sessionStorage cleared), the API returned `persona_tags: []` (never persisted) so cards showed no tags.
- **Fix (part B):** The Profile tab's tab-switch auto-save now calls `updateVersion({ name, prompt, persona_tags })` — the same fields as an explicit Save Version, but skipping image upload (expensive; only done on explicit save). `isDirty` is cleared after auto-save unless the avatar is a pending `data:` URL, in which case the Save Version button stays enabled.
- **Invariant:** After any tab switch away from Profile, `persona_tags` is always durably saved to the backend. The `/agents` enrichment (`listVersions` + `getVersion`) will return the correct tags on the next visit.
