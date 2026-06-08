# Component Sync: may-day-chai → front-end-new

**Last synced:** 2026-06-09  
**Source:** `may-day-chai/src/components/`  
**Target:** `front-end-new/src/components/`

---

## How to use this document

Before each sync run, check the **Component Status** table below.  
Only components marked **🆕 New in may-day-chai** need action — skip everything else.

### Steps
1. `ls may-day-chai/src/components` — look for new directories not in the **Known** list below.
2. For each new directory: copy it wholesale to `front-end-new/src/components/`.
3. **Do NOT overwrite** components marked 🔷 or ⭐ — front-end-new has been further developed.
4. Run `npm run build` or type-check to confirm no regressions.
5. Update **Last synced** date and the status table after each sync.

---

## Component Status

> Legend: ✅ Identical · 🆕 New in may-day-chai · 🔷 front-end-new ahead (do not overwrite) · ⭐ front-end-new only (do not overwrite)

| Component | Status | Notes |
|-----------|--------|-------|
| Avatar | ✅ Identical | — |
| Badge | 🔷 front-end-new ahead | 2-line diff — front-end-new modified |
| BreathingDot | ✅ Identical | — |
| Button | 🔷 front-end-new ahead | 28-line diff — front-end-new modified |
| ChartCard | ✅ Identical | — |
| ChatInput | 🔷 front-end-new ahead | Synced from may-day-chai; front-end-new further extended (68-line diff) |
| ChatRow | ✅ Identical | Synced 2026-05-18 — chat row with pin chip and selection mode |
| ChatSelectionBar | ✅ Identical | Synced 2026-05-18 — bulk-selection action bar for chats |
| ChatThumbnail | 🔷 front-end-new ahead | Synced from may-day-chai; front-end-new further extended (36-line diff) |
| Checkbox | 🔷 front-end-new ahead | 10-line diff — front-end-new modified |
| Chip | 🔷 front-end-new ahead | 52-line diff — front-end-new modified |
| ChipButton | 🔷 front-end-new ahead | 12-line diff — front-end-new modified |
| ChipInput | 🔷 front-end-new ahead | 20-line diff — front-end-new modified |
| ConnectorRow | ✅ Identical | Synced 2026-05-28 — new component from may-day-chai |
| DateRangePill | ✅ Identical | — |
| DeltaPill | ✅ Identical | — |
| DiffLine | ✅ Identical | — |
| Divider | ✅ Identical | — |
| DocumentCard | ⭐ front-end-new only | Keep; not in may-day-chai |
| Dropdown | 🔷 front-end-new ahead | 56-line diff — front-end-new modified |
| DropdownMenuItem | 🔷 front-end-new ahead | Synced from may-day-chai; front-end-new further extended (72-line diff) |
| DropdownSection | 🔷 front-end-new ahead | 4-line diff — front-end-new modified |
| EditProjectModal | ⭐ front-end-new only | Keep; not in may-day-chai |
| EnhanceDotProgress | ✅ Identical | — |
| EnhancePromptField | 🔷 front-end-new ahead | 85-line diff — front-end-new modified |
| EnhanceScanningState | 🔷 front-end-new ahead | 8-line diff — front-end-new modified |
| EnhanceSummaryBar | 🔷 front-end-new ahead | 2-line diff — front-end-new modified |
| Eyebrow | ✅ Identical | — |
| FloatingMenu | 🔷 front-end-new ahead | 10-line diff — front-end-new modified |
| FloatingMenuItem | 🔷 front-end-new ahead | 8-line diff — front-end-new modified |
| GlobalSearchModal | ✅ Identical | Synced 2026-05-18 — global search modal with keyboard navigation and filter tabs |
| HighlightCard | 🔷 front-end-new ahead | 12-line diff — front-end-new modified |
| HighlightMark | 🔷 front-end-new ahead | Synced from may-day-chai; front-end-new further extended (7-line diff) |
| HighlightPanel | 🔷 front-end-new ahead | 44-line diff — front-end-new modified |
| IconButton | 🔷 front-end-new ahead | Synced from may-day-chai; front-end-new further extended (18-line diff) |
| InputField | 🔷 front-end-new ahead | Synced from may-day-chai; front-end-new further extended (22-line diff) |
| InputGroup | ✅ Identical | — |
| JumpTimestampGutter | 🔷 front-end-new ahead | 10-line diff — front-end-new modified |
| LinksSidePanel | ✅ Identical | — |
| MemberRow | 🆕 New in may-day-chai | New component (Jun 9) — teams member row with role, token usage, and actions |
| MessageBubble | 🔷 front-end-new ahead | 24-line diff — front-end-new modified |
| ModelFeaturedCard | 🔷 front-end-new ahead | 14-line diff — front-end-new modified |
| ModelSelectItem | 🔷 front-end-new ahead | Synced from may-day-chai; front-end-new further extended (40-line diff) |
| ModelSelector | 🔷 front-end-new ahead | Synced from may-day-chai; front-end-new further extended (14-line diff) |
| MotionProvider | ⭐ front-end-new only | Keep; not in may-day-chai |
| MoveToProjectModal | ✅ Identical | Synced 2026-05-18 — modal to move selected chats to a project |
| OptionBadge | 🔷 front-end-new ahead | 2-line diff — front-end-new modified |
| OptionRow | 🔷 front-end-new ahead | 30-line diff — front-end-new modified |
| PasswordInputField | 🔷 front-end-new ahead | 8-line diff — front-end-new modified |
| PersonaCard | 🔷 front-end-new ahead | Synced from may-day-chai; front-end-new further extended (6-line diff) |
| Pin | 🔷 front-end-new ahead | Synced from may-day-chai; front-end-new significantly extended (455-line diff) |
| PinCategory | ✅ Identical | — |
| PinCommentField | 🔷 front-end-new ahead | 10-line diff — front-end-new modified |
| PinInsert | 🔷 front-end-new ahead | 32-line diff — front-end-new modified |
| PinSkeleton | 🔷 front-end-new ahead | 18-line diff — front-end-new modified |
| Pinboard | 🔷 front-end-new ahead | Synced from may-day-chai; front-end-new significantly extended (473-line diff) |
| PinboardExpanded | 🔷 front-end-new ahead | Synced from may-day-chai; front-end-new significantly extended (957-line diff) |
| PinboardExpandedSkeleton | 🔷 front-end-new ahead | 36-line diff — front-end-new modified |
| PinboardHeader | 🔷 front-end-new ahead | 6-line diff — front-end-new modified |
| PinboardSkeleton | 🔷 front-end-new ahead | 22-line diff — front-end-new modified |
| Popover | 🔷 front-end-new ahead | 32-line diff — front-end-new modified |
| PresetModelSelector | ⭐ front-end-new only | Keep; not in may-day-chai |
| ProjectCard | ⭐ front-end-new only | Keep; not in may-day-chai |
| ProjectChatRow | ⭐ front-end-new only | Keep; not in may-day-chai |
| ProjectDocumentCard | ⭐ front-end-new only | Keep; not in may-day-chai |
| ProjectFilesPanel | ⭐ front-end-new only | Keep; not in may-day-chai |
| ProjectInstructionsPanel | ⭐ front-end-new only | Keep; not in may-day-chai |
| QuestionCard | 🔷 front-end-new ahead | 24-line diff — front-end-new modified |
| SelectionPopover | 🔷 front-end-new ahead | Synced from may-day-chai; front-end-new further extended (16-line diff) |
| SessionRow | ✅ Identical | — |
| SettingsTable | 🆕 New in may-day-chai | New component (Jun 9) — generic settings table for teams/plan settings |
| ShareModal | ✅ Identical | — |
| Sidebar | 🔷 front-end-new ahead | Synced from may-day-chai; front-end-new significantly extended. May-day received major 463-line update (Jun 9) — review before next merge |
| SidebarInset | ✅ Identical | — |
| SidebarMenuItem | 🔷 front-end-new ahead | Synced from may-day-chai; front-end-new further extended. May-day received 94-line update (Jun 9) — review before next merge |
| SidebarMenuSkeleton | 🔷 front-end-new ahead | 4-line diff — front-end-new modified |
| SidebarProjectsSection | 🔷 front-end-new ahead | 34-line diff — front-end-new modified |
| Slider | 🔷 front-end-new ahead | Synced from may-day-chai; front-end-new further extended (16-line diff) |
| Sparkline | ✅ Identical | — |
| Spinner | 🔷 front-end-new ahead | 18-line diff — front-end-new modified |
| StatCard | ✅ Identical | — |
| StreamingIndicator | 🔷 front-end-new ahead | 18-line diff — front-end-new modified |
| SuperLink | ✅ Identical | — |
| SuperLinkDrawer | ✅ Identical | — |
| SuperLinkRow | ✅ Identical | — |
| SuperLinksEmpty | ✅ Identical | — |
| Switch | 🔷 front-end-new ahead | 10-line diff — front-end-new modified |
| SystemInstructionsModal | ⭐ front-end-new only | Keep; not in may-day-chai |
| TabItem | 🔷 front-end-new ahead | Synced from may-day-chai; front-end-new further extended (8-line diff). May-day received 5-line update (Jun 9) |
| Tabs | 🔷 front-end-new ahead | Synced from may-day-chai; front-end-new further extended (22-line diff). May-day received 24-line update (Jun 9) |
| TeamRow | 🆕 New in may-day-chai | New component (Jun 9) — teams team row with member count and workspace info |
| Toast | 🔷 front-end-new ahead | 8-line diff — front-end-new modified |
| TokenBudgetBar | ✅ Identical | — |
| Tooltip | 🔷 front-end-new ahead | 8-line diff — front-end-new modified |
| UsageBarChart | ✅ Identical | — |
| VersionCard | ✅ Identical | — |
| VisibilityRow | ✅ Identical | — |
| WorkspaceBadge | 🆕 New in may-day-chai | New component (Jun 9) — workspace identity badge |
| WorkspaceConnectorCard | 🆕 New in may-day-chai | New component (Jun 9) — connector card for workspace integrations |
| chat/ | ⭐ front-end-new only | Keep; not in may-day-chai |
| compare/ | ⭐ front-end-new only | Keep; not in may-day-chai |
| layout/ | ⭐ front-end-new only | Keep; not in may-day-chai |
| onboarding/ | ⭐ front-end-new only | Keep; not in may-day-chai |
| shared/ | ⭐ front-end-new only | Keep; not in may-day-chai |
| ui/ | ⭐ front-end-new only (extended) | `button.tsx` identical; `index.ts` barrel is front-end-new only |

---

## Templates

| Template | Status | Notes |
|----------|--------|-------|
| Brain | 🔷 front-end-new ahead | Synced 2026-05-28 — 7 new files added (BrainDigestCard, BrainProjectView, ExternalOutputCard, FixProposalCard, LoopRecord, ProjectConfigPanel, StuckCard); lib/phase.ts extended with fix-proposed + stuck phases; index.tsx has front-end-new specific logic (do not overwrite). May-day index.tsx received 33-line update (Jun 9) — review before next merge |
| ChatBoard | ✅ Identical | Synced 2026-05-19 — was may-day-chai only; now copied to front-end-new |
| SuperLinks | ✅ Identical | Synced; present in both `may-day-chai` and `front-end-new` |

---

## Extra files in component folders

| Component | Extra files | Notes |
|-----------|-------------|-------|
| Pinboard | `enterAnimation.tsx` | Present in both — no action needed |
| Sidebar | `context.tsx` | Present in both — no action needed |

---

## Sync history

| Date | Source | What changed |
|------|--------|-------------|
| 2026-06-09 | may-day-chai | 5 new components: MemberRow, SettingsTable, TeamRow, WorkspaceBadge, WorkspaceConnectorCard. Major Sidebar update (463 lines), SidebarMenuItem update (94 lines), Tabs update (24 lines), TabItem update (5 lines), Brain/index.tsx update (33 lines). New src/types/teams.ts. New stories: teams/AnalyticsPage, teams/MemberRow, teams/RoleBadge, teams/TeamRow, teams/TokenPoolBar, teams/WorkspaceBadge, teams/WorkspaceConnectorCard, molecules/ProjectColumn. New docs: TEAMS_PLAN_SETTINGS_SPEC.md, SUPERLINKS_SPEC.md. |
| 2026-05-28 | may-day-chai | Source renamed from may-day to may-day-chai. Copied 1 new component: ConnectorRow. Copied 7 new Brain template files: BrainDigestCard, BrainProjectView, ExternalOutputCard, FixProposalCard, LoopRecord, ProjectConfigPanel, StuckCard. Extended lib/phase.ts with fix-proposed + stuck phases + new PlanStep fields. Added new exports to Brain index.tsx (existing shell logic preserved). Registered MotionProvider, ProjectDocumentCard, ProjectInstructionsPanel as front-end-new only. |
| 2026-05-19 | may-day | Scanned for new additions. Copied 2 new templates: Brain (31 files — BrainHome, BrainTimeline, ActivityBlock, ArtifactCard, ScheduleCard, ContextRail, and 25 more) and ChatBoard (previously skipped, now synced). All component directories already present in front-end-new. |
| 2026-05-18 | may-day | Scanned full codebase. All 4 new may-day components (ChatRow, ChatSelectionBar, GlobalSearchModal, MoveToProjectModal) already present in front-end-new and identical. All previously 🆕/🔄 entries now confirmed synced. Updated legend to include 🔷 (front-end-new ahead). 53 components marked 🔷 — front-end-new has been further developed beyond may-day baseline; do not overwrite. 30 components confirmed ✅ Identical. |
| 2026-05-16 | may-day | Added 19 new components (Avatar, ChartCard, DateRangePill, DeltaPill, Eyebrow, LinksSidePanel, PersonaCard, SessionRow, ShareModal, Sparkline, StatCard, SuperLink, SuperLinkDrawer, SuperLinkRow, SuperLinksEmpty, TokenBudgetBar, UsageBarChart, VersionCard, VisibilityRow). Updated Slider (variant + showValue). Added SuperLinks template. Registered DocumentCard, SystemInstructionsModal, onboarding/ as front-end-new only. |
| 2026-05-13 | may-day | Initial sync. Added 6 new components (DiffLine, EnhanceDotProgress, EnhancePromptField, EnhanceScanningState, EnhanceSummaryBar, Slider). Updated 16 components. |
