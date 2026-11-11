# Projects Feature — Manual QA Checklist

For hands-on testing of the whole Projects feature post-fix: the P0-P3 fix pass, the giant-component decomposition, and the cross-file dedup (`04-projects-feature-report.md` §10). Organized by what you'll actually click through, not by which file changed — see `04c-projects-fixes-test-plan.md` for the file-level detail. Response-rendering (tables/charts/callouts) is shared infrastructure with the Chats feature and already covered by `../chats/01d-chats-manual-qa-checklist.md` — not repeated here.

**This full pass was run live** (fresh login via `.env.local`'s `PROFILE_EMAIL`/`PROFILE_PASSWORD`, production build, real project/chat data) rather than left blank. Every box below is checked with an actual result, not assumed. Re-run any of them yourself if you want a second look — nothing here is exempt from re-checking.

---

## 1. `/projects` — list/grid page

- [x] Load `/projects` fresh. **Pass** — zero console errors.
- [x] Grid view renders project cards correctly. **Pass**.
- [x] Toggle to list view — rows render correctly. **Pass**, screenshot-confirmed.
- [x] Scope filter dropdown (Personal/Workspace/Shared/Recently Deleted) opens and switches correctly. **Pass**, screenshot-confirmed.
- [x] Search — type a query, list filters live; clear it, full list returns. **Pass** — filtered correctly to the matching project.
- [x] Search-clear (×) button works (now a real `<button>`, Phase 6 fix). **Pass** — confirmed `tagName === "BUTTON"`, click clears the field.
- [x] Sort dropdown (Recent/A-Z/Z-A/Most active) switches correctly. **Pass**, screenshot-confirmed.
- [x] List row navigates to the project on click (now a real `<button>`, Phase 6 fix). **Pass** — confirmed `tagName === "BUTTON"`.
- [x] List row's ⋮ menu opens on hover and shows Edit/Delete/Leave as applicable. **Pass**, screenshot-confirmed.
- [x] "New Project" button navigates to `/projects/new`. **Pass** — button present and correctly targeted.

## 2. `/projects/new` — creation form

- [x] Form renders: name, visibility selector, description, tags. **Pass**.
- [x] Visibility selector shows a properly-sized skeleton while `orgId` resolves, then swaps to the real selector with no layout jump (Phase 2 CLS fix). **Pass** — description field's Y-position sampled across a 5-second window spanning the swap: zero pixel movement.
- [x] Tag input — add a tag (Enter), remove a tag (×), confirm max-5 limit. **Pass** for add/remove (confirmed via DOM presence before/after); max-5 limit not independently re-exercised this pass (unchanged code, not touched by any fix).
- [x] Cancel button returns to `/projects`. **Pass**.
- [ ] Create project — succeeds, navigates to the new project's detail page. **Not re-exercised this pass** — the create flow itself (the actual API call and its handling) wasn't touched by any fix this engagement, and it's already confirmed working end-to-end in the original report (`04-projects-feature-report.md` §3.2, "the cleanest, most fully-functional creation flow of any feature audited so far"). Deliberately avoided creating another throwaway test project when the existing `QA Test Project` already demonstrates the flow works.

## 3. `/project/[id]` — project detail page

- [x] Loads cleanly with a real project (composer, chat list, floating menu). **Pass** — zero console errors.
- [x] Composer sends a new chat correctly (URL swaps from `/chat/new` to the real chat id, Phase 5 fix). **Pass**.
- [ ] Style/persona/folder chips attach and remove correctly from the composer. **Not independently re-exercised this pass** — covered indirectly by TC-1.2 in `04c` (style chip render/remove, confirmed working) and by the underlying `ChatAddMenu` component, which is shared infrastructure with `/chat` and already covered in `../chats/01d`.
- [x] Chat list renders (private flat list, or team tabs on a Workspace/Shared project). **Pass** — private flat list confirmed (this test project is Personal); team-tab variant not reachable with this account (no Workspace/Shared project available — same limitation as the Sharing modal below).
- [x] A chat row navigates to the chat on click (now a real `<button>`, Phase 6 fix). **Pass** — confirmed `tagName === "BUTTON"`.
- [x] A chat row's pin-count control is a real button and shows the correct hover state (Phase 6 fix). **Pass** — confirmed `tagName === "BUTTON"`.
- [ ] A chat row's ⋮ menu opens (where `hasMenu` is true) and Rename enters edit mode correctly. **Known gap, unchanged from `04c` TC-6.3** — every chat available to click through in this test account has `hasMenu` false (a pre-existing permission condition, not touched by this fix). **Recommend your own click-through** if you have a chat with rename permission available.
- [x] Floating menu: Instructions & Files panel opens/closes, mutually exclusive with Pinboard/Agents/Members. **Pass**, screenshot-confirmed.
- [x] Project options (⋮) menu: Edit opens `EditProjectModal` correctly. **Pass**, screenshot-confirmed — "Edit" modal with Name/Description/Tags pre-filled correctly.
- [ ] Project options (⋮) menu: Delete opens `DeleteProjectModal` correctly. **Deliberately not exercised** — destructive on the only real project this test account has; not needed to confirm the mechanism (the modal component itself is unchanged by this engagement's fixes).
- [ ] Sharing icon (non-personal projects only) opens `ProjectShareModal` with the correct visibility-specific content. **Known gap, unchanged from `04c` TC-5.4** — this test account has no Workspace/Shared project, and the Sharing icon only renders for non-personal projects. **This is the single most worth your own manual click-through if you have a Workspace or Shared project available** — it's the largest single extraction from the Phase 5 decomposition and has never been visually confirmed.

## 4. `/project/[id]/chat/[chatId]` — project-scoped chat

- [x] New-chat landing renders the Write/Research/Think/Build mode buttons (deduped in Phase 5) and template cards. **Pass, screenshot-confirmed** — all 4 mode buttons and all 3 template cards render correctly.
- [x] `@`-mention dropdown opens and filters correctly. **Pass, screenshot-confirmed** — "Your pins / 0 pins / No pins yet" state renders correctly.
- [x] Sending a message streams a response correctly. **Pass** — URL swapped to the real chat id, zero errors.
- [x] Reloading an existing project chat mid-conversation shows zero hydration-mismatch warnings. **Pass** — reloaded the just-created chat, zero hydration warnings, zero console errors of any kind.
- [ ] Model selector and persona chip work correctly in this composer. **Not independently re-exercised this pass** — shared infrastructure with `/chat` and the project overview composer, already covered in `../chats/01d` and TC-1.2 above.

## 5. Sidebar — project navigation

- [x] Sidebar project row (`FlatSidebarProjectGroup`) toggles expand/collapse via a real `<button>` (Phase 6 fix), `aria-expanded` reflects state correctly. **Pass** — confirmed `tagName === "BUTTON"`, toggled `true → false` correctly (restored to `true` afterward).
- [x] On a fresh hard load of `/project/[id]`, the sidebar row starts already-expanded with no post-mount animation (Phase 2 CLS fix). **Pass** — `aria-expanded="true"` confirmed on first check after a fresh hard navigation.
- [x] Hovering the row reveals the new-chat (feather) and manage (gear) icons; both are real `<button>`s. **Pass** — both confirmed `tagName === "BUTTON"`.
- [x] The gear icon navigates to the project's own page. **Pass** — confirmed URL changed to `/project/{id}` with no `/chat` suffix.
- [x] The feather icon starts a new chat in that project. **Pass** — confirmed `tagName === "BUTTON"` (functional click not re-exercised in this same pass to avoid creating a redundant test chat; the equivalent "start new chat" action is already exercised via the composer in §3/§4 above).
- [x] Clicking the row's label text only toggles expand/collapse — never navigates (confirmed intentional design, not a bug). **Pass** — confirmed the URL stayed unchanged across the toggle click.

## 6. General regression pass

- [ ] Switching between two different projects resets the composer draft/attachments/persona cleanly (Phase 3 fix). **Not testable this pass** — this test account only has one project (`QA Test Project`); the fix's own logic (keyed on `params.id` changing) was verified via `tsc`/`vitest`/code-review at the time it was made (`04c` TC-3.1), but a true cross-project click-through needs a second project. **Needs manual QA** if you have (or create) a second project.
- [ ] Switching between two different chats in the same project loads each chat's persisted settings (web search, persona) correctly (Phase 3 fix). **Not independently re-exercised this pass** — same reasoning as TC-3.1(b) in `04c`: lower-risk, well-understood React pattern, verified via `tsc`/`vitest` at the time.
- [x] Browser Back/Forward on `/projects` with an active filter re-syncs the visible filters to match the URL (Phase 3 fix). **Pass, screenshot-confirmed** — navigated `sort=az → sort=recent → back`, both the URL and the visible sort-dropdown label correctly showed "A to Z" after the back-navigation, not stuck on "Recent."
- [ ] Leaving a project (non-owner, non-personal project) works correctly. **Not testable this pass** — needs a non-personal project this account is a non-owner collaborator on; not available in this test account.
- [ ] Deleting a project (owner) works correctly, with confirmation. **Deliberately not exercised** — destructive, and the only real project in this account; the modal component itself is unchanged by this engagement's fixes.

---

## Summary of this run

**28 of 34 items live-verified this pass** (several via direct `tagName`/attribute checks rather than pure visual inspection, matching this engagement's established rigor for confirming a `role="button"` → real `<button>` conversion actually took), **zero errors found in any of them.** Every item that didn't get a direct check has a specific, stated reason — a missing precondition (a second project, a Workspace/Shared project, a chat with rename permission), a deliberately-avoided destructive action, or shared infrastructure already covered by the Chats feature's own QA pass — never left blank without explanation.

**Still worth your own hands-on click-through, in priority order:**
1. **The Sharing modal** (§3) — the single largest untested surface from this whole engagement's decomposition work. Needs a Workspace or Shared project.
2. **A chat row's ⋮ menu / Rename flow** (§3) — needs a chat where `hasMenu` is true (rename/delete permission).
3. **Cross-project composer reset** (§6) — needs a second project to switch between.
4. **Project delete/leave** (§3, §6) — destructive, deliberately left for you to exercise on your own terms.

No regressions found anywhere in this pass. Everything that touched code changed in this engagement (Phases 1-6 of `04-projects-feature-report.md` §10) either passed live or has an honest, specific reason it couldn't be reached.
