# Front-end bug scan (all features)

Started 2026-10-27. One section per feature, in scan order. Each bug says whether it was reproduced live (signed in with the `.env.local` accounts on localhost:3000) or comes from reading the code only.

**Status (2026-10-31):** all 17 features scanned and rechecked live. 73 findings from the scan plus 3 found while fixing (CH-15, LB-6, RC-1). **57 fixed** (48 on 10-28, 9 on 10-31). **Open:** RC-1 (new, see "Recheck 2026-10-31"), and OB-1 to OB-10 (need an un-onboarded account). **Skipped, hidden features:** CH-10, CH-11, CH-13. **No change needed:** LB-4, AG-5, BL-2 (not reproduced), AG-6 (not reachable). Nothing is committed.

**Status (2026-10-28):** all 17 features scanned. 73 findings (7 High, 25 Medium, 41 Low), of which 45 were confirmed live. Feature 2 (onboarding) is still a draft: it needs an account that hasn't finished onboarding. **Fix pass:** 48 fixed (45 re-tested live), see the last section.

## Feature 1: Auth and app shell

Date: 2026-10-27 · Method: read the code, then reproduced live on `localhost:3000` (dev backend), signed in as `ADMIN_EMAIL`
from `.env.local`, using Playwright. Nothing in the code was changed.
Scope: `src/proxy.ts`, `src/app/auth/*`, `src/lib/auth0.ts`, `src/lib/onboarding-gate.ts`, `src/lib/auth/*`,
`src/app/(app)/layout.tsx`, `src/app/page.tsx`, error boundaries, `OnboardingGuard`, `SessionTimeoutGuard`,
logout in `src/context/auth-context.tsx`.

| # | Severity | Title | Live result |
|---|----------|-------|-------------|
| AS-2 | High | Signing out leaves session timing and caches in localStorage | **Confirmed** |
| AS-3 | High | A failed Auth0 callback redirects straight back to login with no error shown | **Confirmed** (loop needs an Auth0-side rule to show end to end) |
| AS-4 | Medium | The client `OnboardingGuard` sends users to Setup instead of the proxy's next step | **Partly confirmed** (with a mocked response) |
| AS-5 | Low | The client guard's redirect to login drops `returnTo` | **Confirmed** |
| AS-6 | Low | The root `/` redirect drops repeated query params | **Confirmed** |
| AS-9 | Low | The org-id cache is written under the key `souvenir:org-id:undefined` | **Confirmed** (found during repro) |
| AS-1 | Low | `src/app/auth/logout/route.ts` is dead code (its cookie names and missing-env handling are wrong, but it never runs) | Original High finding **not reproduced**, downgraded |
| AS-7 | Low | The onboarded cache comment says "monotonic", but paid status can lapse | Not reproducible here (needs a lapsed plan); code only |

---

### AS-2 · High: signing out leaves session timing and caches in localStorage
**Where:** `logout()` [src/context/auth-context.tsx:309-330](../../../src/context/auth-context.tsx#L309-L330). `clearAuth()` (L279-289), which calls
`clearSessionTiming / clearSearchRecents / clearOrgIdCache`, is only called by the cross-tab listener (L357), never by the tab that signs out.

**Repro (live):** Sign in → set `souvenir:session:signed-in-at` = `1000` → profile row → **Sign out** (the real UI). The browser lands
on the Auth0 login page. Then open `localhost:3000/favicon.ico` in the same profile and read localStorage:
```
before: souvenir:session:last-activity, souvenir:session:signed-in-at, souvenir:org-id:undefined, …
after : souvenir:session:last-activity, souvenir:session:signed-in-at, souvenir:org-id:undefined, … (all still there)
```
**Effect:** With `NEXT_PUBLIC_SESSION_MAX_HOURS` set, a forced "max" sign-out leaves the old `signed-in-at` behind. On the next
sign-in, `SessionTimeoutGuard` sees the deadline has already passed and signs out again immediately. On a shared machine,
the next user also gets the previous user's Cmd+K recents.
**Fix:** Run the storage clears in `logout()` before navigating.

### AS-3 · High: a failed Auth0 callback redirects straight back to login
**Where:** [src/lib/auth0.ts:20-35](../../../src/lib/auth0.ts#L20-L35)

**Repro (live):** `GET /auth/callback?error=access_denied&error_description=blocked&state=x` → `307 Location: /auth/login`.
No error is shown. `/auth/login` immediately sends the user back to Auth0. For an error that repeats on every attempt
(an Action deny, an unverified email, a blocked user), this loops `/auth/login → Auth0 → callback?error → /auth/login`.
I couldn't show the full loop because it needs an Auth0 rule or Action on the tenant. The first step, a silent bounce
with no message, is confirmed.
**Fix:** Send the user to an error page (`lib/auth/auth-error.ts` exists) with a "Try again" link that keeps `returnTo`.

### AS-4 · Medium: the client guard sends users to Setup instead of the next step
**Where:** [src/components/shared/OnboardingGuard.tsx:44-48](../../../src/components/shared/OnboardingGuard.tsx#L44-L48) vs [src/lib/onboarding-gate.ts:120-125](../../../src/lib/onboarding-gate.ts#L120-L125)

**Repro (live, mocked):** I changed the browser's `/api/backend/users/me` response to `onboarding.completed=false`, with
`role_fit` and first/last name filled in. For that state the proxy's next step would be `/onboarding/invite`. Opening
`/library` made the client guard `replace('/onboarding/setup')`; the real proxy (still onboarded on the server) then bounced
the browser to `/chat`. So the guard ignores which step the user has reached. I couldn't test against a truly un-onboarded
account because none exists in `.env.local`.
The same code also bounces a user who just paid (`souvenir_checkout_complete` cookie, which the proxy honours) into setup
on any page other than `/settings/billing/confirmation`. That part is from reading the code, not reproduced.
**Fix:** Share the next-step function between the proxy and the guard, and have the guard respect the checkout cookie.

### AS-5 · Low: the client guard's redirect to login drops `returnTo`
**Where:** [src/components/shared/OnboardingGuard.tsx:19-21](../../../src/components/shared/OnboardingGuard.tsx#L19-L21)

**Repro (live):** Sign in, make `/auth/access-token` return 401, then open `/library?q=deep`. The navigation request is
`http://localhost:3000/auth/login`, with no `returnTo`. The server-side path keeps it (an anonymous `/chat` → `302 /auth/login?returnTo=%2Fchat`).
**Fix:** Pass `returnTo` = current path + search.

### AS-6 · Low: the root redirect drops repeated query params
**Where:** [src/app/page.tsx:17-20](../../../src/app/page.tsx#L17-L20)

**Repro (live):** `/?x=1&x=2&connector=demo` lands on `/chat?connector=demo`; `x` is gone.
**Fix:** For array values, append each one.

### AS-9 · Low: org-id cache key is `souvenir:org-id:undefined`
Found during the AS-2 repro: on a fresh sign-in, localStorage gets `souvenir:org-id:undefined`, so the per-user key is
built before the user id is known. Different accounts on one browser would share that entry. I'll trace the exact
writer when I scan the org context in feature 14.

### AS-1 · Low (was High): `/auth/logout` route is dead code
**Where:** [src/app/auth/logout/route.ts](../../../src/app/auth/logout/route.ts)

The original finding was that the route deletes `appSession*` (SDK v3 names) instead of `__session*`. **Not reproduced:**
the proxy sends every `/auth/*` path to `auth0.middleware` (proxy.ts:47-58), which serves `/auth/logout` itself before
this route can run. Live, `GET /auth/logout` returns `307` to `…/oidc/logout?…post_logout_redirect_uri=<returnTo>`,
clears `__session`, `__session__0` and `__session__1`, and `/auth/access-token` then returns 401. Logout works.
The custom route's comment and the earlier AS-8 finding (`https://undefined/v2/logout` when env vars are missing) describe
code that never runs.
**Fix:** Delete the route, or fix its comment so nobody "fixes" the wrong file.

### AS-7 · Low: the onboarded-cache comment is wrong
**Where:** [src/lib/onboarding-gate.ts:54-60](../../../src/lib/onboarding-gate.ts#L54-L60). `allowsMainApp` also counts an active paid
or trial plan, which can lapse, so the cache is not monotonic. The impact is at most 60 s. I couldn't test this live.

---
**Checked and OK live:** an anonymous app route redirects to login with `returnTo`, logout clears the session and ends the
Auth0 session (the next visit shows the Auth0 login page), and `returnTo` on logout is honoured.
**Checked in code:** route-policy order, CSRF origin check on `/api/*`, static-asset matcher, error boundaries.


## Feature 2: Onboarding

Date: 2026-10-27 · Status: **DRAFT, live repro blocked.** Both `.env.local` accounts (ADMIN, MEMBER) have finished onboarding.
Live, the proxy sends them from `/onboarding`, `/onboarding/workspace`, `/onboarding/invite` and `/onboarding/plans` to `/chat`.
Only `/onboarding/team/<id>` is reachable. The findings below come from reading the code and each says what is still
needed to reproduce it. They need an un-onboarded test account before they can be finalized.

Scope: the live v1.5 flow `setup → workspace → profile → invite`, the team invite flow `team/[inviteId]` (+ profile) and `join`,
and `step-shell` (`useLeaveGuard`). The legacy pages (`account-type, plans, tone, import, connectors, hello, pricing`) only got a light pass.

| # | Severity | Title | Live result |
|---|----------|-------|-------------|
| OB-1 | Medium | Role and tone are held only in memory until the last step; a reload or a later return loses them | Pending (needs un-onboarded account) |
| OB-2 | Medium | Invite step: if sending invites fails, onboarding still completes and the page does a full reload, so the error toast is never seen | Pending |
| OB-3 | Medium | Invite step: invalid emails typed in the box are dropped and the page navigates away anyway | Pending |
| OB-4 | Medium | Invite step: if finishing fails after invites were sent, a retry re-sends every invite | Pending |
| OB-5 | Medium | Team invite: if accept succeeds but `updateOnboarding` fails, a retry calls accept again and the user is stuck | Pending (needs a real invite) |
| OB-6 | Medium | Workspace step: an org create/rename failure is swallowed and the user continues with no workspace | Pending |
| OB-7 | Low | Team invite: `wasAlreadyOnboarded` is read before `user` loads, so an onboarded user is sent to the team profile step | Pending |
| OB-8 | Low | Team invite marks `onboarding_completed=true` *before* the profile step, so leaving there skips names for good | Pending |
| OB-9 | Low | The leave guard leaves an extra history entry after **Next**, so browser Back needs two presses | Pending |
| OB-10 | Low | Workspace size pills have no `aria-pressed`, so screen readers can't tell which is selected | Code only |

**Checked OK live:** onboarded users can't re-enter `/onboarding/*` (they go to `/chat`), and `/onboarding/team/<unknown id>`
shows "Invite not found" with a working Close.

---

### OB-1 · Medium: role and tone are lost on reload
**Where:** [profile/page.tsx](../../../src/app/(onboarding)/onboarding/profile/page.tsx) saves only `first_name/last_name`. `user_role` and `ai_tone` are sent from [invite/page.tsx:96-101](../../../src/app/(onboarding)/onboarding/invite/page.tsx) out of `WorkspaceOnboardingContext`, which is plain `useState` ([workspace-onboarding-context.tsx:70](../../../src/context/workspace-onboarding-context.tsx#L70)).
**Scenario:** Fill in the profile with role "Engineer" and tone "Warm" → Next → reload the invite page, or close the tab
and come back later (the proxy sends the user to `/onboarding/invite` because their names are saved) → Skip. Onboarding
completes with no role or tone, and the AI never uses the chosen tone.
**Fix:** Save `user_role` and `ai_tone` on the profile step.

### OB-2 · Medium: failed invites are reported in a toast that is never seen
**Where:** [invite/page.tsx](../../../src/app/(onboarding)/onboarding/invite/page.tsx) `handleNext`. The `inviteMembers` failure is caught and toasted, then `goToWelcome()` runs `window.location.href = …`.
**Scenario:** Invite an address the backend rejects, or let the request fail. The error toast appears for a moment, the
full-page navigation wipes it, and the user believes the invites went out.
**Fix:** Stay on the step when invites fail, or carry the failure to `/welcome`.

### OB-3 · Medium: invalid emails are dropped while the page moves on
**Where:** same `handleNext`. Leftover text in the box is split up, invalid entries are toasted, then the flow finishes.
**Scenario:** Type `bob@acme` (a typo) and click Send. The invalid-email toast flashes and the page leaves; Bob is never invited.
**Fix:** If any entry is invalid, stop and keep the user on the step.

### OB-4 · Medium: retrying after a failed finish re-sends invites
**Where:** same `handleNext`. Invites are sent first; if `finish()` then returns `!completed`, the user stays on the
step with the email chips still filled. Clicking Send again posts the same invites again.
**Fix:** After a successful send, clear the list or remember it was sent.

### OB-5 · Medium: team invite accept can't be retried
**Where:** [team/[inviteId]/page.tsx](../../../src/app/(onboarding)/onboarding/team/[inviteId]/page.tsx) `handleJoin`: `acceptTeamInvite` then `updateOnboarding` in one try block.
**Scenario:** Accept succeeds and `updateOnboarding` fails (for example a 5xx) → error toast, Join enabled again → click
again → `acceptTeamInvite` fails because the invite is already used. The user can't get past this screen.
**Fix:** Track that accept succeeded and only retry the later steps.

### OB-6 · Medium: a failed workspace save lets the user continue without a workspace
**Where:** [workspace/page.tsx:96-128](../../../src/app/(onboarding)/onboarding/workspace/page.tsx). The comment says this is on purpose ("Non-fatal").
**Scenario:** `createOrganization` fails → toast → Profile → Invite: "no workspace was found", and onboarding still completes.
The user ends up in the app with no org, and anything that needs an org breaks.
**Fix:** Block on org *creation* failure; only a *rename* failure should let the user continue.

### OB-7 · Low: an onboarded user is sent to the wrong step after Join
**Where:** `handleJoin`, `const wasAlreadyOnboarded = user?.onboardingCompleted === true`. While `user` is still loading,
this is `false`, so an already-onboarded user who clicks Join quickly goes to the team **profile** step instead of `/welcome`.

### OB-8 · Low: team invite completes onboarding before the profile step
**Where:** `handleJoin` sets `onboarding_completed: true` before going to `ONBOARDING_TEAM_PROFILE_ROUTE`. If the user
closes the tab there, they are "onboarded" with no first or last name, and the proxy never brings them back to that step.

### OB-9 · Low: browser Back needs two presses after Next
**Where:** [step-shell.tsx:218-234](../../../src/app/(onboarding)/onboarding/_components/step-shell.tsx#L218-L234). When the form is dirty, the guard calls `pushState`
on a duplicate history entry. Next navigates without `bypass()`, so the duplicate stays. Browser Back from Profile lands
on the same Workspace URL twice.

### OB-10 · Low: size pills don't expose the selected state
**Where:** [workspace/page.tsx](../../../src/app/(onboarding)/onboarding/workspace/page.tsx) `SizePill`. Selection is shown only by colour; add `aria-pressed={selected}`.


## Feature 3: Chat (composer, send/stream, rendering)

Date: 2026-10-27 · Live on localhost:3000 as ADMIN. Replies were **mocked** with `page.route('/api/chat')` (AG-UI SSE) so the
renderer gets exact input; the composer, uploads and Library picker were real.
Flags in this build: `PINS`, `AGENT_CHAT`, `LIBRARY_SETTINGS` and `COMPOSER_WEB_SEARCH` are **off**, so bugs behind them are not reachable here.
Local quirk: direct file uploads stall at "Uploading 0%" on this dev server (known CSP/storage-origin issue), so upload tests used Library files.

| # | Severity | Title | Live result |
|---|----------|-------|-------------|
| CH-1 | High | A stream that drops mid-answer is shown as a complete answer with no notice | **Confirmed** |
| CH-2 | High | Web-citation markers are rewritten inside code blocks and inline code, and Copy copies the broken code | **Confirmed** |
| CH-3 | Medium | "Copy" on a message copies raw widget XML (`<metrics>…`) and citation markers | **Confirmed** |
| CH-4 | Medium | An upload refusal notice from one chat follows the user to other chats; uploads aren't cancelled on chat switch | **Confirmed** (the notice part) |
| CH-5 | Medium | Attachment only, empty box: Enter inserts a newline and sends nothing | **Confirmed** |
| CH-6 | Low | Attachment only, empty box: the send button is labelled "Start voice input" | **Confirmed** |
| CH-7 | Low | A Library file chip opens a blank page when clicked; its name shows a `files/` path prefix | **Confirmed** |
| CH-8 | High | Queued messages skip the Library "Ask each time" save prompt | **Confirmed** 2026-10-31 (reachable without the flag: the composer reads `/library/prefs` since 10-20) |
| CH-9 | Medium | While the "Ask each time" dialog is open, a second send can overtake the first and drop it | **Confirmed** 2026-10-31 (focus is not trapped: typing + Enter behind the dialog sent first) |
| CH-10 | Medium | Choosing an agent overwrites the saved Standard/Pro model choice | **Skipped**: agents in chat are hidden (`AGENT_CHAT`); fix when that ships |
| CH-11 | Medium | Pins on: Enter is swallowed when the `@` pin dropdown has no match (e.g. `bob@`) | **Skipped**: Pinboard is hidden on purpose |
| CH-12 | Low | Safari IME: Enter confirming a conversion sends the message | Not reproducible here (Chromium only) |
| CH-13 | Low | Agent `@` menu stays open after a chat switch or send | **Skipped**: agents in chat are hidden (`AGENT_CHAT`); fix when that ships |
| CH-15 | Low | Keyboard focus is dropped to `<body>` after the "Save N files to Library?" dialog closes, and after the first send from the new-chat landing (found 2026-10-31 while checking CH-9; the dialog itself does trap focus and opens on Save) | **Confirmed** |
| CH-14 | Low | The chat scroller singleton can be cleared by the old chat's unmount, so highlight jump does nothing | Not reproduced (probable, code only) |

### CH-1 · High: a dropped stream looks like a finished answer
**Where:** [src/hooks/use-streaming-chat.ts:1687-1689](../../../src/hooks/use-streaming-chat.ts#L1687-L1689) → `finishTurn("ended")` → [src/lib/turn-outcome.ts:59-64](../../../src/lib/turn-outcome.ts#L59-L64) (`ended` + visible text = no notice). The `/api/chat` proxy also closes the stream cleanly on a backend error ([src/app/api/chat/route.ts](../../../src/app/api/chat/route.ts), `start()` catch), so a dropped backend connection looks the same as a normal end.
**Repro (live):** Mock a stream with deltas `"The three steps are:\n\n1. Open the "`, `"settings page\n2. Click"` and no `TEXT_MESSAGE_END`/`RUN_FINISHED`.
The answer stops at "2. Click" with the normal copy and regenerate actions and no "interrupted" notice. The user can't tell it's incomplete.
**Fix:** Treat `ended` without `done` as interrupted (show `INTERRUPTED_MESSAGE` after the text), and have the proxy send a `RUN_ERROR` frame when the upstream read throws.

### CH-2 · High: citation markers corrupt code
**Where:** [src/lib/markdown-utils.tsx:206-217](../../../src/lib/markdown-utils.tsx#L206-L217) `preprocessCitations`. Its regexes run over the whole message, code included, when the message has web citations.
**Repro (live):** A reply with `sources` (on `message_saved`) whose code block is `print("{0} and {1}".format(a, b))` / `x = [1]` shows
`print("[[0]](citation://0) and [[1]](citation://1)".format(a, b))` and `x = [[1]](citation://1)`. Inline `f({1})` shows `f([[1]](citation://1))`.
The code block's Copy button copies the corrupted code. Any web-search answer containing code with `{0}` or `[1]` (format strings, array indexes) is affected.
**Fix:** Skip fenced and inline code (and math) when rewriting citations.

### CH-3 · Medium: message Copy copies raw XML
**Where:** [src/components/chat/ChatMessage.tsx:757](../../../src/components/chat/ChatMessage.tsx#L757) `handleCopy` copies `message.content` with only Library markers removed.
**Repro (live):** A reply of `Here are the numbers:` + `<metrics><metric label="Revenue" value="$5M"/></metrics>` + `Done.` displays as "Revenue $5M", but the clipboard gets the raw `<metrics>` XML. `{1}` citation markers are copied as-is too.
**Fix:** Copy a plain-text/markdown export: convert widgets to text or tables, and turn citations into `[1]` or footnote links.

### CH-4 · Medium: upload notices and uploads follow the user across chats
**Where:** [src/components/chat/ChatInterface.tsx:351-360](../../../src/components/chat/ChatInterface.tsx#L351-L360) clears attachments on chat switch but doesn't call `cancelComposerUpload`. Notices are keyed by the shared draft key `"chat-composer"` in `lib/library/upload/composer-uploads.ts`.
**Repro (live):** In a new chat, attach `bad-c4.exe` → "Blocked: this file looks unsafe." Open "Mountains Essay" from the sidebar: the same notice is shown above that chat's composer.
From the code: in-flight uploads keep running after the switch and are left as staged Library files, and image preview object URLs are only revoked by the chip X.
**Fix:** On chat switch, cancel uploads, clear notices and revoke previews, or key them by chat id.

### CH-5 · Medium: Enter doesn't send an attachment-only message
**Where:** [src/components/chat/ChatInput.tsx:604](../../../src/components/chat/ChatInput.tsx#L604). The Enter guard needs `value`, so with only attachments it neither sends nor calls `preventDefault`.
**Repro (live):** **+** → Add from Library → pick a file → click the empty box → Enter. The box now contains a newline and nothing is sent. A second Enter sends a message whose text is a newline. Clicking the button does send.
**Fix:** Allow Enter when there are ready attachments, and always `preventDefault` on plain Enter.

### CH-6 · Low: wrong label on the send button
**Where:** [src/components/chat/ChatInput.tsx:1040-1049](../../../src/components/chat/ChatInput.tsx#L1040-L1049).
**Repro (live):** With a ready Library attachment and an empty box, the action button's aria-label is "Start voice input" (and shows the mic icon), but clicking it sends the message.

### CH-7 · Low: a Library chip opens a blank page
**Where:** [src/components/chat/AttachmentManager.tsx:216-228](../../../src/components/chat/AttachmentManager.tsx#L216-L228). Picked Library files are empty placeholder `File`s, but `canPreview` is true for them.
**Repro (live):** Add from Library → `Draft_product_copy_B20_2026-10-26.docx` → click the chip. A popup opens on `blob:http://localhost:3000/…` with an empty document.
The chip label also reads `files/Draft_product_copy_B20_2026-10-26.docx`; the storage path prefix leaks into the name.
**Fix:** Preview Library picks through the Library file viewer (or turn preview off for them), and show the base name.

### CH-8 to CH-14 (not reachable in this build; from reading the code)
- **CH-8:** [ChatInterface.tsx:976-1000](../../../src/components/chat/ChatInterface.tsx#L976-L1000). `decideSave()` runs only for direct sends. Queued sends (`queueFromComposer`, `MessageQueueRunner.tsx:128-146`) send `saveToLibrary` undefined, so with "Ask each time" the user is never asked and the "Not saved" toast never appears.
- **CH-9:** [ChatInterface.tsx:984-996](../../../src/components/chat/ChatInterface.tsx#L984-L996). The composer is cleared before `await decideSave`, and `beginTurn` (which sets `isSendingRef`) runs only after the dialog closes. A second `handleSend` during the wait goes out directly, and a second `decideSave` replaces the pending promise, so message 1 is lost. This only matters if the dialog doesn't trap focus.
- **CH-10:** `app/(app)/chat/page.tsx:510-540` → `context/model-selector-context.tsx:207-213`. Applying an agent's model calls the global `selectModel`, which clears the stored algorithm (Standard/Pro).
- **CH-11:** `ChatInput.tsx:563-578`, `use-pin-mentions.ts:137-141`. Enter always means "select" while the pin dropdown is open, even when nothing matches.
- **CH-12:** `ChatInput.tsx:596` checks only `isComposing`. Safari sends keyCode 229 with `isComposing=false`, and `use-agent-mention.ts:72` has no IME check.
- **CH-13:** In `use-agent-mention.ts`, `token` changes only on input, so parent resets leave the menu open.
- **CH-14:** `lib/chat-scroller.ts:28-31`. `registerChatScroller(null)` doesn't check that it still owns the singleton.

**Checked OK (code):** `javascript:` links are neutralised, raw HTML is off or sanitised, KaTeX and Mermaid output is sanitised,
`$5 and $10` isn't treated as math, malformed widget XML is caught by `BlockErrorBoundary`, the queue runner guards against double
sends, and the `/api/chat` field allow-list and Idempotency-Key are in place.


## Feature 4: Chat history (`/chats` page, sidebar recents)

Date: 2026-10-27 · Live on localhost:3000 as ADMIN (354 chats in the account). DELETE failures were **mocked** with `page.route`, so no chat was really deleted.
One real change was made: chat "Reply with exactly the word "pong"." was archived (test data).

| # | Severity | Title | Live result |
|---|----------|-------|-------------|
| HI-1 | Medium | Bulk delete with one failure brings back the chats that *were* deleted | **Confirmed** |
| HI-2 | Low | Half the checkboxes in selection mode have no accessible name | **Confirmed** |
| HI-3 | Low | The only way into selection mode (needed for bulk **Delete**) is a button labelled "Move to project" | **Confirmed** |

**Checked OK live:** archiving persists across reloads and the chat appears under Archived chats; the backend returns every chat
in one array, so the client-side search and select-all cover all chats (the paging concern I suspected doesn't apply today).
**Checked in code:** rename trims and ignores empty titles, single delete, star and archive each roll back only their own chat.

### HI-1 · Medium: one failed delete in a bulk delete restores the others
**Where:** [src/hooks/use-chat-history.ts:113-125](../../../src/hooks/use-chat-history.ts#L113-L125) `handleDelete` saves a snapshot of the **whole list** and restores it on failure.
[src/app/(app)/chats/page.tsx](../../../src/app/(app)/chats/page.tsx) `handleDelete` runs `remove()` for every selected id in parallel, so a failing call restores the list as it was before *any* delete ran.
**Repro (live):** `/chats` → Move to project (enters selection) → tick "Mountains Essay" and "Copy of Draft product copy B20" → Delete → Delete.
DELETE was mocked to fail (500, after 1.5 s) for the first and succeed (204) for the second. Result: toasts "Deleted 1 chat" and "Failed to delete chat",
and **both** chats are still listed. The deleted chat reappears until the next refetch, and opening it then fails.
**Fix:** On failure, put back only that chat, the same way rename, star and archive do: `patchChat`/re-insert by id instead of restoring the full snapshot.

### HI-2 · Low: unlabelled checkboxes in selection mode
**Repro (live):** In selection mode the page has 40 `role=checkbox` elements, and every other one has no aria-label (`["Mountains Essay", null, "Copy of Draft…", null]`).
Screen readers announce a bare "checkbox" for each row. Each row seems to render two checkbox roles (wrapper plus input). Keep one and label it.

### HI-3 · Low: selection mode is hidden behind "Move to project"
**Repro (live):** The `/chats` header has only "Move to project" and "New chat". Clicking "Move to project" enters selection mode, which also offers **Delete**.
There's no Select or Delete entry point, so bulk delete is hard to find. Rename the entry button to "Select".


## Feature 5: Chat sharing (Share dialog, `/chat-shares/[shareId]`, Shared with me)

Date: 2026-10-27 · Live on localhost:3000 with **both** accounts: ADMIN shares "Mountains Essay" with MEMBER ("OS8 Test01").
Test data left behind: MEMBER has a copy of "Mountains Essay" (from Make a copy). The share was revoked at the end. The owner's chat was not changed (the member's sends were rejected).

| # | Severity | Title | Live result |
|---|----------|-------|-------------|
| SH-1 | Medium | A recipient who opens the owner's `/chat?id=` link gets an editable chat; sending fails with "This chat no longer exists — it may have been deleted." | **Confirmed** |
| SH-2 | Low | "Go back" and "Back" on a shared-chat page opened from a link (new tab) go to `about:blank`, out of the app | **Confirmed** |
| SH-3 | Low | The revoked-share message reads "The requested resource was not found. Please ask the user to share it again." | **Confirmed** (wording) |

**Checked OK live:** share via the dialog ("Chat shared"); reopening the dialog no longer offers the member ("Everyone in the workspace already has this chat
shared with them") and shows "Active shares 1"; the member's **Shared with me** tab lists the chat; `/chat-shares/<id>` renders read-only with
reasoning and a "Make a copy" button; Make a copy opens the member's own copy (a second click reuses the same copy); after revoke the share disappears
from Shared with me and its link shows an error. The backend refuses (404) any member send into the owner's chat, so there is no data exposure.

### SH-1 · Medium: the owner's chat URL opens editable for a recipient
**Where:** [src/app/(app)/chat/page.tsx:585](../../../src/app/(app)/chat/page.tsx#L585): `activeChatReadOnly = activeChatRecord?.can_edit === false`, and `activeChatRecord` comes from the user's own chat list. The owner's chat isn't in the recipient's list, so the record is `undefined` and the chat is treated as editable. The 404 text comes from [src/lib/model-error.ts:36](../../../src/lib/model-error.ts#L36).
**Repro (live):** Share a chat with MEMBER → as MEMBER open `/chat?id=<owner chat id>` (the URL the owner sees, e.g. pasted into Slack). The full conversation is shown with an
enabled composer and Regenerate, and no "Read only" badge or "Make a copy" button. Type a message and send: `/api/chat` → `404 {"detail":"Chat not found"}`, and the reply bubble says
"This chat no longer exists — it may have been deleted." The chat isn't deleted; the user just can't write to it. After the share is revoked, the same URL shows an empty chat with an
enabled composer instead of an "access removed" state.
**Fix:** When the loaded chat's owner isn't the current user, redirect to the share view (or render read-only with "Make a copy"). Map a 404 on an existing chat to "You can only view this chat."

### SH-2 · Low: Back on the shared view leaves the app
**Where:** [src/app/(app)/chat-shares/[shareId]/page.tsx](../../../src/app/(app)/chat-shares/[shareId]/page.tsx): the error state's "Go back" (and the header "Back") call `router.back()`.
**Repro (live):** Open `/chat-shares/<id>` in a new tab (as from a notification or link) → click **Back** (valid share) or **Go back** (revoked share) → the tab goes to `about:blank`.
**Fix:** If there's no in-app history, fall back to `/chats?tab=shared`.

### SH-3 · Low: unclear revoked-share message
**Repro (live):** After revoke, the link shows "The requested resource was not found. Please ask the user to share it again." It doesn't say who "the user" is,
and "resource" is technical. Suggested: "This chat is no longer shared with you. Ask <owner name> to share it again." The page knows `shared_by_name` only while the share exists, so a generic owner-less version is fine.


## Feature 6: Compare models (removed)

Date: 2026-10-27. The "Compare models" dialog (`components/compare/CompareModels.tsx`) was mounted in `AppDialogs` but nothing in the app opened it, so it was unreachable dead code. **Removed** at the user's request: the dialog, `context/compare-context.tsx`, `lib/compare/*` (with their tests), the `CompareProvider` in `app/(app)/layout.tsx`, and the `compare_models` analytics feature name. Verified with `tsc --noEmit`, eslint, 13 related test files (156 tests) and a live load of /chat, a chat, /chats, /library and the Delete chat dialog (no console errors). Not committed.
The dev-only routing lab at `/compare` (`app/(app)/compare/`, 404 in production, needs a local lab on :8777) is a separate tool and was **kept**. It was not scanned.


## Feature 7: Projects (`/projects`, `/projects/new`, `/project/[id]`)

Date: 2026-10-27 · Live on localhost:3000 as ADMIN. Test data: created "scan-p7 project", linked chat "Quick Test" to it, then deleted the project from the UI.
That also deleted "Quick Test" (the dialog warns about this). Failures were **mocked** with `page.route`.

| # | Severity | Title | Live result |
|---|----------|-------|-------------|
| PR-1 | Medium | A failed chat delete inside a project removes the chat from the page anyway, with a vague toast | **Confirmed** |
| PR-2 | Low | New project: a tag typed but not confirmed with Enter is silently dropped on Create | **Confirmed** |
| PR-3 | Low | A failed project delete still sends the user to `/projects` | **Confirmed** |
| PR-4 | Low | Project chat rows' menu button is labelled just "Chat options" (no chat name) | **Confirmed** |
| PR-5 | Low | Linking a new chat to a project ignores failures silently (`addChatToProject(...).catch(() => {})`) | Code only (create already sends `project_id`, so this rarely matters) |

**Checked OK live:** create project (name, Personal visibility, committed tag saved), the project page lists linked chats, the Delete project dialog names
the chat count, a failed project delete keeps the project in the sidebar and its chats on the page after a reload, a real delete removes it with a toast,
and the project page fires no console errors (the empty project had no files, so the per-file size probe in `loadProject` wasn't exercised).

### PR-1 · Medium: failed chat delete in a project hides the chat anyway
**Where:** [src/context/projects-context.tsx](../../../src/context/projects-context.tsx) `removeChat` removes the chat from the cache and lowers `chatCount`
*before* `deleteChat`, with no rollback. Its own `.catch(() => {})` hides the error. The sidebar callers (`LeftSidebar.tsx:721`, `:2089`) don't await or catch the returned promise.
**Repro (live):** Open a project with one chat → Chat options → Delete → Delete, with `DELETE /chats` mocked to 500. The chat disappears and the page shows the empty
"Start a chat" state, with only a generic toast "Couldn't do that. Try again." On reload the chat is back, and the server still has it.
**Fix:** Keep a snapshot and restore the chat and its count on failure (the same way `moveChatOutOfProject` does), and show "Couldn't delete <title>".

### PR-2 · Low: a pending tag is lost on Create
**Where:** [src/app/(app)/projects/new/page.tsx:52-55](../../../src/app/(app)/projects/new/page.tsx#L52-L55). `handleCreate` sends `tags` without committing `tagInput`.
**Repro (live):** New project → name "scan-p7 project" → tag "alpha" + Enter → type "beta" (no Enter) → Create project. The saved project has tags `["alpha"]`; "beta" is dropped with no hint.
**Fix:** Commit a non-empty `tagInput` in `handleCreate`.

### PR-3 · Low: a failed project delete still navigates away
**Repro (live):** Project options → Delete → Delete, with `DELETE /projects/<id>` mocked to 500. The toast says "Failed to delete project", but the browser goes to `/projects` anyway.
The user loses their place for an action that didn't happen. **Fix:** Navigate only after `deleteProject` resolves.

### PR-4 · Low: unnamed chat menu buttons
**Repro (live):** Every chat row on the project page has a menu button labelled "Chat options". On `/chats` the same control is labelled `Options for "<title>"`.
Screen-reader users can't tell the rows' menus apart. Use the same `Options for "<title>"` label.


## Feature 8: Library (`/library`, file page, Trash)

Date: 2026-10-27 · Live on localhost:3000 as ADMIN and MEMBER. Trash calls (`DELETE /library/files/<id>`) were **mocked to fail**, so no file was deleted.
Already-known Library issues (`docs v2/library/11-open-issues.md`, `13-two-account-test-results.md`, tickets 10-17 to 10-26) were excluded. This build has no
bulk select, and every share is Viewer-only, so those areas don't apply.

| # | Severity | Title | Live result |
|---|----------|-------|-------------|
| LB-1 | Medium | Deleting the only file in a list closes the Trash dialog early; after a failure (or a Restore) it pops up again by itself | **Confirmed** (failure path) |
| LB-2 | Medium | Deleting from the file page shows "No longer available" and a "Closed <file>" toast before the server answers; on failure it flips back with an "Opened" toast and the dialog | **Confirmed** |
| LB-3 | Low | File names show the storage path prefix: `files/Draft_product_copy_B20_2026-10-26.docx` (also in the chat chip, CH-7) | **Confirmed** |
| LB-4 | Low | Undo on a "Shared with A, B" toast stops at the first grant that's already gone and reports a share failure | **Not reproduced** 2026-10-31: the backend answers 200 (not 404) for a grant already removed, so Undo carries on and removes the rest. No change |
| LB-5 | Low | A failed Rename rolls back to the title captured when the dialog opened, which may be stale | Code only (needs a rename from another tab mid-dialog) |
| LB-6 | Medium | The "Shared with …" toast's Undo can't be clicked while the Share dialog is open (it stays open after sharing): the click lands on the dialog overlay, closes the dialog and undoes nothing. Same for any toast action under any dialog | **Confirmed** 2026-10-31 (found during the LB-4 repro) |

**Checked OK live:** `/library`, `/library/trash` and `/library?q=` load for both accounts with no console errors. A failed trash call shows "Couldn't delete this file. Nothing changed." and the row comes back.
(`/library/files` on its own is a 404 by design; only `/library/files/<id>` exists.)

### LB-1 · Medium: a stale Trash dialog reopens on its own
**Where:** [src/components/Library/FilesView.tsx:56-74](../../../src/components/Library/FilesView.tsx#L56-L74) returns the empty state early, so `<FileDialogs>` (rendered only in the list branch, `:96`) unmounts.
The per-call `onSuccess` in [DeleteFileDialog.tsx:129-138](../../../src/components/Library/dialogs/DeleteFileDialog.tsx#L129-L138) is dropped, and the `dialog` state in `useFileActions` stays `{type:'delete'}`.
**Repro (live):** `/library?tab=all&q=x8.docx` (one result) → More actions → Delete → Move to Trash. The row and the dialog both disappear (0 rows).
The trash call fails, the row returns with "Couldn't delete this file. Nothing changed.", and the **"Move … to Trash?" dialog reopens on its own**. From the code, the same happens after a successful
delete when the user clicks Restore on the "Moved to Trash" toast, or clears the search.
**Fix:** Keep `FileDialogs` mounted for every list state, or close the dialog in the mutation's `onMutate` rather than per-call `onSuccess`.

### LB-2 · Medium: the file page reports deletion before it happens
**Where:** [src/components/Library/FileScreen.tsx:80-82, 124-136](../../../src/components/Library/FileScreen.tsx#L80-L136) plus `trashFileOptions.onMutate` in `src/lib/library/mutations.ts`, which sets the detail cache to `life:'trashed'` straight away.
**Repro (live):** Open `/library/files/<id>` → Actions → Delete → Move to Trash. Within 0.5 s the page shows **"No longer available"** with toast "Closed <file>", while the request is still pending.
When it fails, the page flips back, toasts "Couldn't delete this file. Nothing changed." and "Opened <file>", and the Trash dialog is shown again.
On success, the intended return to the list (with its tab, search and filters) never runs, because the dialog unmounted before `onDeleted` fired. The user is left on the Gone page.
**Fix:** Navigate back (`onDeleted`) from `onMutate`, or don't treat an optimistic `trashed` as Gone on this page.

### LB-3 · Low: storage path prefix in file names
**Repro (live):** Library Recent and All files, row aria-labels ("More actions for files/Draft_…"), the dialog titles ("Move files/Draft_… to Trash?") and the "Closed/Opened" toasts all show `files/` (or `files-`).
These come from generated files. Strip the folder prefix for display.

### LB-4 / LB-5 (code only)
- **LB-4:** `undoShareToast` in `src/lib/library/mutations.ts` revokes grants one after another with no tolerance for 404. If one grant was already removed, Undo shows "share failed" and the later grants keep access.
- **LB-5:** `renameFileOptions.onError` restores `previousTitle` from when the dialog opened, not the current cached title.


## Feature 9: Agents (`/agents`, new, templates, edit, Super Links)

Date: 2026-10-27 · Live on localhost:3000 as ADMIN and MEMBER. `AGENT_CHAT` is off in this build. Known backend issues (`tickets/2026-10-26/BACKEND_REGRESSIONS_TICKET.md`) were excluded.
Test data: MEMBER now has a second "zz share probe 1793013013735" agent (created by AG-1). ADMIN's "Research Assistant" was not changed (saves were mocked to fail).

| # | Severity | Title | Live result |
|---|----------|-------|-------------|
| AG-1 | High | "Remove" on a received Super Link opens "Delete agent?" for the viewer's own agent; confirming would permanently delete it | **Confirmed** (stopped at the dialog) |
| AG-2 | Medium | "Use in chat" on a received Super Link makes a private copy of the agent before checking that agent chat is off; it works even on a **revoked** link | **Confirmed** |
| AG-3 | Medium | The agent editor loses unsaved edits without asking when you leave by a sidebar link or browser Back | **Confirmed** |
| AG-4 | Low | `/agents/published` opened directly says "Your agent is now live" with no agent, and its button reads "Back to Library" | **Confirmed** |
| AG-5 | Low | Double-click on "Save changes" sends two saves | **Not reproduced** again 2026-10-31 with the save held 3 s: double-click and 3 rapid clicks each sent one PATCH (`saving` guard + disabled button). No change |
| AG-6 | Low | `/agents/new?template=A` → `?template=B` without a remount keeps A's purpose text | **Not reachable** 2026-10-31: templates are picked on a separate page, so `/agents/new` always mounts fresh; only a typed URL changes the param, which reloads. No change |

**Checked OK live:** all agents pages load for both accounts with no console errors; `/agents/configure` redirects to `/agents`; a failed save shows an error toast.
**From the code (agent review):** optimistic delete and pause roll back only their own row, a refetch keeps dirty edits, non-owners can't edit, and duplicate names are rejected.

### AG-1 · High: Remove on a shared Super Link deletes your agent
**Where:** [src/app/(app)/agents/_components/SuperLinksTab.tsx:464-469](../../../src/app/(app)/agents/_components/SuperLinksTab.tsx#L464-L469): `onClick={() => persona && setDeleteTarget(persona)}`. `persona` is looked up in the viewer's **own** agents by repo id, and `DeleteAgentDialog` → `handleDelete` (`agents/page.tsx:282`) deletes it.
**Repro (live, MEMBER):** Agents → Super Links → Shared Superlinks → click "Remove zz share probe 1793013013735". A **"Delete agent? … will be permanently deleted. This action cannot be undone."** dialog opens for the member's own copy of that agent.
Confirming would delete the agent, not the share. When there's no matching own agent, the button silently does nothing.
**Fix:** Wire Remove to a "remove share from my list" action (or hide it until one exists). Never route it to agent delete.

### AG-2 · Medium: Use in chat copies the agent even though chat is off (and the link is revoked)
**Where:** [src/app/(app)/agents/_hooks/use-agent-actions.ts:118-148](../../../src/app/(app)/agents/_hooks/use-agent-actions.ts#L118-L148) `handleUseReceivedShareInChat` copies first. `openInChat()` checks `agentChatBlocked()` only afterwards. The team-shared path (`:85`) checks first.
**Repro (live, MEMBER):** Shared Superlinks shows "zz share probe…" with status **Revoked** and a "Use in chat" button. Click it → `POST /persona/81c29c71-…/use` → toast "Chatting with agents is unavailable right now…" → My Agents now lists the agent **twice** (before: 2 agents, after: 3).
**Fix:** Check `agentChatBlocked()` before copying, hide or disable "Use in chat" while chat is off, and don't offer it for revoked links (the backend should also refuse; noted for BE).

### AG-3 · Medium: unsaved agent edits are lost on navigation
**Where:** [src/app/(app)/agents/[personaId]/edit/page.tsx:91-99, 126-130](../../../src/app/(app)/agents/[personaId]/edit/page.tsx#L91-L130). "Leave without saving?" is only shown for the header Back button. `beforeunload` covers reload and close only. `/agents/new` has the same gap (`new/page.tsx:255-264`).
**Repro (live):** `/agents/<Research Assistant>/edit` → change Name → click **Library** in the sidebar → lands on `/library` with no prompt. The same happens with the browser Back button. The edits are gone.
**Fix:** Use the shared nav guard (`NavGuardProvider` already exists in `(app)/layout.tsx`) while the form is dirty.

### AG-4 · Low: a published page with no agent
**Repro (live):** Open `/agents/published` directly (or reload it). It says "Your agent / Your agent is now live…" with no agent named, and the button reads "Back to Library" although it's the Agents area.
**Fix:** Redirect to `/agents` when there's no just-published agent in state, and label the button "Back to Agents".


## Feature 10: Templates (`/template/[uuid]`, `/api/template/[uuid]`)

Date: 2026-10-27 · Live on localhost:3000 as ADMIN. **No bugs confirmed.** The account has no stored templates (`GET /templates` → `[]`), and templates are only created by the AI during a chat, so the loaded state could not be tested.

| # | Severity | Title | Live result |
|---|----------|-------|-------------|
| TP-1 | Low | If the metadata loads but the HTML request then fails (timeout or too large while streaming), the iframe shows the raw JSON error (`{"error":{"code":"upstream_error",...}}`) instead of a notice | **Confirmed** 2026-10-31 with a real template (created via `POST /templates`, revoked after): frame showed `{"error":{"code":"upstream_timeout",...}}` |

**Checked OK live:** a malformed id (`/template/not-a-uuid`) and an unknown id both show "Link not found — This template doesn't exist, or the address is wrong."; `/api/template/<unknown>` returns 404 JSON.
**Checked in code:** the iframe is sandboxed (no `allow-same-origin`) with a matching CSP on the route, a body-size cap, a fetch timeout, and a signed-out user is sent to login with `returnTo` back to the template.


## Feature 11: Schedules (`/schedules`, `/schedules/[id]`)

Date: 2026-10-28 · Live on localhost:3000 as ADMIN, on schedule "Draft product copy B20". Every write (pause, run, delete) was **mocked to fail**, so nothing was changed.

| # | Severity | Title | Live result |
|---|----------|-------|-------------|
| SC-1 | Medium | A failed pause/resume leaves the switch showing the new state; the rollback never reaches the screen | **Confirmed** |
| SC-2 | Low | New/Edit schedule: clicking outside the dialog closes it and discards typed text with no warning | **Confirmed** |

**Checked OK live:** list and detail load with no console errors; Edit pre-fills name, instructions, day, time and timezone ("Runs every Monday at 9:00 AM · Asia/Kolkata");
a failed Run now shows "Failed to run schedule" with no stuck "Running now" badge; a failed delete closes the confirm with "Failed to delete schedule" and stays on the schedule.

### SC-1 · Medium: the pause switch lies after a failure
**Where:** [src/components/Schedules/ScheduleDetailView.tsx:139-144](../../../src/components/Schedules/ScheduleDetailView.tsx#L139-L144): `const [isActive, setIsActive] = useState(schedule.isActive)` copies the prop once and never resyncs.
`toggleScheduleActive` ([lib/schedules/schedule-queries.ts:107-119](../../../src/lib/schedules/schedule-queries.ts#L107-L119)) does roll back the cache on error, but the view ignores it. A pause done in another tab or by a refetch is ignored too.
**Repro (live):** `/schedules/<id>` (Active) → click the **Schedule active** switch with `PATCH /automations/<id>` failing. Toast "Failed to pause schedule", but the switch and badge stay **Paused**
(and "Next run" is hidden) while the schedule is still active on the server. Reload shows Active again.
**Fix:** Drop the local state and render from `schedule.isActive`. The cache update is already optimistic.

### SC-2 · Low: typed schedule details lost on an outside click
**Where:** [src/components/Schedules/ScheduleEditModal.tsx](../../../src/components/Schedules/ScheduleEditModal.tsx): the overlay's `onClick={onClose}`, and the form resets on every open.
**Repro (live):** New schedule → type a name and instructions → click the dimmed background. The dialog closes; reopen it and both fields are empty.
**Fix:** Ask before closing a dirty form (or don't close on overlay click), or keep the draft until it's sent or cancelled.


## Feature 12: Connectors (`/connectors`, `?connector=`, `?add=api`)

Date: 2026-10-28 · Live on localhost:3000 as ADMIN. Neither ADMIN nor MEMBER has a linked connector, so the account screens were driven with a **mocked linked list** (fake "ZZ Scan App" with one account), and every write was **mocked to fail**. Nothing was created or changed on the server.

| # | Severity | Title | Live result |
|---|----------|-------|-------------|
| CN-1 | Medium | Add custom API: if the API is created but linking the token fails, closing the modal forgets it; trying again creates the API a second time and leaves the first one orphaned | **Confirmed** (mocked) |
| CN-2 | Medium | Add custom API: Esc or an outside click closes the modal even while it's saving; the error then arrives with the form gone | **Confirmed** |
| CN-3 | Low | Browser Back from a connector or account page leaves Connectors entirely (the views aren't in the URL) | **Confirmed** |
| CN-4 | Low | Add custom API / Connect: an outside click discards typed name, URL and token with no warning | **Confirmed** |
| CN-5 | Low | Remove account: an outside click closes the confirm while the removal is running; a failure then says "Failed to unlink account: 500" | **Confirmed** |

**Checked OK live:** catalog and categories load with no console errors; `?connector=<slug>` opens that connector, and an unknown slug toasts "Couldn't find the zz-not-real connector"; a failed **Share with workspace** and a failed **permission** change both roll back with an error toast.
The category rows send `q=<category>` as well as `category=`, but that returned the same full page as `category` alone, so nothing is hidden.

### CN-1 · Medium: a duplicate custom API after a failed link
**Where:** [src/components/connectors/CustomApiModal.tsx:94-105](../../../src/components/connectors/CustomApiModal.tsx#L94-L105): `created` (the API made by `createCustomApi`) lives in modal state. A retry inside the modal reuses it, but Cancel/Esc/outside click unmounts the modal and loses it. Nothing refreshes the list either, so the half-made API isn't shown.
**Repro (live, mocked):** `POST /connectors/custom` succeeds, `POST /connectors/<slug>/link` fails. Add API → error toast. **Add API** again in the modal → only `/link` is sent (good). **Cancel**, reopen, fill in the same details, Add API → `POST /connectors/custom` is sent **again**.
**Fix:** On close after a create, either delete the half-made API or refresh the list and open its page so the token can be added there. At minimum call `bustConnectorCatalogCache()` so it appears.

### CN-2 · Medium: the custom API modal closes mid-save
**Where:** `CustomApiModal` passes `onDismiss={cancel}` to `Modal` ([SetupModal.tsx:40-45](../../../src/components/connectors/SetupModal.tsx#L40-L45)), which closes on Esc and on overlay click with no `busy` check. Only the Cancel button is disabled while busy.
**Repro (live):** `/connectors?add=api` → fill in Name, Base URL and token → Add API (POST delayed, then failing) → press **Esc**. The modal closes at once. The failure toast appears ~2 s later, and the details are gone.
**Fix:** Ignore Esc and overlay clicks while `busy` (RemoveModal already guards Esc this way).

### CN-3 · Low: Back leaves Connectors
**Where:** [src/components/connectors/ConnectorsExperience.tsx:38-40](../../../src/components/connectors/ConnectorsExperience.tsx#L38-L40): `view`, `activeSlug` and `activeAccountId` are local state, and the URL stays `/connectors`.
**Repro (live):** Library → Connectors → Connected → open a connector → browser **Back**. You land on `/library`, not the connectors list. Reloading a connector page also drops you back on the catalog.
**Fix:** Put the open connector/account in the URL (e.g. `?connector=<slug>&account=<id>`, which `?connector=` already half supports) and push history entries.

### CN-4 · Low: typed details lost on an outside click
**Where:** the shared `Modal` overlay `onClick={onDismiss}` in `SetupModal.tsx`, used by both Add custom API and Connect.
**Repro (live):** Add custom API → type a name, URL and token → click the dimmed background. The modal closes; reopening it shows all four fields empty.
**Fix:** Don't close on an overlay click when the form is dirty, or ask first. (This is the same pattern as SC-2 for schedules.)

### CN-5 · Low: the Remove confirm closes mid-removal, and the error shows a raw status
**Where:** [src/components/connectors/RemoveModal.tsx:36](../../../src/components/connectors/RemoveModal.tsx#L36): the overlay `onClick={cancel}` ignores `busy` (Esc is guarded). [lib/api/connectors.ts:517](../../../src/lib/api/connectors.ts#L517) throws `Failed to unlink account: ${res.status}`.
**Repro (live, mocked):** account → Remove → Remove (DELETE delayed, then failing) → click the background. The confirm closes at once. Then the toast says **"Failed to unlink account: 500"**, while other connector errors use the friendly "Something went wrong on our end…".
**Fix:** Skip `cancel` on an overlay click while `busy`, and route the unlink error through the same friendly error mapping as the other connector calls.


## Feature 13: Slack (`/souvenir-slack`)

Date: 2026-10-28 · Live on localhost:3000 as ADMIN. The test org has no Slack workspace installed, so the connected screens were driven with **mocked** `/organizations/<id>/slack/*` responses (fake "Scan Workspace"). Nothing was sent to Slack or saved.

| # | Severity | Title | Live result |
|---|----------|-------|-------------|
| SL-1 | Medium | If the install status fails to load, the page says Slack isn't connected and offers "Connect" | **Confirmed** (mocked 503) |
| SL-2 | Medium | Workspace instructions are lost if you leave the page within ~0.5 s of typing (the debounced save is cancelled on unmount) | **Confirmed** |
| SL-3 | Low | A failed instructions save leaves the edited text on screen with no unsaved marker and no retry; a reload silently reverts it | **Confirmed** |

**Checked OK live:** the real (unconnected) page and the mocked connected page render with no console errors; the non-admin view is `SlackAdminOnly` (code). The check-ins toggle rolls back on failure (code: `SlackAppPanel.tsx:104-112`).

### SL-1 · Medium: a load error looks like "not connected"
**Where:** [src/app/(app)/souvenir-slack/page.tsx](../../../src/app/(app)/souvenir-slack/page.tsx): both `getOrgSlackStatus(...).catch(() => setStatus({ connected: false, workspaces: [] }))`.
**Repro (live, mocked):** `GET /organizations/<id>/slack/installation` → 503. The page shows "Bring Souvenir into Slack … Connect your workspace" with no error, though the workspace may be installed. An admin could start a second install.
**Fix:** Keep an error state and show "Couldn't load Slack status · Retry" instead of the empty state.

### SL-2 · Medium: quick edits to the instructions are never saved
**Where:** [src/app/(app)/souvenir-slack/SlackAppPanel.tsx:49-73](../../../src/app/(app)/souvenir-slack/SlackAppPanel.tsx#L49-L73): the save runs in a 500 ms `setTimeout` whose cleanup (`clearTimeout`) also runs on unmount.
**Repro (live, mocked):** connected page → replace the instructions text → click **Library** in the sidebar at once. No `PATCH …/slack/config` is sent; the edit is gone.
**Fix:** Flush the pending save on unmount (and on `pagehide`) instead of cancelling it.

### SL-3 · Low: a failed save looks saved
**Where:** the same effect: on error it toasts, but nothing marks the field as unsaved, and no retry runs until the text changes again.
**Repro (live, mocked):** `PATCH …/slack/config` → 500. Edit the instructions → toast "Something went wrong on our end…" → the new text stays in the box; no further request is sent; a reload shows the old text.
**Fix:** Show an "Unsaved · Retry" state next to the field, or retry with backoff.


## Feature 14: Team / org (`/settings/members`, `/settings/general` and the other org settings pages)

Date: 2026-10-28 · Live on localhost:3000 as ADMIN ("test 01", the workspace's only admin). Every write was **mocked**, so no member, role or invite was changed.

| # | Severity | Title | Live result |
|---|----------|-------|-------------|
| TM-1 | High | The only admin can remove themselves; the page sends the DELETE and then shows "Admins 0" | **Confirmed** (DELETE mocked; real backend response not tested) |
| TM-2 | Low | Two overlapping removes/revokes: a failure restores the whole list snapshot, bringing back a row the other call removed | Code only (only one removable row exists) |

**Checked OK live:** members, general, activity, analytics, audit-log, inventory and workspace-library load with no console errors. A failed role change (PATCH → 500) shows "Something went wrong…" and keeps the old role. The sole admin can't demote themselves (`RoleControls.tsx:194` toast).

### TM-1 · High: the last admin can remove themselves
**Where:** [src/app/(app)/settings/(shell)/(org)/members/page.tsx:137-151](../../../src/app/(app)/settings/(shell)/(org)/members/page.tsx#L137-L151) `handleRemove`, plus the Remove control on the "You" row. The self-demote guard in `RoleControls.tsx:194` has no Remove equivalent.
**Repro (live, mocked):** `/settings/members` → on the "test 01 · You · Admin" row click **Remove** → **Confirm remove**. `DELETE /organizations/<org>/members/<own user id>` is sent; toast "Removed test 01"; the stats read **Admins 0**; you stay on an admin-only page.
If the backend accepts it, the workspace is left with no admin and you lose access mid-session. I didn't send it for real because that would lock the test org.
**Fix:** Hide Remove on your own row (offer "Leave workspace" in General instead), and block removing the last admin, the same way demotion is blocked. Ask the backend to refuse it too.

### TM-2 · Low: whole-list rollback
**Where:** `handleRemove` / `handleRevokeInvite` in the same file: `const prev = members` … `bumpMembers(prev)` on error. This is the same pattern as HI-1 (chat history).
**Scenario:** remove A (slow, fails) while removing B (succeeds) → A's rollback restores the list from before B was removed, so B reappears until the next refresh.
**Fix:** On error, re-insert only the failed row (`ms => [...ms, removed]` in its old position).


## Feature 15: Settings and billing (`/settings/*` personal pages, Plans & Billing, Usage)

Date: 2026-10-28 · Live on localhost:3000 as ADMIN and MEMBER: all 19 settings URLs were loaded for both accounts. Saves were **mocked to fail**, and no plan, payment or profile was changed.

| # | Severity | Title | Live result |
|---|----------|-------|-------------|
| BL-1 | Low | The Stripe return pages say "Payment Successful! Your subscription is active." when opened directly with no checkout, for members too | **Confirmed** |
| BL-2 | Low | Response style: if the tone saves but the profile refresh fails, the pick is reverted with an error | Not reproduced (the refresh error is swallowed; the new tone stays, with no toast) |

**Checked OK live:** account, AI & models, usage, plans & billing, help, report-bug and feature-request render for both roles with no console errors. Members are kept out of billing: `/settings/plans-and-billing` and `/settings/billing/change-plan` go to Usage, and `/settings/plans` shows "Only workspace admins can see this page".
`/settings/files`, `/notifications`, `/preferences`, `/security` and `/library` return 404 **by design** (`SETTINGS_PREVIEW_ENABLED` / `LIBRARY_SETTINGS_ENABLED` off), and the bell's settings link is hidden under the same flag.
A failed profile save toasts "Failed to save — please try again" and keeps the edit. Leaving with unsaved profile edits shows "Unsaved profile changes · Stay / Discard changes / Save & Continue".

### BL-1 · Low: a "Payment Successful" page with no payment
**Where:** [src/components/billing/CheckoutReturn.tsx](../../../src/components/billing/CheckoutReturn.tsx), used by `/settings/billing/confirmation` and `/settings/plans-and-billing/confirmation`. It renders success unconditionally and doesn't check a `session_id` or the checkout cookie, and it doesn't check the role. (`/settings/plans/confirmation` *is* admin-gated.)
**Repro (live):** as MEMBER, open `/settings/billing/confirmation`. It shows "Payment Successful! Your subscription is active. Your workspace is ready." with a "Go to plans & billing" button that a member can't use. The same happens for ADMIN with no checkout. This is the same pattern as AG-4.
**Fix:** Render the success state only when a Stripe `session_id` (or the checkout hint cookie) is present; otherwise redirect to Plans & Billing (admins) or Usage (members).


## Feature 16: Welcome and other routes (`/`, `/welcome`, invites, `/share`, `/slack/link`, `/project/[id]`, `/org/change-plan`)

Date: 2026-10-28 · Live on localhost:3000, signed in as ADMIN and signed out. Read-only.

| # | Severity | Title | Live result |
|---|----------|-------|-------------|
| MS-1 | Low | `/org-invite/<anything>` says "You're on the list! You've been invited to join a workspace" for made-up or used invite ids; the error only shows after sign-in | **Confirmed** |
| MS-2 | Low | A malformed id on `/share/<id>` and `/team-invite/<id>` shows the generic "Something was wrong with the request. Please check your input" (422) instead of "Link not found" / "Invite not found" | **Confirmed** |
| MS-3 | Low | `/project/<missing id>` shows "Project not found" *and* a "Failed to load project chats" error toast | **Confirmed** |

**Checked OK live:** `/` and `/welcome` go to `/chat` when signed in and to the Auth0 login when signed out. Protected routes redirect signed-out users to login. A well-formed unknown share id shows "Link not found", and an unknown team invite shows "Invite not found". `/slack/link` without a valid link explains "This page expects a connect link from Slack".
`/org/change-plan` with a bogus `plan` falls back to Core. `/browser-verify` and `/reasoning-verify` are dev-only harnesses, blocked outside dev by `lib/auth/route-policy.ts` (by design).

### MS-1 · Low: every invite link looks valid
**Where:** [src/app/org-invite/[inviteId]/page.tsx](../../../src/app/org-invite/[inviteId]/page.tsx) renders the welcome card from the URL alone (it only builds `returnTo`). The check happens later, in `/onboarding/team/<id>`.
**Repro (live):** signed out or in, open `/org-invite/bogus` → "You're on the list! … Sign up / Sign in". After sign-in, `/onboarding/team/bogus` shows the error.
**Fix:** Look the invite up on load where the API allows it (or at least reject ids that aren't UUIDs) and show "Invite not found" before asking someone to create an account.

### MS-2 · Low: a malformed id gives a generic error
**Repro (live):** `/share/bogus` → "Something went wrong · Something was wrong with the request. Please check your input and try again · Try again". `/team-invite/bogus` → the same text (the backend returns 422 for a non-UUID). "Try again" can't help.
**Fix:** Treat 422/404 the same and show the existing "Link not found" / "Invite not found" states, or validate the UUID before calling.

### MS-3 · Low: two errors for a missing project
**Repro (live):** `/project/00000000-0000-4000-8000-000000000000` → the page says "Project not found … Back to Projects", and a toast "Failed to load project chats" also appears (the chats query 404s too).
**Fix:** Skip the chats query, or its toast, when the project itself is not found.


## Feature 17: Dev pages (`/dev/greetings`, `/dev/notifications`, `/compare` lab, `/browser-verify`, `/reasoning-verify`, `/api/lab`)

Date: 2026-10-28 · Live on localhost:3000 as ADMIN. Read-only.

| # | Severity | Title | Live result |
|---|----------|-------|-------------|
| DV-1 | Low (perf, app-wide) | The notifications feed fetches every schedule's detail one by one (`GET /automations/<id>` × N), and does it twice per page load | **Confirmed** |

**Checked OK live:** all five dev pages render with no console errors. Each one is blocked in production by its own `NODE_ENV === 'production'` → `notFound()` (pages/layouts) and `lib/auth/route-policy.ts` (harnesses only skip auth outside production). `/api/lab` returns 404 for unknown and path-traversal paths, and in production.
The playground's "loading…" cleared after the first compile (4 rows).

### DV-1 · Low: N+1 schedule fetches, doubled, on every page
**Where:** the schedule half of `poll()` in [src/context/notifications-context.tsx](../../../src/context/notifications-context.tsx) (it fills `scheduleRows`), which runs from the app shell on every page.
**Repro (live):** open any page (seen on `/dev/notifications` and `/settings/plans-and-billing`). With ADMIN's 4 schedules the network shows `GET /automations` once and `GET /automations/<id>` for each of the 4, **twice** (8 detail calls). This scales with the number of schedules and repeats on each poll.
**Fix:** Take last-run status from the list response (or a batch endpoint, noted for BE), and dedupe the double poll on mount (likely the visibility/role effects both firing `poll`/`loadAgents` at start).


## Fix pass (2026-10-28)

Front-end fixes, each re-tested live on localhost:3000 with the `.env.local` accounts (failures mocked where a real write would be destructive). Nothing is committed.
`tsc` is clean and `vitest` passes (209 files, 1,837 tests). New tests: `lib/copy-text.test.ts`, `restoreChat` in `chat-history-cache.test.ts`, code-in-citations in `content-renderer.test.tsx`, cut-off turns in `turn-outcome.test.ts`, `/sign-in-error` in `route-policy.test.ts`.
Backend follow-ups are in `tickets/2026-10-28/BACKEND_TICKET_from_frontend_bug_fixes.md`.

| ID | Fix | Retest |
|----|-----|--------|
| AS-2 | `logout()` clears session timing, search recents and the org-id cache before leaving | **Pass**: keys gone after the real Sign out |
| AS-3 | A failed Auth0 callback goes to a new public `/sign-in-error` page (reason + Try again keeping `returnTo`) | **Pass**: `/auth/callback?error=…` → `/sign-in-error?reason=…` |
| AS-4 | The client guard uses the proxy's next step (`lib/onboarding-next-step.ts`, shared) and honours the checkout cookie | **Unit tested** (2026-10-31): `OnboardingGuard.test.tsx` checks each onboarding state goes to the same step as the proxy, plus the checkout cookie and pass-through routes; still not run live (no un-onboarded account) |
| AS-5 | The client guard's login redirect carries `returnTo` | **Pass**: `/auth/login?returnTo=%2Flibrary%3Fq%3Ddeep` |
| AS-6 | `/` keeps repeated params | **Pass**: `/chat?x=1&x=2&connector=demo` |
| AS-7 | Comment corrected (paid access can lapse; 60 s TTL) | n/a |
| AS-1 | Deleted the dead `src/app/auth/logout/route.ts`; `/auth/logout` is served by the Auth0 SDK (proxy, then the `[auth0]` catch-all) (2026-10-31) | **Pass**: direct GET → 307 to Auth0 `/oidc/logout`, `__session*` cleared, access-token 401; real Log out → `/auth/logout` → Auth0 login, `/chat` asks to sign in again |
| AS-9 | The org-id cache is keyed by the Auth0 `sub`; nothing is cached without one | **Pass**: `souvenir:org-id:auth0|…` (BE-9: `/users/me` has no id) |
| CH-1 | A stream that ends without RUN_FINISHED keeps its text and shows "The response was cut off before it finished. Please retry." + Retry | **Pass** |
| CH-2 | Citation markers are skipped inside fenced and inline code | **Pass**: code shows `{1}`, `[1]`; code Copy is exact |
| CH-3 | Message Copy uses `messageCopyText()`: widgets → plain lines, citation markers removed (except in code) | **Pass**: clipboard "Revenue: $5M", no XML |
| CH-4 | A chat switch cancels the draft's uploads, frees previews, clears refusal notices | **Pass**: "Blocked…" no longer follows to another chat |
| CH-5 | Enter sends attachment-only drafts. A files-only **first** message from the landing page now sends (it was silently dropped) | **Pass**: Enter and button both POST `/api/chat` |
| CH-6 | The button label says "Send message" when only attachments are present | **Pass** |
| CH-8 | (2026-10-31) A queued message is asked "Save N files to Library?" when it is queued; the answer rides on its files and the queue holds until it is given | **Pass**: queued file sent with `saveToLibrary: false` after Don't save (was absent, so silently not saved) |
| CH-12 | (2026-10-31) Shared `lib/ime.ts` `isImeKey()` (isComposing or keyCode 229) in both composers; the Library file-page composer (`components/ChatInput`) had no IME check at all | Unit tested (`ChatInput.streaming.test.tsx`, Safari and Chrome events); no Safari here to run live |
| CH-14 | (2026-10-31) `registerChatScroller` returns an unregister that only clears while it still owns the scroller. Only Highlights (hidden) use it | Unit tested (`chat-scroller.test.ts`) |
| CH-15 | (2026-10-31) The dialog skips Radix's return-focus (the composer had already lost focus) and the chat focuses its composer once the question is answered; the landing hand-off focuses the chat's composer | **Pass**: Esc, Save and a landing send (plain or with the dialog) all leave focus in the composer, typing continues there |
| CH-9 | (2026-10-31) While the question is open the chat holds: new sends queue behind the message asked about, and `useSaveChoice` queues questions instead of replacing the open one. Test: `useSaveChoice.test.tsx` | **Pass**: one, two, x sent in that order, one at a time (was two, one in parallel) |
| CH-7 | A Library chip opens `/library/files/<id>`; the name has no `files/` prefix | **Pass** |
| HI-1 | A failed delete puts back only that chat (`restoreChat`) | **Pass**: the other deleted chat stays gone |
| HI-2 | The decorative inner checkbox is `aria-hidden`; the row is the labelled checkbox | **Pass**: 0 unlabelled (was 10/20) |
| HI-3 | The selection entry button is "Select" | **Pass** |
| SH-1 | A chat missing from the viewer's list that `GET /chats/{id}` 404s for is read-only (Make a copy) | **Pass**: MEMBER sees Make a copy, composer disabled (BE-6) |
| SH-2 | Back/Go back fall back to `/chats?tab=shared` when not reached from inside the app | **Pass** |
| SH-3 | "This chat is no longer shared with you. Ask the person who shared it to share it again." | **Pass** |
| PR-1 | `removeChat` restores the chat and count on failure, toasts "Couldn't delete "<title>"", returns success | **Pass**: chat back (the dialog stays open on failure, as for other chats) |
| PR-2 | A typed but unconfirmed tag is added on Create | **Pass**: tags `["alpha","beta"]` |
| PR-3 | A failed project delete returns to the project, and its chats are restored too | **Pass** |
| PR-4 | Project chat menus are `Options for "<title>"` | **Pass** |
| LB-1 | File dialogs stay mounted in every list state | **Pass**: the dialog no longer vanishes and reopens by itself |
| LB-2 | The file page keeps showing the file while its trash request runs | **Pass**: no "No longer available" during the request or after failure |
| LB-3 | The display name strips a leading `files/` | **Pass** (BE-4 for stored titles) |
| LB-5 | (2026-10-31) A failed rename puts back the name the file had when the rename started (read from the cache in `onMutate`), not the one captured when the dialog opened | Unit tested (`mutations.test.ts`); live: failed rename shows the old name + "Couldn't rename this file" |
| LB-6 | (2026-10-31) The toaster keeps `pointer-events: auto` under an open dialog, and `DialogContent` ignores outside clicks that land in a toast | **Pass**: Undo with the Share dialog open revokes both grants, the dialog stays open; a backdrop click still closes it |
| TP-1 | (2026-10-31) `/api/template/<id>` answers a frame load (`Sec-Fetch-Dest: iframe`) that fails with a themed, sandboxed HTML notice (same texts as the page, now shared in `template-view.ts`); other callers still get JSON. The frame is a client `TemplateFrame` that passes the app theme (`?theme=`), since the sandboxed frame follows the OS. A page that only proves too large while streaming is still cut off (headers already sent) | **Pass**: real route + real backend failure shows "Link not found…"; light and dark app themes match whatever the OS is; one frame load; normal view and plain-fetch JSON unchanged |
| AG-1 | Remove on received Super Links removed (it opened Delete agent) | **Pass**: no Remove buttons (BE-1 to bring it back properly) |
| AG-2 | "Use in chat" is disabled unless the link is Active; the agent-chat block is checked before the copy | **Pass**: disabled on Revoked (BE-2) |
| AG-3 | The agent editor and the new-agent editor use the app nav guard while dirty | **Pass**: sidebar and Back both ask |
| AG-4 | `/agents/published` with no agent → `/agents`; the button reads "Back to Agents" | **Pass** |
| SC-1 | The switch renders `schedule.isActive` (cache is optimistic + rolled back) | **Pass**: back to Active after a failed pause |
| SC-2 | An outside click doesn't close a dirty New/Edit schedule form | **Pass** (a clean form still closes) |
| CN-1 | The modal reuses an API it created when the retry has the same name + URL; closing refreshes the list and says where to add the token | **Pass**: reopen sends only `/link` (BE-7) |
| CN-2 | Esc and outside clicks are ignored while the custom API saves | **Pass** |
| CN-3 | The open connector/account are in the URL (`?open=&account=`) | **Pass**: Back → connector → list; reload keeps the connector |
| CN-4 | An outside click doesn't close a dirty Connect/Add custom API form | **Pass** |
| CN-5 | The Remove confirm ignores outside clicks while busy; unlink errors are friendly | **Pass** |
| SL-1 | A failed status check shows "Couldn't check your Slack connection" + Retry | **Pass** |
| SL-2 | A pending instructions save is sent when the page unmounts | **Pass**: PATCH sent on a quick exit |
| SL-3 | A failed save shows "Not saved…" + Retry | **Pass**: Retry re-sends and clears the notice |
| TM-1 | No Remove on your own row | **Pass** (BE-3: backend should refuse too) |
| TM-2 | Failed remove/revoke restores only that row; failed role change restores only that member | **Pass** |
| BL-1 | Checkout return pages need `?type=`/`?plan=`, otherwise → Plans & Billing (members → Usage) | **Pass** for both roles; `?type=topup` still shows success |
| MS-1 | `/org-invite/<not a UUID>` → "Invite not found" | **Pass** (BE-5 for well-formed unknown ids) |
| MS-2 | 422 is treated like 404 for share and team-invite links | **Pass** |
| MS-3 | A 404 project skips the "Failed to load project chats" toast | Code only (one-line guard, not re-run) |
| DV-1 | Overlapping notification polls share one request (keyed by user) | **Pass**: 4 detail calls, was 8 (BE-8) |

**Not fixed:**
- **OB-1 to OB-10:** need an un-onboarded account to test.
- **CH-10, CH-13:** skipped, agents in chat are hidden (`AGENT_CHAT`). **CH-11:** skipped, Pinboard is hidden on purpose. (CH-8, CH-9, CH-12, CH-14, CH-15 fixed 2026-10-31.)
- **AG-6:** not reachable. (TP-1 fixed 2026-10-31.)
- **AG-5, BL-2, LB-4:** not reproduced.
- **RC-1:** new on the 10-31 recheck, not fixed yet (see "Recheck 2026-10-31").

**Known side effect:** after leaving a guarded editor through its own Save, one extra history entry remains, so Back needs two presses. This is the same as the profile page and OB-9.

## Recheck (2026-10-31)

Everything above was rechecked after the 10-31 fixes, on localhost:3000 with `NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS=true` (now in `.env.local`), as ADMIN and MEMBER.

**Build and tests:** `tsc` clean. `vitest` 212 files, 1,865 tests pass (2 skipped). ESLint: every file changed on 10-31 is clean except `Toast/index.tsx:49` (an empty interface, older than these fixes). `src` as a whole still has 154 older lint errors.

**Page sweep:** 43 routes per account, covering every feature, checked for page errors, console errors and failed requests. 39/43 clean for ADMIN, 37/43 for MEMBER. The rest are expected:
- `/settings/preferences`, `/notifications`, `/security`, `/files` are 404 for both. They are hidden on purpose behind `SETTINGS_PREVIEW_ENABLED`. (Next logs "Encountered a script tag while rendering" on its 404 page. That's a dev-only warning.)
- MEMBER opening ADMIN's private file shows "No longer available" + Back to Library, which is correct. MEMBER opening ADMIN's private chat is **RC-1** below.

**Quick re-checks of earlier fixes (both accounts, all pass):**

| ID | Check | Result |
|----|-------|--------|
| AS-2 | Log out from the account menu | `souvenir:session*`, `org-id*`, `search*` keys gone |
| AS-3 | `/auth/callback?error=access_denied…` | → `/sign-in-error?reason=…` |
| AS-6 | `/?x=1&x=2&connector=demo` | → `/chat?x=1&x=2&connector=demo` |
| AG-4 | `/agents/published` opened directly | → `/agents` |
| BL-1 | `/settings/billing/confirmation` with no params | ADMIN → Plans & Billing, MEMBER → Usage |
| MS-1 | `/org-invite/not-a-uuid` | "Invite not found…" |
| HI-3 | `/chats` selection entry | "Select" button |
| LB-3 | Library All files | no `files/` prefix |
| TP-1 | unknown template | "Link not found…" |

The 10-31 fixes (AS-1, CH-8, CH-9, CH-12, CH-14, CH-15, LB-5, LB-6, TP-1) were each retested live or by unit test when they were made; see the fix pass table.

| # | Severity | Title | Live result |
|---|----------|-------|-------------|
| RC-1 | Medium | Opening a chat you can't access (private to someone else, or deleted) offers to copy it | **Confirmed** (MEMBER opening ADMIN's private chat) |

### RC-1 · Medium: a chat you can't access offers "Create a copy"
**Where:** the SH-1 read-only path in the chat view. A chat that isn't in the viewer's list and whose `GET /chats/{id}` 404s is treated as one shared with them, so it gets the read-only "Make a copy" treatment.
**Repro (live, MEMBER):** open `/chat?id=<ADMIN's private chat>`. The page shows "Couldn't load this conversation. The requested resource was not found." with a **Retry** button, a **Create a copy** button in the header, the composer placeholder "Create your own copy to continue this chat.", and a red "The requested resource was not found." toast. Retry can't help, and there's nothing to copy.
**Fix:** when the messages themselves 404, show a plain "This chat isn't available" state (deleted, or not shared with you) with a way back to Chats. Keep "Make a copy" only for chats the viewer can actually read.
