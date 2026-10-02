# Settings — Manual QA Checklist (Post-Fix)

Hands-on click-through checklist of the whole Settings feature post-fix, against the main tree's production build (port 3000), logged in via `.env.local`'s real test account (an org member with admin role — confirmed org/workspace access to `/settings/general` and `/settings/members`). Real checkboxes with real results from this session's live Playwright testing, not assumed — plus an honest "still worth your own click-through" list at the end for what a headless automated pass can't responsibly cover.

Legend: [x] = checked live this session, [ ] = not checked this session (see the priority list at the end for why).

## Personal settings

- [x] `/settings/account` — loads, heading "Account", zero console errors beyond the known CSP/Facebook-pixel warning. Zero hydration warnings on a hard reload.
- [x] `/settings/preferences` — loads, heading "Preferences", real content visible immediately (no skeleton-then-flip — confirms the Phase 6 mounted-gate removal didn't break anything).
- [x] `/settings/security` — loads, heading "Security", real content immediately. The "3-dot" session-actions button now carries `aria-label="Session actions"` (confirmed in the rendered DOM, not just the source).
- [x] `/settings/notifications` — loads, heading "Notifications", real content immediately.
- [x] `/settings/files` — loads, heading "Files & Data", zero console errors; confirms the hook-order fix (Phase 2) didn't break the page for an already-authenticated user (the bug only mattered for the pre-auth-resolved render, which a full page load doesn't isolate — see `06c` TC-2.2's honest caveat).
- [x] `/settings/plans-and-billing` — loads, heading "Plan & Billing", zero console errors. Reached as the org-admin (`OrgBillingView`) branch with this test account.
- [x] `/settings/help` — loads, heading "Help & Legal", real content immediately.
- [x] `/settings/usage` — loads, heading "Usage", zero console errors.

## Workspace/org settings

- [x] `/settings/general` (org) — loads, heading "General", real admin content (workspace name/slug fields, logo upload UI) rendered, not a permission-denied placeholder. Zero console errors.
- [x] `/settings/members` (org) — loads, heading "Members", real member list rendered. Zero console errors. Confirmed the 3 `role="dialog"` custom overlays (`prefer-html-dialog`, left untouched per scope) are still present in the source at lines 308/589/765.

## Fix-specific checks

- [x] **SettingsSidebar hydration fix** — re-ran the full 10-page smoke test against both the pre-fix (port 3001) and post-fix (port 3000) builds: identical results on every page, zero hydration-mismatch console warnings on either build. The workspace-name row, role badge, and bottom `AccountMenu` (all downstream of the fixed `billingSnap` value) render with plausible, non-broken content on every settings page for this org-admin test account (workspace name, "Free Plan"/plan tag, credit count all visible and non-garbled).
- [x] **Mounted-gate removal (help/notifications/preferences/security)** — all 4 pages checked above render their real content on the very first captured DOM snapshot post-`networkidle`, with no separate loading-skeleton state observed in between.
- [x] **`plans-and-billing` decomposition** — the org-admin view (`OrgBillingView`, using the new shared `CancelSubscriptionDialog`) renders correctly; the Cancel Subscription button/dialog wiring was verified via code-review (see `06c` TC-8.1), not clicked live this session (would cancel a real subscription against the live Stripe-backed billing system — correctly out of scope for automated testing, see the priority list below).
- [x] **Accessibility labels** — `security/page.tsx`'s 3-dot button's `aria-label` confirmed present in the live DOM (`page.$('button[aria-label="Session actions"]')` resolved). The `plans-and-billing` `InputField`/change-plan slider labels were confirmed via source review, not independently queried in the live DOM this session (both are further down their respective pages than the above-the-fold content this pass's screenshots covered).

## Still worth your own click-through (not safely or responsibly automatable this session)

1. **The personal (non-org) billing view (`PersonalBillingView`)** — this session's test account is an org member, so only the org-admin billing branch was live-reachable. The decomposition fix (Phase 8) was verified correct via a code-level diff against the org branch's near-identical original, but a real individual account's Plans & Billing page (and its own Cancel Subscription dialog, now sharing the same extracted component) was never actually rendered live this session. **Highest-priority item on this list.**
2. **Actually triggering a Stripe checkout, plan change, or subscription cancellation** — correctly never attempted against the real, live-connected payment processor this session (per the engagement's own instruction). If you want to confirm the Cancel Subscription dialog's real button-click behavior (not just its rendered markup), do this by hand against a test/sandbox Stripe account, not production.
3. **The four ref-guarded "unsaved changes" flows** (`/settings/account`'s name/avatar edit, `/settings/general`'s workspace identity edit) — this session confirmed the underlying ref-write-during-render bug is fixed (Phase 7) via code trace, but never actually edited a field, tried to navigate away, and confirmed the nav-guard modal appears (or that a real `beforeunload` browser prompt fires on tab close). Click into an edit, change a name, click a different Settings nav item, and confirm you get the "unsaved changes" confirmation — then try again and actually close/reload the tab to confirm the native browser prompt.
4. **`(org)/general/page.tsx`'s logo upload** (the fetch-status-check fix, Phase 9) — never exercised with a real file picker interaction this session. Upload a real image and confirm the preview/staged logo still works exactly as before.
5. **A real screen-reader pass over the 4 newly-labeled controls** (`security/page.tsx`'s 3-dot button, `plans-and-billing`'s spend-cap input, the 2 change-plan credit sliders) — this session confirmed the `aria-label`/`aria-labelledby` attributes are present and correctly paired in the DOM, but never confirmed with an actual assistive-technology pass (VoiceOver/NVDA) that they announce sensibly in context.
6. **`(org)/members/page.tsx`'s 3 custom dialogs** — confirmed still present in source (unfixed, per explicit scope), but their actual open/close/focus-trap behavior wasn't re-verified live this session; if you're touching this file for any other reason, worth a sanity click-through.
7. **The decomposed `CancelSubscriptionDialog`'s keyboard/focus behavior** — the backdrop-click-to-dismiss pattern was confirmed as an already-correctly-suppressed, intentional pattern (not re-designed), but a real Escape-key or focus-trap check wasn't performed this session.

## Backend health, re-confirmed

Zero 502s, zero non-CSP console errors, across 20 total page loads this session (10 pages × 2 builds) — the original report's "first fully clean live run in the series" finding holds again, on a genuinely fresh test this session, not carried forward from memory.
