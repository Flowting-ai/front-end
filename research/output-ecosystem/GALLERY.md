# Internal Output Gallery specification

**Audience:** Souvenir frontend, backend and design engineers. **Home:** a private May Day Storybook section plus a small research workbench in a branch of `ds-dev`. The production integration consumes the catalog; the workbench is for evaluation. No public registry is required.

## Information architecture

| Mode | Engineer task | Required controls and evidence |
|---|---|---|
| **Browse** | Find a component or answer pattern | Filter by human task, semantic ID and host; inspect complete/loading/empty/error/narrow states; read required data and authority boundary; view source, Storybook story, install command and version. |
| **Compose** | See whether a renderer preserves a frozen answer | Scenario selector (diagnosis, comparison, approval); five lanes (existing frontend, assistant-ui, OpenUI, json-render, A2UI); editable presentation payload; Validate and Reset buttons; side-by-side rendered result, raw spec, errors, missing facts and authority changes. Editing a fact in a presentation spec fails validation. |
| **Experience** | Test the full interaction | Replay a deterministic stream with thinking/activity row, text, evidence, optional proposal, interrupted/malformed toggle, mobile width and reduced-motion toggle. Approval is simulated and labeled; no merchant action executes. |

### Page and component detail

- `/output-gallery` opens on Browse. Each card shows a human-task label and one real component state, not only an icon.
- `/output-gallery/compose` selects one frozen case. Compare uses the same source object and shows a semantic diff before it compares visual design. A failed renderer displays its error and text fallback; it never hides the answer.
- `/output-gallery/experience` has **Play**, **Pause**, **Interrupt**, **Malformed widget**, **Reset**, **Inspect source**, and **Copy payload** controls. It records no private reasoning. The activity row describes observable work only.
- Each component detail has Props/Schema, States, Accessibility, Usage, Source, Install and Changelog tabs. The engineer can copy a valid payload and a failing payload.

## Private registry and fetching

Publish Souvenir-authored components as registry items compatible with the [shadcn registry schema](https://github.com/shadcn-ui/ui/blob/main/apps/v4/content/docs/registry/examples.mdx). Serve them behind internal access at a versioned URL such as `/r/v0.1/answer-finding.json`. Keep the source in May Day and generate registry JSON in CI; do not copy from the registry back into May Day.

An item includes files, peer dependencies, token prerequisites, semantic catalog ID, story URL, and a pinned version. The gallery shows the authenticated install command and a manual source link. The consumer records the installed registry version so upgrades are explicit. The `ds-dev` app uses an adapter package or pinned source copy; adding an item must not silently alter existing XML or ResponseBlock behavior.

The [shadcn template](https://github.com/shadcn-ui/registry-template) demonstrates this distribution shape, but GitHub did not report a template license in this pass. Use its documented registry format and CLI; check the template's license before copying its source.

## Review checklist

Every promoted entry must have: a source-linked fixture, permitted and prohibited implications, text fallback, keyboard and screen-reader behavior, narrow layout, reduced-motion state, malformed-input behavior, story, install artifact and owner. A screenshot alone cannot promote a component.
