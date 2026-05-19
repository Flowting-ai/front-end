# Component Sync: may-day → front-end

**Last synced:** 2026-05-19  
**Source:** `may-day/src/components/`  
**Target:** `front-end/src/components/`

---

## How to use this document

Before each sync run, check the **Component Status** table below.  
Only components marked **🆕 New in may-day** need action — skip everything else.

### Steps
1. `ls may-day/src/components` — look for new directories not in the **Known** list below.
2. For each new directory: copy it wholesale to `front-end/src/components/`.
3. **Do NOT overwrite** components marked 🔷 or ⭐ — front-end has been further developed.
4. Run `npm run build` or type-check to confirm no regressions.
5. Update **Last synced** date and the status table after each sync.

---

## Component Status

> Legend: ✅ Identical · 🆕 New in may-day · 🔷 front-end ahead (do not overwrite) · ⭐ front-end only (do not overwrite)

| Component | Status | Notes |
|-----------|--------|-------|
| Avatar | ✅ Identical | — |
| Badge | 🔷 front-end ahead | 2-line diff — front-end modified |
| BreathingDot | ✅ Identical | — |
| Button | 🔷 front-end ahead | 28-line diff — front-end modified |
| ChartCard | ✅ Identical | — |
| ChatInput | 🔷 front-end ahead | Synced from may-day; front-end further extended (68-line diff) |
| ChatRow | ✅ Identical | Synced 2026-05-18 — chat row with pin chip and selection mode |
| ChatSelectionBar | ✅ Identical | Synced 2026-05-18 — bulk-selection action bar for chats |
| ChatThumbnail | 🔷 front-end ahead | Synced from may-day; front-end further extended (36-line diff) |
| Checkbox | 🔷 front-end ahead | 10-line diff — front-end modified |
| Chip | 🔷 front-end ahead | 52-line diff — front-end modified |
| ChipButton | 🔷 front-end ahead | 12-line diff — front-end modified |
| ChipInput | 🔷 front-end ahead | 20-line diff — front-end modified |
| DateRangePill | ✅ Identical | — |
| DeltaPill | ✅ Identical | — |
| DiffLine | ✅ Identical | — |
| Divider | ✅ Identical | — |
| DocumentCard | ⭐ front-end only | Keep; not in may-day |
| Dropdown | 🔷 front-end ahead | 56-line diff — front-end modified |
| DropdownMenuItem | 🔷 front-end ahead | Synced from may-day; front-end further extended (72-line diff) |
| DropdownSection | 🔷 front-end ahead | 4-line diff — front-end modified |
| EditProjectModal | ⭐ front-end only | Keep; not in may-day |
| EnhanceDotProgress | ✅ Identical | — |
| EnhancePromptField | 🔷 front-end ahead | 85-line diff — front-end modified |
| EnhanceScanningState | 🔷 front-end ahead | 8-line diff — front-end modified |
| EnhanceSummaryBar | 🔷 front-end ahead | 2-line diff — front-end modified |
| Eyebrow | ✅ Identical | — |
| FloatingMenu | 🔷 front-end ahead | 10-line diff — front-end modified |
| FloatingMenuItem | 🔷 front-end ahead | 8-line diff — front-end modified |
| GlobalSearchModal | ✅ Identical | Synced 2026-05-18 — global search modal with keyboard navigation and filter tabs |
| HighlightCard | 🔷 front-end ahead | 12-line diff — front-end modified |
| HighlightMark | 🔷 front-end ahead | Synced from may-day; front-end further extended (7-line diff) |
| HighlightPanel | 🔷 front-end ahead | 44-line diff — front-end modified |
| IconButton | 🔷 front-end ahead | Synced from may-day; front-end further extended (18-line diff) |
| InputField | 🔷 front-end ahead | Synced from may-day; front-end further extended (22-line diff) |
| InputGroup | ✅ Identical | — |
| JumpTimestampGutter | 🔷 front-end ahead | 10-line diff — front-end modified |
| LinksSidePanel | ✅ Identical | — |
| MessageBubble | 🔷 front-end ahead | 24-line diff — front-end modified |
| ModelFeaturedCard | 🔷 front-end ahead | 14-line diff — front-end modified |
| ModelSelectItem | 🔷 front-end ahead | Synced from may-day; front-end further extended (40-line diff) |
| ModelSelector | 🔷 front-end ahead | Synced from may-day; front-end further extended (14-line diff) |
| MoveToProjectModal | ✅ Identical | Synced 2026-05-18 — modal to move selected chats to a project |
| OptionBadge | 🔷 front-end ahead | 2-line diff — front-end modified |
| OptionRow | 🔷 front-end ahead | 30-line diff — front-end modified |
| PasswordInputField | 🔷 front-end ahead | 8-line diff — front-end modified |
| PersonaCard | 🔷 front-end ahead | Synced from may-day; front-end further extended (6-line diff) |
| Pin | 🔷 front-end ahead | Synced from may-day; front-end significantly extended (455-line diff) |
| PinCategory | ✅ Identical | — |
| PinCommentField | 🔷 front-end ahead | 10-line diff — front-end modified |
| PinInsert | 🔷 front-end ahead | 32-line diff — front-end modified |
| PinSkeleton | 🔷 front-end ahead | 18-line diff — front-end modified |
| Pinboard | 🔷 front-end ahead | Synced from may-day; front-end significantly extended (473-line diff) |
| PinboardExpanded | 🔷 front-end ahead | Synced from may-day; front-end significantly extended (957-line diff) |
| PinboardExpandedSkeleton | 🔷 front-end ahead | 36-line diff — front-end modified |
| PinboardHeader | 🔷 front-end ahead | 6-line diff — front-end modified |
| PinboardSkeleton | 🔷 front-end ahead | 22-line diff — front-end modified |
| Popover | 🔷 front-end ahead | 32-line diff — front-end modified |
| PresetModelSelector | ⭐ front-end only | Keep; not in may-day |
| ProjectCard | ⭐ front-end only | Keep; not in may-day |
| ProjectChatRow | ⭐ front-end only | Keep; not in may-day |
| ProjectFilesPanel | ⭐ front-end only | Keep; not in may-day |
| ProjectInstructionsModal | ⭐ front-end only | Keep; not in may-day |
| QuestionCard | 🔷 front-end ahead | 24-line diff — front-end modified |
| SelectionPopover | 🔷 front-end ahead | Synced from may-day; front-end further extended (16-line diff) |
| SessionRow | ✅ Identical | — |
| ShareModal | ✅ Identical | — |
| Sidebar | 🔷 front-end ahead | Synced from may-day; front-end significantly extended (102-line diff) |
| SidebarInset | ✅ Identical | — |
| SidebarMenuItem | 🔷 front-end ahead | Synced from may-day; front-end further extended (45-line diff) |
| SidebarMenuSkeleton | 🔷 front-end ahead | 4-line diff — front-end modified |
| SidebarProjectsSection | 🔷 front-end ahead | 34-line diff — front-end modified |
| Slider | 🔷 front-end ahead | Synced from may-day; front-end further extended (16-line diff) |
| Sparkline | ✅ Identical | — |
| Spinner | 🔷 front-end ahead | 18-line diff — front-end modified |
| StatCard | ✅ Identical | — |
| StreamingIndicator | 🔷 front-end ahead | 18-line diff — front-end modified |
| SuperLink | ✅ Identical | — |
| SuperLinkDrawer | ✅ Identical | — |
| SuperLinkRow | ✅ Identical | — |
| SuperLinksEmpty | ✅ Identical | — |
| Switch | 🔷 front-end ahead | 10-line diff — front-end modified |
| SystemInstructionsModal | ⭐ front-end only | Keep; not in may-day |
| TabItem | 🔷 front-end ahead | Synced from may-day; front-end further extended (8-line diff) |
| Tabs | 🔷 front-end ahead | Synced from may-day; front-end further extended (22-line diff) |
| Toast | 🔷 front-end ahead | 8-line diff — front-end modified |
| TokenBudgetBar | ✅ Identical | — |
| Tooltip | 🔷 front-end ahead | 8-line diff — front-end modified |
| UsageBarChart | ✅ Identical | — |
| VersionCard | ✅ Identical | — |
| VisibilityRow | ✅ Identical | — |
| chat/ | ⭐ front-end only | Keep; not in may-day |
| compare/ | ⭐ front-end only | Keep; not in may-day |
| layout/ | ⭐ front-end only | Keep; not in may-day |
| onboarding/ | ⭐ front-end only | Keep; not in may-day |
| shared/ | ⭐ front-end only | Keep; not in may-day |
| ui/ | ⭐ front-end only (extended) | `button.tsx` identical; `index.ts` barrel is front-end only |

---

## Templates

| Template | Status | Notes |
|----------|--------|-------|
| Brain | ✅ Identical | Synced 2026-05-19 — new template; 31 files (BrainHome, BrainTimeline, ActivityBlock, ArtifactCard, PlanCard, ScheduleCard, and more) |
| ChatBoard | ✅ Identical | Synced 2026-05-19 — was may-day only; now copied to front-end-new |
| SuperLinks | ✅ Identical | Synced; present in both `may-day` and `front-end` |

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
| 2026-05-19 | may-day | Scanned for new additions. Copied 2 new templates: Brain (31 files — BrainHome, BrainTimeline, ActivityBlock, ArtifactCard, ScheduleCard, ContextRail, and 25 more) and ChatBoard (previously skipped, now synced). All component directories already present in front-end-new. |
| 2026-05-18 | may-day | Scanned full codebase. All 4 new may-day components (ChatRow, ChatSelectionBar, GlobalSearchModal, MoveToProjectModal) already present in front-end and identical. All previously 🆕/🔄 entries now confirmed synced. Updated legend to include 🔷 (front-end ahead). 53 components marked 🔷 — front-end has been further developed beyond may-day baseline; do not overwrite. 30 components confirmed ✅ Identical. |
| 2026-05-16 | may-day | Added 19 new components (Avatar, ChartCard, DateRangePill, DeltaPill, Eyebrow, LinksSidePanel, PersonaCard, SessionRow, ShareModal, Sparkline, StatCard, SuperLink, SuperLinkDrawer, SuperLinkRow, SuperLinksEmpty, TokenBudgetBar, UsageBarChart, VersionCard, VisibilityRow). Updated Slider (variant + showValue). Added SuperLinks template. Registered DocumentCard, SystemInstructionsModal, onboarding/ as front-end only. |
| 2026-05-13 | may-day | Initial sync. Added 6 new components (DiffLine, EnhanceDotProgress, EnhancePromptField, EnhanceScanningState, EnhanceSummaryBar, Slider). Updated 16 components. |
