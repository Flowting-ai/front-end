# Chat Components

This folder contains the chat UI building blocks used by chat screens and persona flows.

Removals (2026-01)
- Removed `chat-box-main.tsx` and `chat-box-main.module.css`.
  - Why: The component was not referenced anywhere in the app. The canonical chat surface is `ChatInterface` (`src/components/chat/chat-interface.tsx`), which composes message rendering, initial prompts, and reference banner.
  - Where to find if needed: Check git history on `src/components/chat/` (branch/tag prior to 2026-01-07) to retrieve the old component. The newer flow centralizes layout concerns under `AppLayout` + `Topbar`.
  
Notes
- Token usage UI: component `TokenTracker` exists but is disabled in the top bar. See comment in `src/components/layout/top-bar.tsx` on how to re-enable.
- Scrollbar style: the `customScrollbar` class was moved from `chat-interface.module.css` into the global stylesheet at `src/app/globals.css` so non-chat pages can reuse it without importing chat-specific CSS. References were updated to use the global class name `customScrollbar`.

- `ChatInterface` is used by multiple pages (home, personas configure, and per-persona chat). Supporting components like `chat-message`, `initial-prompts`, `reference-banner`, and the model selection dialogs are actively used and should be kept.
