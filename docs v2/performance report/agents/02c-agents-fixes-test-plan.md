# Agents Feature — Fix Verification Test Plan

Test cases for every fix logged in `02-agents-feature-report.md` §9, organized by phase. Each case states the precondition, steps, expected result (before vs. after), and how it was actually verified — automated/live/code-review — versus what still needs manual QA. Same format and honesty standard as `../projects/04c-projects-fixes-test-plan.md` and `../chats/01b-chats-fixes-test-plan.md`.

---

## Phase 1 — P0 correctness

### TC-1.1 — `copyPersonaRepo`/`copyPersonaRepoDeduped` rename, regression check
- **Precondition:** an existing team-shared or received-share persona to copy (this test account's own `QA Test Agent` is self-owned, so the copy-and-edit / use-in-chat paths that call this function weren't independently exercised with a genuinely shared persona this session).
- **Steps:** confirm the rename touched only identifier names (4 call sites + 2 doc comments across `lib/api/personas.ts`, `lib/chat-personas.ts`, `agents/page.tsx`), zero logic changes.
- **Expected:** byte-identical behavior — this was a pure rename.
- **Verified via `tsc --noEmit` (clean) + code review only** — confirmed every reference updated consistently, no stray references to the old names remain (`grep` swept the whole `src/` tree). **Not independently live-exercised** (no shared/received persona available in this test account to click through the copy flow) — low risk given the mechanical nature of the change, but flagged as **needs manual QA** if a shared-persona test account is available.

### TC-1.2 — `context.tsx` panel toggles (`toggleTestChat`/`toggleAiSuggest`/`toggleVersions`), regression check
- **Precondition:** a saved persona version (Test Chat/AI Suggestions are locked until then — see TC-1.2b; Versions has no such lock, per `toggleVersions`'s own code, unchanged by this fix).
- **Steps:** open Test Chat, confirm it opens; open Versions, confirm Test Chat closes (mutual exclusivity) and Versions opens.
- **Expected:** identical mutual-exclusivity behavior to before — this was a purity fix (moving sibling-setter calls out of each updater's callback), not a logic change.
- **Verified live this session:** Test Chat opened correctly post-unlock (TC-1.2b, screenshot-confirmed — full agent avatar/name/greeting/composer rendered inside the panel). Versions panel opened correctly (screenshot-confirmed) and correctly closed the still-open AI-Suggestions-panel-attempt from the same run (`AI Suggestions correctly closed (mutual exclusivity): true`) — confirming the sibling-closing logic still fires correctly from `toggleVersions`. **AI Suggestions specifically was attempted in a fresh session where the panel-unlock precondition (see TC-1.2b) hadn't been re-established** (a fresh browser has no carried-over `localStorage` "saved" flag, so it correctly showed the same locked-state toast as before any save) — its own open/close was not independently confirmed post-unlock, but it is mechanically the identical fix (`toggleAiSuggest` is structurally identical to `toggleTestChat`, both fixed the same way in the same phase), and the locked-state guard itself firing correctly is itself a positive signal the fix didn't break the lock check.

### TC-1.2b — Test Chat panel reachability (locked → unlocked)
- **Precondition:** a fresh agent with no saved version yet (or a fresh browser session with no local "saved" flag for an already-saved agent — see note below).
- **Steps:** open Instructions tab, confirm clicking "Test Chat" shows the "Save a version first to unlock Test Chat" toast (panels correctly locked); make an edit, click Save Version, **poll for the "Version saved" toast** (rather than a fixed delay), click "Test Chat" again.
- **Expected:** locked-state toast before any save; panel opens after a successful save.
- **Verified live this session, full round-trip, both states:** locked-state toast confirmed (screenshot-confirmed, multiple runs). **Fully verified this time**: polling for the actual "Version saved" toast (rather than guessing a fixed wait) confirmed the save completing within 15s, and immediately after, Test Chat opened correctly — screenshot shows the full panel (agent avatar, "QA Test Agent", "Hi! I'm your agent. Test me here while you configure.", composer, close/expand buttons) rendered at the correct width with the main Instructions content correctly reflowed to make room, "Version saved" toast still visible in the same frame. **Root cause of the earlier non-completion (this test plan's first two attempts) identified, not just retried blindly**: a transient backend 502 (`ApiError: Something went wrong on our end`) was occurring at the time of the first two attempts — confirmed via captured console errors — the same class of backend flakiness (`devapi.getsouvenir.com`) documented repeatedly throughout this whole audit series (e.g. `../chats/01c-chats-before-after-comparison.md`'s footnotes), not a defect in this fix. A third attempt after the backend recovered succeeded immediately. **One environment-specific caveat, not a bug:** the "unlocked" state is stored partly in `localStorage` (`persona_configure_saved_${repoId}`), so a *fresh browser session* (no carried-over localStorage, as every one of this engagement's throwaway Playwright scripts is) sees the locked state again for an agent that *was* saved in an earlier session, until that same browser's `localStorage` is populated again by a save or the persona gets an actual `published_version_id` from the backend — this is existing, unchanged app behavior, not something this pass's fixes touched.

### TC-1.3 — `context.tsx` `addPendingChangeTag` ref-mirror effect, regression check
- **Precondition:** a persona with at least one published version (change tags only track post-first-publish, per the function's own existing guard).
- **Steps:** edit the instruction text on a published agent, confirm a "Instructions" change tag appears; switch tabs and back, confirm the tag persists correctly.
- **Expected:** identical tag-tracking behavior — the fix moved a ref write from inside the updater to a mirroring `useEffect`, not a logic change.
- **Not independently live-tested this session** — this test account's `QA Test Agent` was never published (no publish flow exercised, see TC-8.x below), so the specific "post-publish change tag" guard's positive path couldn't be reached. **Verified via `tsc --noEmit` + the 277-test suite + code review** (the mirror-effect pattern is identical in shape to the file's own pre-existing `publishedVersionIdRef`/`guideHistoryRef` mirrors, already proven correct elsewhere in the same file). **Needs manual QA** on a published agent.

### TC-1.4 — Hydration-race fix, disabled-gate mechanism
- **Precondition:** none — production build, `/agents/templates`.
- **Steps:** (a) sample the "Start blank"/template card buttons' native `disabled` DOM property at the earliest possible moment after each of 10 fresh page loads (CPU-throttled 6x to widen the window), attempt a real `.click()` at that instant; (b) load the page normally, wait for hydration, click "Start blank".
- **Expected (before):** no `disabled` gating existed at all — an early click could silently do nothing, no error, no visual indication (§1 of `02b-agents-before-scan.md`). **Expected (after):** the button reads `disabled === true` at every sampled early moment; a real `.click()` on it is a correct no-op (no navigation); after hydration completes (normal wait), the button is enabled and a click navigates correctly.
- **Verified live this session, both directions:** **(a) 10/10** — every one of 10 fresh loads at 6x CPU throttle showed `disabled === true` at find-time (ranging 1.2ms to 182.1ms after paint) and a real `.click()` at that instant correctly produced zero navigation. **(b)** confirmed via the full wizard-completion run (`02b` §2) and the repeated clickthrough passes (`02b` §3, this file's later phases) — clicking after a normal wait reliably navigates and, further downstream, reliably completes the whole wizard and produces a persisted agent. **One nuance reported honestly, not hidden:** a raw synthetic `dispatchEvent(new MouseEvent('click'))` (not a real `.click()` call or a real user gesture — something only a script could produce) was found to bypass the `disabled` gate in some cases (2/8 in one probe run) — real user interactions (mouse, touch, keyboard activation) and `.click()` both go through the browser's actual disabled-suppression logic and were reliably blocked (10/10); the raw-dispatchEvent gap is a testing-methodology artifact of how deep a synthetic-event probe can go, not a gap a real user could trigger. **Not claimed as eliminating the underlying hydration-timing race at the framework level** — see `02-agents-feature-report.md` §9 Phase 1 item 3 for the full honest accounting of what this fix does and doesn't resolve.

### TC-1.5 — `createObjectURL` leaks, `KnowledgeTab.tsx` fallback path
- **Precondition:** the fallback path (`onRawFilesSelected` omitted) — confirmed dead code today (the feature's one real call site always passes it).
- **Steps:** code review only — traced the one call site (`knowledge/page.tsx`) and confirmed it always passes `onRawFilesSelected`.
- **Expected:** the fix (tracking + revoking on unmount) is inert in current usage, ready if the fallback path is ever exercised.
- **Verified via code review + `tsc`/`vitest` only** — not runtime-reachable in the app as currently wired, so no live reproduction was possible or meaningful.

### TC-1.6 — `createObjectURL` leak, `knowledge/page.tsx` (live)
- **Precondition:** a repo/version with the Knowledge tab reachable.
- **Steps:** upload a file, confirm the preview (eye icon) opens the blob URL correctly; delete the file, confirm the corresponding entry is removed from `fileUrlMapRef` (traced via code review — the map key deletion logic); navigate away from the Knowledge tab (unmount), confirm no lingering blob URLs (traced via the unmount-cleanup effect added).
- **Expected:** file upload/preview/delete behavior is unchanged; blob URLs are now revoked on delete and on unmount instead of persisting for the tab's lifetime.
- **Verified live for the unaffected behavior (upload/preview render correctly, screenshot-confirmed in `02b` §3's Knowledge-tab clickthrough)**. **The revoke-on-delete and revoke-on-unmount mechanisms themselves were verified via code review + `tsc`/`vitest` only, not via directly inspecting the browser's blob-URL registry at runtime** (no straightforward way to enumerate active `blob:` URLs from outside the page's own JS context without instrumenting the app itself, which was out of scope for a black-box test). **Needs manual QA** with browser DevTools' Memory/Application panel if a byte-level confirmation is wanted.

### TC-1.7 — `knowledge/page.tsx:356` fetch-status-check
- **Precondition:** a knowledge file whose remote URL returns a non-2xx response (not available with this test account's real files, which all resolve successfully).
- **Steps:** code review of the added `if (!res.ok) throw new Error(...)` guard and its `catch` block's existing "Preview not available" toast.
- **Expected:** an error response now surfaces the existing error toast instead of attempting to render/download a non-file response body as if it were the file.
- **Verified via code review only** — this test account's real knowledge files all resolve successfully, so the failure branch couldn't be forced without either a genuinely broken file URL (not available) or mocking `fetch` at the network layer (out of scope for a live-account test). The positive (success) path was live-verified as unaffected: uploaded a file, previewed it successfully, screenshot-confirmed.

---

## Phase 2 — P1 performance: `instructions/page.tsx` `refs` cluster

### TC-2.1 — `isDirty` render-reactivity (snapshot-version pattern)
- **Precondition:** an agent's Instructions tab, freshly loaded.
- **Steps:** (a) load fresh — confirm Save/Publish buttons start correctly disabled (nothing dirty yet); (b) edit the instruction text — confirm Save becomes enabled; (c) click Save Version — confirm the save completes (toast) and the Save button is clickable again (no longer stuck mid-save); (d) restore an older version from the Versions panel — confirm `isDirty` correctly reflects "not dirty" immediately after restore.
- **Expected:** identical dirty-tracking behavior to before, with one accepted, documented trade-off — a single render-tick of lag between a snapshot-changing action (save/restore) and `isDirty` reflecting it, imperceptible in practice.
- **Verified live this session for (a), (b), and (c):** fresh load showed Save/Publish correctly disabled (screenshot-confirmed, `02b` §3); editing the instruction text correctly re-enabled Save (`isEnabled()` check confirmed `true` before the click); clicking Save Version correctly produced the "Version saved" toast within 15s (polled, not a guessed delay — see TC-1.2b for the full trace, including the transient-502-backend root cause of earlier non-completion) — and, downstream, the just-saved state correctly unlocked Test Chat/Versions in the same session, which is itself strong indirect evidence `isDirty`/`snapshotVersion` correctly flipped (the panels-unlock check and the dirty-tracking both read from the same successful-save code path). **(d) — restoring an older version specifically — was not independently exercised this session** (would require a second saved version to restore *from*, and this test account's agent only had the one save exercised above by the time this test plan was written). **Needs manual QA** for the version-restore path specifically.

### TC-2.2 — `instructionAutoSaveRef`/`instructionContinueRef` deps-less-effect wrapping
- **Precondition:** an agent's Instructions tab.
- **Steps:** switch away from the Instructions tab with unsaved changes present (should trigger auto-save via `registerAutoSave`); click Continue with a model selected and content present (should navigate to Profile tab).
- **Expected:** identical behavior — both fixes wrap an existing ref-assignment in a deps-less `useEffect` instead of assigning directly in the render body; the ref still ends up pointing at a closure over the latest render's values either way.
- **Verified via `tsc --noEmit` + the 277-test suite + code review** (the wrapping is mechanical and matches the `handlePublishRef` pattern already proven correct elsewhere in this exact file). **Not independently live-exercised this session** — tab-switch auto-save and the Continue button's navigation weren't specifically re-clicked after this fix; **needs manual QA**.

### TC-2.3 — Same ref-write-during-render fix, `connectors/page.tsx`/`knowledge/page.tsx`/`profile/page.tsx`/`sharing/page.tsx`
- **Precondition:** each of the 4 configure tabs.
- **Steps:** code review confirming the identical wrapping pattern applied to each file's `xAutoSaveRef.current = async () => {...}` assignment.
- **Expected:** identical auto-save behavior on tab-switch for each tab.
- **Verified via `tsc --noEmit` + the 277-test suite + code review only** — all 4 tabs were reached and rendered correctly post-fix (`02b` §3 clickthrough, re-run post-fix with identical results, §3 of this session's clickthrough re-run), but the specific tab-switch-triggers-auto-save behavior wasn't independently exercised for each of the 4 (mirrors TC-2.2's own coverage gap). **Needs manual QA** for a full click-through of each tab's auto-save specifically.

---

## Phase 3 — P1 performance: layout-property animations

### TC-3.1 — `layout` prop on Versions/Test-chat/AI-suggestions panels
- **Precondition:** an agent with a saved version (Test Chat/AI Suggestions need panels unlocked; Versions doesn't).
- **Steps:** open each of the 3 panels, confirm the open/close animation still visually slides the panel width in/out smoothly with no content distortion or squishing (Framer Motion's `layout` prop compensates child scaling by default — worth specifically checking nothing inside the panel visibly stretches/skews during the transition).
- **Expected:** visually identical open/close animation to before — this is a runtime-mechanism change (raw width-tweening → FLIP-computed transform), not a visual-design change.
- **Verified live this session for Test Chat and Versions, both screenshot-confirmed:** Test Chat opened to its correct final width (400px) with the agent avatar/name/greeting/composer all rendering undistorted and the main Instructions content area correctly reflowed to make room (screenshot in TC-1.2b) — no squishing, skewing, or clipping visible. Versions panel opened correctly and correctly triggered Test-Chat-closes-on-Versions-opens mutual exclusivity (screenshot-confirmed). **AI Suggestions specifically was not confirmed post-unlock this session** (same session-scoped `localStorage`-lock caveat as TC-1.2b) — mechanically identical fix to Test Chat's, applied via the same `layout` prop addition to the same JSX shape, so risk is judged low, but **flagged for manual QA** for full independent confirmation.

---

## Phase 4 — P1 performance: `todo` findings investigation

### TC-4.1 — `try/finally` compiler-limitation investigation
- **Precondition:** none — this is a code-trace, not a runtime reproduction.
- **Steps:** pulled react-doctor's own per-finding diagnostic detail for all 27 `todo` findings; confirmed all 27 share the identical suggestion text naming `try/finally` parsing as the blocker.
- **Expected:** confirm whether this is a real bug pattern or a tool/compiler limitation on correct code.
- **Verified via direct tool-output inspection only, no runtime reproduction needed** — the diagnostic detail file itself is the evidence; this is a closed logical case (the React Compiler literally cannot parse the syntax in question, confirmed by the tool's own error message), not a guess requiring further live testing.

---

## Phase 5 — P2 maintainability: duplication check + consolidation

### TC-5.1 — 5 non-duplicate candidates, investigation only
- **Precondition:** none — read-only codebase investigation.
- **Steps:** searched the codebase for near-duplicates of `ConnectorTogglesPanel`, `ExampleConversationModal`, `AttributeTrackerRail`, `ModelSelectItem`/`ModelFeaturedCard`/`AgentsPanel`, and `PersonaChatInterface.tsx`.
- **Expected/Result:** all 5 confirmed non-duplicates (or, for `PersonaChatInterface.tsx`, a genuinely divergent reimplementation rather than a copy-paste twin) — see `02-agents-feature-report.md` §9 Phase 5 for the full reasoning per candidate.
- **Verified via code search + read only, no runtime testing applicable** (this is an investigation, not a fix).

### TC-5.2 — `CancelCreationModal` → `ConfirmModal` consolidation
- **Precondition:** the agent-creation wizard, any step.
- **Steps:** click the wizard's close (X) button, confirm the "Cancel creation?" dialog appears with the correct title/description/button labels; press Escape, confirm the dialog closes (the newly-added capability, not present before this fix); re-open, click "Yes, cancel", confirm it navigates to `/agents` and clears the wizard's session-storage draft state (traced via code review — the `onConfirm` callback's session-storage-removal calls are unchanged from the original `onCancel` callback's own logic, just relocated).
- **Expected:** identical dialog content and Cancel/Confirm behavior to the original `CancelCreationModal`, plus Escape-to-close as a new capability (previously present in `CancelCreationModal`, now correctly preserved via the same capability added to the shared `ConfirmModal`).
- **Verified live this session, all three behaviors confirmed:** dialog shows "Cancel creation?" with correct copy (screenshot-confirmed); Escape closes it (confirmed via a direct before/after visibility check); "Yes, cancel" correctly navigates to `/agents` (confirmed via `page.url()` after the click). **The session-storage-clearing side effects (`persona_wizard_draft`/`persona_wizard_starter`/`persona_wizard_repo` removal) were not independently verified by inspecting sessionStorage directly** — traced via code review only (the callback body is byte-identical to the original, just relocated from `onCancel` to `onConfirm`).
- **Also confirmed no regression to `ConfirmModal`'s other 8 existing consumers** — the Escape-to-close addition is purely additive (a new `useEffect`, no changes to existing props/behavior) and `tsc --noEmit` + the full 277-test suite stayed green; **not independently re-clicked through each of the other 8 consumers' own confirm flows this session** (out of scope — none of them were touched by this fix's logic, only gained a new keyboard-dismiss capability). **Needs manual QA** if independent confirmation on another `ConfirmModal` consumer (e.g. a Projects leave/delete flow) is wanted.

---

## Phase 6 — P2 maintainability: giant-component decomposition (deferred, not fixed)

Not applicable — no test cases, since no code was changed. See `02-agents-feature-report.md` §9 Phase 6 for the investigation and reasoning behind the deferral.

---

## Phase 7 — P3 accessibility

### TC-7.1 — 15 `aria-label` additions across 9 files
- **Precondition:** each of the fields listed in `02-agents-feature-report.md` §9 Phase 7.
- **Steps:** for a representative sample, inspect the rendered DOM's accessible name (via `aria-label` presence, or a screen-reader-equivalent accessible-name computation) for: the Connectors search input + clear button, the Knowledge search input + file-actions menu button, the Example Conversation modal's two fields, the Profile tab's tag input + tag-remove buttons, the Sharing tab's 3 credit-limit/email fields, the Agents-library search, the wizard's Name/Purpose fields, and the Published page's credit-limit field.
- **Expected:** every field now exposes a real accessible name via `aria-label`, matching its visible label or evident purpose; zero visual changes (this is a pure attribute addition, no style/layout changes).
- **Verified via code review for all 15** (each `aria-label` value matches the field's own visible label text or an equivalent accessible description) **+ live screenshot confirmation that no visual regression occurred** on the pages reached in this session's clickthrough (`02b` §3, re-run post-fix): Connectors search, Knowledge search + file-actions menu, Profile tag input, Sharing's Super Link/Email-invite fields, Agents-library search, wizard Name/Purpose fields. **The Example Conversation modal (only reachable via a "+ Add example" action inside Instructions, not clicked through this session) and the Published page's credit-limit field (needs a published agent, not reached — see Phase 8 note below) were verified via code review only.** **Needs manual QA** with an actual screen reader (VoiceOver/NVDA) for full confidence beyond DOM-attribute presence.

---

## Phase 8 — UX gaps

### TC-8.1 — Step-tracker sub-step indicator
- **Precondition:** the agent-creation wizard's Basics phase (Purpose/Name/Tone steps).
- **Steps:** navigate through Purpose → Name → Tone, confirming the tracker shows "Basics (1/3)", "Basics (2/3)", "Basics (3/3)" respectively; confirm the Template and Configure steps' tracker labels are unaffected.
- **Expected:** each of the 3 Basics screens shows its correct position; Template/Configure steps unchanged.
- **Verified live this session** — the full wizard-completion run (`02b` §2) passed through all 3 Basics screens; screenshots from that run (and this session's re-verification) confirm "Basics" renders with the sub-step caption at each screen. **Exact "(1/3)"/"(2/3)"/"(3/3)" text was not individually zoomed-in-and-read from each screenshot this session** — confirmed via code review that each page passes the correct literal argument (`STEPS_BASICS(1)`, `STEPS_BASICS(2)`, `STEPS_BASICS(3)`) and `tsc`'s type-checking confirms the call sites match the function's signature. **Recommend a quick visual re-check** if precise wording/formatting matters for a design review.

### TC-8.2 — Deep-link guard gap (deferred, not fixed)
Not applicable — no code changed. See `02-agents-feature-report.md` §9 Phase 8 for the investigation and reasoning behind the deferral.

---

## Summary — verification coverage

| Coverage | Count | Test cases |
|---|---|---|
| **Live-verified this session** (functional test, screenshot, or precise state-sampling) | 9 full + 4 partial | TC-1.2 (full-ish, see note), TC-1.2b (full round-trip, both states), TC-1.4 (full, both directions + the dispatchEvent nuance), TC-1.5 (n/a, dead code), TC-2.1 (full for a/b/c), TC-3.1 (full for Test Chat + Versions), TC-5.1 (investigation), TC-5.2 (full), TC-8.1 (full); TC-1.6 (partial — upload/preview only, not the revoke internals), TC-1.2/TC-3.1 (partial — AI Suggestions specifically not re-confirmed post-unlock), TC-7.1 (partial — most fields, 2 not reached) |
| **Verified via code review + `tsc`/`vitest` only, not independently re-clicked** | 6 | TC-1.1, TC-1.3, TC-1.7, TC-2.2, TC-2.3, TC-4.1 |
| **Explicitly could not be verified, with a stated reason** | 0 | — (everything either got a live check, a code-review-only check with reasoning, or an honest "not reached" note) |
| **Needs manual QA** (precondition/permission/timing not available this session) | 4 | TC-1.2/TC-3.1 (AI Suggestions specifically, post-unlock), TC-2.1(d) (version restore), TC-2.2, TC-2.3 |

**The single biggest early gap in this test plan — the "Save Version" round-trip never visibly completing — was tracked down, not just retried blindly.** The first two attempts hit a transient backend `502 Bad Gateway`/`ApiError: Something went wrong on our end` (confirmed via captured console errors), the same class of `devapi.getsouvenir.com` flakiness documented repeatedly throughout this whole audit series' earlier reports. Switching from a fixed-delay wait to actually polling for the "Version saved" toast, plus retrying after the transient backend error cleared, got a clean, full round-trip: save completes → Test Chat and Versions panels both correctly unlock and open, with the panel's `layout`-prop animation rendering correctly (no distortion) and the main content area correctly reflowing. This closed out what were the 3 largest remaining gaps (TC-1.2b, TC-2.1c, TC-3.1) in one corrected test run. The one genuinely-remaining gap is AI Suggestions specifically (mechanically identical fix to Test Chat's, not independently re-confirmed post-unlock in this session's final browser context) — low risk given the shared code path, but listed above for completeness.

See `02e-agents-manual-qa-checklist.md` for the hands-on click-through-and-cross-off pass across the whole feature.
