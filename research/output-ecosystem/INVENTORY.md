# Souvenir inventory

Sources: this branch's `ds-dev` commit `c6fbe81`, and local May Day checkout `603b9b0` (its remote is `Souvenir-AI/may-day`; compare with the user-named `souvenir-inc/may-day` before copying changes). Paths below are relative to their own repositories. This is a code inventory, not a claim that every path is active in production traffic.

| Capability | `ds-dev` implementation and contract | May Day counterpart | Owner / reuse decision |
|---|---|---|---|
| Chat text | `src/components/chat/ChatMessage.tsx` composes text, reasoning, activities and structural blocks; `src/lib/markdown-utils.tsx` owns GFM, math, code, links and citation-aware rendering | `src/templates/Brain/StreamingMessageBubble.tsx`, `src/components/ChatInput/` | Frontend owns live chat behavior. May Day owns shared visual guidance; do not replace the parser for gallery work. |
| Inline XML widgets | `src/lib/content-parser.ts` recognizes 12 tags: table, chart, metrics, email, funnel, kanban, schedule, weather, map, steps, callout, tags. `Xml*.tsx` and parsers render them. | ChartCard, UsageBarChart, Brain cards | Frontend owns this legacy wire format and its streaming recovery. Catalog adapter can map it to semantic entries; do not make XML the new canonical contract. |
| Structured blocks | `src/types/chat.ts` has a 13-kind `ResponseBlock` union; `src/components/chat/ResponseBlocks.tsx` renders typed animated table, charts, steps, code, callout, tags, card, errors and follow-ups. Text blocks are handled separately in `ChatMessage.tsx`. | ChartCard and Brain activity/artifact cards | Frontend owns message integration; candidate first adapter to the Output Catalog. The two current formats overlap and need an explicit compatibility map. |
| Thinking and activity | `ReasoningBlock.tsx` has live status, collapsible timeline, tool/activity rows and duration display | `StreamingIndicator`, Brain `ActivityBlock`, `BrainTimeline`, `StreamingIndicator` | Use May Day motion and tokens as reference. Keep user-visible activity separate from private reasoning. |
| Citations and evidence | `CitationChip.tsx`, `ChatMessage.tsx` source handling, Markdown links | No equivalent evidence/provenance contract found in the inspected May Day paths | Product/backend must supply source IDs, definitions and freshness. Visual chips alone cannot establish provenance. |
| Documents | `src/components/DocumentCard/`, `ProjectDocumentCard/`; chat supports generated file cards and downloads | Brain `ArtifactCard` | Catalog needs document status and source manifest. These cards are previews, not a shared document payload standard. |
| Actions and questions | Chat prompt cards, approval/recovery widgets, follow-ups | Brain `ClarificationCard`, `ExternalOutputCard`, `PauseCard`, `FixProposalCard` | Backend owns action authority and result. Gallery examples must be simulated and label proposal, pending, completed and failed distinctly. |

## Current gaps

- No single typed semantic record binds a claim to metric definition, period, source, freshness and uncertainty across text, XML, ResponseBlock and document outputs.
- Component selection is coupled to two incompatible wire shapes. A registry must name the intended human task and adapter mapping rather than expose every XML tag as a separate design primitive.
- The production branch's [chat-output fixes note](../../docs%20v2/chat-output-fixes.md) reports frontend fixes plus remaining mobile and backend gaps. Verify each fix against the branch before claiming it is shipped; that note describes an earlier working tree.
- May Day has Storybook and relevant experience components, but the inspected checkout does not provide an installable, versioned Output-specific registry or catalog schema.
