# Claude Code handoff: Souvenir chat and output

Updated October 13, 2026. The canonical product repository is [Flowting-ai/front-end](https://github.com/Flowting-ai/front-end), with the output work based on `feat/output-experience`. The reference animation prototype is [Chaiidesign/souvenir-chat-preview](https://github.com/Chaiidesign/souvenir-chat-preview), pinned at `d5109dd0f66ac8166d33d87b0c43b596fc9d316c`. Its source map is documented on its [`docs/output-integration-handoff` branch](https://github.com/Chaiidesign/souvenir-chat-preview/blob/docs/output-integration-handoff/INTEGRATION_HANDOFF.md).

**Publication state:** This GitHub branch contains the handoff, not the full working preview. A local checkout at `/Users/chaitanyalandge/Desktop/SVNR/souvenir-output-atlas` contains a committed output-preview implementation at `f1884b9`; an isolated cherry-pick for `feat/output-experience` is `108aae7`. Publishing that broad 479-file preview commit was rejected by automatic approval review because it would disclose roughly 84,000 lines of internal code in a public repository. Do not assume that GitHub has that code, and do not bypass this block. Ask the user for explicit approval of the reviewed code package before publishing it. Separate unrelated live-chat PDF work exists in the local checkout; preserve it.

## Product decision

Build one internal, shareable preview in the full frontend rather than merging unrelated Git histories or installing a second chat runtime. Assistant-ui plus Souvenir-owned state are the message/send/cancel foundation. May Day/Geist and production components set the visual language. The model may choose from approved, validated text, product, metric, comparison and evidence views; it must not emit arbitrary executable UI. A document is optional and should appear only when useful or requested.

The standalone prototype's synthetic S1–S17 and E1–E2 cases should become typed fixtures in a Journey gallery beside the current Component library. They cover simple answers, reasoning, web research, files, pins, connectors, mixed/structured outputs and failure. Its README lists fewer cases than its current code. Extract fixture data and event sequences; compare its activity, sources, tables, charts, steps, callouts and error views with the current implementation before porting. Keep one renderer per purpose. The prototype's 5,426-line page contains timer-driven replay, model cycling/picker and timing sliders. Those are not live evidence or operator UI; move any useful debug controls to a developer view.

The prototype repository has no observed license file. The user requests reuse, but record exact commit, ownership/permission, copied paths and changes before incorporating source. Do not label it MIT by inference. The assistant-ui source in the local output preview has separate MIT provenance and retained notice.

## Local implementation and verification

The local `/output-preview` currently has editable margin/inventory/promotion prompt pills; assistant-ui external-store chat; observable activity and fixture streaming; typed component selection with source/numeric validation; evidence/source inspection; optional decision memo; Tiptap editing, local saving, history/undo, targeted revisions and text/Word/print export. `/output-preview/components` defaults to 23 working demos and offers 198 source families in an archive. Fixtures use synthetic merchant evidence and must be labeled. OpenRouter uses a server-only local endpoint; no paid model-quality comparison has been run. A key was exposed in a prior chat and must be rotated before any shared deployment. Never read, print, commit or transmit local `.env.local` values.

The local handoff files `research/output-ecosystem/BUILD_PROGRESS.md`, `PREVIEW_SETUP.md`, `REFINED_BUILD_PLAN.md` and `standards/REUSE_MANIFEST.md` describe the implementation and its limits. On October 13, `npx tsc --noEmit` and 35 focused output tests passed. Scoped ESLint had no errors and three existing SourceCitation warnings. Global historical test/lint gates, independent review, native print-PDF inspection, real-model output quality and account persistence remain open. The preview route and API deliberately return 404 or require auth in production builds.

## Next sequence

1. In the local checkout, inspect `git status`, branch/worktree history, current user changes and `AGENTS.md`; read relevant Next 16 docs. Do not overwrite the separate live-chat PDF work.
2. Extract S1–S17/E1–E2 into a typed journey fixture/event schema that distinguishes observed live events from synthetic replay. Add the Journey gallery using the existing chat shell.
3. Adapt only missing or better source/activity/structured-output components. Keep concise conclusion-first answers, one primary visual, simple language, contextual actions, keyboard/mobile/reduced-motion behavior and honest timing.
4. Verify journeys, cancellation/failure/retry, source support, optional document preservation and accepted exports. Review the whole experience and content quality.
5. With explicit approval for the code package, publish the implementation on the full frontend output branch. Then create a separate access-protected preview deployment and stable link, with preview-only routing and no production-store access. Do not merge to main as part of the handoff.

The team review should have one link, a three-minute prompt-to-answer-to-evidence-to-optional-memo walkthrough, Journey and Component galleries, a synthetic-data notice, known limitations and a simple feedback rubric for clarity, evidence, control, motion and delight.
