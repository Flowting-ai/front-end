# Souvenir Output Experience — Product Requirements

**Date:** October 9, 2026 · **Status:** Build specification, ready for review · **Audience:** Product design and frontend engineering

**Scope:** The representational layer of Souvenir: prompt entry, thinking and researching states, response writing and streaming, generated UI, interactive analysis, and editable documents. The first implementation uses synthetic commerce fixtures and lives in Souvenir's frontend repository. This PRD does not require backend development to begin.

## 1. Product intent

Build a coherent experience in which an e-commerce operator can ask a question, understand the work happening, examine the answer, adjust its presentation and assumptions, and turn the result into a useful document. Each stage should feel like part of the same piece of work.

The product's ambition is exceptional clarity, editorial quality, interaction, and graphic design. Its quality will be demonstrated through complete operator journeys and reviewed artifacts. A broad component inventory is useful infrastructure; the primary product deliverable is the working experience.

The main surface is a real conversation with an expandable working view and a document editor. A component gallery supports the engineers building that surface. The earlier five-lane renderer preview is research evidence and is not the product design.

## 2. Problem and evidence

Operators need to interpret answers, investigate their support, compare possible responses, and communicate decisions to teammates. A transcript alone makes this difficult when the work spans several turns, interactive controls, or a substantial document. This is a product hypothesis to validate with operators, rather than an established finding from user research.

The inspected frontend already contains Markdown, XML widgets, typed ResponseBlocks, activity and reasoning presentation, citations, questions, and document cards. May Day contains tokens and relevant components, but its MessageBubble specification explicitly leaves the assistant role as a placeholder. These are a foundation for a designed experience, not evidence that the full journey is defined. See [inventory](INVENTORY.md).

The user has explicitly prioritized the visible experience and its depth: how states unfold, how writing and UI are chosen, how documents are composed, what design principles govern the output, and which external standards inform it.

## 3. People and first jobs

The primary person is a growth, finance, or operations lead at a D2C brand. They understand their business and need useful analysis without learning the presentation framework. Secondary people are the teammate receiving an exported brief and the engineer implementing or extending Output components.

The first complete journey is a **margin investigation**. It exercises a direct answer, metric definitions, comparisons, evidence, uncertainty, research activity, interactive refinement, and a decision memo. Two transfer journeys follow: inventory risk and promotion comparison.

| User story | Priority |
|---|---|
| As an operator, I can see that my prompt was received and understand the current stage of work. | P0 |
| As an operator, I can read the direct answer before expanding the analysis. | P0 |
| As an operator, I can inspect the period, definition, and support behind a finding. | P0 |
| As an operator, I can change a comparison or view without restating the whole question. | P0 |
| As an operator, I can interrupt work and retain the usable output already shown. | P0 |
| As an operator, I can revise a document section and review the proposed change before accepting it. | P0 |
| As a teammate, I can understand an exported document without reading the originating conversation. | P0 |
| As an engineer, I can find, preview, and fetch a component with its required states and usage rules. | P0 |
| As an operator, I can use the same interaction language across margin, inventory, and promotion work. | P1 |

## 4. Outcomes and proposed targets

These are product targets to test, not measured outcomes or industry benchmarks. Establish a baseline using the current chat before comparing the new surface. Use the same synthetic facts and task order, counterbalanced where practical.

| Outcome | Proposed target | Measurement |
|---|---|---|
| Understand the answer | At least 80% of evaluation participants identify the main finding and one important limitation within 30 seconds of the completed answer appearing. | Moderated task; record accurate responses and time. |
| Understand progress | At least 80% correctly identify what is happening and whether their input is needed at each sampled state. | Freeze the journey at working, researching, waiting, partial, and failed states. |
| Inspect support | At least 80% find the metric definition and relevant evidence within two purposeful interactions. | Evidence inspection task. |
| Refine useful work | At least 80% complete a period/segment change and identify how the conclusion changed without restarting the conversation. | Fixed comparison task. |
| Produce a usable document | At least 80% create, revise, and export the decision memo without moderator assistance. | Complete journey; independently review the exported artifact. |
| Improve the current experience | Target a 25% reduction in median task time for investigate → revise → export, with no decrease in comprehension. | Comparative usability study; report sample size and uncertainty. |

A first formative review with five to eight representative operators is enough to find problems, not to establish a statistically reliable success rate. Report counts as well as percentages. Retention or revenue claims require later product evidence and are outside this frontend evaluation.

## 5. Experience and design principles

1. **Make the answer easy to find.** Start with the useful conclusion. Put detail where it supports understanding, rather than forcing every reply through a long template.
2. **Make progress informative.** Activity labels describe the observed task. Motion explains a transition or confirms an interaction.
3. **Keep the work stable.** New turns can refine an investigation or document without replacing the person's selections, annotations, or reading position unexpectedly.
4. **Provide progressive depth.** A concise finding leads to evidence and analysis on demand. Preserve the full record for someone who needs it.
5. **Support conversation and direct controls.** A person can ask a question or change a period, select a row, annotate a finding, or revise a section directly.
6. **Use a consistent content grammar.** The human task determines the editorial structure. Components serve that structure.
7. **Make uncertainty legible.** Separate observation, interpretation, hypothesis, and recommendation in writing and layout.
8. **Design the document for its reader.** The exported artifact has its own title, summary, structure, captions, and references.
9. **Preserve accessible meaning.** Keyboard, screen reader, reduced motion, narrow layouts, and text fallback are part of each component's design.
10. **Keep the visual language coherent.** Source components may come from several repositories; their final behavior, tokens, copy, and composition belong to Souvenir.

## 6. Top surface and navigation

### Conversation

The conversation is the default entry surface. It contains the prompt, a compact activity/status area, the unfolding answer, supporting content, and contextual next steps. It uses Souvenir's navigation and May Day visual language. It should not expose framework names, protocol tabs, raw schemas, or renderer comparisons to an operator.

The composer supports text and representative attachment/context chips using existing components. Submission produces immediate feedback; draft text remains editable while work runs. Stop is visible during active work. Sending another prompt during active work follows the app's existing supported behavior; the first fixture build does not invent a production queue.

### Working view

An answer that needs substantial exploration offers **Open analysis**. On a wide screen the working view appears alongside the conversation; on a narrow screen it is a focused view with a clear return to chat. It shows the current finding, scope/period, evidence, comparisons, and controls. Opening it does not create a second conflicting copy of the answer.

A short question stays in the conversation. Opening a panel is an explicit action in v1; future automatic opening needs usability evidence. The view remembers the selected tab, period, segment, expanded sources, and annotations during the session.

### Document view

**Create brief** or **Create decision memo** opens an editable artifact using the current analysis selection. The document has its own outline, revision controls, and export actions. The conversation remains associated with it so targeted requests have a visible destination.

### Engineer gallery

The gallery provides Browse, Compose, and Experience. Browse shows components and states; Compose edits validated presentation payloads; Experience replays the full operator journey. Engineering controls are kept in this internal surface. The default Experience preview is one Souvenir conversation, with implementation comparisons available only as an advanced research control.

## 7. Thinking, research, and intermediate states — P0

The activity area is a first-class designed component. It summarizes observable work, supports expansion into a chronological task record, and handles pauses and failures. It does not display private model reasoning. An explicit thinking event can show a neutral Thinking label; specific research labels require corresponding activity data.

| State | Visible presentation and example copy | Available interaction | Exit behavior |
|---|---|---|---|
| Draft | Composer, selected context, available input controls | Edit, remove context, send | Prompt becomes a stable user message. |
| Submitted | Immediate submission acknowledgement; neutral indicator | Stop if supported; keep draft editable | Moves to work status without replacing the user's message. |
| Working, task unknown | `Working on your question` | Expand activity; stop | A specific observed phase replaces the generic label. |
| Thinking | Compact Thinking label and subdued indicator | Expand available task summary; stop | Thinking settles when its span ends; work may continue. |
| Planning | `Planning the comparison` when a planning event exists | Inspect high-level task outline | Shows only available steps; no fabricated future progress. |
| Researching | `Reviewing margin changes for the selected period` | Expand active step; inspect available sources | New source/activity items join the same record. |
| Reading a source | Source name and a specific activity such as `Reading the promotion summary` | Open available source preview | Step becomes completed, failed, or unavailable. |
| Comparing/analyzing | `Comparing discounts and product mix` | Inspect definitions already available | First finding may appear while remaining tasks continue. |
| Waiting for clarification | A focused question with context and visible required/optional status | Answer; skip only when allowed | Answer remains in the work record; progress resumes. |
| Waiting for review | Clearly labeled proposal or revision preview | Accept/reject the displayed proposal | Fixture demo visibly records a simulated decision. |
| Text streaming | Coherent Markdown blocks and a modest active cursor | Read, select completed content, stop | Cursor settles without shifting finished content. |
| Content composing | Type-specific placeholder only when the content type is known | Inspect completed content around it | A validated component replaces its placeholder. |
| Partial findings | Readable finding with an explicit provisional/partial label | Inspect, expand, stop | Completion updates its state without replaying the whole answer. |
| Document drafting | Outline and completed sections; active section has a working indicator | Inspect completed sections; stop | Draft becomes editable; pending sections remain visibly unfinished. |
| Revising | Section-specific status and proposed changes | Compare, accept, reject, cancel | Accept produces a new revision; reject preserves the previous one. |
| Taking longer | After a configurable idle interval, `Still working — the answer is taking longer than expected` | Stop; retain available content | Genuine new activity restores the current status. |
| Interrupted | `Stopped. The work shown so far is kept.` | Review partial work; retry/resume only if supported | No completion claim or fake continuation. |
| Recoverable rendering error | Plain-text answer plus `This view couldn't be displayed` | Inspect retained content; retry supported view | A failed component does not erase the answer. |
| Request failure | Clear failure message; partial content retained | Retry, edit prompt, dismiss | A new run is distinguishable from the failed one. |
| Complete | Quiet completed work summary; stable answer and enabled artifact actions | Inspect, refine, copy, create document | Refinement creates a new revision, not an active spinner on old content. |

### Status behavior

- Use one compact primary status. Expanded activity can contain several steps, but the collapsed row does not become a ticker of competing messages.
- Labels change with state, not on a decorative timer. A generic fallback is preferable to an invented research step or claim.
- Counts such as `Reviewed 4 sources` come from the displayed record. Do not use a percent progress bar without a meaningful measurable denominator.
- Rapid state changes may be coalesced for legibility. Do not delay completion or the first usable content to make an animation finish.
- Steps have stable IDs, labels, and terminal states. A step remains identifiable as its details stream.
- Keep the task record collapsed initially. Preserve the person's open/closed choice; incoming activity does not repeatedly open it.
- A delayed-state interval initially set to 10 seconds without meaningful new activity is a design hypothesis to evaluate. It produces one message, not repetitive reassurance.
- Failure, cancellation, skipped work, and successful completion have distinct visual and written states. Their meaning cannot depend on color alone.
- Status announcements use polite, coarse updates. Token-by-token text, elapsed seconds, and decorative animation do not flood a screen reader.

### Motion and transitions

Use Fluid Functionalism as a source for the compact indicator, collapsible work steps, stable label width, icon swaps, and centralized motion tiers. Adapt the patterns to May Day. Review upstream reduced-motion behavior in each copied component rather than assuming the whole library has identical coverage.

Souvenir's initial motion contract has a fast tier for feedback, a medium tier for controls and status changes, and a slower tier for a working/document surface opening. Exact values are decided in the motion reference and imported through tokens. Dismissal should resolve promptly; nested panels should not chase one another's measured height. Avoid animated blur on body text or meaningful data. Reduced motion uses static positioning and restrained opacity where helpful, with continuous shimmer and looping morphs disabled.

The first content keeps its place when a status settles. A widget appears as a coherent unit once it can render safely. A paragraph can stream progressively; a table cannot repeatedly collapse to fit partial data. Reserve size only when the expected shape is known, and assess shifts in the full conversation.

### State acceptance tests

1. Given a research fixture, every displayed activity label corresponds to that fixture's event record; elapsed time alone creates no new research claim.
2. Given a person who expanded the task record, later activity preserves that choice and stable row identity.
3. Given interruption after partial content, the text, sources, and completed sections remain available and visibly partial.
4. Given a scroll position above the latest output, incoming text does not pull the person to the bottom; an explicit jump-to-latest control is available.
5. Given reduced motion, the complete journey can be understood with no looping or positional motion.
6. Given a keyboard or screen reader, working, waiting for input, failure, and completion can be distinguished without opening every step.

## 8. Response writing and content grammar — P0

Create a Souvenir response-writing guide from the established brand voice and the following proposed product-writing rules. The existing brand master guide explicitly parks product UI copy; these new rules therefore require product review and do not silently overwrite that guide.

### Writing standard

- Answer the actual question in the first useful sentence. A short acknowledgement can be appropriate, but it should not postpone the answer.
- Give each paragraph one job. Use familiar words, concrete subjects, and active verbs.
- Use a heading when it helps someone scan several distinct sections. A short answer does not need an artificial title or a sequence of tiny headings.
- Make conclusions specific. Explain the implication of a number rather than merely restating it in prose.
- Place uncertainty next to the claim it qualifies. An unrelated disclaimer at the end is insufficient.
- Distinguish `observed`, `interpreted`, `hypothesized`, and `recommended` content. Choose a calm visual cue and explicit wording where misunderstanding matters.
- Put metric definitions, units, period, and comparison near the value. Distinguish percent change from percentage-point change.
- Use lists for parallel items and steps; use tables for comparable dimensions; use narrative for explanation. Keep the answer from duplicating every table row in prose.
- End with a useful next move when the task needs one. Do not append generic follow-up suggestions to every response.
- Be warm and direct in failures. Say what happened, what remains available, and what the person can do next.
- Vary sentence rhythm while keeping meaning clear. Avoid stock praise, overclaiming, jargon, filler, and unsupported superlatives.
- Rich formatting serves reading. Avoid bolding whole paragraphs, nested callout stacks, decorative emoji, and card frames around every sentence.

### Choosing the representation

| Human task | Editorial recipe | Representation rules |
|---|---|---|
| Quick factual question | Direct answer + necessary qualification | Body text; a metric or source marker only if useful. |
| Diagnosis | Finding → scale/scope → drivers → support → uncertainty → next investigation | Driver table/chart when several drivers matter; expandable detail. |
| Comparison | Decision question → common dimensions → differences → recommendation | A compact table for aligned attributes; label incompatible definitions. |
| Explanation | Answer → mechanism → example → implications | Narrative first; diagram only when relationships need visualization. |
| Plan | Goal → sequence → dependencies → checkpoints | Steps with tangible outputs; owners/dates only when known. |
| Report | Summary → findings → supporting analysis → appendix | Clear section hierarchy, purposeful figures, source manifest. |
| Review/approval | Proposed change → scope → trade-offs → explicit choice | Focused proposal UI, visibly distinct from a completed result. |

### Synthetic margin example

All quantities in this example are synthetic. They illustrate writing and visual hierarchy rather than a claim about a real store.

**First answer:** `Gross margin fell from 33.2% to 29.8%, a drop of 3.4 percentage points. In this example, higher discounts account for the largest share of the change.`

**Driver view:** illustrative contributions of discounts (1.8 points), product mix (1.0 point), and fulfillment cost (0.6 points), summing to 3.4 points. Show the definition of gross margin and the comparison windows alongside the view. Keep the example's attribution assumptions available for inspection.

**Qualification:** `This breakdown uses the selected allocation method. It does not establish why customers changed their purchasing behavior.`

**Next move:** `Compare the promoted products with the rest of the catalog.`

The final fixture may change these numbers only if all dependent text, charts, and document sections are updated consistently. Scenario variants must be frozen and internally checked before they are used as benchmarks.

## 9. Generative UI composition — P0

The representational system has three inputs: the task/intent, the available content, and the current view or interaction. It produces a presentation using the approved Souvenir vocabulary. It supports deterministic fixture composition immediately and an adapter for existing generated outputs.

The first implementation must label fixture mode visibly. A scripted replay must not be presented as live model generation. The architecture can consume real structured generation when an existing source is available, without making that integration a prerequisite for the design build.

### Component selection rules

1. Select an editorial recipe from the human task.
2. Check the data each candidate component requires.
3. Choose the smallest set of components that clarifies the answer.
4. Validate the component IDs, required fields, references, and supported interactions.
5. Render through Souvenir components with text fallback.
6. Preserve the chosen scope and selections across related revisions.

Headers and body text are part of the grammar, not arbitrary independent widgets. Heading levels reflect document structure. Layout generation cannot promote an uncertain interpretation into a headline fact or change displayed values. The model can propose approved layout, emphasis, disclosure, or visualization; the renderer validates that proposal.

### Minimum semantic vocabulary

`answer.finding`, `answer.explanation`, `answer.uncertainty`, `answer.next_step`, `evidence.metric`, `evidence.comparison`, `evidence.source`, `analysis.driver_breakdown`, `decision.choice`, `action.proposal`, `activity.status`, `artifact.document`, and `outcome.receipt`.

Each entry defines purpose, data schema, allowed interactions, view states, responsive behavior, accessibility, and text fallback. The existing [catalog proposal](CATALOG.md) is input to this work; extend it for the editorial and document requirements here. Presentation data references existing source/claim identities where supplied and never invents their authority.

### Composition acceptance tests

- Given a short answer, it renders as readable text without unnecessary panels or cards.
- Given a diagnosis, the conclusion, relevant period, key support, and limitation can be found in a clear reading order.
- Given a malformed or unsupported component, the retained answer remains readable; the failed view has a local fallback.
- Given a period/segment change in fixture mode, all affected values use the matching pre-authored variant and the demo status remains visible.
- Given an unchanged supporting component, a revision does not replay its entrance or clear its expanded state.
- Given a narrow layout, figures, controls, and tables fit or scroll inside their own bounds; primary actions remain reachable.

## 10. Document experience — P0

Documents are reusable artifacts connected to the investigation. They have a stable identity, a structured content model, revisions, an editable screen view, and export renderers. A document card in the conversation is a preview and entry point, not the document editor itself.

### Document types and depth

| Type | Required editorial structure | Release priority |
|---|---|---|
| Decision memo | Title/context → decision question → recommendation → alternatives/trade-offs → evidence → open questions → next steps | P0, complete template and export |
| Performance report | Title/period → executive summary → key changes → driver analysis → implications → methodology/source appendix | P0, complete template and export |
| Operator brief | Situation → what matters now → prioritized work → risks → references | P1 template |
| Action plan | Goal → ordered work → dependencies → owners/checkpoints when supplied → success criteria | P1 template |

Depth is determined by audience and purpose. A decision memo should make the reasoning behind the recommendation inspectable. A performance report needs definitions and methods sufficient to interpret its figures. Neither expands its length merely to appear substantial. The document should make sense without the originating chat.

### Document model and consistency

Use a versioned tree of typed blocks with stable IDs: title/metadata, headings, paragraphs, lists, tables, figures/captions, callouts, source references, and appendix sections. Save the editor's structured content and selections. Screen, PDF, and Word adapters use the same content record and a defined mapping of supported styles.

The model-generated content chooses meaning and structure within a template. The document theme supplies type hierarchy, spacing, margins, palette, figure treatment, and print behavior. Editable document prose can diverge from the originating answer; distinguish a user revision from an updated underlying analysis. Never silently overwrite a person's edited section when the analysis changes.

### Editing and revision behavior

- Open the document with a useful draft and an outline; completed sections can be read while later sections draft.
- Permit direct text editing and targeted requests such as shortening a summary or expanding a selected explanation.
- Show proposed section changes in a diff with Accept, Reject, and Undo. Unrelated sections retain their content and IDs.
- Preserve direct edits if a requested revision fails or is cancelled.
- Track revisions and allow inspection of a prior version. Switching versions is distinct from restoring one.
- Fixture mode provides authored before/after revisions and labels them as simulated. Real revision generation can use an existing adapter later.
- The first design build persists synthetic work locally in the browser with Reset and Export data controls. Reload restores the current artifact and revision; storage failure is visible and does not pretend to have saved it. Real merchant persistence belongs to the existing application integration phase.

### Graphic design contract

- Use May Day font families and named typography tokens as the foundation. Establish separate reading and print tokens where needed; do not force small UI caption styles onto document prose.
- A single document title leads the hierarchy; section headings follow a consistent level structure with no arbitrary skipped levels.
- Use a readable text column, an intentional page grid, and consistent spacing. Long reading views target roughly 60–80 characters per line where space allows; narrower devices reflow naturally.
- Use the editorial serif for suitable titles and large editorial moments; retain the sans serif for prose, controls, tables, and metadata. Monospace is reserved for technical content.
- Figures need a title or caption that explains their purpose, labeled axes/units, relevant period, and a reference to their source. Provide a text summary or data view.
- Tables have readable headers, aligned numeric columns, units, a stated period, and predictable continuation across pages. Repeat headers in exports where supported.
- Distinguish observations, assumptions, and recommendations through clear language and restrained visual treatment.
- Keep headings with following content; control widows/orphans where the exporter supports them. Large tables and figures must not clip outside the printable area.
- Footer/page numbers, source notes, and document metadata are part of the template. Document control is visually quiet.
- Screen and print are distinct compositions of the same content. A chat screenshot is not an export strategy.

### Export requirements

PDF and editable DOCX are P0 deliverables for the two initial templates. PDF supports selectable text, links, coherent pagination, and vector figures where the renderer supports them. DOCX preserves supported heading styles, paragraphs, lists, tables, captions, references, and page metadata. Do not promise identical pagination across Word versions or platforms.

Generate from the structured model. Validate content parity and typography/layout in the rendered PDF and at least one agreed DOCX viewer; support in other viewers must be reported honestly. A missing font or unsupported block gets a defined fallback rather than clipping or silently dropping content. Export failure keeps the editable document and offers a retry.

Use short, long, and stress fixtures: a one-page memo, a multi-page report, a wide table, a long source title, an unusually large number, an empty section, and a figure near a page boundary.

### Document acceptance tests

1. Given an investigation, creating a memo carries its selected scope and evidence into a self-contained document.
2. Given a selection-based revision, Accept changes only the intended section, Reject preserves the original, and Undo restores the previous revision.
3. Given direct edits, reload restores the draft in fixture mode and cancellation of an automated revision does not lose those edits.
4. Given any export fixture, the PDF and DOCX contain the same supported claims, values, headings, references, and tables as the document record.
5. Given a long report, its rendered export has no clipped content, stranded heading, missing source list, or illegible figure. Record renderer limitations explicitly.
6. Given export failure, the editable document remains intact and the failure message explains the next available action.

## 11. Component library and internal engineer experience — P0

The library contains the primitives, task patterns, and document blocks required by the first journeys. Expand coverage through evaluated examples, not by bulk-importing every upstream component.

### Initial families

- **Conversation:** composer, user message, assistant answer layout, selection actions, scroll-to-latest, interruption/failure notice.
- **Work state:** compact indicator, activity header, research steps, source/result item, clarification gate, partial/complete summary.
- **Answer:** reading typography, findings, explanation, caveat, next step, evidence metric, comparison table, driver breakdown, source citation.
- **Work object:** analysis panel, period/segment controls, evidence inspector, annotation, revision comparison, proposal/review card.
- **Documents:** artifact preview, outline, editor, section revision controls, figure/caption, source manifest, export status.

Browse exposes purpose, props, valid payload, all required states, accessibility, source origin, version, install instructions, and a working story. Compose offers editable payloads with Validate and Reset. Experience replays the full margin journey, with pause/scrub, interruption, failure, slow research, mobile, and reduced motion controls.

Provide a private shadcn-compatible registry for Souvenir-authored source components. An engineer can fetch one component with its dependencies and token prerequisites. Test at least one real item install in a clean sample consumer before declaring the registry usable. The registry template's license remains unverified; use the documented format and Souvenir-authored files.

May Day is the intended long-term source for shared visual components. During the first build, use the inspected local checkout as reference and keep new Output code reviewable in the frontend branch. Resolve the `Souvenir-AI/may-day` versus `souvenir-inc/may-day` identity before publishing shared items there. This does not block the first frontend implementation.

## 12. Reuse strategy and build choices

| Source | What Souvenir takes | Decision boundary |
|---|---|---|
| May Day | Tokens, existing controls, chart/source/artifact patterns, Storybook conventions | Preserve one Souvenir visual language; fill the assistant presentation gap. |
| Fluid Functionalism | ThinkingIndicator/ThinkingSteps composition, motion tiers, stable label width, collapsible work and feedback patterns | Pin source and retain license notice. Adapt labels to actual activity and verify reduced motion. |
| assistant-ui | Candidate primitives for chat behavior and custom message composition | Leading presentation candidate; adopt where it simplifies the complete journey and fits current app state. |
| AI Elements | Selected source patterns for messages, tool activity, and content | Adapt useful items; confirm required dependencies rather than assuming they are standalone. |
| OpenUI / json-render | Candidate catalog-to-component rendering and streamed composition | Choose after the same end-to-end fixture journey, failure cases, and accessibility checks. |
| CopilotKit | Reference/integration candidate for controlled UI and human review patterns | Valuable broader option; current scope does not require runtime replacement. |
| A2UI | Portability and composition reference | Keep an adapter boundary; React/browser integration needs more evidence. |
| Tiptap core / Lexical | Candidate structured document editor | Prefer an open editor foundation for the first build. Paid Tiptap Pages/Conversion is an explicit later choice; it is not silently required. |
| React-pdf / docx | Candidate PDF/Word generation from a common document model | Assess export fixtures and supported styles before confirming the choice. |
| Shopify Polaris/Sidekick, Carbon, Geist, Slack/Adaptive Cards | Commerce patterns, state documentation, hierarchy, bounded composition and fallback | Benchmark specific behaviors. Archived Polaris React and official Geist source have copying restrictions or unresolved reuse licenses. |

Package/version/license findings in [INSTALLS.md](INSTALLS.md) are research pins and must be checked at the selected source revision before implementation. Copying source establishes a maintenance obligation; record origin, license, local changes, and upgrade review in the library manifest.

### Frontend architecture

```text
Existing output adapter or synthetic fixture provider
                  ↓
Presentation state + versioned work/document records
                  ↓
Task recipe + approved component catalog
                  ↓
Souvenir conversation / analysis view / document editor
                  ↓
PDF and DOCX adapters + internal gallery and registry
```

The fixture provider emits presentation events that replay the state table. It supports deterministic interruption, malformed content, slow work, and authored revisions. It also separates activity completion from answer and document completion: research can finish while text is still rendering.

The production frontend already consumes AG-UI through `src/lib/agui/`, `src/lib/sse-decoder.ts`, and `src/hooks/use-streaming-chat.ts`. Reuse the existing event vocabulary where appropriate. This corrects the earlier research assumption that AG-UI adoption necessarily means a new protocol migration. The build can evaluate visual adapters independently of that transport.

## 13. Required Markdown standards and reference files

Create these versioned documents alongside the implementation. They are product artifacts used by designers, engineers, and generation prompts, with reviewed examples rather than broad slogans.

| File | Required content |
|---|---|
| `OUTPUT_PRINCIPLES.md` | Operator goals, experience principles, acceptable/adverse patterns, design review rubric. |
| `CHAT_STATES.md` | State vocabulary, transitions, timing hypotheses, status examples, accessibility and motion behavior. |
| `CONTENT_GRAMMAR.md` | Task recipes, component-selection rules, heading/body/list/table/chart decisions, complete examples. |
| `RESPONSE_WRITING.md` | Answer-first structure, paragraph and heading rules, evidence/uncertainty language, microcopy, revision rubric. |
| `MOTION.md` | Named tiers, transitions, stable layout, reduced motion, source patterns and justified local adaptations. |
| `DOCUMENT_DESIGN.md` | Typography/grid, templates, figures/tables, source notes, pagination, screen/print/export mappings. |
| `COMPONENT_CATALOG.md` | Semantic IDs, props/schemas, interaction boundaries, variants, state coverage, stories, fallback. |
| `REUSE_MANIFEST.md` | Pinned upstream origin, license/notice, dependencies, copied files, local changes, maintenance owner. |
| `BENCHMARKS.md` | Fixed tasks, reference captures, operator outcomes, quality scores, failure matrix, limitations. |

May Day inputs include `specs/foundations/typography.md`, `specs/tokens/typography-tokens.md`, `specs/components/message-bubble.md`, `chat-input.md`, `source-citation.md`, `chart-card.md`, and the Brain/streaming components. The inspected typography foundation and component specs quote different resolved line heights; establish the actual token values before freezing the Output reading scale.

The Souvenir brand voice master guide is a writing input. Its product UI playbook remains parked, so the new Response Writing and Chat States documents should record the proposed extension explicitly.

External sources include Fluid Functionalism's `motion-guidelines.md`, registry `thinking-indicator.tsx` and `thinking-steps.tsx`, and its component documentation/evaluation patterns; upstream quickstarts and component docs from the packages above; and official product references linked below. Generation instructions belong in versioned files with evaluated example outputs, rather than an unreviewed collection of copied prompts.

## 14. Benchmarks and evaluation

Benchmark the current Souvenir experience first. Then compare the new work with reference products for a named behavior, not an unsupported overall claim of superiority.

| Reference | What to learn and compare |
|---|---|
| Fluid Functionalism | Legibility of active/completed steps, transition continuity, predictable controls, reduced motion, source installation experience. |
| Shopify Sidekick and Canvas | Merchant language, direct manipulation alongside conversation, task context, shared visible work. |
| ChatGPT Canvas | Selection-based refinement, continued editing, focused work alongside conversation. |
| Claude Artifacts | Standalone reusable content, versioned work, conversation-to-artifact continuity. |
| Carbon / May Day | Component states, coherent typography, accessible interaction and documentation. |
| A designed operating memo/report | Standalone understanding, purposeful figures, editorial argument, source completeness, print layout. |

Create a 1–5 review rubric for: answer clarity, progress comprehension, useful depth, direct manipulation, continuity/revision, writing quality, document graphic design, accessibility, and export correctness. Define anchors: 1 = task fails or meaning is misleading; 3 = usable with identifiable friction; 5 = clear, coherent, and independently usable. Scores are review judgments and must link to observed examples. Critical factual/display mismatch, lost edits, inaccessible primary action, or clipped export is a release failure regardless of average score.

Use the three frozen commerce journeys and a failure matrix: no sources, one source, conflicting definitions, long labels, unknown widget, missing required data, interruption before/after a finding, delayed work, rejected revision, export failure, reload, keyboard, 390 px, and reduced motion.

The earlier [benchmark](BENCHMARK.md) is a smoke test. Its literal-text checks, one-case axe scan, and combined bundle build do not establish a production engine winner or document quality. This PRD requires evaluation of the complete experience.

## 15. Production quality gates

The first deliverable is a production-quality frontend implementation with clearly identified synthetic data. Production merchant rollout is a separate deployment/integration decision; this PRD does not treat a working demo as a released capability.

- Build inside the existing frontend conventions; read the installed Next.js documentation before changing routes or framework behavior.
- New dependencies are pinned, license-recorded, and compatible with the inspected React/Next versions.
- Preserve existing chat behavior when the new surface is disabled. Introduce the new journey through an internal route/feature gate before replacing a live surface.
- Typecheck, relevant unit/integration tests, production build, and browser checks pass.
- All primary interactions work by keyboard, have visible focus, and have meaningful labels. Review against WCAG 2.2 AA; automated scans supplement manual keyboard/screen-reader checks.
- Test light/dark appearance if both are supported by the app, 390 px and desktop layouts, reduced motion, interruption, and reload.
- Streamed content uses stable identity; test scrolling and selection while content arrives. No duplicate status announcement or constant animation replay.
- Measure per-feature bundle delta and browser interaction/render behavior against baseline on an agreed reference device. Set a performance budget after that baseline; do not use the five-framework preview bundle as the budget.
- Verify synthetic claim/value/reference consistency across conversation, analysis, documents, and exports.
- Registry items install and render in a clean consumer; stories show all required states.
- Use existing typed analytics helpers if instrumenting the internal evaluation; record event enums and IDs, not prompt or document text.

## 16. Priority and release sequence

### Phase 1 — Complete margin journey

Build the conversation, work-state system, answer composition, evidence inspector, and working view using the synthetic margin fixture. Include a short answer, slow research, clarification, partial findings, interruption, and rendering failure. Draft the Output Principles, Chat States, Response Writing, Content Grammar, and Motion references alongside the UI. Review the complete flow on desktop and mobile.

### Phase 2 — Document journey

Build the structured document model, decision memo/performance report templates, editor, targeted revision preview, local fixture persistence, and PDF/DOCX exports. Review short and stress documents visually. Preserve direct edits and revisions across the chat-to-document flow.

### Phase 3 — Reusable library and transfer

Extract the validated patterns, add full stories and the private registry, and build Browse/Compose/Experience. Transfer the same design language to inventory and promotion fixtures. Add the operator brief and action-plan recipes as P1.

### Phase 4 — Production integration handoff

Map the presentation records to the existing output source, confirm the authoritative May Day publishing location, and review the production route/feature gate. Record any data limitations as interface behavior and integration notes. Deployment follows the team's existing release process.

There is no committed calendar deadline or staffing estimate. Estimate after the editor/export and chat primitive integration checks. A renderer comparison or paid editor decision should resolve in a bounded spike with a written result, rather than indefinitely delaying the first designed journey.

### P1 and later work

P1 includes inventory/promotion transfer, the two additional document recipes, richer annotations, and reviewed mobile refinements. P2 includes live collaboration, reusable organization templates, multiple external-host adapters, proactive home recommendations, and extensive personalized layouts. These should be evaluated after the initial workflow is usable.

Backend redesign, executing store changes, importing entire design systems, a general storefront/site builder, and an unrestricted arbitrary-code UI generator are outside this release scope.

## 17. Decisions and open questions

| Decision | Default for the build | Owner / timing |
|---|---|---|
| Scope | Presentation, complete synthetic operator journey, and documents | Resolved by the user in this conversation. |
| First task | Margin investigation → decision memo; inventory and promotions follow | Product can change the first fixture without blocking foundation work. |
| Visual foundation | May Day tokens and components; fill assistant/output gaps | Design during Phase 1. |
| Chat primitives | Evaluate assistant-ui against the current surface on one complete flow | Frontend; resolve before locking a new chat dependency. |
| Composition engine | Existing adapter baseline; compare OpenUI/json-render on the same full journey | Frontend/design; no engine winner inferred from the smoke spike. |
| Document editor | Open foundation: evaluate Tiptap core or Lexical; paid Pages/Conversion requires explicit selection | Frontend/product during Phase 2. |
| Export renderer | Evaluate React-pdf and docx against short and stress fixtures | Frontend during Phase 2. |
| Canonical May Day repository | Existing local source for reference; publishing identity still unresolved | Team owner before library publication. |
| Actual operators and success baseline | Start with formative evaluation; recruit representative growth/finance/ops roles | Product/design before claiming measured improvement. |
| DOCX verification viewer | Select the team's primary Word-compatible viewer and document coverage | Product/frontend before export sign-off. |

These open implementation choices do not require the user to provide backend contracts before the design build starts.

## 18. Definition of done for the first build

- One coherent Souvenir conversation demonstrates prompt → working/thinking → researching → partial answer → completed analysis → targeted refinement → editable document → PDF and DOCX.
- The same journey demonstrates clarification, delay, interruption, rejected revision, malformed content, and export failure without losing completed work or edits.
- Writing, typography, figures, motion, and document composition follow versioned standards with representative examples.
- The implementation passes the production quality gates and reports any remaining limitations.
- Engineers can inspect the component state stories and install at least one real registry item.
- A complete walkthrough and exported artifacts are available for product/design review. The default preview shows the intended operator experience.
- The work is committed on the Souvenir branch, with a reviewable diff. Publishing or deploying follows the user's subsequent instruction and normal team process.

## 19. Verified references

- [Local research handoff](README.md), [reuse atlas](ATLAS.md), [package ledger](INSTALLS.md), [existing inventory](INVENTORY.md).
- [Fluid Functionalism](https://www.fluidfunctionalism.com/), [source repository](https://github.com/mickadesign/fluid-functionalism), [motion guidelines](https://github.com/mickadesign/fluid-functionalism/blob/main/motion-guidelines.md), [ThinkingSteps source](https://github.com/mickadesign/fluid-functionalism/blob/main/registry/radix/thinking-steps.tsx), [ThinkingIndicator source](https://github.com/mickadesign/fluid-functionalism/blob/main/registry/default/thinking-indicator.tsx).
- [assistant-ui primitives](https://www.assistant-ui.com/docs/primitives), [OpenUI interface](https://github.com/thesysdev/openui/blob/main/docs/content/docs/agent/getting-started/introduction.mdx), [json-render](https://github.com/vercel-labs/json-render), [CopilotKit chat layout](https://docs.copilotkit.ai/reference/v2/components/CopilotChatView).
- [Shopify Canvas](https://www.shopify.com/news/introducing-canvas), [Sidekick Pulse](https://help.shopify.com/en/manual/ai-powered-tools/sidekick/pulse), [ChatGPT Canvas](https://academy.openai.com/en/public/clubs/work-users-ynjqu/resources/canvas), [Claude Artifacts](https://support.anthropic.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them).
- [Tiptap Pages and paid-package boundary](https://tiptap.dev/docs/pages/getting-started/overview), [Lexical](https://lexical.dev/docs/intro), [React-pdf v4](https://react-pdf.org/docs/v4/advanced), [docx](https://docx.js.org/).

Upstream behavior and licensing can change. References support specific patterns; they do not prove Souvenir has implemented them or establish that its proposed experience is uniquely novel.
