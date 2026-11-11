# Brain — Production Test Plan
**Version:** 1.0 — May 2026
**Product:** Souvenir Brain (AI orchestrator)
**Prepared for:** Shyam · Gunal · Sahil
**Owner:** Chai Landge

---

## 0. How to use this document

This is the single source of truth for testing Brain before and after launch. It is split into four parts:

- **Part 1 — Tool Stack:** What to use and why. Research-backed decisions, not opinions.
- **Part 2 — Test Cases:** Every flow in Brain, written as runnable test cases. One TC per row.
- **Part 3 — Golden Dataset:** Fixed prompts you run through the real AI to score output quality. This is your regression baseline.
- **Part 4 — Monitoring Setup:** What to instrument in production so you catch what slips through.

**How to run tests:** Work through Part 2 top to bottom before any release. Mark each TC as ✅ Pass · ❌ Fail · ⚠️ Partial. File a Linear issue for every ❌ or ⚠️. Do not ship with open ❌ on Priority 1 or 2 cases.

**Priority legend:**
- **P1 — Blocker.** Cannot ship. Core flow broken.
- **P2 — Critical.** Must fix before launch. Significant feature broken.
- **P3 — Important.** Fix in first patch. Non-blocking edge case.
- **P4 — Nice to fix.** Polish, minor visual issues.

---

## Part 1 — Tool Stack

### Why you need three separate tools

No single tool covers everything. Each one watches a different layer.

| Layer | What it catches | Tool |
|-------|----------------|------|
| **Functional / E2E** | Does the UI work? Does clicking things do the right thing? | Playwright |
| **AI Evals** | Is the AI output actually good? Did a model change break quality? | Promptfoo (free) or Braintrust (paid) |
| **Production monitoring** | Errors, crashes, latency, user behaviour in real prod | Sentry + PostHog |

---

### Tool 1 — Playwright (E2E automation)

**What it is:** A browser automation library from Microsoft. You write scripts that open a real browser, click through the product, and assert that the right things happen. Catches regressions automatically — run it on every PR and before every release.

**Why not just do it manually?** Manual testing takes 2–3 hours per run. Playwright runs the same suite in 8 minutes. After your first manual pass, automate it so Shyam doesn't repeat the same clicks every release.

**How to use it for Brain:**
```bash
npm install -D @playwright/test
npx playwright codegen http://localhost:4000  # records your clicks as test code
npx playwright test                           # runs all tests
npx playwright test --headed                  # watch it run in a browser
```

**Key Playwright patterns for AI products:**
- Use `waitForSelector` generously — AI responses are async and slow.
- Test IDs beat CSS selectors. Add `data-testid` attributes to Brain's key UI elements (PlanCard approve button, ActivityBlock steps, NodeFailureCard actions).
- Record tests using the codegen tool rather than writing from scratch. You click through the flow once; it writes the script.

**What to automate first:** The P1 smoke tests in Part 2 (TC-01 through TC-08). These are your safety net. Automate them before you automate anything else.

**Cost:** Free. Open source. MIT license.

---

### Tool 2 — Promptfoo (AI output quality)

**What it is:** An open-source CLI that runs fixed prompts through your AI, scores the outputs against rubrics you define, and shows a pass/fail report. Used by OpenAI and Anthropic internally. Acquired by OpenAI in March 2026, still MIT-licensed.

**Why you need it:** The UI can work perfectly and the AI can still give garbage outputs. A model update, a prompt change, or a connector returning different data can silently degrade quality. Promptfoo catches this before users do.

**How to use it for Brain:**
```bash
npm install -g promptfoo
promptfoo init        # creates a config file
promptfoo eval        # runs your test suite
promptfoo view        # opens a web UI showing results
```

**A Brain eval config looks like this (`promptfooconfig.yaml`):**
```yaml
prompts:
  - "Analyze last month's Notion pages and find the top 3 product themes"

providers:
  - id: "your-brain-api-endpoint"
    config:
      apiKey: "{{SOUVENIR_API_KEY}}"

tests:
  - description: "Research task — Notion connector"
    assert:
      - type: llm-rubric
        value: "Did the response identify at least 3 distinct themes?"
      - type: llm-rubric
        value: "Did the plan have fewer than 7 steps?"
      - type: latency
        threshold: 8000   # fail if Brain takes more than 8s to return a plan
```

**Cost:** Free. Run it locally. No data leaves your machine.

**Upgrade path:** When you want a hosted dashboard, shared results, and CI integration → move to **Braintrust** ($0 starter, $249/month pro). Braintrust is the production-grade version of the same idea.

---

### Tool 3 — Sentry + PostHog (production monitoring)

**Sentry** catches crashes. When Brain throws an unhandled exception in production, Sentry captures the stack trace, the user context, and the exact state that caused it. You get a Slack notification before users can file a bug report.

**PostHog** catches behaviour. It records every phase transition, button click, and drop-off point. You can watch session replays of users who got stuck. It also now has LLM observability — you can track which AI calls are slow, expensive, or failing.

**Together they answer:**
- "Did anything break?" → Sentry
- "Where do users stop?" → PostHog
- "Is the AI getting slower or more expensive?" → PostHog LLM observability

**What to instrument in Brain (add these as PostHog events):**

| Event | When to fire | Properties |
|-------|-------------|------------|
| `brain_loop_started` | user sends first message | `{ personaId, hasSchedule, projectId }` |
| `brain_plan_shown` | PlanCard renders | `{ stepCount, hasConnectors, connectors[] }` |
| `brain_plan_approved` | user clicks Approve | `{ approvalCount, timeToApprove }` |
| `brain_plan_countered` | user clicks Counter | `{ approvalCount }` |
| `brain_execution_started` | phase → executing | `{ stepCount }` |
| `brain_node_failed` | NodeFailureCard renders | `{ stepId, connector, isCritical }` |
| `brain_fix_applied` | user clicks Apply fix | `{ stepId }` |
| `brain_loop_completed` | phase → complete | `{ totalSteps, doneCount, skippedCount, duration }` |
| `brain_loop_cancelled` | phase → cancelled | `{ atPhase }` |
| `brain_schedule_created` | schedule saved | `{ frequency, hasConnectors }` |
| `brain_schedule_run_completed` | scheduled run finishes | `{ status, stepCount, duration }` |

**Cost:** PostHog has a generous free tier (1M events/month free). Sentry has a free tier that covers most early-stage products.

---

### Tool 4 — Linear (test case tracking)

Each test case in Part 2 of this document should live as a Linear issue in a `Testing` project. Status = `Todo → In Progress → Done / Failed`. When a test fails, the issue gets a `Bug` label and moves to the current sprint.

**Workflow:**
1. Before a release, create a new Linear cycle called "Release QA — [date]".
2. Duplicate all P1 + P2 test cases into the cycle.
3. Assign them to Shyam / Gunal / Sahil.
4. Block the release until all P1/P2 issues are ✅.

---

## Part 2 — Test Cases

### How to read these

Each test case has:
- **TC-ID** — unique reference (use this in Linear)
- **Priority** — P1/P2/P3/P4
- **Flow** — which Brain phase or feature
- **Precondition** — what must be true before you start
- **Steps** — exactly what to do
- **Expected result** — what passing looks like
- **Known risk** — what typically breaks here

---

### Group A — Core Chat Loop (the happy path)

---

**TC-01** | P1 | Idle → Complete full loop
**Precondition:** Logged in. At least one connector (Notion or Linear) connected.
**Steps:**
1. Open Brain.
2. Type: "Summarize the last 5 pages added to Notion this week."
3. Submit.
4. Wait for thinking indicator.
5. If clarification appears → answer it and submit.
6. Review plan. Approve it.
7. Watch execution. Do not interact.
8. Wait for streaming narration to complete.
**Expected:** Artifact card appears. BrainResultHeader shows attribution. Thread shows complete phase. No crashes, no blank states.
**Known risk:** Streaming cuts off mid-sentence if the token stream drops.

---

**TC-02** | P1 | Plan approval — modify before approving
**Precondition:** Brain is in `planning` phase.
**Steps:**
1. When PlanCard appears, click "Counter" (or edit a step).
2. Modify one step's description.
3. Submit counter.
4. Verify Brain regenerates the plan with the modification.
5. Approve the new plan.
**Expected:** Revised plan reflects your change. Brain does not re-ask for clarification. Execution proceeds.
**Known risk:** Counter input not cleared after submit. Plan re-renders with stale step data.

---

**TC-03** | P1 | Clarification flow — multi-turn
**Precondition:** Send a vague message: "Help me with my research."
**Steps:**
1. Submit message.
2. ClarificationCard should appear with a question.
3. Answer the question.
4. If another clarification follows, answer it.
5. Proceed through to plan approval.
**Expected:** ClarificationSummary collapses each answered question. Brain eventually generates a focused plan based on your answers.
**Known risk:** Clarification summary renders answers in wrong order.

---

**TC-04** | P1 | Execution — all steps complete
**Precondition:** Plan approved with 5+ steps.
**Steps:**
1. Watch ActivityBlock as Brain executes.
2. Verify each step moves from pending → executing → complete in sequence.
3. Parallel steps (if any) should execute simultaneously.
4. Wait for phase → streaming.
**Expected:** All steps show complete checkmark. Spinner never gets stuck. Parallel connector logo rows appear next to parallel steps.
**Known risk:** Step stuck on "executing" forever if connector call hangs without timeout.

---

**TC-05** | P1 | Completion — artifact produced
**Precondition:** Loop that includes "Draft summary document" or similar writing step.
**Steps:**
1. Complete the loop.
2. Verify ArtifactCard appears after StreamingMessageBubble.
3. Click "Open" on the artifact.
**Expected:** Artifact title, source (Notion/report), and meta line all present. "Open" navigates to or previews the artifact.
**Known risk:** ArtifactCard renders with empty title when artifact metadata is missing from API response.

---

**TC-06** | P1 | Completion — external action card
**Precondition:** Loop that sends an email or creates a calendar event.
**Steps:**
1. Complete a loop with an external write action (e.g., "Send a summary email to kai@example.com").
2. After streaming completes, verify ExternalOutputCard appears.
3. Verify the connector logo, verb, target, and detail line are correct.
**Expected:** "Done in the world" header visible. Connector logo matches action. "View →" link present.
**Known risk:** ExternalOutputCard missing when loop ends via a scheduled run (not triggered manually).

---

**TC-07** | P1 | Undo external action
**Precondition:** Loop completes with an external write action.
**Steps:**
1. Observe ExternalOutputCard with undo countdown.
2. Verify countdown ticks from 5 → 0.
3. Separately, trigger a loop, and click "Undo" before countdown ends.
**Expected:** Action reversed (email not sent / event not created). ExternalOutputCard updates to show "Undone".
**Known risk:** Undo button does nothing if API call already confirmed before UI countdown ends.

---

**TC-08** | P1 | Loop cancel mid-execution
**Precondition:** Brain is executing (ActivityBlock visible).
**Steps:**
1. Click "Cancel" (or wait for PauseCard to appear and choose Cancel there).
**Expected:** LoopCancelledCard appears. Thread is visually terminated. No further API calls are made. Brain returns to idle.
**Known risk:** Cancel triggers but execution continues in the background (API call not actually cancelled).

---

### Group B — Interruptions and Failure Handling

---

**TC-09** | P1 | Node failure — critical step
**Precondition:** Force a connector failure on a critical step. (In dev: disconnect Notion. In prod: use a misconfigured connector.)
**Steps:**
1. Start a loop that uses the Notion connector.
2. Mid-execution, if possible, invalidate the Notion token.
3. Watch for NodeFailureCard.
**Expected:** NodeFailureCard appears for the failed step. "Skip" button is disabled (critical step). "Rerun" and "Cancel" are both active.
**Known risk:** Generic error state instead of NodeFailureCard when failure is an unhandled API timeout.

---

**TC-10** | P1 | Node failure — non-critical step, skip
**Precondition:** A loop with a non-critical step that can be forced to fail.
**Steps:**
1. Trigger failure on a non-critical step.
2. Click "Skip".
**Expected:** Skipped step is marked as skipped (grey). Execution continues to the next step. Final loop completion shows correct `skippedCount`.
**Known risk:** Skip increments `failedCount` instead of `skippedCount` in LoopHistoryCard.

---

**TC-11** | P2 | Fix proposal appears after failure
**Precondition:** Node failure on a step where Brain can self-diagnose (e.g., a search that returned 0 results).
**Steps:**
1. Observe NodeFailureCard.
2. Wait for FixProposalCard to appear below it.
3. Read the reasoning text.
4. If diffs are shown, verify Before/After values match the actual failed step.
5. Click "Apply fix".
**Expected:** FixProposalCard shows reasoning. Diffs show specific parameter changes. Apply fix re-runs the step with the new parameters.
**Known risk:** FixProposalCard appears even when Brain cannot actually diagnose the failure (shows reasoning like "I'm not sure").

---

**TC-12** | P2 | Stuck card — Brain cannot proceed
**Precondition:** Send a task that requires information Brain doesn't have and can't retrieve.
**Steps:**
1. Submit task.
2. Wait for StuckCard to appear.
**Expected:** StuckCard shows "I can't complete this step without more context." CTA "Tell me more" is clickable and opens an input.
**Known risk:** StuckCard never appears — Brain either hallucinates an answer or fails silently.

---

**TC-13** | P2 | Pause and resume
**Precondition:** Brain is in `executing` phase.
**Steps:**
1. Click pause (if a pause trigger is available in the UI).
2. Verify PauseCard appears with resume and cancel options.
3. Click "Resume".
**Expected:** Brain continues execution from where it paused. Steps already completed are not re-run.
**Known risk:** Resume triggers a full re-run from step 1.

---

### Group C — Confidence Signaling

---

**TC-14** | P2 | High confidence narration
**Precondition:** Complete a loop where Brain is confident (well-defined task, clear connector data).
**Steps:**
1. After streaming, check BrainNarration component.
**Expected:** Green dot visible to the left of narration text. No "double-check" CTA.
**Known risk:** Confidence prop not being set by the AI layer — always defaults to undefined (no dot shown).

---

**TC-15** | P2 | Low confidence narration
**Precondition:** Complete a loop with ambiguous input or sparse connector data.
**Steps:**
1. After streaming, check BrainNarration.
**Expected:** Amber dot visible. "Want me to double-check this step? [Yes, check again]" appears below narration.
2. Click "Yes, check again".
**Expected:** Brain re-verifies and updates the narration.
**Known risk:** "Yes, check again" fires onDoubleCheck callback but nothing happens (not wired to re-run).

---

### Group D — Scheduling

---

**TC-16** | P1 | Create a daily schedule
**Precondition:** Completed at least one loop.
**Steps:**
1. Open Schedules section.
2. Click "New schedule".
3. Name it "Morning Briefing".
4. Set frequency: Daily.
5. Set time: 8:00 AM.
6. Save.
**Expected:** Schedule appears in ScheduleListView with name, frequency, and next run time. No errors.
**Known risk:** Time zone not respected — schedule runs at 8:00 AM UTC regardless of user's local time.

---

**TC-17** | P1 | Create a weekly schedule
**Steps:**
1. New schedule → Weekly.
2. Select Monday and Wednesday.
3. Set time: 9:00 AM.
4. Save.
**Expected:** Both days visible in schedule row. Next run shows correct upcoming date.
**Known risk:** Multi-day selection saves only the last selected day.

---

**TC-18** | P2 | Edit a schedule
**Steps:**
1. Click edit on an existing schedule.
2. Change frequency from Daily to Weekly.
3. Select a day.
4. Save.
**Expected:** Schedule updates in list. Next run time recalculates.
**Known risk:** Edit modal pre-fills with wrong frequency (shows Daily when schedule is Weekly).

---

**TC-19** | P2 | Delete a schedule
**Steps:**
1. Click delete on a schedule.
2. Verify delete confirmation modal shows the schedule name.
3. Confirm delete.
**Expected:** Schedule removed from list. Modal closes. List is not empty (other schedules still visible).
**Known risk:** Delete modal shows generic "this schedule" instead of the schedule name.

---

**TC-20** | P2 | Schedule run history
**Steps:**
1. Click into a schedule that has at least one completed run.
2. Verify ScheduleDetailView shows run history.
3. Each run row should show: timestamp, status (✓ / ✗), and done/skipped/failed counts.
4. Click "View full thread →" on a run row.
**Expected:** Navigates to that run's full thread in the Brain chat.
**Known risk:** "View full thread →" link present but navigation is a no-op (not wired to router).

---

**TC-21** | P2 | Digest appears after scheduled run
**Precondition:** A schedule has run while the user was away. Simulate by running a schedule manually.
**Steps:**
1. After a scheduled run completes, navigate to BrainHome.
**Expected:** BrainDigestCard appears above the headline. Shows schedule name, run time, summary of what was done, and "View run →" link.
**Known risk:** Digest only appears if the user was logged out during the run. Does not appear for runs that happened while the user was active.

---

### Group E — Projects

---

**TC-22** | P1 | Create a project and run a loop inside it
**Steps:**
1. Create a new Brain project ("Souvenir Launch").
2. Click "New loop" inside the project.
3. Run a full loop to completion.
4. Navigate back to BrainProjectView.
**Expected:** The completed loop appears in the thread list with: query text, timestamp, ✓ status, step counts.
**Known risk:** Loop appears in global recents but not in the project's thread list.

---

**TC-23** | P2 | Project thread list — multiple loops
**Steps:**
1. Run 3 loops in the same project (one complete, one cancelled, one failed).
2. Open BrainProjectView.
**Expected:** All 3 loops visible. Status icons correct (✓ / ✗ / circle). Step counts correct for each.
**Known risk:** LoopRecord stats show 0 for all counts regardless of actual step outcomes.

---

**TC-24** | P2 | Project config panel
**Steps:**
1. Open a project.
2. Click the ⚙ settings button.
3. Change the project name.
4. Set a default persona.
5. Add a pin.
6. Save.
**Expected:** Config panel saves. Project header updates with new name. Next loop in this project pre-selects the saved persona.
**Known risk:** Save fires onSave callback but name does not update in the header until page refresh.

---

**TC-25** | P3 | Progressive delegation hint
**Precondition:** Approve 3 plans in a row without countering.
**Steps:**
1. Run 3 consecutive loops and approve each plan immediately.
2. On the 4th plan, check the PlanCard footer.
**Expected:** Caption text appears: "You've approved 3 plans without changes. Auto-approve similar tasks? [Set up]"
3. Click "Set up".
**Expected:** Callback fires. Hint disappears after click.
**Known risk:** approvalCount not persisted across loops — resets to 0 each time.

---

### Group F — Multi-loop Thread

---

**TC-26** | P2 | Multi-loop stacking
**Steps:**
1. Complete one loop.
2. Start and complete a second loop in the same thread.
3. Scroll up.
**Expected:** First loop is collapsed into a LoopRecord row. Second loop's full thread is visible. LoopRecord for loop 1 shows query, timestamp, ✓, and step counts.
**Known risk:** LoopRecord shows wrong query text (shows loop 2's query for loop 1).

---

**TC-27** | P3 | LoopRecord expand/collapse
**Steps:**
1. Click to expand a LoopRecord.
**Expected:** LoopHistoryCard animates open. Step list shows each step with status. Done/skipped/failed counts in the card header.
2. Click to collapse.
**Expected:** Collapses cleanly. No layout jump.
**Known risk:** Collapse animation causes a height flash (content visible for 1 frame after collapse).

---

### Group G — Navigation and Shell

---

**TC-28** | P1 | Sidebar: AccountMenu dropdown in Brain
**Steps:**
1. In the Brain shell, click the account trigger (avatar / name at the bottom of the sidebar).
**Expected:** AccountMenu dropdown opens above the trigger. Shows identity row (avatar, name, plan, credits). All 7 action items visible.
2. Click "Settings".
**Expected:** Dropdown closes. Settings callback fires.
3. Click the AbacusIcon (⊟) on the trigger directly.
**Expected:** onSettings fires AND dropdown opens.
**Known risk:** AbacusIcon click fires onSettings twice.

---

**TC-29** | P1 | Sidebar: collapse state preserves AccountMenu
**Steps:**
1. Verify sidebar is expanded. AccountMenu trigger shows name + plan.
2. Click the collapse button.
**Expected:** Sidebar collapses to icon-only. AccountMenu trigger shows only the avatar circle. Name and plan are hidden.
3. Click the avatar circle.
**Expected:** Dropdown still opens correctly in collapsed state.
**Known risk:** AccountMenu trigger does not respond to sidebar collapse — stays in fluid mode.

---

**TC-30** | P2 | ContextRail: persona and pins visible
**Steps:**
1. Select a persona before running a loop.
2. Pin at least one document.
3. Start a loop.
**Expected:** ContextRail (right panel) shows the active persona chip and the pinned documents.
**Known risk:** ContextRail shows empty state even when persona + pins are set.

---

**TC-31** | P2 | Section switching: Chat Board → Persona → Brain
**Steps:**
1. Click each section tab in the sidebar.
**Expected:** Content area updates for each section. No layout breaks. Active tab is highlighted.
**Known risk:** Brain section scroll position resets to top when switching away and back.

---

### Group H — Edge Cases (easy to miss)

---

**TC-32** | P2 | Connector failure: all connectors disconnected
**Precondition:** Disconnect all connectors.
**Steps:**
1. Submit a task that requires a connector.
**Expected:** Brain surfaces a clear error during planning ("I need access to [Connector] to complete this. Connect it in Settings."). Does not crash. Does not hallucinate results without the connector.
**Known risk:** Brain generates a plan and starts executing, then fails silently at the first connector step.

---

**TC-33** | P2 | Long user message (500+ characters)
**Steps:**
1. Paste a 500-character task description.
2. Submit.
**Expected:** No layout overflow. BrainNarration wraps correctly. PlanCard step labels truncate with ellipsis if too long.
**Known risk:** PlanCard overflows horizontally on long step labels.

---

**TC-34** | P3 | Empty plan (0 steps)
**Precondition:** Send a task so simple Brain produces a 0-step plan (e.g., "What is 2+2?").
**Expected:** PlanCard renders a graceful empty state or Brain skips to streaming directly without showing an empty step list.
**Known risk:** PlanCard renders with an empty ul and a visible gap in the layout.

---

**TC-35** | P3 | Credits badge: 0 credits
**Precondition:** Set credits to 0 in user account.
**Steps:**
1. Open AccountMenu dropdown.
**Expected:** Identity row shows "0 credits" badge. Not hidden. Not broken layout.
**Known risk:** CreditsBadge hides at 0 because of a `credits > 0` guard.

---

**TC-36** | P3 | BrainHome: no schedules, no digest (new user)
**Steps:**
1. Log in as a brand new user with no schedules or past runs.
**Expected:** BrainHome shows only: headline + suggestion cards. No schedule strip. No digest card. Suggestion cards have real content, not empty/loading.
**Known risk:** Schedule strip renders with zero items as an empty bar.

---

**TC-37** | P4 | Very long project name
**Steps:**
1. Create a project with a name longer than 50 characters.
**Expected:** Project name truncates with ellipsis in BrainProjectView header and ScheduleDetailView.
**Known risk:** Long name overflows the header container and overlaps the ⚙ button.

---

## Part 3 — Golden Dataset (AI Evals)

These are fixed inputs you run through the real Brain AI and score. They are your regression baseline. Run them:
- Before every major release.
- Any time you update a prompt or model.
- Any time a connector's API changes.

Save this dataset as `brain-evals/golden.json` in the repo. Version it in git.

**How to score:** For each test, score 0 (fail) or 1 (pass) on each rubric item. A run passes if average score ≥ 0.80.

---

### Eval 001 — Research task, single connector
**Input:** "Analyze the last 10 pages added to Notion this week and give me the top 3 themes."
**Connectors required:** Notion
**Rubric:**
- [ ] Brain pulled from Notion (not hallucinated data)
- [ ] Plan had ≤6 steps
- [ ] Exactly 3 themes identified, not more, not fewer
- [ ] Each theme has at least one supporting example from the data
- [ ] Artifact produced (not just narration)
- [ ] Completed in < 60 seconds

---

### Eval 002 — Research task, multi-connector
**Input:** "Cross-reference last month's Linear issues with our Notion product spec and tell me where there are gaps."
**Connectors required:** Linear, Notion
**Rubric:**
- [ ] Brain pulled from both Linear and Notion (not just one)
- [ ] Plan separated data-gathering steps from analysis steps
- [ ] Gap analysis contains at least 2 specific gaps with references
- [ ] No hallucinated issue IDs or Notion page names
- [ ] Completed in < 90 seconds

---

### Eval 003 — External action task (write operation)
**Input:** "Draft a summary of this week's product updates and send it to team@souvenir.ai."
**Connectors required:** Notion (read), Gmail (write)
**Rubric:**
- [ ] Brain confirmed the action before executing (did not auto-send without approval)
- [ ] ExternalOutputCard appeared after completion
- [ ] Email target matches what was specified (team@souvenir.ai)
- [ ] Summary content came from actual Notion data, not a generic template
- [ ] Undo countdown appeared

---

### Eval 004 — Ambiguous input → clarification
**Input:** "Help me with my research."
**Expected behavior:** Brain asks for clarification (does NOT hallucinate a research task)
**Rubric:**
- [ ] ClarificationCard appeared (not a plan)
- [ ] Question was specific and useful (not "What do you mean?")
- [ ] After clarification, Brain produced a focused plan

---

### Eval 005 — Failure self-diagnosis
**Setup:** Run a search task but restrict the connector's data access so the search returns 0 results.
**Input:** "Find all customer feedback from Q1 in Notion."
**Expected:** FixProposalCard appears with a specific diagnosis.
**Rubric:**
- [ ] NodeFailureCard appeared (not a crash)
- [ ] FixProposalCard appeared after NodeFailureCard
- [ ] Reasoning text explains the actual cause (not generic "something went wrong")
- [ ] Diff shows a specific parameter change (date range, search query)
- [ ] Apply fix re-ran the step with the new parameters

---

### Eval 006 — Scheduling quality
**Setup:** Create a daily schedule: "Every morning, pull new Notion pages and send a briefing email."
**Rubric:**
- [ ] Schedule saved with correct frequency
- [ ] On first run, BrainDigestCard appeared on BrainHome
- [ ] Digest summary was specific (referenced actual Notion data, not a placeholder)
- [ ] Run appeared in ScheduleDetailView with correct timestamp and step counts

---

### Eval 007 — Low confidence signal
**Input:** Send a task with deliberately sparse, ambiguous data available in connected tools.
**Rubric:**
- [ ] BrainNarration rendered with amber dot (low confidence)
- [ ] "Want me to double-check?" CTA appeared
- [ ] Clicking "Yes, check again" triggered a re-verification step

---

### Eval 008 — High confidence signal
**Input:** Send a clearly-scoped, data-rich task with a well-connected workspace.
**Rubric:**
- [ ] BrainNarration rendered with green dot (high confidence)
- [ ] No "double-check" CTA appeared

---

## Part 4 — Production Monitoring Setup

### What to set up before launch day

**1. Sentry**
Install in the Next.js app. Set up Slack alerts for:
- Any unhandled exception in Brain's phase transitions
- Any error with `component: BrainShell` or `component: ActivityBlock`
- Error rate > 1% in a 5-minute window

**2. PostHog**
Install and instrument all events from the table in Part 1 (Tool 3). Additionally:
- Enable session replay for users who hit a `brain_node_failed` event. You want to watch exactly what happened.
- Set up a funnel: `brain_loop_started → brain_plan_approved → brain_loop_completed`. Drop-off at plan approval = UX problem. Drop-off at completion = technical problem.
- Set up an alert: if `brain_node_failed` / `brain_loop_started` > 20%, something is broken.

**3. PostHog LLM observability**
Track all AI API calls with:
- Model name
- Latency (p50, p95)
- Token count
- Cost per call
- Phase it was called in

Alert if p95 latency for any Brain API call exceeds 10 seconds.

---

### What the dashboard should show on launch day

| Metric | Healthy threshold | Alert if |
|--------|------------------|---------|
| Loop completion rate | > 75% | < 60% |
| Plan approval rate | > 80% | < 65% |
| Node failure rate | < 15% | > 25% |
| Avg loop duration | < 45s | > 90s |
| AI call p95 latency | < 8s | > 15s |
| Frontend error rate | < 0.5% | > 2% |

---

## Known Gaps — Things to watch

These are issues identified during design and development that have not been fully resolved and may surface in testing.

| Gap | Risk | Where it shows |
|-----|------|---------------|
| `onViewFullThread` in ScheduleDetailView wired in component but not in stories | Medium — may not be wired in the real app either | TC-20 |
| Confidence prop not set by AI layer (always `undefined`) | High — confidence signaling is a differentiator but may be invisible at launch | TC-14, TC-15, Eval 007/008 |
| `approvalCount` not persisted across loops | Medium — delegation hint may never appear | TC-25 |
| Undo window is frontend-only | High — if API call completes before 5s countdown ends, undo is a no-op | TC-07 |
| Brain connector error vs generic crash | High — most common production failure type | TC-09, TC-32 |
| Time zone handling on schedules | Medium — affects international users | TC-16 |

---

## Pre-launch Checklist

Run this on the day before launch. All items must be ✅.

**Product**
- [ ] All P1 test cases passing
- [ ] All P2 test cases passing or have accepted workaround
- [ ] Golden dataset average score ≥ 0.80
- [ ] At least one real end-to-end loop tested on prod infrastructure (not localhost)

**Monitoring**
- [ ] Sentry installed and sending test error successfully
- [ ] PostHog installed and all events firing on a test loop
- [ ] Phase transition funnel visible in PostHog
- [ ] Slack alerts configured for Sentry and PostHog thresholds

**Connectors**
- [ ] Notion connector tested end-to-end in prod
- [ ] Gmail connector tested end-to-end in prod (send + undo)
- [ ] Linear connector tested end-to-end in prod
- [ ] Mixpanel connector tested (read only)
- [ ] All connectors tested in DISCONNECTED state — verify graceful error, not crash

**Scheduling**
- [ ] One schedule created and allowed to run on prod infrastructure
- [ ] Digest appeared on BrainHome after the run
- [ ] Run appeared in ScheduleDetailView with correct stats

**Accounts**
- [ ] AccountMenu dropdown works in the deployed app
- [ ] Settings navigation works from AccountMenu
- [ ] Log out works from AccountMenu

---

*Document maintained by Chai Landge. File issues against test cases using the TC-ID as the Linear issue title prefix.*
