# Workspace v2 / Project Chat Model / Onboarding v1.5 — Spec vs. Backend vs. Frontend Tracker

**Purpose:** living reference reconciling three Superhuman Docs specs against what the backend actually implements and what the frontend (`front-end/`) currently does.

**CORRECTION 2026-08-30 — every claim in this doc before today was sourced from the wrong backend.** All prior passes read `D:\WJP Souvenir\back-end-test`, which turns out to be a different, stale repo (`github.com/Flowting-ai/flowtingAI-api`) — **not** `D:\WJP Souvenir\back-end-test2` (`github.com/Souvenir-AI/souvenir-server`, branch `test`), which is what the live app actually runs against (`devapi.getsouvenir.com/test`). This pass re-verified every single row directly against `back-end-test2` (file:line cited) and current frontend code. Net result: several of the tracker's most serious findings — the chat-privacy leak, the org billing/usage leaks, most of the persona role-permission bugs — are **already fixed** in the real backend, via a burst of commits dated 2026-08-29 that this doc never saw. A few new bugs were also found and fixed this session (see Section 9). Every row below is fresh as of this pass — do not assume anything predates this correction.

**Sources:**
- [Workspace Model v2 — Entities, Billing, Credits](https://docs.superhuman.com/d/Product-Team-Doc_dgtnRlALWv3/Workspace-Model-v2-Entities-Billing-Credits_suM6tOKn)
- [Project Chat Model](https://docs.superhuman.com/d/Product-Team-Doc_dgtnRlALWv3/Project-Chat-Model_suRwrfIl)
- [Onboarding V1.5](https://docs.superhuman.com/d/Onboarding-Settings-Connectors-V1-5-Implementation-Flow_dgfHvG_bkGD/Onboarding-V1-5_suY3RN_R) + local `onboarding-v1.5-flow.md`
- [Connectors — Connections v1 UX flow](https://docs.superhuman.com/d/Connectors_deAyH5BPP5a/Connectors_surqivP-)
- Storybook reference: `may-day-final/src/stories/teams/ConnectorLibraryV1.stories.tsx` (S1–S22 end-to-end connector flow)

**Status legend:** ✅ Done/matches · ⚠️ Partial / open but non-blocking · ❌ Open gap · 🔒 Held (explicitly deprioritized by user) · — Not evaluated this pass

**Resolved column:** a simplified Yes/No/Partial read of the Status column. "Yes" = fully closed, nothing left to do. "Partial" = some fix shipped, something real still remains. "No" = nothing has been fixed yet, including 🔒 held items.

**Last updated:** 2026-08-30 (full re-audit against `back-end-test2`)

---

## 1. Onboarding

| # | Spec requirement | Frontend (current) | Backend dependency | Status | Resolved |
|---|---|---|---|---|---|
| O1 | A1a: choice between "Continue with Slack" and "Continue setting up" (web) | `onboarding/setup/page.tsx` — calls `getSlackInstallUrl()` unconditionally on the very first screen, before any org exists; on failure shows a generic toast that will always fail again on retry | **Re-confirmed against `back-end-test2`.** `services/slack/service.py:529-538` `require_admin_org()` unconditionally 403s if no org membership exists; called from both `build_install_url` (line 550) and `completeInstall` (line 598). A backend fix (let a no-org caller through, auto-provision an org from the Slack team name on callback) was drafted this session but **reverted per explicit instruction — no backend edits allowed** | ❌ Open — backend requires an org that doesn't exist yet at this step | No |
| O2 | A1b: Workspace name (required) + size (Just Me default); empty-field error; Next disabled until valid | `workspace/page.tsx` — inline error ✅, `nextDisabled` wired, and now also calls `refreshUser()` before navigating (see O2b) | `createOrganization`/`updateOnboarding` — soft-fail: toast shown but page **always advances** even if the save fails (unchanged, re-confirmed) | ✅ Validation fixed · ⚠️ soft-fail-then-advance still open | Partial |
| O2a | **Bug found and fixed:** clicking Next again on the workspace step threw "You already belong to an organization" | `GET /users/me` still has **no `org_id` field at all** (re-confirmed, `services/users/schemas.py`) | `workspace/page.tsx` resolves the real org id via `listOrganizations()` first, falling back only when `user.orgId` is unset | ✅ Fixed | Yes |
| O2b | **Bug found and fixed 2026-08-30:** the redirect-loop DDoS — onboarding would silently complete mid-flow (see O3b) and the client's cached user object never learned about it before the next navigation | `services/users/repository.py:495-505` `update_onboarding` silently sets `onboarding_completed=True` the instant `user_role`+`ai_tone`+`role_fit` are all set — a real side effect of routine PATCH calls, not just the invite step | `workspace/page.tsx` and `profile/page.tsx` now both call `refreshUser()` immediately before their `push()` to the next step, so `OnboardingGuard`'s cached `user` is never stale when a redirect decision is made | ✅ Fixed | Yes |
| O3 | A1c: First/Last name (required), Role dropdown (Founder/Marketer/Designer/Engineer/Operator/Student-Researcher/**Other disabled**) | `profile/page.tsx` — role list matches spec exactly (Other removed entirely), inline validation + `nextDisabled` wired, now also calls `refreshUser()` (O2b) before navigating | Same soft-fail-then-advance pattern as O2 on `updateUser` failure (unchanged) | ✅ Role list + validation fixed · ⚠️ soft-fail still open | Partial |
| O3a | **Deliberate spec reversal:** an "AI tone" field (Direct/Balanced/Warm) was added to `/onboarding/profile`, even though the flow doc says "no tone step" | N/A — confirmed product decision, not an oversight | `updateOnboarding()`'s existing `TONE_API_MAP` already mapped this to the real backend enum, no new backend wiring needed | ✅ Added, deliberate deviation | Yes |
| O4 | A1d: Email invites — comma/newline split, tag/chip UI with remove ✕, skippable, format validation | `invite/page.tsx` — chip UI, regex validation, skip preserved | `updateOnboarding({onboarding_completed:true})` correctly **blocks** navigation on failure — most robust of the onboarding steps | ✅ Fixed | Yes |
| O5 | A1d: "Add Souvenir to Slack" modal on completion | `_components/add-to-slack-modal.tsx` — implemented, try/catch + toast | Same org-required constraint as O1, but the org already exists by this point (created at O2), so this instance works | ✅ Verified fine | Yes |
| O6 | A2: "Join a workspace" (org name/member count/avatar stack/Join button) | `join/page.tsx` — implemented correctly, calls invite-accept after login. **Bug found and fixed 2026-08-30:** `lib/api/teams.ts`'s `InviteOnboardingResponse` read `organization_member_count`/`organization_members`; the real backend fields (`services/organizations/schemas.py` `InvitePreview`) are `member_count`/`members` — the "who's already here" member count/avatar stack always rendered as empty | Backend re-confirmed unchanged: `GET /org-invite/{id}` returns real `member_count`/`members` data, just under different names than the frontend was reading | ✅ Fixed 2026-08-30 (was silently broken before) | Yes |
| O7 | A2: profile + Slack-modal screens reuse A1's components | Confirmed identical instances, no new code needed | — | ✅ Matches | Yes |
| O8 | B1/B2: pre-login invite landing, Sign in vs. Sign up | `app/invite/[inviteId]/page.tsx` — same `member_count`/`members` fix from O6 applies here too (shared response type) | **Re-confirmed.** `GET /org-invite/{invite_id}` (`services/organizations/router.py:512-518`) still requires `Depends(get_current_user)` — not anonymous-accessible | 🔒 Held — confirmed real blocker, explicitly on hold per user instruction | No |
| O9 | B1 vs B2 selection signal — "does this invited email already have a Souvenir account" | `?existingAccount=1` query-param workaround, defaults to B2 (Sign up) when missing/invalid | **Re-confirmed.** `InvitePreview` (`services/organizations/schemas.py:306-322`) still has no such field | ❌ Open — no backend signal exists | No |

---

## 2. Chats

| # | Spec requirement | back-end-test2 reality | Frontend (current) | Status | Resolved |
|---|---|---|---|---|---|
| CH1 | Every chat is private by default; **even inside a shared project, invisible to other members — no exceptions** | **FIXED, re-verified 2026-08-30.** Current function `services/chat/repository.py:78-96` `chat_readable_by_user` now gates on `visible_to_user(Chatboard, user_id)` (own chat, or `visibility=="shared"` in the same org) OR an explicit `ChatShare` row targeting the user or a visible project. Being a member of a shared project no longer by itself grants chat read — no arm follows a project link the way it used to. A dedicated regression test exists: `services/chat/tests/test_surface_isolation.py:95` `test_chat_read_does_not_follow_project_links` | No frontend change needed | ✅ **Fixed — highest-severity item on this whole tracker is closed**, and guarded by a real regression test | Yes |
| CH2 | (Supporting leak) Project chat listing should only surface chats the viewer is allowed to see | **Not a leak, re-verified.** `Project.chats()` (`services/projects/project.py:275-283`) calls a DB query that joins every chat linked to the project, but then filters in Python to `row["user_id"] == self.userId` — only the caller's own chats are returned. If anything this is now *overly* restrictive: a chat explicitly `ChatShare`'d into the project by someone else also won't surface here | `projects-context.tsx`'s `loadProjectChats()` reflects whatever the endpoint returns — no frontend exposure issue | ✅ No leak (was a real concern under the old model, resolved by the rewrite) · note: project-shared chats may not appear in the project chat list at all, a UX gap not a privacy one | Yes |
| CH3 | Chat sharing is explicit and strictly view-only (no continue/edit/branch/delete by the recipient) | **Re-confirmed**, function moved to `services/organizations/router.py:451-495` (`/chat-shares`). Fork (`fork_shared_chat`, `service.py:927-947`) creates a genuinely new `Chatboard`; no endpoint lets a recipient write into the original. `ChatShareMode.editable` only gates whether forking is permitted, not in-place editing | `ChatShareOverlay.tsx`/`chat-shares.ts` — verified compliant | ✅ Verified compliant | Yes |
| CH4 | Only the original creator can unshare a previously shared chat | **Re-confirmed**, function moved to `services/organizations/service.py:865-875` `revoke_chat_share` — 403s unless `share.shared_by_user_id == user_id` | Publish/unpublish toggle only ever rendered for the viewer's own chats | ✅ Compliant | Yes |
| CH5 | What happens to chats when a project is deleted: all chats within it (private and shared) should be deleted with the project | **FIXED, re-verified.** `Project.delete()` (`services/projects/project.py:169-183`) now iterates every chat linked to the project and calls `chatRepository.soft_delete_chat()` for each, before soft-deleting the project itself | N/A — backend-only fix | ✅ Fixed — cascade delete is real now | Yes |
| CH6 | Scratch chats (outside any project) have no persistent memory and cannot be shared | **Evaluated for the first time, two spec violations found.** (1) `services/memory/scope.py:63-114` — a scratch chat's `MemoryScope` still includes the `"user"` kind in both `readableKinds`/`writableKinds`, backed by `UserMemory`, whose own docstring says "durable facts... shared by the user's Chat and Brain sessions" — directly contradicts "no persistent memory." (2) `create_chat_share` (`services/organizations/service.py:781-831`) has no check excluding a project-less chat from being shared — a scratch chat can be shared to another user today | `ChatShareOverlay.tsx` has no gating on whether a chat belongs to a project — matches the backend gap rather than guarding against it | ❌ Open — two new spec violations, not previously evaluated | No |

---

## 3. Projects

| # | Spec requirement | back-end-test2 reality | Frontend (current) | Status | Resolved |
|---|---|---|---|---|---|
| P1 | Project visibility types: **Private** (creator only) vs. **Shared** (explicitly added members) | **Changed since the last audit — real membership now exists.** `Project.create()` (`project.py:131`) hardcodes `visibility="private"` always; the `visibility` column is no longer exposed on `ProjectResponse`/`ProjectSummary` at all — sharing is now a genuine `ProjectMember` table (`models.py:45-57`) backing `inviteOne`/`inviteMany` (`project.py:320-336`) and read access (`requireAccess`: owner OR `isProjectMember`) | **Nothing calls it.** Grepped all of `front-end/src` — no caller of `/projects/{id}/invite`, `/invites`, or `/members` exists. `projects.ts:21-25` already has a comment acknowledging the old model is gone | ⚠️ Backend now implements this; frontend has no UI for it at all | No |
| P2 | Project membership is a simple list — any workspace member added can see/use everything in the project, no project-level roles | **Changed — backend endpoint now exists and works.** `GET /projects/{id}/members` (`router.py:134-136` → `project.py:338-348`) returns owner + all `ProjectMember` rows as `PersonResponse` | No frontend caller exists (old `ProjectMembersPanel` was removed, nothing replaced it) | ⚠️ No longer blocked on backend — this is now a frontend feature-build, not a backend gap | No |
| P3 | Shared → Private conversion is never allowed (restrict access by removing members instead) | **Spec framing no longer applies as written.** There is no reversible `visibility` toggle left at all — no `PATCH .../visibility` route exists on the project router. Sharing/unsharing is now per-member and individually revocable (see P5), not a single flip that could be reversed | `setProjectVisibility()` (`projects.ts:301-...`) is confirmed dead code calling a route that no longer exists at all (not just renamed) | ✅ Not applicable to the current model — recommend retiring this row rather than carrying the old framing forward | Yes |
| P4 | Deleting a project: any Owner/Admin can delete a shared one, only the creator can delete a private one; agents stop running, outputs persist in workspace history | **FIXED at the backend, exactly matching spec.** `requireDelete` (`project.py:77-92`, added 2026-08-29): owner can always delete; a non-owner can delete only if the project has ≥1 `ProjectMember` AND has an `organization_id` AND the caller is Admin/Owner in that org. A private (no-member) project 404s to an admin. Verified by `test_requireDelete_allows_org_admin_on_shared_project`/`test_requireDelete_hides_private_project_from_admin` | **Fixed.** The frontend has no per-project membership signal (P1/P2 aren't wired up yet), so it can't tell a shared project from a private one client-side — the delete guardrail (`projects-context.tsx`'s `deleteProject`) and the two UI gates (`projects/page.tsx`'s `canDeleteProject`, `project/[id]/page.tsx`'s `canDeleteProject`) now allow the attempt whenever the caller owns the project OR is an org Admin/Owner acting on a project in their own org; the backend's `requireDelete` remains the real authority and still 404s (surfaced as an error toast) if the project turns out to be genuinely private | ✅ Fixed — frontend now defers to the backend's actual rule instead of a stricter ownership-only check | Yes |
| P5 | Removing a member from a shared project: their private chats there become inaccessible to them, their previously-shared chats remain visible to others | **FIXED at the backend, exactly matching spec.** `removeMember` (`project.py:350-368`): owner-only, can't remove self; for each project-linked chat owned by the removed member, checks for a `ChatShare` row — no share found → unlinked (inaccessible); share found → link preserved (stays visible) | Unreachable — depends entirely on P1/P2's UI, which doesn't exist | ⚠️ Backend logic is correct and complete; currently dead capability since nothing calls it | No |

---

## 4. Connectors

| # | Spec requirement | back-end-test2 reality | Frontend (current) | Status | Resolved |
|---|---|---|---|---|---|
| CO1 | Connections are workspace-wide — never scoped by project or member | **Re-confirmed.** `ConnectorAccount` (`services/connectors/models.py:74-157`) has only `auth0_id` XOR `organization_id` — no `project_id`, no team concept, no per-project/member field anywhere | `connectors.ts`/`org-connectors.ts`/`connectorsUnified.ts` — 2-value scope enum, matches | ✅ Matches | Yes |
| CO2 | No per-project/per-member credit allocation (deferred to enterprise) | **Re-confirmed.** No credit/budget/allocation field anywhere on `ConnectorAccount` | Not implemented (nothing to remove) | ✅ Matches | Yes |
| CO3 | No connection-level approval workflows — all connections available to all workspace members | **Re-confirmed.** `ConnectorAccount.status` (`models.py:134-138`) is only `active`/`disabled`/`expired` — no pending-approval state anywhere | `org-connectors.ts:6-9` correctly documents this | ✅ Matches | Yes |
| CO4 | Team-scoped connector sharing removed entirely | **Re-confirmed.** No team-scoped connector routes or joins anywhere | Team-connector functions already deleted from `org-connectors.ts` | ✅ Matches | Yes |
| CO5 | `GET /organizations/{id}/connectors/{slug}/used-by` — what surface(s) can lose access if a shared connector is removed | **Re-confirmed, still coarse.** `Organization.connectorUsedBy()` (`organization.py:635-649`) only ever returns a single hardcoded `surface="organization"` entry — no per-automation/per-persona enumeration | `surface` typed as plain `string` already, tolerant of this | ✅ No frontend change needed | Yes |
| CO6 | *(Backend hygiene, not frontend-facing)* | **Still unresolved, re-confirmed.** `test_automation_permission_contract.py:78` still calls `inspect.getsource(service.unlink_team)`, which still doesn't exist (only `unlink`, line 820) — will error on test collection | N/A | ❌ Open — flag to backend team, doesn't block frontend work | No |
| CO7 | **Spec conflict**: Workspace Model v2 (Owner/Admin manage Connections) vs. the newer Connections v1 UX doc (no role gating at all) | **Still open, mechanism detail corrected.** Connector-account mutations (`organizations/router.py:190-252`) use only `Depends(get_current_user)` at the route level — the actual gate is `self.requireAdmin()` called *inside* `Organization.connectorAccounts`/`createConnectorAccount`/etc. (`organization.py:562-649`), unchanged by the recent permissions commit. Functionally identical outcome (non-admins still 403) to what was previously described, just via a different code path than `require_organization_admin` | FE-only fix from the previous pass (hide/disable "Shared" for non-admins in `SetupModal.tsx`/etc.) still matches current backend behavior. **Minor correction needed**: `ConnectorsExperience.tsx:65-70`'s comment cites `require_organization_admin` in `router.py` as the gate — should cite `Organization.requireAdmin()` in `organization.py` instead | ✅ FE fix still correct · ⚠️ underlying spec conflict unresolved, comment inaccuracy to fix | Partial |
| CO8 | 22-story end-to-end connector flow should be reflected in the real Connectors page | Not independently re-checked this pass beyond CO7 — no new evidence contradicting the prior "wired to real data" finding | N/A | ✅ Already matches | Yes |

---

## 5. Personas / Agents

| # | Spec requirement | back-end-test2 reality | Frontend (current) | Status | Resolved |
|---|---|---|---|---|---|
| AG1 | Agents follow the same flattened workspace model as Projects/Chats — no Team dependency | **Re-confirmed.** `PersonaRepo` (`services/persona/models.py:10-45`) carries `visibility` + `organization_id` — same flattened shape as Project | No frontend change needed | ✅ Already flattened | Yes |
| AG2 | Per the Project Chat Model spec, Agents live *inside* Projects — project members create/run agents within that project's context, and project membership governs who can use them | **Changed — a real relationship now exists, but the spec still isn't met, plus a new leak.** `ProjectPersona` (`services/projects/models.py:59-70`) with real routes (`GET/POST/DELETE /projects/{id}/personas[/{repo_id}]`). But: (1) attach/detach is owner-only, not member-accessible; (2) **new leak** — `Project.personas()` (the list read, reachable by any project member) loads each attached repo with no `resource_visible` check at all, exposing the full system prompt of a private persona to any project member; (3) actually *using* a persona (chatting with it) still gates purely on `require_owned_repo` — project membership grants no usable access, only leaks metadata | `ProjectAgentsPanel`/`personasForTeamContext()` still do the old workaround (show every org-shared agent) — the new endpoints aren't called at all | ❌ Open — backend groundwork laid, spec still unmet, plus an unrelated new privacy leak in the new code | No |
| AG3 | Shared → Private conversion rules for a resource a member owns | **Backend enforcement now real** (`repo_service.setVisibility`, `repo_service.py:321-348`, blocks shared→private with 400) — the *old* finding (unenforced reversal) is fixed. **But found and fixed a more severe, unrelated live bug 2026-08-30**: the frontend sent `visibility: "org"` (wrong — real enum is `"private"\|"shared"`) on every persona/chat visibility write, so sharing an agent or chat always 400'd, **and** the read-side zod schema only accepted `"private"\|"org"` — meaning fetching the personas list would **throw and break the sidebar/`/agents`/search/project panel entirely** for any org with even one already-shared agent | Fixed: `personas.ts`, `persona-repo.ts`, `chat.ts`, `persona-schemas.ts`'s enum, and the dead reference in `projects.ts`, all corrected to `"shared"` | ✅ Backend reversal-block confirmed working · ✅ Frontend wire-format crash-risk bug fixed 2026-08-30 | Yes |
| AG4 | Agent sharing ("Super Link" / persona-shares) should work the same regardless of Team's removal | **Re-confirmed.** No org/team column anywhere on `PersonaShare`/`PersonaShareRecipient` | `persona-shares.ts` already flat | ✅ Already flattened | Yes |
| AG5 | Workspace Model v2: all three roles get "full product access... Create Projects, Agents, and run workflows" — no role differentiation on product actions | **FIXED.** `require_owned_repo` (`repo_service.py:309-318`) is now just `repo.user_id == user_id OR isPersonaMember(repo_id, user_id)` — no org-role check anywhere in `services/persona` at all (grepped in full). The Member-vs-Admin asymmetry is gone because the mechanism that caused it no longer exists | No frontend change needed | ✅ Fixed | Yes |
| AG6 | Internal consistency: whatever governs edit rights on an org-owned agent should govern visibility changes too | **FIXED.** `setVisibility` (`repo_service.py:321-348`) is gated by the exact same `require_owned_repo` used by every editing route — one authorization model now, not two | No frontend change needed | ✅ Fixed | Yes |
| AG7 | Creating a new agent — open to any org member, no role gate | **Re-confirmed.** `POST /persona` depends only on `get_current_user` | No frontend change needed | ✅ Matches | Yes |
| AG8 | Agent sharing ("Super Link") authorization | **FIXED, broader than the spec strictly requires.** `revoke_share` (`persona_share/service.py:338-350`) now gates on `require_owned_repo` (owner OR any invited editor), not the original sharer specifically. Confirmed by `test_an_invited_editor_can_revoke_a_super_link` | No frontend change needed — revoke call already just posts the share id | ✅ Fixed | Yes |
| AG9 | "Team" terminology fully dead in persona/persona-shares | **Re-confirmed.** Only comments/docstrings/one test placeholder string remain | N/A | ✅ Confirmed dead, cosmetic only | Yes |

---

## 6. Stripe (Billing) / Pins / Highlights / Users

| # | Spec requirement | back-end-test2 reality | Status | Resolved |
|---|---|---|---|---|
| ST1 | Owner-only billing mutations: manage plan/payment, spend cap, checkout, portal | **Re-confirmed, code moved.** `StripeAccount` (`services/stripe/account.py`, replaces the deleted `service.py`) is now the sole actor; `requireOwner()` gates every mutating method (`checkout`, `updatePlan`, `cancelPlan`, `resumePlan`, `portal`) | ✅ Matches | Yes |
| ST2 | Admin: "Billing — No access at all" | **Fixed on the main endpoint, residual leak found on a sibling one.** `GET /stripe/billing` (`account.py:168`) now returns an empty `BillingInfo` for any non-owner — the old "Admin sees full enterprise view" bug is gone. **But** `GET /organizations/{id}/plan` (`organization.py:515` → `visiblePlan()`, line 529) only zeroes `plan_type`/pool-cap/USD-cost/token fields for Admin — `plan_credits`/`topup_credits`/`total_credits`/`used`/`remaining`/`percent_used`/`pool_status`/the full `members` list (with everyone's usage) are all left real. Admin can still read the org's live wallet balance and every member's usage through this route | ❌ Open (narrower than before) — `/stripe/billing` fixed, `/organizations/{id}/plan` still leaks real credit/usage/member data to Admin | Partial |
| ST3 | Admin/Member: "Billing — No access" | **Fixed on the main endpoint, one residual leak.** On `/stripe/billing`, Admin and Member now get identical, fully-empty billing info. On `/organizations/{id}/plan`'s `visiblePlan()`, a plain Member additionally has credits/members zeroed (restricted to self) but **`pool_status` (healthy/warning_95/paused) is not zeroed** — a Member still learns the org's spend-health signal | ⚠️ Partial — narrower leak than before, `pool_status` still visible to Member on the org plan endpoint | Partial |
| ST6 | *(New this pass, fixed 2026-08-30)* Frontend billing-section visibility should distinguish Admin from Member | **Removed rather than fixed in place.** The `adminBillingPerms` concept was entirely frontend-fictional — confirmed zero backend equivalent — so the "Admin permissions" toggle panel was deleted outright instead of wired to a real check. Payment/Invoice-history sections on the org billing view are now gated on `isOwner` directly, matching what the backend actually enforces (`/stripe/billing` already returns empty for any non-owner) | ✅ Fixed — dead panel removed, real `isOwner` gate in its place | Yes |
| ST7 | *(New this pass, fixed 2026-08-30)* "Buy credits" / top-up purchase flow | **Confirmed dead end-to-end, then removed.** `chargeTopUp()`/`createTopUpSession()` posted to `/stripe/topup(/charge)` — no such route exists anywhere in `back-end-test2`. Removed the "Buy credits" button from both the org and individual billing views, the now-fully-orphaned `BuyMoreCreditsModal`/`components/BuyCreditsModal`, and the dead `chargeTopUp`/`createTopUpSession` functions + their endpoint constants, rather than leaving a disabled button as a placeholder | ✅ Fixed — dead purchase flow removed end-to-end (UI, modal, API functions, endpoint constants) | Yes |
| ST4 | "Org tier is dropped, Workspace is the sole boundary" | **Still true, cosmetic, unchanged.** `PlanType.teams`/`teams_tier`/`STRIPE_PRICE_TEAMS` naming still pervasive across `stripe/account.py`, `stripe/catalog.py`, `users/models.py` | ⚠️ Cosmetic — functions correctly, needs a naming decision only | Partial |
| ST5 | A plan-less org should never show as subscribed to a paid tier | **Backend confirmed correct at all three resolution sites** (`stripe/account.py::getPlan()`, `organizations/service.py::get_plan()` line 473-477, `organization.py::to_organization_response_with_owner()`) — none hardcode `"teams"`; all correctly return `None`/no-plan when no real subscription exists. This contradicts a stale code comment left in `plans-and-billing/page.tsx` claiming the org `/plan` endpoint defaults to `"teams"` unconditionally — that claim is false for `back-end-test2`. The frontend's `hasPlan = isEnterprise \|\| totalCredits > 0` guard doesn't key off `plan_type` anyway, so it's correct and not redundant with anything | ✅ Frontend fix from the previous pass remains correct and necessary · stale code comment should be corrected | Yes |
| PH1 | Pins & Highlights should be personal artifacts, unaffected by the Team removal | **Re-confirmed.** Both scoped to `user_id` only, zero role gating on either router | ✅ No changes needed | Yes |
| US1 | Users should carry no leftover Team/org-role fields | **Re-confirmed.** No org/role field on any user-facing schema | ✅ No changes needed | Yes |

---

## 7. Workspace & Organization (catch-all)

**This section had the single biggest gap between the stale tracker and reality.** `back-end-test2` has a dedicated commit (`20cab0a1`, "enhance organization permissions and member management features") plus 280+ lines of new permission tests (`test_organization_permissions.py`) that post-date everything the old tracker saw — every W6–W11 finding below flips from "open, serious" to "fixed."

| # | Spec requirement | back-end-test2 reality | Frontend (current) | Status | Resolved |
|---|---|---|---|---|---|
| W1 | Workspace is the sole commercial/org boundary; "org tier" dropped | **Re-confirmed, unchanged.** Still literally `Organization` everywhere in code identifiers | "Workspace" in user-facing copy only, deliberate | ✅ Cosmetic-only, confirmed intentional | Yes |
| W2 | Three fixed roles: Owner / Admin / Member, per-workspace | **Re-confirmed, unchanged.** 4-value enum (`owner`/`admin`/`member`/`service`); `resolve_role` folds `service` into Member | `OrgRole` type matches the 3 user-facing roles | ✅ Aligned | Yes |
| W3 | Teams entity removed entirely | **Re-confirmed via migration.** `alembic/versions/f8a1c3e5b7d9_flatten_org_drop_teams.py` exists; no Team model/route remains in `services/organizations/*`. (Frontend still has `lib/api/teams.ts`/`types/teams.ts` as file names — naming only, not a live Team entity) | Dead Teams UI already removed | ✅ Done | Yes |
| W4 | Invites are workspace-level, not team-scoped | **Re-confirmed, unchanged.** `OrganizationInvite` has no team scoping, only optional `project_id` | `inviteMembers()` already flat | ✅ Matches | Yes |
| W5 | Invite preview/accept | **Re-confirmed, unchanged.** Routes still `/org-invite/*`, return `OrganizationResponse` | Endpoint wiring correct; internal naming (`getTeamInviteOnboarding`) still says "Team", cosmetic | ✅ Endpoint fixed · ⚠️ naming still cosmetic | Partial |
| W6 | Member: "Billing — No access" | **FIXED — via response-filtering, not endpoint-gating.** `GET /organizations/{id}/plan` is still open to any member, but `Organization.plan()` now passes the response through `visiblePlan()` (`organization.py:529-560`): Member gets billing zeroed AND aggregate usage zeroed AND `members` filtered to `[self]` only. Confirmed by `test_visiblePlan_member_sees_only_self`. Minor residual: `pool_status`/`billing_model` are not redacted for any role (low-sensitivity strings, see ST3) | No frontend change needed | ✅ Fixed | Yes |
| W7 | Member: "View own usage and project-level usage..." only, not org-wide | **FIXED.** `Organization.members()` (`organization.py:226-268`): `showAllUsage = isinstance(self.role, Admin)`; a plain Member's per-member `usage_total` is `None` for every member except themself. Applies uniformly across `/members`, `/members/admins`, `/members/regular`. Confirmed by tests | No frontend change needed | ✅ Fixed | Yes |
| W8 | "Only Owners can change roles" — Admin cannot promote to Admin or Owner | **FIXED, more strictly than required.** `setRole()` now calls `requireOwner()` unconditionally — Admin cannot change ANY role, not just the promote-to-owner case. Confirmed by `test_setRole_admin_forbidden` | No frontend change needed | ✅ Fixed | Yes |
| W9 | Admin: "Invite and remove Members" — not Admins | **FIXED.** `invite()`: `role==owner`→400; `role==admin`→`requireOwner()`; else→`requireAdmin()`. Re-enforced identically in the new LLM tool surface (`tools.py:380-387`). Confirmed by tests | No frontend change needed | ✅ Fixed, defense-in-depth | Yes |
| W10 | Admin: removes Members, implicitly not other Admins | **FIXED.** `removeMember()`: base gate `requireAdmin()`; owner target→400; admin target→additional `requireOwner()`. Confirmed by `test_removeMember_admin_cannot_remove_admin` | No frontend change needed | ✅ Fixed | Yes |
| W11 | Owner-only: "Configure workspace settings (name, logo, timezone)" — Admin excluded | **FIXED.** Both `Organization.update()` and `updateSettings()` now call `requireOwner()`. Read-only `GET /settings` correctly remains member-accessible. Confirmed by `test_update_and_settings_require_owner` | No frontend change needed | ✅ Fixed | Yes |
| W12 | "Delete workspace (Primary Admin only)" — an internal flag on one Owner | **Re-confirmed, unchanged.** No flag; single-owner enforced via a DB partial-unique index instead. Not a deviation, just a different mechanism | N/A | ⚠️ Structural difference, not exploitable | Partial |
| W13 | Confirmed matches, no gaps | **Re-confirmed, unchanged and correct**: transfer-owner Owner-only, pool-cap Owner-only, usage/pool-status/audit reads Admin-gated, audit log correctly scoped to own actions for non-admins. **New**: Connectors/Slack integration endpoints confirmed uniformly Admin-gated (`self.requireAdmin()`, `organization.py:562-649`), matching spec; the new LLM tool surface (`tools.py`) mirrors the same HTTP permission model correctly for every tool | — | ✅ No action needed | Yes |
| W14 | Proposed (not yet spec'd): collapse 3 roles to 2 | **Structural blockers re-confirmed unchanged** — pool-cap/transfer-owner/delete are still hard Owner-only gates. Not a compliance item, just a live conversation topic | Not started, explicitly not recommended as a cosmetic-only stopgap | 🔒 Held | No |

**New, minor findings not mapped to any existing row:**
- The org owner's `name`/`email` are visible in `OrganizationResponse` to every caller regardless of role (`to_organization_response_with_owner`) — org-identity info, not billing/usage, so not a spec violation, but worth a footnote.
- `pool_status`/`billing_model` are not redacted by `visiblePlan()` for any role — low-sensitivity strings, cross-referenced under ST3/W6.

---

## 8. Remaining services — Brain, Automations, Memory, LLM, Internal/Sandbox, Doc Design, Slack, Templates, Docx

Re-swept every service directory in `back-end-test2` against the same method as before: full router read, every `Depends(...)` traced to its real check, fresh case-insensitive "team" grep.

| # | Service | back-end-test2 reality | Status | Resolved |
|---|---|---|---|---|
| RS1 | **Brain** | Re-confirmed clean. All routes `get_current_user` only; ownership re-checked via `chat.user_id` comparisons | ✅ No changes needed | Yes |
| RS2 | **Automations** | Re-confirmed clean. `ownedOr404()` gates every user route; webhook HMAC-verified. `team_id` hits are all Slack's own workspace id | ✅ No changes needed | Yes |
| RS3 | **Memory** | Re-confirmed clean. Org scope always server-derived from the caller's own membership, never client-supplied | ✅ No changes needed | Yes |
| RS4 | **LLM** | Re-confirmed clean. All routes scoped by `user_id` | ✅ No changes needed | Yes |
| RS5 | **Internal/Sandbox** | Re-confirmed isolated. No `get_current_user` dependency at all — every route resolves a per-run capability token via Redis, unreachable by a normal user JWT | ✅ Correctly isolated | Yes |
| RS6 | **Doc Design** | Re-confirmed clean/defensible. Org reads member-accessible, org mutations Admin-gated (judgment call, not a violation) | ✅ No changes needed | Yes |
| RS7 | **Slack — install/oauth/status/link/webhooks** | Re-confirmed correct, same known onboarding gap (tracked under O1, not here). `/events`/`/interactivity` both HMAC-signature-verified | ✅ No changes needed | Yes |
| RS8 | **Slack — org channel-binding GET is over-gated** | Re-confirmed, unchanged. Read-only channel-binding lookup still requires `require_organization_admin`, same as the mutations — stricter than spec needs for a plain read | ❌ Open — read-only endpoint over-gated relative to spec | No |
| RS9 | **Slack — genuine Team leftover** | Re-confirmed, unchanged. `SlackAgentAccount.team_id` still always `None`, still dead | ❌ Open — flag to backend team, same category as CO6 | No |
| RS10 | **Templates** | **Changed since the last audit, still compliant.** Now has a real `organization_id` column, stamped server-side at creation. `readable()` permits any org member equal access (no role check) in addition to the creator — matches spec's "equal product access." `listMine()` still only lists the caller's own creations, so org-mates can open a shared template via direct link but it won't appear in their own list — a UX gap worth confirming intent on, not an access-control bug | ✅ Still compliant, description updated to reflect new org-scoping | Yes |
| RS11 | **Docx** | Re-confirmed clean. All routes `get_current_user`, keyed by caller's own session | ✅ No changes needed | Yes |

---

## 9. Resolution Detail — How Each Item Was (Partially) Resolved, and What's Left

Companion to the "Resolved" columns above.

### Onboarding

| # | Resolved | How resolved / partially resolved | What it still needs | Remarks |
|---|---|---|---|---|
| O1 | No | — | Backend must let a brand-new signup start Slack install without a pre-existing org | Confirmed still real; a backend fix was drafted then reverted per explicit "no backend edits" instruction |
| O2 | Partial | Empty-field validation + Next-disabled wired | Backend soft-fail-then-advance on save failure not fixed | Revisit if silent data loss is reported |
| O2a | Yes | `workspace/page.tsx` resolves org id via `listOrganizations()` instead of the permanently-null `user.orgId` | Nothing | — |
| O2b | Yes | `workspace/page.tsx` and `profile/page.tsx` now call `refreshUser()` before navigating onward | Nothing | Root cause: backend silently completes onboarding mid-flow (see `services/users/repository.py:501-502`); this was the actual cause of a reported production DDoS-shaped redirect loop |
| O3 | Partial | Role list corrected to spec; inline validation + Next-disabled wired; `refreshUser()` added | Same soft-fail-then-advance gap as O2 | — |
| O3a | Yes | Added Tone dropdown, reusing the existing `TONE_API_MAP` | Nothing | Deliberate spec deviation, confirmed with user |
| O4 | Yes | Rewrote invite entry to chip UI, added regex email validation | Nothing | Most robust of the onboarding steps |
| O5 | Yes | Verified existing `add-to-slack-modal` works | Nothing | — |
| O6 | Yes | Fixed `teams.ts` reading `organization_member_count`/`organization_members` (nonexistent) instead of `member_count`/`members` (real) | Nothing | Confirmed independently by two separate audit passes |
| O7 | Yes | Confirmed A1 components reused as-is | Nothing | — |
| O8 | No (held) | — | `GET /org-invite/{id}` needs to allow anonymous access | Explicitly held per user instruction |
| O9 | No | — | Backend needs an existing-account signal on `InvitePreview` | Distinct from the O6 field-name bug — this is a genuinely missing field, not a wrong name |

### Chats

| # | Resolved | How resolved / partially resolved | What it still needs | Remarks |
|---|---|---|---|---|
| CH1 | Yes | Backend rewrote `chat_readable_by_user` to check the chat's own visibility, not just project visibility, with a regression test guarding it | Nothing | Was the highest-severity item on the tracker — now closed |
| CH2 | Yes | Confirmed `Project.chats()` already filters to the caller's own chats only | Nothing | Arguably over-restrictive (shared chats may not surface) — product question, not a bug |
| CH3 | Yes | Re-verified fork-only sharing, function relocated but logic unchanged | Nothing | — |
| CH4 | Yes | Re-verified owner-only revoke, function relocated but logic unchanged | Nothing | — |
| CH5 | Yes | Backend's `Project.delete()` now cascades to soft-delete linked chats | Nothing | Was a pre-existing correctness bug — now fixed |
| CH6 | No | — | Backend needs to exclude scratch chats from persistent `"user"` memory scope, and block sharing a project-less chat | First evaluation this pass — two real spec violations found |

### Projects

| # | Resolved | How resolved / partially resolved | What it still needs | Remarks |
|---|---|---|---|---|
| P1 | No | Backend now has real per-project membership (`ProjectMember`) | Frontend UI to invite/view members on a project — a feature build, not a bug fix | No longer blocked on backend |
| P2 | No | Backend `GET /projects/{id}/members` works today | Frontend caller — none exists | Same as P1 |
| P3 | Yes | N/A — spec requirement doesn't map onto the current model (no reversible visibility flip exists at all) | Nothing | Recommend rewriting this row's framing next pass |
| P4 | Yes | Delete guardrail and both UI gates now allow an org Admin/Owner to attempt deleting a same-org project they don't own, not just the owner | Nothing — the backend's `requireDelete` is the real authority and still correctly 404s a genuinely-private project | Frontend can't distinguish shared vs. private client-side (no membership signal yet), so it defers to the backend rather than trying to replicate its exact rule |
| P5 | No | Backend's `removeMember()` correctly handles the private/shared chat split described by spec | Frontend UI to actually remove a member (blocked on P1/P2) | Backend logic verified correct, just unreachable |

### Connectors

| # | Resolved | How resolved / partially resolved | What it still needs | Remarks |
|---|---|---|---|---|
| CO1–CO6 | Yes / No (CO6) | Re-verified unchanged from previous pass | CO6: backend must fix the dead `unlink_team` test reference | — |
| CO7 | Partial | FE fix from the previous pass still correct against current backend behavior | A product decision on which spec doc backend should implement; a stale code comment naming the wrong gate mechanism should be corrected | — |
| CO8 | Yes | Not re-litigated, no contradicting evidence found | Nothing | — |

### Personas / Agents

| # | Resolved | How resolved / partially resolved | What it still needs | Remarks |
|---|---|---|---|---|
| AG1 | Yes | Re-confirmed unchanged | Nothing | — |
| AG2 | No | Backend built a real `ProjectPersona` relationship | Frontend must wire `ProjectAgentsPanel` to the real endpoints; backend must add a `resource_visible` check to `Project.personas()` (currently leaks private prompts to project members) | Two independent gaps bundled in one row — a feature build and a backend leak |
| AG3 | Yes | Backend's shared→private block confirmed working; frontend's `"org"`→`"shared"` wire-format bug fixed 2026-08-30 across `personas.ts`, `persona-repo.ts`, `chat.ts`, `persona-schemas.ts`'s enum, and the dead reference in `projects.ts` | Nothing | The wire-format bug was a genuine crash risk (personas list fetch would throw for any org with a shared agent), independent of and more severe than the original finding |
| AG4 | Yes | Re-confirmed unchanged | Nothing | — |
| AG5 | Yes | Backend removed the mechanism that caused the Member-vs-Admin asymmetry entirely | Nothing | — |
| AG6 | Yes | Backend now uses one authorization model (`require_owned_repo`) for both edit and visibility | Nothing | — |
| AG7 | Yes | Re-confirmed unchanged | Nothing | — |
| AG8 | Yes | Backend broadened revoke to owner-or-any-invited-editor, confirmed by test | Nothing | — |
| AG9 | Yes | Re-confirmed unchanged | Nothing | — |

### Stripe / Pins / Highlights / Users

| # | Resolved | How resolved / partially resolved | What it still needs | Remarks |
|---|---|---|---|---|
| ST1 | Yes | Re-confirmed on the new `StripeAccount` actor class | Nothing | Code moved (`service.py` deleted, split into `account.py`/`catalog.py`/`webhooks.py`), behavior unchanged |
| ST2 | Partial | `/stripe/billing` now correctly empty for non-owners | `/organizations/{id}/plan`'s `visiblePlan()` must also zero credits/usage/members for Admin, not just billing fields | Same info-disclosure category as W6, narrower than before |
| ST3 | Partial | `/stripe/billing` now identical (empty) for Admin/Member | `/organizations/{id}/plan` must also zero `pool_status` for Member | — |
| ST4 | Partial | N/A | Rename `teams`/`team_*` identifiers if a terminology pass ever happens | Cosmetic only |
| ST5 | Yes | Confirmed correct at all three backend resolution sites, not just frontend | Nothing | Stale code comment claiming a backend hardcoding bug should be corrected |
| ST6 | Yes | Deleted `AdminPermissionsPanel`/`PERM_ROWS`, the `adminBillingPerms` state/effect/handler, and the type from `types/teams.ts`/`organization.ts`; Payment/Invoices sections now gated on real `isOwner` | Nothing | User chose removal over building a real permissions UI on top of a concept the backend doesn't have |
| ST7 | Yes | Deleted the "Buy credits" button (both billing views), `BuyMoreCreditsModal`, `components/BuyCreditsModal`, `chargeTopUp`/`createTopUpSession` and their endpoint constants | Nothing | User chose removal over a disabled placeholder; a real topup flow would need a backend endpoint that doesn't exist today |
| PH1 | Yes | Re-confirmed unchanged | Nothing | — |
| US1 | Yes | Re-confirmed unchanged | Nothing | — |

### Workspace & Organization

| # | Resolved | How resolved / partially resolved | What it still needs | Remarks |
|---|---|---|---|---|
| W1–W5 | Yes / Partial (W5) | Re-confirmed unchanged | W5: cosmetic naming cleanup only | — |
| W6 | Yes | Backend's `visiblePlan()` zeroes billing + usage + member list for Member | Nothing (minor: `pool_status`/`billing_model` not redacted for any role — low sensitivity) | Fixed via response-filtering, not endpoint-gating |
| W7 | Yes | `Organization.members()` nulls out other members' usage for non-admins | Nothing | — |
| W8 | Yes | `setRole()` now requires Owner unconditionally | Nothing | Stricter than the spec's minimum requirement |
| W9 | Yes | `invite()` requires Owner specifically for admin-role invites | Nothing | Also enforced in the new LLM tool surface |
| W10 | Yes | `removeMember()` requires Owner to remove an Admin | Nothing | — |
| W11 | Yes | `update()`/`updateSettings()` now require Owner | Nothing | — |
| W12 | Partial | Single-Owner invariant enforced via DB constraint | Formalize a true primary-designation if multi-Owner is ever introduced | Not currently exploitable |
| W13 | Yes | Re-confirmed unchanged and correct; new Connectors/Slack/LLM-tool gating also confirmed correct | Nothing | — |
| W14 | No (held) | — | Structural Owner-only gates would need relaxing first | Not a formal spec item |

### Remaining services

| # | Resolved | How resolved / partially resolved | What it still needs | Remarks |
|---|---|---|---|---|
| RS1–RS7 | Yes | Re-confirmed unchanged and clean | Nothing | — |
| RS8 | No | — | `GET .../slack/.../channel` (read-only) should not require `require_organization_admin` | Unchanged, still open |
| RS9 | No | — | Remove the dead `SlackAgentAccount.team_id` field | Unchanged, still open |
| RS10 | Yes | Confirmed still compliant despite growing real org-scoping since the last audit | Nothing required; worth confirming `listMine()`'s own-creations-only behavior matches intended UX | Description updated to reflect the change |
| RS11 | Yes | Re-confirmed unchanged and clean | Nothing | — |

---

## Notes for next pass

- **The single biggest lesson from this pass**: never trust a backend-behavior claim in this doc without re-checking which repo it was actually read from. `back-end-test` and `back-end-test2` are different codebases that have diverged substantially — this correction should not need to happen a third time.
- P1/P2/P5 (real project-membership backend, unused by frontend) and AG2 (real project-persona backend, unused by frontend, plus a new leak) are the two biggest "backend moved on, frontend didn't" gaps — worth scoping as a single feature-build pass since they're likely related UI work (a project's "People" and "Agents" tabs).
- P4 resolved 2026-08-30 — `projects-context.tsx`'s delete guardrail and the two UI gates (`projects/page.tsx`, `project/[id]/page.tsx`) now let a same-org Admin/Owner attempt a delete they don't own; the backend's `requireDelete` stays the real authority.
- CH6's two new findings (persistent memory + shareability on scratch chats) need a product decision on whether the spec's "no memory, can't be shared" framing is still the intended design — this reads like it could also be a deliberate simplification the spec doc predates, not necessarily a bug.
- ST6/ST7 resolved 2026-08-30 — user chose removal over building/gating a non-functional feature. If a real per-project/per-role billing-permissions model or a working topup endpoint ever gets built server-side, both would need to be re-added from scratch, not restored from this code.
- AG3's frontend wire-format bug (`"org"` vs `"shared"`) is now fixed, but note in the fix comments that this exact wrong value was traced to a copy-pasted comment in the dead `projects.ts::setProjectVisibility()` — that function is worth deleting outright next time this area is touched, since it's now actively demonstrated to be a source of copy-paste bugs rather than a harmless reference.
- CO7's underlying spec conflict (Workspace Model v2 vs. Connections v1 UX doc) still needs a product decision — unchanged from before.
- RS8/RS9/CO6 remain the only three purely-backend-hygiene items outstanding; low severity, safe to batch into one small backend PR whenever convenient.
</content>
