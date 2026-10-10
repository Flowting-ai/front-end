# Souvenir Output Catalog v0.1 — proposed contract

This is a proposal for the product boundary, not a production API. The executable comparison uses the narrower Zod record in [`spikes/catalog.ts`](spikes/catalog.ts). The catalog does not let a UI framework decide facts, authority or completion.

## Two records, two owners

1. **Output record (backend-owned):** version, human task, claim, cited evidence, uncertainty, next step, requested interaction, authority state and outcome state. It is generated from authorized source snapshots and checked before rendering. The source snapshot and action result remain server-side.
2. **Presentation spec (renderer-owned):** approved component IDs, layout, emphasis, disclosure and motion. It can reference output-record IDs but cannot supply new numbers, claims, permission or action results.

The v0.1 spike record pins one answer to a `caseId`, a claim with `evidenceIds`, evidence items with source/status, uncertainty, next step and an optional `proposal_only` action. It rejects changed claim text and action authority against the frozen source. Production should replace fixture equality with stable source IDs, metric definitions, periods, freshness and backend action-state verification.

## Initial semantic entries

| Catalog ID | Purpose | Required data | Interaction boundary | Text fallback |
|---|---|---|---|---|
| `answer.finding` | Direct answer to the merchant's question | Claim plus supporting evidence IDs | No action | Claim followed by source references |
| `evidence.metric` | Show a value with definition and comparison | Value, unit/currency, period, comparison, source, checked time | Inspect source only | Label, value, period, source |
| `evidence.comparison` | Explain why two values differ | Both definitions, windows, sources and compatibility note | Expand details | Two labeled values and the definition difference |
| `answer.uncertainty` | State what is unknown or tentative | Scope and reason | No action | Plain caveat sentence |
| `answer.next_step` | Recommend a useful investigation | Concrete task and reason | Start an investigation only through an explicit tool contract | Plain recommendation |
| `decision.choice` | Ask for missing human judgment | Options, trade-off, consequence | Choose an option; never approval | Numbered options and confirmation path |
| `action.proposal` | Request a consequential approval | Target, change, cost/risk, reversibility, authority gap, version | Confirm/reject via backend; never execute from local UI state | Summary and secure confirmation handoff |
| `activity.status` | Show observable work | Phase, specific task, timestamp | Expand details | Status sentence |
| `outcome.receipt` | Show verified result | Backend result ID, final state, timestamp | Inspect result | Result sentence with ID |
| `artifact.document` | Take an answer out of chat | Title, period, sources, status, document URI | Open/download authorized artifact | Markdown link and summary |

The first gallery can show all ten entries, but only `finding`, `metric`, `uncertainty`, `next_step` and `action.proposal` are required for the three benchmark cases. `decision.choice` needs a fourth case before promotion. Components may be visually composed, but the semantic IDs remain stable.

## Validation sequence

```text
authorized source snapshot + backend action state
    → versioned Output record
    → structural schema and source/authority checks
    → renderer capability filter
    → presentation spec from approved catalog IDs
    → presentation schema + semantic reference check
    → May Day component / text fallback / external host adapter
```

For every consequential output, reject unknown component IDs, missing evidence, a claim that cites absent facts, unsupported values, an action absent from the backend decision, and a completion state without a verified result. On malformed presentation, retain the validated plain-text answer and log the rejected spec. On a text-only host, send the same answer and a secure action handoff rather than a fake local approval button.

## Versioning and transport

- Version the semantic record and catalog separately (`souvenir-output-0.1` and renderer catalog ID). Store both with each run for replay.
- Start with an adapter to the frontend's typed `ResponseBlock` path. Keep the XML parser as a compatibility path; do not make XML attributes the source of truth.
- Generate OpenUI/json-render/A2UI specs from the same validated record. AG-UI can carry events if adopted, but it does not replace either record.
- Internal installable components export React props and stories. The wire schema is separate so Slack, document and MCP Apps renderers can share meaning without sharing React markup.
