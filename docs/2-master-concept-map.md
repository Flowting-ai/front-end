# Master Concept Map — Souvenir V2 Frontend

A single Mermaid diagram synthesising the full system: team, process, codebase layers, and feature architecture.

**To paste into FigJam:** `/` → type "Mermaid" → paste diagram below → Insert.

---

```mermaid
graph TD

  %% ── Team ──────────────────────────────────────────────
  Team["Team"] -->|"owns"| Product["Souvenir V2 Product"]

  Team -->|"includes"| Chai["Chai · Design + Product\nFigma specs · PRDs · QA sign-off"]
  Team -->|"includes"| Utkarsh["Utkarsh · Kaya DS\nStorybook · component build · ONLY DS"]
  Team -->|"includes"| Shyam["Shyam · Feature Build\nconsumes DS · wires to API"]
  Team -->|"includes"| Kunal["Kunal · Feature Build\nconsumes DS · wires to API"]
  Team -->|"includes"| Sahil["Sahil · Backend API\ndevapi.getsouvenir.com · 56 endpoints"]

  %% ── Design System ─────────────────────────────────────
  Chai -->|"specs components"| DS["Kaya Design System\ngithub: strange-rock/kaya-design-system"]
  Utkarsh -->|"builds + Storybooks"| DS

  DS -->|"18 component families ready"| DSReady["Ready Components\nButton · Sidebar · ChatInput · Pin · Pinboard\nDropdown · FloatingMenu · Tooltip · Popover\nInputField · ModelSelector · Tabs · Badge · Chip"]
  DS -->|"8 components pending"| DSPending["Pending Components\nMessageBubble · StreamingIndicator\nClarifyingQuestion · HighlightPopover\nComparePanel · ShareButton\nUserNameDisplay · UsageCreditsButton"]

  %% ── V2 Codebase ────────────────────────────────────────
  DSReady -->|"COPY verbatim into"| V2Code["V2 Codebase\nsrc/components/[Name]/index.tsx"]
  DSPending -->|"placeholder in"| V2Code

  V2Code -->|"logic layered via"| Wrappers["Wrappers + Hooks\nAppButton · useChatInput · useModelSelector\n(business logic never in copied source)"]

  %% ── API Layer ──────────────────────────────────────────
  Sahil -->|"provides"| API["V2 API\nPOST /chats/{id}/stream · SSE\nGET /chats · GET /llm/models\nPOST /pins · GET /pins\nPOST /users/me · GET /users/me"]

  %% ── Chat Feature ───────────────────────────────────────
  Wrappers -->|"builds"| ChatFeature["Chat Board Feature\nsrc/app/(app)/chat/page.tsx"]

  ChatFeature -->|"phases through"| Phase1["idle\nInitialPrompts shown"]
  Phase1 -->|"user submits"| Phase2["user-sent\nmessage appears · input disabled"]
  Phase2 -->|"SSE opens"| Phase3["routing\nSouvenir logo animates"]
  Phase3 -->|"thinking event"| Phase4["thinking\nReasoningBlock visible"]
  Phase4 -->|"model-chosen event"| Phase5["model-chosen\nmodel chip in TopBar"]
  Phase5 -->|"research mode"| Phase6["researching\nsources load one by one"]
  Phase5 -->|"simple mode"| Phase7["streaming\ntext streams · cursor blinks"]
  Phase6 -->|"sources complete"| Phase7
  Phase7 -->|"stream ends"| Phase8["complete\ncopy · pin actions appear"]
  Phase3 -->|"error event"| Phase9["error\ninline · non-blocking · retryable"]

  %% ── Chat Components ────────────────────────────────────
  ChatFeature -->|"composed of"| ChatComp["Chat Components\nChatInterface · ChatMessage\nStreamingMessage · ReasoningBlock\nCitationsPanel · ModelSelector\nChatInput · InitialPrompts"]

  ChatComp -->|"renders via"| DSReady
  ChatComp -->|"placeholders via"| DSPending

  %% ── Left Sidebar ───────────────────────────────────────
  Wrappers -->|"builds"| Sidebar["Left Sidebar\nsrc/components/layout/LeftSidebar.tsx"]
  Sidebar -->|"uses"| SidebarKDS["KDS Sidebar + SidebarMenuItem\n+ SidebarProjectsSection"]
  Sidebar -->|"loads from"| ChatHistory["GET /chats\n(title · model · timestamp · starred)"]

  %% ── Token System ───────────────────────────────────────
  DS -->|"ships"| Tokens["CSS Token System\nPrimitives → Aliases → Semantics\nNEVER hardcode hex"]
  Tokens -->|"dark mode via"| DarkMode["Dark Mode\n.dark {} block · auto after Individual Chat ships\nzero code change if tokens used correctly"]

  %% ── V1 Lib Files ───────────────────────────────────────
  V1["V1 Codebase\ngithub: Flowting-ai/front-end"] -->|"copy verbatim"| V1Libs["Keep Verbatim\nstreaming.ts · thinking.ts · config.ts\nerror-reporter.ts · chat-tones.ts\nplan-config.ts · api/client.ts · api-client.ts"]
  V1Libs --> V2Code
```

---

## Reading the map

| Cluster | What it shows |
|---------|--------------|
| Team | Who does what — Utkarsh = DS only, Shyam/Kunal = features |
| Design System | What's ready vs pending, and the copy-not-import mechanism |
| V2 Codebase | How copied components get business logic layered on top |
| Chat Feature | The 10-phase chat state machine and its component composition |
| Left Sidebar | Separate feature, simpler state, same copy pattern |
| Token System | Why no hex values, and how dark mode arrives for free |
| V1 Lib Files | The 8 files Shyam copies verbatim — no rewriting |
