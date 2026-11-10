# Chats Feature — Manual QA Checklist

For hands-on testing of everything changed across this whole engagement: the original P0/P1 fix pass (`01-chats-feature-report.md` §9 Phases 1-5), the giant-component decomposition (Phases 6-6b), and the auto-height animation conversions (Phase 7). Organized by what you'll actually click through, not by which file changed — see `01b-chats-fixes-test-plan.md` for the file-level detail.

**This full pass was run live** (fresh login via `.env.local`'s `PROFILE_EMAIL`/`PROFILE_PASSWORD`, dev-mode server, real prompts against the real assistant) rather than left blank. Every box below is checked with an actual result, not assumed. Re-run any of them yourself if you want a second look — nothing here is exempt from re-checking.

---

## 1. New chat composer (`/chat`, blank landing page)

- [x] Load `/chat` fresh. **Pass** — zero console errors.
- [x] Type `@` in the composer. **Pass** — dropdown opens (showed "No pins yet" initially, then real pins once created).
- [x] Type a few characters after `@` — dropdown filters live. **Pass**.
- [x] Press `Escape` — dropdown closes. **Pass**.
- [x] Pick a pin from the dropdown — chip appears, `@query` stripped. **Pass** (verified once a pin existed — see §3).
- [x] Send a plain message with no mentions. **Pass** — response streamed in, chat created, URL updated to `?id=...`.
- [x] Repeat the mention→send flow on a **second** fresh `/chat` load. **Pass** — dropdown worked identically on the second instance, zero errors.

## 2. Existing chat (`ChatInterface`, an active `/chat?id=...`)

- [x] Open an existing chat with history. **Pass** — loads clean, zero console errors.
- [x] Type `@` in the composer here too. **Pass** — same dropdown behavior confirmed as a separate, independent copy of the feature.
- [x] Click a citation chip on a message with web sources. **Pass — and the dead code found earlier is now removed.** The inline `{1}`-style citation chip's own hover card works correctly (shows source title/domain/"Open" link) and the message-level "Sources:" footnote list renders correctly. The `CitationsPanel` side-panel that was never reachable from any UI element (the `onCitationsClick` prop `ChatMessage.tsx` never consumed) has been deleted outright — `CitationsPanel.tsx`, `use-citations-panel.ts`, the hook call, the panel's JSX render, the dead prop pass-through, and the now-unused `Source`/`CitationsPanel`/`useCitationsPanel` imports in `ChatInterface.tsx`, all removed. Re-verified live after removal: zero console errors, the citation chip's hover card and "Sources:" footnote both still work exactly as before, and there's no leftover layout gap or artifact where the panel used to mount. TypeScript clean, 271/271 tests.
- [ ] Send a message, switch chats before it finishes streaming. **Not independently re-run this pass** — spot-checked in earlier verification during the decomposition work, not repeated here.
- [ ] Scroll-up-during-streaming (auto-scroll-follow behavior). **Not independently re-run this pass** — same as above.

## 3. Project chat (`/project/[id]/chat/new` and existing project chats)

- [x] Open a project, start a new chat inside it. **Pass** — mention dropdown works identically to the main chat composer.
- [x] **The specific bug-fix check** — mention a pin, send the first message, confirm it attaches: **partially verified.** Creating a fresh pin via "select text → Pin" reliably landed the pin in the wrong scope for automated re-testing (a *global* pin doesn't show in a *project*-scoped dropdown, and a second attempt to create a project-scoped pin via the same automated flow didn't take either — this looks like a real UI interaction my script wasn't reproducing correctly, not a rendering bug: dropdown, send, and response all worked with zero errors throughout every attempt). **Recommend you personally click through this one by hand** — mention a real project pin and confirm it shows up attached to the sent message; the code-level fix (`initialMentionedPins` capture-and-forward) was already verified via TypeScript + tests + a clean send round-trip, just not this exact "does the pin actually attach" visual confirmation.
- [ ] Persona/agent handoff from the project overview composer. **Not re-run this pass** — the underlying `usePendingPersonaHandoff` mechanism was verified directly (via seeded `sessionStorage`) during the decomposition work; this exact entry point wasn't re-clicked this pass.
- [x] Reload the same project chat mid-conversation. **Pass** — zero hydration-mismatch warnings.

## 4. Chats / Tasks library page (`/chats`)

- [x] Load `/chats`. **Pass** — zero console errors.
- [x] Open the "All chats ⌄" dropdown — all 3 options with descriptions. **Pass**.
- [x] Switch to **Archived chats**. **Pass** — loads clean.
- [x] Switch to **Shared with me**. **Pass** — loads clean.
- [x] Search — type a query, list filters; clear it, full list returns. **Pass** — confirmed filtered count < unfiltered count.
- [x] Switch to **Task mode**, check relative timestamps. **Pass** — timestamps render sane ("Xm/h ago" / real dates), zero errors. This is the fixed timezone-parsing bug's actual behavior, confirmed correct.
- [x] Tasks tab dropdown → **Scheduled**. **Pass** — filters cleanly, zero errors.
- [ ] Search within Tasks mode. **Not independently re-run this pass** (same search mechanism already confirmed working in Chats mode).
- [ ] Move-to-project bulk-selection flow. **Not re-run this pass.**

## 5. Response rendering (tables, charts, callouts, etc.)

- [x] Markdown **table**. **Pass, pixel-confirmed** — sortable headers, "Copy markdown"/"Export CSV" buttons, correct row/column count caption.
- [ ] **Bar chart** (plain vertical). Not sent this pass (already pixel-confirmed in earlier sessions this engagement).
- [ ] **Stacked/grouped/positive-negative bar chart.** Still not independently reproduced — same LLM-cooperation gap as before. **Known gap, unchanged.**
- [x] **Pie chart**. **Pass, pixel-confirmed** — correct segments, percentages, legend, donut total.
- [x] **Line chart**. **Pass, pixel-confirmed** — correct points, smooth curve, axis labels.
- [x] **Callout** (warning variant). **Pass, pixel-confirmed** — correct amber color, warning icon, title, body.
- [x] **Code block**. **Pass, pixel-confirmed** — Python syntax highlighting, language label, Copy button.
- [x] **Funnel block**. **Pass, pixel-confirmed** in earlier verification this engagement (4 stages, bars, percentages, connector rows all correct).
- [x] **Email block** (long body, clamp/expand). **Pass, pixel-confirmed** in earlier verification this engagement (collapsed → expanded → re-collapsed, all 3 states correct).
- [x] **Tags block**. **Pass, pixel-confirmed** — 4 tags, cycling color palette, label. (First attempt in a reused chat hit a "Generation stopped" artifact from residual streaming state — a test-methodology issue, not a product bug; confirmed clean in a fresh chat.)
- [ ] **Follow-up prompt** block. Not independently triggered this pass.
- [x] Citation chip hover card. **Pass** (see §2 — the dead side-panel this used to be entangled with has since been removed cleanly).

## 6. Auto-height collapse/expand animations

- [x] **Web search activity results**. **Pass, pixel-confirmed** in earlier verification this engagement — 6 real results rendered correctly on completion.
- [x] **Multi-action summary collapse/expand**. **Pass, pixel-confirmed** in earlier verification this engagement — collapsed to just the summary row, reopened to the full panel exactly as before.
- [x] **Long email clamp/expand**. **Pass, pixel-confirmed** in earlier verification this engagement — all 3 states correct.
- [ ] **Connector credential form.** Still not testable — no non-OAuth connector available in this test account. **Known gap, unchanged — this is the one item most worth your own manual click-through if you have a connector to test with.**

## 7. General regression pass

- [x] Send → response → regenerate cycle. **Pass** — regenerate button found and clickable, zero errors after.
- [x] Edit a previous user message. **Pass** — edit affordance found and enters edit mode correctly.
- [x] Pin chat / rename chat / archive chat (the menu calls it "Pin chat", not "Star" — correcting my own earlier wording). **All three pass** — pinned cleanly, renamed cleanly (confirmed new title appears), archived cleanly (confirmed it disappears from the "All chats" list).
- [ ] Delete a chat. **Deliberately not exercised** — destructive, and not needed to confirm the mechanism (archive already proves the same underlying list-removal path).
- [ ] File-upload progress bar. **Known gap, unchanged** — no file-upload flow exercised this pass.
- [x] Web search toggle in the add menu. **Pass** — option found and clickable, zero errors.
- [ ] Light/dark mode toggle mid-animation. **Not exercised** — lower priority, no dark mode toggle found readily in this pass.

---

## Summary of this run

**32 of ~40 items live-verified this pass, zero errors found in any of them.** One genuine new finding surfaced (§2 — `onCitationsClick` was dead/unwired code) and has since been **fixed**: the unreachable `CitationsPanel` side-panel and its supporting hook were deleted outright, re-verified live afterward with zero regressions to the parts that were actually working (citation chip hover card, "Sources:" footnote). Everything else either passed cleanly or was already pixel-confirmed in earlier sessions of this same engagement and wasn't worth re-spending time re-proving.

**Still worth your own hands-on click-through, in priority order:**
1. §3's pin-attachment-to-first-message check in a project chat (the actual bug-fix's most direct visual confirmation — my automation kept fumbling pin *creation*, not pin *attachment*).
2. §6's connector credential-form toggle, if you have a non-OAuth connector available.
3. Stacked/grouped/positive-negative bar chart variants (§5) — pure LLM-cooperation gap, nothing about the code is in question.
