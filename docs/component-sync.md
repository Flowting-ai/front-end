# Component Sync: may-day → front-end-new

**Last synced:** 2026-05-16  
**Source:** `may-day/src/components/`  
**Target:** `front-end-new/src/components/`

---

## How to use this document

Before each sync run, check the **Component Status** table below.  
Only components marked **CHANGED** or **NEW (may-day)** need action — skip everything else.

### Steps
1. `ls may-day/src/components` — look for new directories not in the **Known** list below.
2. For each new directory: copy it wholesale to `front-end-new/src/components/`.
3. For changed components: copy `index.tsx` (and any extra files) from may-day.
4. Run `npm run build` or type-check to confirm no regressions.
5. Update **Last synced** date and the status table after each sync.

---

## Component Status

> Legend: ✅ Identical · 🔄 Updated · 🆕 New in may-day · ⭐ front-end-new only (do not overwrite)

| Component | Status | Notes |
|-----------|--------|-------|
| Avatar | 🆕 New in may-day | New atom/molecule — user avatar with fallback initials |
| Badge | ✅ Identical | — |
| BreathingDot | ✅ Identical | — |
| Button | ✅ Identical | — |
| ChartCard | 🆕 New in may-day | New molecule — chart card wrapper with header/footer slots |
| ChatInput | 🔄 Updated | `FolderAddIcon`/`UserIcon`/`LlmIcon variant="color"`; `FolderOneIcon` loses `variant="static"`; `Omit` type fix |
| ChatThumbnail | 🔄 Updated | `FolderOneIcon` loses `variant="static"` |
| Checkbox | ✅ Identical | — |
| Chip | ✅ Identical | — |
| ChipButton | ✅ Identical | — |
| ChipInput | ✅ Identical | — |
| DateRangePill | 🆕 New in may-day | New atom — date range pill display |
| DeltaPill | 🆕 New in may-day | New atom — delta/change indicator pill |
| DiffLine | ✅ Identical | Synced; no changes in may-day |
| Divider | ✅ Identical | — |
| DocumentCard | ⭐ front-end-new only | Keep; not in may-day |
| Dropdown | ✅ Identical | — |
| DropdownMenuItem | 🔄 Updated | `LlmIcon variant` `"avatar"` → `"color"` |
| DropdownSection | ✅ Identical | — |
| EditProjectModal | ⭐ front-end-new only | Keep; not in may-day |
| EnhanceDotProgress | ✅ Identical | Synced; no changes in may-day |
| EnhancePromptField | ✅ Identical | Synced; no changes in may-day |
| EnhanceScanningState | ✅ Identical | Synced; no changes in may-day |
| EnhanceSummaryBar | ✅ Identical | Synced; no changes in may-day |
| Eyebrow | 🆕 New in may-day | New atom — section eyebrow/label |
| FloatingMenu | ✅ Identical | — |
| FloatingMenuItem | ✅ Identical | — |
| HighlightCard | ✅ Identical | — |
| HighlightMark | 🔄 Updated | Adds `data-highlight-id` prop forwarded to `<mark>` element |
| HighlightPanel | ✅ Identical | — |
| IconButton | 🔄 Updated | Discriminated union enforcing `aria-label` OR `aria-labelledby` (TS a11y) |
| InputField | 🔄 Updated | `Omit` extended to also exclude `'size'` from `InputHTMLAttributes` |
| InputGroup | ✅ Identical | — |
| JumpTimestampGutter | ✅ Identical | — |
| LinksSidePanel | 🆕 New in may-day | New molecule — side panel for links/resources |
| MessageBubble | ✅ Identical | — |
| ModelFeaturedCard | ✅ Identical | — |
| ModelSelectItem | 🔄 Updated | `LlmIcon variant` `"avatar"` → `"color"` |
| ModelSelector | 🔄 Updated | `AtomTwoIcon` → `AtomOneIcon`; `TIER_TABS` gains "All"; default tier `'free'` → `'all'` |
| OptionBadge | ✅ Identical | — |
| OptionRow | ✅ Identical | — |
| PasswordInputField | ✅ Identical | — |
| PersonaCard | 🆕 New in may-day | New molecule — persona card with avatar, bio, stats, and link sections |
| Pin | 🔄 Updated | Major: `modelName`/`createdAt`/`pinId` props; comment CRUD API integration; `PinMarkdownRenderer` + `PinCommentItem` sub-components; `formatRelativeTime` helper; dynamic `ExpandedMeta`; revised height animation |
| PinCategory | ✅ Identical | — |
| PinCommentField | ✅ Identical | — |
| PinInsert | ✅ Identical | — |
| PinSkeleton | ✅ Identical | — |
| Pinboard | 🔄 Updated | New organize-mode props (`onCreateFolder`, `onMoveToFolder`, `onDeletePins`); viewport-safe expanded positioning; `FolderOneIcon` loses `variant="static"` |
| PinboardExpanded | 🔄 Updated | New organize-mode props fully wired; inline new-folder creation flow; `CancelCircleIcon` replaces `DeleteTwoIcon`; `FolderOneIcon` loses `variant="static"` |
| PinboardExpandedSkeleton | ✅ Identical | — |
| PinboardHeader | ✅ Identical | — |
| PinboardSkeleton | ✅ Identical | — |
| Popover | ✅ Identical | — |
| PresetModelSelector | ⭐ front-end-new only | Keep; not in may-day |
| ProjectCard | ⭐ front-end-new only | Keep; not in may-day |
| ProjectChatRow | ⭐ front-end-new only | Keep; not in may-day |
| ProjectFilesPanel | ⭐ front-end-new only | Keep; not in may-day |
| ProjectInstructionsPanel | ⭐ front-end-new only | Keep; not in may-day |
| QuestionCard | ✅ Identical | — |
| SelectionPopover | 🔄 Updated | Toolbar `onMouseDown={e => e.preventDefault()}` to preserve text selection |
| SessionRow | 🆕 New in may-day | New molecule — session list row |
| ShareModal | 🆕 New in may-day | New molecule — share modal for superlinks |
| Sidebar | 🔄 Updated | `activeChatId`/`onSelectChat` controlled selection; scroll-position memory; `onChatClick` flow; auto-expand parent folder |
| SidebarInset | ✅ Identical | — |
| SidebarMenuItem | 🔄 Updated | `useEffect` syncs `editValue` to `label` on edit entry; cursor placed at end; keydown guard for edit mode; `data-state` prop added |
| SidebarMenuSkeleton | ✅ Identical | — |
| SidebarProjectsSection | ✅ Identical | — |
| Slider | 🔄 Updated | Added `variant` (`'default' \| 'pips' \| 'scrubber'`) and `showValue` prop |
| Sparkline | 🆕 New in may-day | New molecule — sparkline mini-chart |
| Spinner | ✅ Identical | — |
| StatCard | 🆕 New in may-day | New molecule — stat/metric display card |
| StreamingIndicator | ✅ Identical | — |
| SuperLink | 🆕 New in may-day | New molecule — superlink core component |
| SuperLinkDrawer | 🆕 New in may-day | New organism — superlink detail drawer |
| SuperLinkRow | 🆕 New in may-day | New molecule — superlink row list item |
| SuperLinksEmpty | 🆕 New in may-day | New molecule — superlinks empty state |
| Switch | ✅ Identical | — |
| SystemInstructionsModal | ⭐ front-end-new only | Keep; not in may-day |
| TabItem | 🔄 Updated | `data-state` prop added (Radix Tabs injects it) |
| Tabs | 🔄 Updated | Type assertion on `.focus()` call (functionally identical) |
| Toast | ✅ Identical | — |
| TokenBudgetBar | 🆕 New in may-day | New atom — token budget usage bar |
| Tooltip | ✅ Identical | — |
| UsageBarChart | 🆕 New in may-day | New molecule — usage bar chart |
| VersionCard | 🆕 New in may-day | New molecule — version/release card |
| VisibilityRow | 🆕 New in may-day | New molecule — visibility toggle row |
| chat/ | ⭐ front-end-new only | Keep; not in may-day |
| compare/ | ⭐ front-end-new only | Keep; not in may-day |
| layout/ | ⭐ front-end-new only | Keep; not in may-day |
| onboarding/ | ⭐ front-end-new only | Keep; not in may-day |
| shared/ | ⭐ front-end-new only | Keep; not in may-day |
| ui/ | ⭐ front-end-new only (extended) | `button.tsx` identical; `index.ts` barrel is front-end-new only |

---

## Templates

> may-day has a `src/templates/` directory. front-end-new has no templates directory yet.

| Template | Status | Notes |
|----------|--------|-------|
| SuperLinks | 🆕 New in may-day | New page template — superlinks management view; copy `may-day/src/templates/SuperLinks/` to `front-end-new/src/templates/SuperLinks/` |
| ChatBoard | ⭐ may-day only | Existing may-day template; no equivalent in front-end-new — skip unless needed |

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
| 2026-05-16 | may-day | Added 19 new components (Avatar, ChartCard, DateRangePill, DeltaPill, Eyebrow, LinksSidePanel, PersonaCard, SessionRow, ShareModal, Sparkline, StatCard, SuperLink, SuperLinkDrawer, SuperLinkRow, SuperLinksEmpty, TokenBudgetBar, UsageBarChart, VersionCard, VisibilityRow). Updated Slider (variant + showValue). Added SuperLinks template. Resolved prior 🆕 entries (DiffLine, Enhance*) now confirmed synced. Registered DocumentCard, SystemInstructionsModal, onboarding/ as front-end-new only. |
| 2026-05-13 | may-day | Initial sync. Added 6 new components (DiffLine, EnhanceDotProgress, EnhancePromptField, EnhanceScanningState, EnhanceSummaryBar, Slider). Updated 16 components (see 🔄 rows above). |
