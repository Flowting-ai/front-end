# Component Sync: may-day → front-end-new

**Last synced:** 2026-05-13  
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
| Badge | ✅ Identical | — |
| BreathingDot | ✅ Identical | — |
| Button | ✅ Identical | — |
| ChatInput | 🔄 Updated | `FolderAddIcon`/`UserIcon`/`LlmIcon variant="color"`; `FolderOneIcon` loses `variant="static"`; `Omit` type fix |
| ChatThumbnail | 🔄 Updated | `FolderOneIcon` loses `variant="static"` |
| Checkbox | ✅ Identical | — |
| Chip | ✅ Identical | — |
| ChipButton | ✅ Identical | — |
| ChipInput | ✅ Identical | — |
| DiffLine | 🆕 New in may-day | New atom — diff-line renderer |
| Divider | ✅ Identical | — |
| Dropdown | ✅ Identical | — |
| DropdownMenuItem | 🔄 Updated | `LlmIcon variant` `"avatar"` → `"color"` |
| DropdownSection | ✅ Identical | — |
| EditProjectModal | ⭐ front-end-new only | Keep; not in may-day |
| EnhanceDotProgress | 🆕 New in may-day | New atom — animated dot progress for enhance flow |
| EnhancePromptField | 🆕 New in may-day | New molecule — prompt field for enhance flow |
| EnhanceScanningState | 🆕 New in may-day | New molecule — scanning state for enhance flow |
| EnhanceSummaryBar | 🆕 New in may-day | New molecule — summary bar for enhance flow |
| FloatingMenu | ✅ Identical | — |
| FloatingMenuItem | ✅ Identical | — |
| HighlightCard | ✅ Identical | — |
| HighlightMark | 🔄 Updated | Adds `data-highlight-id` prop forwarded to `<mark>` element |
| HighlightPanel | ✅ Identical | — |
| IconButton | 🔄 Updated | Discriminated union enforcing `aria-label` OR `aria-labelledby` (TS a11y) |
| InputField | 🔄 Updated | `Omit` extended to also exclude `'size'` from `InputHTMLAttributes` |
| InputGroup | ✅ Identical | — |
| JumpTimestampGutter | ✅ Identical | — |
| MessageBubble | ✅ Identical | — |
| ModelFeaturedCard | ✅ Identical | — |
| ModelSelectItem | 🔄 Updated | `LlmIcon variant` `"avatar"` → `"color"` |
| ModelSelector | 🔄 Updated | `AtomTwoIcon` → `AtomOneIcon`; `TIER_TABS` gains "All"; default tier `'free'` → `'all'` |
| OptionBadge | ✅ Identical | — |
| OptionRow | ✅ Identical | — |
| PasswordInputField | ✅ Identical | — |
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
| Sidebar | 🔄 Updated | `activeChatId`/`onSelectChat` controlled selection; scroll-position memory; `onChatClick` flow; auto-expand parent folder |
| SidebarInset | ✅ Identical | — |
| SidebarMenuItem | 🔄 Updated | `useEffect` syncs `editValue` to `label` on edit entry; cursor placed at end; keydown guard for edit mode; `data-state` prop added |
| SidebarMenuSkeleton | ✅ Identical | — |
| SidebarProjectsSection | ✅ Identical | — |
| Slider | 🆕 New in may-day | New atom — range slider |
| Spinner | ✅ Identical | — |
| StreamingIndicator | ✅ Identical | — |
| Switch | ✅ Identical | — |
| TabItem | 🔄 Updated | `data-state` prop added (Radix Tabs injects it) |
| Tabs | 🔄 Updated | Type assertion on `.focus()` call (functionally identical) |
| Toast | ✅ Identical | — |
| Tooltip | ✅ Identical | — |
| chat/ | ⭐ front-end-new only | Keep; not in may-day |
| compare/ | ⭐ front-end-new only | Keep; not in may-day |
| layout/ | ⭐ front-end-new only | Keep; not in may-day |
| shared/ | ⭐ front-end-new only | Keep; not in may-day |
| ui/ | ⭐ front-end-new only (extended) | `button.tsx` identical; `index.ts` barrel is front-end-new only |

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
| 2026-05-13 | may-day | Initial sync. Added 6 new components (DiffLine, EnhanceDotProgress, EnhancePromptField, EnhanceScanningState, EnhanceSummaryBar, Slider). Updated 16 components (see 🔄 rows above). |
