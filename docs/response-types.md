# Response Types

Every assistant response falls into one of four types. The type determines which SSE events arrive and what the UI renders. The chat state machine in `use-chat-state.ts` handles all four.

---

## Type 1 — Simple

The default. No web search, no extended thinking. Fast.

**SSE event sequence:**
```
model_chosen { model_id, model_name }
text_start
text_delta × N
text_end
done
```

**What the UI does:**
1. `routing` → Souvenir logo animates
2. `model_chosen` → model chip appears in TopBar, transition to `model-chosen`
3. `text_start` → create new assistant MessageBubble, show StreamingCursor
4. `text_delta` × N → append to message, call `mergeStreamingText(current, incoming)`
5. `text_end` → remove StreamingCursor
6. `done` → transition to `complete`, unlock input, show copy/pin actions

---

## Type 2 — Research

Triggered when Souvenir's routing decides a web search is needed, or when the user's request explicitly involves current information.

**SSE event sequence:**
```
model_chosen { model_id, model_name }
research_start
research_source { title, url, snippet, favicon } × N
research_end
text_start
text_delta × N
text_end
done
```

**What the UI does:**
1. `routing` → Souvenir logo animates
2. `model_chosen` → model chip in TopBar
3. `research_start` → show ResearchPanel above input, transition to `researching`
4. `research_source` × N → each source card animates in sequentially (see `docs/animation-states.md → Pattern 5`)
5. `research_end` → ResearchPanel collapses to a pill (height + opacity transition)
6. `text_start` → create assistant MessageBubble with StreamingCursor
7. `text_delta` × N → stream text
8. `text_end` → remove cursor
9. `done` → `complete`, sources available in CitationsPanel on the message

**CitationsPanel after complete:**
- Collapsed by default below the message
- Expands on click
- Shows all `research_source` items with title, URL, and snippet
- Citations in message text link back to source index (e.g. `[1]`, `[2]`)

---

## Type 3 — Thinking + Response

Triggered by complex prompts that use chain-of-thought models. The model reasons before responding.

**SSE event sequence:**
```
model_chosen { model_id, model_name }
thinking_start
thinking_delta × N    ← raw thinking text, may be long
thinking_end
text_start
text_delta × N
text_end
done
```

**What the UI does:**
1. `model_chosen` → model chip in TopBar
2. `thinking_start` → create ReasoningBlock (collapsed header + expanding content), transition to `thinking`
3. `thinking_delta` × N → append to ReasoningBlock content area, parse step boundaries
4. `thinking_end` → seal ReasoningBlock, transition to `model-chosen`
5. `text_start` → create MessageBubble below the sealed ReasoningBlock
6. `text_delta` × N → stream text
7. `text_end`, `done` → `complete`

**ReasoningBlock behavior:**
- Starts expanded during `thinking` phase so user can watch reasoning live
- Automatically collapses when `thinking_end` fires
- User can re-expand at any time (toggle)
- Header: "Reasoning · {N} steps"
- Content: monospace font, scrollable, raw thinking text
- Use expand/collapse Pattern 1 from `docs/animation-states.md`

---

## Type 4 — Research + Thinking (combined)

Both research and chain-of-thought reasoning. Complex queries only.

**SSE event sequence:**
```
model_chosen { model_id, model_name }
thinking_start
thinking_delta × N
thinking_end
research_start
research_source × N
research_end
text_start
text_delta × N
text_end
done
```

Handle this by composing Types 2 and 3. The ReasoningBlock seals before the ResearchPanel appears.

---

## Determining the type at runtime

You don't know the type until events arrive. The `use-chat-state.ts` hook reacts to incoming SSE events:

```ts
function reducer(state: ChatState, event: SSEEvent): ChatState {
  switch (event.type) {
    case 'model_chosen':
      return { ...state, phase: 'model-chosen', modelName: event.model_name }

    case 'thinking_start':
      return { ...state, phase: 'thinking', reasoningContent: '' }

    case 'thinking_delta':
      return { ...state, reasoningContent: state.reasoningContent + event.content }

    case 'thinking_end':
      return { ...state, phase: 'model-chosen', reasoningSealed: true }

    case 'research_start':
      return { ...state, phase: 'researching', sources: [] }

    case 'research_source':
      return { ...state, sources: [...state.sources, event] }

    case 'research_end':
      return { ...state, phase: 'streaming', researchCollapsed: true }

    case 'text_start':
      return { ...state, phase: 'streaming', streamingContent: '' }

    case 'text_delta':
      return { ...state, streamingContent: mergeStreamingText(state.streamingContent, event.content) }

    case 'text_end':
    case 'done':
      return { ...state, phase: 'complete' }

    case 'error':
      return { ...state, phase: 'error', error: event }

    default:
      return state
  }
}
```

---

## ClarifyingQuestion — a special pre-response type

Before any of the 4 types above, the routing layer may decide the prompt is ambiguous and send a clarification request instead of routing to a model.

**SSE event sequence:**
```
clarification_needed { question: string, options: { id, label }[] }
```

**What the UI does:**
1. Render a `ClarifyingQuestion` component inside the assistant MessageBubble (pending component — placeholder from `docs/0`)
2. Input remains unlocked — user can either click an option chip or type a different message
3. When user selects an option: send a new stream request with `input = option.label`
4. The clarification bubble stays in the conversation history (read-only, selected option highlighted)
