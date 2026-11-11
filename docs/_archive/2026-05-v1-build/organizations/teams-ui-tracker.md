# Teams UI Update Tracker

> Source: `may-day` Storybook at https://may-day-mauve.vercel.app
> Target: `front-end/src/app/(app)/settings/`
> Started: 2026-06-09

---

## Progress

| # | Section | Story | Route | Status | Notes |
|---|---------|-------|-------|--------|-------|
| 1a | Admin Panel | Activity Log Page | `settings/org/activity` | ✅ Done | Columns: Time / Member (Avatar) / Action (Badge) / Detail; relative timestamps; member + action type filters |
| 1b | Admin Panel | Analytics Page | `settings/org/analytics` | ✅ Done | Structure matched; fixed 6 token issues (`white`→`var(--neutral-white)`, `#0081db`→`var(--blue-600)`, tooltip shadow, mock data) |
| 1c | Admin Panel | Connectors Page | `settings/org/connectors` | ✅ Done | Admin: Manage/Requests/Catalog tabs; Member: My Connectors/Browse tabs; RequestFromSouvenir dialog; custom TabGroup, ConnectorCatalogTile |
| 1d | Admin Panel | Members Table | `settings/org/members` | ✅ Done | MembersTableComponent with RoleButton (animated portal dropdown), RemoveButton (blur-swap), TeamsBadges (Badge), RolesPermissionsSection (collapsible); wired to useOrg() |
| 1e | Admin Panel | Member Row | `settings/org/members` | ✅ Done | Component at `src/components/MemberRow/` — DropdownFloat role picker, AnimatePresence confirm-remove drawer, InviteStatusBadge |
| 1f | Admin Panel | Plans Page | `settings/org/plans` | ✅ Done | Replaced DarkButton/WhiteButton/RedButton with KDS Button variants |
| 1g | Admin Panel | Security Page | `settings/org/security` | ✅ Done | Rewrote using SecurityToggleRow for all toggles + radio HITL; added SAML disabled row; verifying DNS flow |
| 1h | Admin Panel | Workspace Settings Page | `settings/org/general` | ✅ Done | Replaced DarkButton/WhiteButton with KDS Button; additional sections (AI instructions, email domains, workspace defaults) kept |
| 2a | Teams | Teams Page | `settings/org/teams` | ✅ Done | Added animated CreateTeamForm (height 0→auto, opacity) below table; empty state; wired Create button toggle |
| 2b | Teams | Team Settings Page | `settings/org/teams/[id]` | ⬜ Pending | |
| 2c | Teams | Team Members Table | `settings/org/teams/[id]` | ⬜ Pending | |
| 2d | Teams | Team Row | `settings/org/teams` | ✅ Done | Created `src/components/TeamRow/` — active/archived/tombstone states, Recover button (disabled for tombstone) |
| 3a | Shared | Approval Card | — | ✅ Done | Component at `src/components/ApprovalCard/` — pending/accepted/denied states, deny-reason chips, springs.moderate animation |
| 3a2 | Shared | Undo Toast | — | ✅ Done | Component at `src/components/UndoToast/` — countdown timer, active/undone/dismissed states, AnimatePresence popLayout blur transition |
| 3b | Shared | Invite Modal | — | ✅ Done | Rewrote `src/components/InviteModal/` — RoleSelector (Popover + AnimatePresence), role description hint, loading prop, focus trap, auto-focus; AppInviteModal Dialog wrapper kept for backward compat |
| 3c | Shared | Role Badge | — | ⬜ Pending | |
| 3d | Shared | Role Selector Dropdown | — | ✅ Done | Component at `src/components/RoleSelectorDropdown/` — matches story exactly; DemoteWarning confirm panel for admin demotions |
| 3e | Shared | Team Chip | — | ⬜ Pending | |
| 3f | Shared | Workspace Badge | — | ⬜ Pending | |
| 3g | Shared | Workspace Connector Card | — | ✅ Done | Created `src/components/WorkspaceConnectorCard/` — connected/not_connected/auth_in_progress/auth_failed states; admin Revoke/Connect/Retry/Manage buttons |
| 3h | Shared | Workspace Status Banner | — | ✅ Done | Component at `src/components/WorkspaceStatusBanner/` — warning_95/grace/locked states; admin CTA vs member note |
| 3i | Shared | Context Indicator | — | ✅ Done | Component at `src/components/ContextIndicator/` — personal (null), team (blue dot), project (purple dot); locked state |
| 4a | Onboarding | Onboarding Page | `/onboarding/workspace-setup` | ✅ Done | Created `src/app/(onboarding)/onboarding/workspace-setup/page.tsx` — step 0 Basics (avatar, name, invite, description, tags) + step 1 Configure (connector grid); animated step transitions |
| 4b | Token | Token Pool Bar | — | ✅ Done | Component at `src/components/TokenPoolBar/` — matches story exactly; poolStatus normal/warning_80/warning_95/locked |
| 4c | Token | Token Exhaustion | — | ✅ Done | Created `src/components/InlineCreditNotice/` — warning_95/grace/locked states; sits above ChatInput; admin CTA with arrow vs member muted text; dismissible except locked |
| 4d | Token | Credit Cap Row | — | ✅ Done | Component already identical to may-day — no changes needed |
| 5a | Persona | Persona Visibility | — | ⬜ Pending | |

---

## Decisions

- **Role awareness**: Pages default to admin view until auth context provides role. `isAdmin` flag to be wired when `useWorkspace()` hook is available.
- **Filters**: Using native `<select>` elements per Storybook spec (not custom dropdowns) for the filter bar.
- **Relative timestamps**: Computed client-side from ISO timestamps. Will be replaced by real API data.
- **Badge colors**: Connector=Blue, Member=Yellow, Settings=Neutral, Automation=Purple, Team=Green, Persona=Purple (per `DECISIONS.md` in may-day).
