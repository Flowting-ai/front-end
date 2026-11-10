# Onboarding Feature — Detailed Report

**Scope:** the first-run flow — account type, profile, workspace creation, team invites/join, plan selection, tone preference, connector import, and the post-signup "hello" welcome. 15 route files, the largest single flow by page count after Settings.

**How this was produced:** a static-analysis pass (`react-doctor`) filtered to this feature's files, Tailwind composition measurement, and a live guard-behavior check. **Full live UI walkthrough was not possible this pass** — see the caveat in §3 before treating this report as equivalent in coverage to the other seven.

---

## 1. Pages in this feature

| Route | File | Purpose |
|---|---|---|
| `/onboarding` | `onboarding/page.tsx` | Entry point — routes into the flow |
| `/onboarding/hello` | `onboarding/hello/page.tsx` | Welcome screen |
| `/onboarding/account-type` | `onboarding/account-type/page.tsx` | Personal vs. team/org account choice |
| `/onboarding/profile` | `onboarding/profile/page.tsx` | Name/profile setup |
| `/onboarding/workspace` | `onboarding/workspace/page.tsx` | Workspace/org creation |
| `/onboarding/invite` | `onboarding/invite/page.tsx` | Invite teammates |
| `/onboarding/join` | `onboarding/join/page.tsx` | Join an existing workspace via invite |
| `/onboarding/team/[inviteId]` | `onboarding/team/[inviteId]/page.tsx` | Team-invite landing |
| `/onboarding/team/[inviteId]/profile` | `onboarding/team/[inviteId]/profile/page.tsx` | Profile setup specifically for an invited user |
| `/onboarding/plans` | `onboarding/plans/page.tsx` | Plan selection — **largest file in this feature**, flagged both giant and high-complexity |
| `/onboarding/pricing/confirmation` | `onboarding/pricing/confirmation/page.tsx` | Post-checkout confirmation |
| `/onboarding/tone` | `onboarding/tone/page.tsx` | AI tone/personality preference |
| `/onboarding/import` | `onboarding/import/page.tsx` | Import data/connectors during setup |
| `/onboarding/connectors` | `onboarding/connectors/page.tsx` | Connect tools during setup |
| `/onboarding/setup` | `onboarding/setup/page.tsx` | Generic self-serve setup landing (referenced by name in `auth0.ts`'s onCallback comment as the fallback destination) |

**Core components:** `onboarding/_components/step-shell.tsx` (shared step chrome/progress), `onboarding/_components/add-to-slack-modal.tsx`.

**State/data layer:** `context/onboarding-context.tsx`, `lib/onboarding-access.ts` (the server-side gate — see §3), `USER_ONBOARDING_ENDPOINT` (`/users/me/onboarding`).

---

## 2. All API calls used by this feature

Onboarding doesn't have its own endpoint block in `config.ts` — it reuses:

| Endpoint | Method | Used for |
|---|---|---|
| `/users/me` | GET | The onboarding **gate** itself — `src/proxy.ts` fetches this server-side on every request to decide whether to redirect into onboarding, cached per Auth0 `sub` per the code comment at `proxy.ts:33-45` |
| `/users/me/onboarding` | GET/POST | Read/write onboarding progress state |
| `/users/create` | POST | Account creation |
| `/organizations` (create) | POST | Workspace creation during onboarding |
| `/org-invite/{inviteId}` | GET | Preview an invite before accepting |
| `/org-invite/{inviteId}/accept` | POST | Accept a team invite |
| `/stripe/checkout`, `/stripe/trial` | POST | Plan selection / free trial start (shared with the Settings report's billing surface) |

---

## 3. Live functional test results — **coverage gap, stated plainly**

**The test account used throughout this entire report series has already completed onboarding**, so this feature's actual UI could not be walked through live the way the other seven reports did. What *was* confirmed live:

**The onboarding gate works correctly.** Directly requesting all six tested onboarding routes (`/onboarding`, `/onboarding/hello`, `/onboarding/profile`, `/onboarding/workspace`, `/onboarding/plans`, `/onboarding/tone`) while authenticated as an already-onboarded user **correctly redirected to `/chat` every time** — no broken-guard access, no ability to re-enter the flow accidentally. This is a genuine positive finding: the server-side gate (`src/proxy.ts` + `lib/onboarding-access.ts`, fetching and caching `/users/me` per the code's own documented reasoning) is doing its job.

**What this means for the rest of this report:** §5 (Tailwind) and §6 (static analysis) below are based on direct source reading, same as every other report — those numbers are real and measured. But there is **no live screenshot evidence, no confirmed working end-to-end signup flow, and no captured runtime bugs** for this feature, unlike the other seven reports. If a genuinely fresh account (new email, not yet run through onboarding) becomes available, this report should be redone with the same live-walkthrough rigor as the rest of the series — treat this one as **static-analysis-only** until then.

---

## 4. Lighthouse — not run this pass

Same root cause as §3 — an authenticated, already-onboarded session cannot reach these pages to profile them; they redirect before any paint happens. Requires a fresh account to test properly.

---

## 5. Tailwind vs. inline-style composition — scoped to this feature

Measured directly across this feature's 22 files (5,336 LOC):

| | Inline `style={{}}` | `className=""` |
|---|---|---|
| Count | **299** | **3** |
| **Share of styling touchpoints** | **99.01%** | **0.99%** |

**This is the opposite extreme from the Pinboard report's ~88/12 finding — the lowest Tailwind usage of any feature measured in this entire series**, below even the ~96/4 codebase-wide baseline. Between this and Pinboard, the report series now has empirical evidence of the full real-world range within this one codebase: from under 1% to over 11% Tailwind adoption depending on which part of the app (and, plausibly, which author/team) built it.

---

## 6. Static-analysis findings (react-doctor, scoped to this feature)

**36 findings** (12 Performance, 9 Bugs, 7 Maintainability, 8 Accessibility; 9 errors / 27 warnings). Smallest total count of any feature, proportionate to it being mostly simple, linear step forms rather than complex stateful UI.

### Highest-volume issues

| Count | Category/Severity | Rule | What it means | Where |
|---|---|---|---|---|
| 8 | Performance/error | React Compiler can't parse (`todo`) | Blocks auto-memoization | `hello`, `import`, `invite` (2×), `join`, `profile`, `team/[inviteId]/profile`, `workspace` — spread across 7 of the flow's 15 pages |
| 3 | Bugs/warning | `motion-animate-presence-must-outlive-child` | Framer Motion misuse | all 3 in `plans/page.tsx` — same bug class flagged in six prior reports, concentrated here in one file |
| 2 | Accessibility/warning | `no-static-element-interactions` | Click handlers on non-interactive elements | `add-to-slack-modal.tsx`, `invite/page.tsx` |
| 2 | Accessibility/warning | `prefer-html-dialog` | Custom modal instead of `<dialog>` | `add-to-slack-modal.tsx`, `step-shell.tsx` — notably, this means even the **shared step-shell chrome** used by every onboarding page carries this pattern |
| 2 | Maintainability/warning | `no-giant-component` | Too large to reason about | `import/page.tsx`, `plans/page.tsx` |
| 2 | Accessibility/warning | `no-placeholder-only-field` | Field's only label is placeholder text | `import/page.tsx`, `workspace/page.tsx` |
| 2 | Bugs/warning | `no-array-index-as-key` | List items keyed by array index | `join/page.tsx`, `team/[inviteId]/page.tsx` |
| 2 | Performance/warning | `set-state-in-effect` | Blocks React Compiler optimization | `join/page.tsx`, `pricing/confirmation/page.tsx` |
| 2 | Accessibility/warning | `control-has-associated-label` | Control missing accessible label | both in `plans/page.tsx` |
| 2 | Maintainability/warning | `only-export-components` | Breaks Fast Refresh | both in `context/onboarding-context.tsx` |

### Notable single findings

- **1× `nextjs-no-client-side-redirect`** (`pricing/confirmation/page.tsx:167`) — a real Next.js correctness pattern issue on the page users land on immediately after paying; worth extra scrutiny given the stakes of that specific moment in the flow.
- **1× `no-initialize-state`** + **1× `exhaustive-deps`**, both in `pricing/confirmation/page.tsx` — two more findings on that same post-payment page, making it the single most-flagged page in this feature relative to its likely size.
- **1× `no-loading-flag-reset-outside-finally`** (`tone/page.tsx:161`) — a loading spinner that can get stuck on if an error path skips the reset; worth checking given this is the same bug class (loading flag outside `finally`) flagged 9 times codebase-wide in earlier reports' combined findings.
- **1× `duplicate-jsx-subtree`** (`profile/page.tsx:57`).

Full file/line detail for all 36 findings is in the raw JSON generated this session (see §7).

---

## 7. Backlog — prioritized

**P0 — needs live verification, not yet confirmed either way**
1. **Get a fresh test account and redo this report's live-walkthrough sections.** Every other feature in this series has confirmed, reproduced live behavior (working or broken); this one currently rests entirely on static analysis. Given onboarding is the very first experience a new user has, this is arguably the highest-value gap to close of anything flagged across all eight reports.
2. `pricing/confirmation/page.tsx` carries 3 separate findings (client-side redirect, state-initialized-from-effect, missing deps) concentrated on the page users see immediately after paying — worth a manual walkthrough specifically of the payment-confirmation moment once a fresh account is available.

**P1 — performance**
3. 8× React-Compiler-blocking findings spread across 7 of 15 pages — broader (more files touched) than deep (few per file), suggesting a shared pattern used across many onboarding steps rather than one bad file.
4. 3× `AnimatePresence` misuse, all in `plans/page.tsx` — concentrated, cheap fix.

**P2 — maintainability**
5. `import/page.tsx` and `plans/page.tsx` are the only two files flagged giant/high-complexity in this feature — a much smaller maintainability footprint than any other feature audited, consistent with onboarding being mostly simple linear forms.

**P3 — accessibility**
6. **The shared `step-shell.tsx` carries the `prefer-html-dialog` finding** — since every onboarding page uses this shell, fixing it here (rather than per-page) fixes the pattern across the whole flow in one place, same logic as the Chats/Agents/Connectors/Settings/Pinboard reports' repeated recommendation for a shared Dialog primitive.
7. 2× placeholder-only field labels, 2× missing control labels — modest count, consistent with the feature's overall small footprint.

---

## 8. Cross-feature pattern check (now 8 features in)

- `no-shared-Dialog-primitive` (`prefer-html-dialog`) — **now confirmed in 6 of 8 features**, and notably here it's in the *shared* step-shell component, meaning a single fix propagates across all 15 onboarding pages at once. Strengthens the case (now the strongest yet) for building one shared Dialog/Modal primitive rather than continuing to patch call sites feature-by-feature.
- `AnimatePresence` exit-animation misuse — 4th feature to show this pattern (Pinboard, Chats, Agents, now Onboarding).
- React-Compiler-blocking `todo` patterns — present in every one of the 8 features audited, no exceptions, at this point the single most universal finding in the whole series.
- **New this report:** Tailwind composition range across the codebase is now empirically bounded — 0.99% (Onboarding, lowest) to 11.54% (Pinboard, highest), with the bulk of features clustering at 3-5%. Useful concrete range for any future migration-scoping conversation.
- **New this report, structural rather than a bug:** this is the first feature in the series where **live functional testing wasn't possible with the available test account** — worth remembering when comparing this report's apparent "cleanliness" (few live-observed bugs) against the other seven, since that's an artifact of not having tested it live, not evidence the flow is actually bug-free.

---

## 9. Artifacts backing this report

Raw data (the redirect-guard verification screenshot, full react-doctor diagnostics scoped to this feature) was generated during this session in a local scratchpad, not checked into this repo — ask if you want it attached here as a supporting file. No Lighthouse or live-UI screenshots exist for this feature — see §3/§4.
