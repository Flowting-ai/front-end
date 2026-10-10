# Ranked reuse atlas

Checked October 9, 2026 (Pacific time). Versions are npm registry versions checked during this pass, not endorsements or upgrade instructions. “Active” means the upstream GitHub repository had a recent push; it is not a support guarantee. All candidates must be pinned and license-reviewed at the exact commit/package before code is copied.

## Priority order for Souvenir

1. **Adopt the existing frontend and May Day inventory.** `ds-dev` already renders text, citations, XML widgets, typed blocks, thinking, and documents. May Day supplies brand primitives and Storybook. The missing layer is a shared evidence/action contract, not another generic card.
2. **Adapt assistant-ui or AI Elements for experience patterns.** assistant-ui's [`@assistant-ui/react-generative-ui@0.1.0`](https://github.com/assistant-ui/assistant-ui/tree/main/packages/react-generative-ui) exposes a model-facing approved-component tool; AI Elements supplies installable source components. Neither establishes merchant facts or authority.
3. **Experiment with OpenUI and json-render on the same catalog.** The executable smoke spike passed exact text-presence checks for both. OpenUI supports a custom library and incremental parser; json-render offers catalog validation and devtools. Both still need browser and malformed-stream comparisons.
4. **Keep A2UI as a portability arm.** Its React v0.9 renderer uses a message processor and component catalog. The local JSDOM harness produced text but also a Markdown-renderer warning; the browser preview mounted. Its candidate v1.0 protocol is ahead of its maintained React renderer.
5. **Keep AG-UI/CopilotKit separate from component choice.** Their value is runtime events, state and interaction. The existing production SSE path needs a measured migration benefit before replacement.

## Components and composition

| Candidate | Exact package/version or source | License / React fit | Maintenance and working example | Verdict and precise reuse |
|---|---|---|---|---|
| Souvenir `ds-dev` | Local branch `c6fbe81`; React 19.2.4, Next 16.2.4 | Souvenir-owned; already integrated | Production paths in [inventory](INVENTORY.md) | **Adopt:** parser, Markdown, current widgets, thinking and document cards as baseline. |
| May Day | Local checkout `603b9b0`; remote `Souvenir-AI/may-day` | Internal source; React 19.2.3, Next 16.1.6 | Storybook in checkout; compare remote identities before merging | **Adopt/adapt:** tokens, chart, streaming, artifact and activity presentation; no parallel chat runtime. |
| [assistant-ui](https://github.com/assistant-ui/assistant-ui) | `@assistant-ui/react@0.15.26`; `@assistant-ui/react-generative-ui@0.1.0` | MIT; React 18/19, Zod 4 | Active; [approved component example](https://github.com/assistant-ui/assistant-ui/blob/main/packages/react-generative-ui/README.md) | **Experiment:** `present` tool and source-owned chat primitives. Existing chat may make full runtime adoption costly. |
| [Vercel AI Elements](https://github.com/vercel/ai-elements) | `ai-elements@1.9.0` CLI/registry | Apache-2.0; targets React 19, Tailwind 4, shadcn and AI SDK | Repo maintained; [registry example](https://github.com/vercel/ai-elements) | **Adapt selected source:** reasoning, tool and message states; avoid installing all and avoid making AI SDK a hidden runtime requirement. |
| [Ant Design Agentic UI](https://github.com/antdigital-ai/agentic-ui) | `@ant-design/agentic-ui@2.32.48` | MIT; React accepted, but requires Ant Design 5.29–6 plus other peers | Active; Bubble, ThoughtChainList, TaskList, ToolUseBar examples | **Reference:** state vocabulary and accessibility; wholesale package introduces a second visual system. |
| [Fluid Functionalism](https://github.com/mickadesign/fluid-functionalism) | Source registry, commit to pin before import | MIT; React/shadcn oriented | Active; [thinking and control demos](https://www.fluidfunctionalism.com/) | **Adapt selectively:** timing, reduced-motion and state transitions; retain May Day tokens. |
| [OpenUI](https://github.com/thesysdev/openui) | `@openuidev/react-lang@0.3.2`; optional `@openuidev/react-ui@0.17.0` | MIT; React 19 compatible, Zod 3.25/4 | Active; [custom library and renderer](https://github.com/thesysdev/openui/blob/main/packages/react-lang/README.md) | **Experiment:** custom Souvenir component library, prompt generation, streaming parser. Use renderer without replacing the chat shell first. |
| [json-render](https://github.com/vercel-labs/json-render) | `@json-render/core@0.21.0`, `@json-render/react@0.21.0` | Apache-2.0; React 19.2.3+, Zod 4 | Active; [catalog/renderer example](https://github.com/vercel-labs/json-render) | **Experiment:** typed catalog, spec validation and devtools; compare JSON/tree overhead and stream recovery. |
| [A2UI](https://github.com/a2ui-project/a2ui) | `@a2ui/react@0.13.0`, `@a2ui/web_core@0.13.0`; use v0.9 import path | Apache-2.0; React 18/19, renderer expects browser environment | Active; [processor and React example](https://github.com/a2ui-project/a2ui/blob/main/renderers/react/README.md). [v1.0 React renderer planned](https://github.com/a2ui-project/a2ui/blob/main/docs/public/reference/renderers.md) | **Experiment later:** portability, capability negotiation and data binding; basic browser mount passed, but custom catalog and streaming remain open. |
| [Tambo](https://github.com/tambo-ai/tambo) | `@tambo-ai/react@1.4.0` | MIT; React 18/19 | Active repo; hosted Tambo Cloud says it ends October 31, 2026 | **Reference/experiment only:** evaluate self-host path before dependency; do not couple Souvenir to retiring hosted service. |

## Runtime and portable tool surfaces

| Candidate | Exact package/version or source | License / fit | Verdict and precise reuse |
|---|---|---|---|
| [AG-UI](https://github.com/ag-ui-protocol/ag-ui) | `@ag-ui/client@1.0.2`; [protocol source](https://github.com/ag-ui-protocol/ag-ui) | MIT; framework-neutral events | **Experiment:** map existing SSE message/tool/finish/error events into AG-UI and compare replay and interruption behavior. No UI component adoption implied. |
| [CopilotKit](https://github.com/CopilotKit/CopilotKit) | `@copilotkit/react-core@1.78.0` | MIT; React 18/19 | **Reference/experiment:** run [Static, MCP Apps and A2UI playground](https://github.com/CopilotKit/CopilotKit/blob/main/examples/showcases/generative-ui-playground/README.md); adopt only if runtime migration outperforms current chat integration. |
| [MCP Apps](https://github.com/modelcontextprotocol/ext-apps) | `@modelcontextprotocol/ext-apps@2.0.3` | Mixed MIT/Apache-2.0 transition; React 17–19 | **Reference:** sandboxed, interactive external-host widgets. It is a distribution surface, not Souvenir's internal chat renderer. Check file-level license before copying. |
| [MCP-UI](https://github.com/MCP-UI-Org/mcp-ui) | `@mcp-ui/client@7.1.1` | Apache-2.0; React 18/19 | **Reference:** host-side UI resource renderer and bridge if Souvenir later serves widgets to external agents. |
| [OpenAI Apps SDK examples](https://github.com/openai/openai-apps-sdk-examples) | Repository examples, no package pinned | MIT; host-specific | **Reference:** widget state, tool output and display-mode examples; not a generic component package. |

## Block systems, merchant patterns and distribution

| Candidate | Exact package/version or source | License / maintenance | Verdict and precise reuse |
|---|---|---|---|
| [Slack Block Kit](https://github.com/slackapi/node-slack-sdk/blob/main/packages/types/src/block-kit/blocks.ts) | `@slack/types@3.2.0` | MIT; active SDK | **Reference:** bounded message blocks, actions, field limits and visual builder. Souvenir's web catalog should be analogous, not a copy of Slack JSON. |
| [Adaptive Cards](https://github.com/microsoft/AdaptiveCards) | `adaptivecards-designer@2.4.4`; avoid old React wrapper | MIT; active repository | **Reference:** host fallback, schema validation, editable visual designer and refresh lifecycle. |
| [Shopify Polaris React archive](https://github.com/Shopify/polaris-react-archive) | `@shopify/polaris@13.9.5` | Custom restricted license; archived September 2026; React peer is 18 | **Reject code import:** use merchant interaction research only. |
| [Shopify Sidekick app actions](https://shopify.dev/docs/apps/build/sidekick/build-app-actions) | Official product docs and [intent examples](https://github.com/Shopify/app-intent-types), not a reusable React package | Shopify-controlled | **Reference:** scoped intents, prefilled state and merchant confirmation; never treat a rendered button as authority. |
| [IBM Carbon](https://github.com/carbon-design-system/carbon) | `@carbon/react@1.118.0` | Apache-2.0; React 16–19, active | **Reference:** thorough state/a11y documentation; adopting all components would conflict with May Day. |
| [Vercel Geist](https://vercel.com/geist/introduction) | Official visual documentation; no verified public `@vercel/geistcn` npm package | Official design source, not a confirmed installable kit | **Reference:** hierarchy and density. Do not mistake the [community Geist UI project](https://github.com/geist-org/geist-ui) for Vercel's official source. |
| [shadcn registry](https://github.com/shadcn-ui/registry-template) | `shadcn@4.21.4` CLI and published registry-item schema | CLI MIT; template repository has no license detected by GitHub API | **Adopt format/CLI:** publish Souvenir-authored private registry items. Do not copy template source until license confirmed. |

## Why this ranking is provisional

The executable spike tests three static, frozen synthetic outputs, with a basic Chromium mount, 390 px overflow check, and one-case axe scan. It does **not** test live model selection, streamed UI repair beyond OpenUI parser completion, full keyboard/accessibility behavior, or total production bundle change. [Benchmark](BENCHMARK.md) defines those missing gates. The largest shared limitation is semantic: every renderer accepted ordinary strings; none independently checked whether a number or action was authorized by the source snapshot.
