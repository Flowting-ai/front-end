# Engineer handoff and decision gate

This branch produces a research atlas, reproducible static spikes, and a browser comparison preview. It deliberately does not install a new rendering framework into production or choose one. The user asked for a decision after equal-input evidence, and the streaming and integration gates in [BENCHMARK.md](BENCHMARK.md) are still open.

## Ownership

| System | Owns | Must not own |
|---|---|---|
| Backend/product | Authorized source snapshot, metric definitions, action authority, verified result, Output record | Visual layout |
| May Day | Souvenir tokens, source components, Storybook states, private registry items | Merchant source truth or action execution |
| `ds-dev` frontend | Chat shell, streaming, renderer adapters, text fallback, gallery workbench | Permission inference from rendered controls |
| OpenUI/json-render/assistant-ui/A2UI candidate | Presentation spec parsing and approved component rendering | New facts, authority, or completed-state claims |
| AG-UI/CopilotKit candidate | Event transport/runtime if a measured integration benefit exists | The semantic catalog or source validation |

## Sequenced implementation

1. **Resolve the May Day source identity.** The inspected local checkout points to `Souvenir-AI/may-day`, while the user provided `souvenir-inc/may-day`. Confirm which is authoritative and pin its commit before moving components.
2. **Add an Output record on the backend.** Use the [catalog proposal](CATALOG.md) to bind claims to evidence IDs and action proposals to backend authority state. Replace synthetic equality with authorized source IDs, definitions, period, freshness and result IDs. Preserve existing chat payloads during migration.
3. **Build a compatibility adapter in `ds-dev`.** Map validated records to the current ResponseBlock renderer and plain text; keep XML support for older replies. Test that the two paths show identical facts and cannot create a local completion claim.
4. **Run the browser comparison.** Add OpenUI, json-render, assistant-ui and A2UI only to an isolated gallery route or preview chunk. Use the three fixtures and failure matrix from [benchmark](BENCHMARK.md). Measure build output, console, axe, keyboard, mobile and hours spent integrating.
5. **Choose one composition adapter.** Score semantic preservation and fallback as pass/fail gates; among passing candidates compare authoring cost, streaming quality, browser behavior and production bundle delta. If none passes, continue with controlled ResponseBlock composition.
6. **Publish the internal library.** Add the approved components to the authoritative May Day Storybook and a private, versioned registry. `ds-dev` consumes pinned items or an adapter package. Build the Browse/Compose/Experience workbench from [gallery spec](GALLERY.md).
7. **Evaluate runtime migration separately.** Map one production turn into AG-UI events and replay it; adopt CopilotKit only if it removes more streaming/state complexity than it adds. Keep the semantic record and renderer decision independent.

## Review package and release criteria

This branch gives engineers the [inventory](INVENTORY.md), [ranked atlas](ATLAS.md), [catalog](CATALOG.md), [gallery spec](GALLERY.md), frozen fixtures, runnable adapters and raw benchmark output. The next review should name an owner for backend facts/authority, May Day registry, frontend adapter and browser QA.

The engine decision is ready only when the browser comparison passes all three scenarios, source/action mutations are blocked, malformed UI has a readable fallback, keyboard/mobile/reduced-motion states work, and real integration/bundle costs are recorded. No screenshot, package popularity or model prompt alone can satisfy that gate.
