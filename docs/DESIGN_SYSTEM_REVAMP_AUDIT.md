# Design System Revamp — Full Codebase Audit

> Generated: 2026-04-08 | Next.js 16.1 + React 19 + Tailwind v4 + TypeScript 5

---

## 1. Codebase Overview

| Metric | Value |
|--------|-------|
| **Total Source Files** | 217 |
| **Total Source Size** | 2.97 MB |
| **Components** | 99 files |
| **Library / Utilities** | 37 files |
| **Pages (app routes)** | 40 files |
| **Hooks** | 7 files |
| **Types** | 2 files |
| **Context** | 1 file |
| **CSS Module Files** | 7 files |
| **Inline `style={}` occurrences** | 351 |
| **`useState` occurrences** | 541 |
| **`useEffect` occurrences** | 211 |
| **`localStorage` usages** | 32 |
| **`dangerouslySetInnerHTML`** | 4 |
| **`window.addEventListener`** | 11 |
| **Direct fetch/apiFetch calls** | 64 |

---

## 2. File Inventory — Sorted by Size (Descending)

### Critical Files (>1000 lines)

| File | Size (KB) | Lines | Concern |
|------|-----------|-------|---------|
| `src/components/chat/chat-interface.tsx` | 182.69 | 4,454 | MIXED — 30+ useState, heavy normalization, streaming |
| `src/app/personas/new/configure/page.tsx` | 174.09 | 3,513 | MIXED — persona builder with heavy form logic |
| `src/components/chat/chat-message.tsx` | 77.15 | 2,152 | MIXED — markdown/KaTeX/code rendering + parsing |
| `src/components/layout/app-layout.tsx` | 81.08 | 2,151 | MIXED — metadata extraction, chat history, state hub |
| `src/components/workflows/workflow-api.ts` | 66.62 | 1,911 | LOGIC ✓ — well-separated API layer |
| `src/components/workflows/WorkflowCanvas.tsx` | 71.14 | 1,885 | MIXED — canvas + execution engine + undo/redo |
| `src/app/personas/new/configure/persona-configure.module.css` | 36.34 | 1,778 | CSS — oversized module stylesheet |
| `src/components/compare/compare-models.tsx` | 61.00 | 1,654 | MIXED — model transforms + comparison UI |
| `src/components/layout/left-sidebar.tsx` | 72.00 | 1,547 | MIXED — animation + event bus + filtering |
| `src/components/pinboard/organize-pins-dialog.tsx` | 65.24 | 1,538 | MIXED — folder tree + drag/move + search |
| `src/components/workflows/WorkflowChatInterface.tsx` | 56.40 | 1,294 | MIXED — streaming + markdown rendering |
| `src/components/pinboard/pin-item.tsx` | 51.89 | 1,255 | MIXED — 20+ useState, tags/comments/folders |
| `src/app/globals.css` | 31.72 | 1,204 | CSS — global theme + Tailwind config |
| `src/components/layout/right-sidebar.tsx` | 44.83 | 1,192 | MIXED — 5 panel types, duplicate normalizers |
| `src/components/workflows/WorkflowChatFullPage.tsx` | 45.71 | 1,089 | MIXED — 60% duplicate of WorkflowChatInterface |
| `src/app/personas/admin/page.tsx` | 46.31 | 1,042 | MIXED — admin table + bulk actions |

### Large Files (500–999 lines)

| File | Size (KB) | Lines | Concern |
|------|-----------|-------|---------|
| `src/app/personas/page.tsx` | 41.81 | 987 | MIXED — gallery + hardcoded template data |
| `src/components/chat/model-switch-dialog.tsx` | 40.07 | 934 | MIXED — model filter + memory calc + pin select |
| `src/app/workflows/admin/page.tsx` | 36.15 | 792 | MIXED — duplicates personas/admin utils |
| `src/components/ui/sidebar.tsx` | 21.75 | 670 | UI ✓ — ShadCN compound component |
| `src/components/chat/model-selector-dialog.tsx` | 27.02 | 671 | DUPLICATE — 70% overlap with model-switch-dialog |
| `src/components/personas/unified-row.tsx` | 27.63 | 629 | UI ✓ — well-structured row component |
| `src/app/personas/personas.module.css` | 13.40 | 615 | CSS |
| `src/components/workflows/SelectPinsDialog.tsx` | 23.29 | 596 | MIXED |
| `src/app/settings/usage-and-billing/page.tsx` | 23.57 | 540 | MIXED |
| `src/app/personas/new/configure/persona-form.module.css` | 11.89 | 564 | CSS |

### Medium Files (200–499 lines)

| File | Size (KB) | Lines | Concern |
|------|-----------|-------|---------|
| `src/components/pricing/pricing-cards-grid.tsx` | 18.13 | 435 | UI |
| `src/lib/api/personas.ts` | 15.12 | 429 | LOGIC ✓ |
| `src/components/workflows/SelectModelDialog.tsx` | 17.28 | 400 | MIXED |
| `src/components/workflows/CustomNode.tsx` | 15.13 | 380 | UI |
| `src/components/personas/persona-row.tsx` | 14.14 | 338 | UI |
| `src/app/personas/new/page.tsx` | 13.94 | 340 | MIXED |
| `src/app/settings/account/page.tsx` | 13.10 | 325 | MIXED |
| `src/lib/api/pins.ts` | 10.35 | 318 | LOGIC ✓ |
| `src/components/workflows/workflow-graph.ts` | 10.50 | 301 | LOGIC ✓ |
| `src/app/settings/usage-and-billing/change-plan/page.tsx` | 11.05 | 293 | MIXED |
| `src/components/workflows/workflow-row.tsx` | 10.78 | 285 | UI |
| `src/components/workflows/workflow-utils.ts` | 10.06 | 285 | LOGIC ✓ |
| `src/app/settings/routing/page.tsx` | 12.20 | 284 | UI |
| `src/lib/api/user.ts` | 9.26 | 268 | LOGIC ✓ |
| `src/components/workflows/DocumentNodeInspector.tsx` | 9.32 | 265 | UI |
| `src/lib/throttle.ts` | 6.31 | 253 | LOGIC ✓ |
| `src/components/workflows/PersonaNodeInspector.tsx` | 9.11 | 252 | UI |
| `src/lib/api-client.ts` | 7.31 | 251 | LOGIC ✓ |
| `src/components/workflows/AddPersonaDialog.tsx` | 10.18 | 251 | MIXED |
| `src/components/compare/compareModels.module.css` | 4.47 | 250 | CSS |
| `src/components/layout/chat-history-item.tsx` | 9.36 | 248 | UI |
| `src/components/workflows/PinNodeInspector.tsx` | 9.67 | 245 | UI |
| `src/components/ui/dropdown-menu.tsx` | 8.48 | 239 | UI ✓ |
| `src/context/auth-context.tsx` | 7.48 | 235 | LOGIC ✓ |
| `src/lib/greetings.ts` | 7.31 | 223 | DATA |
| `src/lib/api/chat.ts` | 6.49 | 214 | LOGIC ✓ |
| `src/hooks/use-cleanup.ts` | 5.70 | 215 | LOGIC ✓ |
| `src/components/workflows/SelectChatsDialog.tsx` | 7.90 | 213 | MIXED |
| `src/lib/highlight.ts` | 8.72 | 209 | LOGIC ✓ |
| `src/components/workflows/ModelNodeInspector.tsx` | 7.80 | 218 | UI |
| `src/components/workflows/TopBar.tsx` | 8.35 | 206 | UI |

### Small Files (<200 lines)

72 files under 200 lines each — mostly well-scoped UI primitives (`src/components/ui/*`), hooks, types, and small page routes.

---

## 3. File Counts by Directory

| Directory | Files | Notes |
|-----------|-------|-------|
| `src/components/workflows/` | 35 | Largest module — needs sub-folders |
| `src/lib/` | 27 | Good utility isolation |
| `src/components/ui/` | 26 | ShadCN primitives — well-scoped |
| `src/components/chat/` | 16 | Core chat — biggest refactor target |
| `src/components/personas/` | 10 | Moderate coupling |
| `src/lib/api/` | 10 | Good API layer separation |
| `src/hooks/` | 7 | Under-utilized — too much logic in components |
| `src/components/layout/` | 6 | Layout foundation — heavy files |
| `src/app/personas/new/configure/hooks/` | 5 | Good pattern — local hooks |
| `src/components/pricing/` | 4 | Small, focused |
| `src/components/pinboard/` | 3 | Large files but few |
| `src/components/compare/` | 2 | Needs consolidation |
| `src/components/icons/` | 2 | Small |
| `src/context/` | 1 | Consider expanding |
| `src/types/` | 2 | Needs expansion |

---

## 4. CSS Strategy Audit

| Strategy | Estimated Usage | Assessment |
|----------|----------------|------------|
| **Tailwind utility classes** | ~40% | Primary approach — should be the default |
| **Inline `style={}`** | ~30% (351 instances) | **Excessive** — migrate to Tailwind or CSS modules |
| **CSS Modules** | ~20% (7 files, 21 imports) | Good for complex/scoped styles |
| **CSS Variables (globals.css)** | ~10% | Theme tokens defined but inconsistently used |

### CSS Module Files

| File | Lines |
|------|-------|
| `persona-configure.module.css` | 1,778 |
| `personas.module.css` | 615 |
| `persona-form.module.css` | 564 |
| `compareModels.module.css` | 250 |
| `chat-box-main.module.css` | 139 |
| `workflow-chat-interface.module.css` | 77 |
| `frame-1171275887.module.css` | 55 |
| `chat-interface.module.css` | 37 |
| `persona-chat-interface.module.css` | 22 |

### Recommendation

1. **Standardize**: Tailwind for layout/spacing/colors; CSS Modules only for complex animations/selectors
2. **Eliminate**: Inline `style={}` usage — migrate all 351 occurrences to Tailwind classes
3. **Theme tokens**: Use CSS variables for semantic colors, enforce via design system
4. **Dark mode**: Add dark variant to CSS variables (currently missing)

---

## 5. UI vs Logic Separation Analysis

### Components with Critical UI/Logic Coupling

These files mix rendering, state management, API calls, and data transformation in a single component. Each needs decomposition.

#### 5.1 `chat-interface.tsx` — 4,454 lines (Priority: P0)

| What | Extractable As |
|------|---------------|
| 30+ `useState` calls | `useChatState()` hook |
| `normalizeGeneratedFilePayload()`, `normalizeWebSearchPayload()`, `normalizeClarificationPrompt()` | `src/lib/chat-normalizers.ts` |
| `extractThinkingContent()`, `extractSourcesFromContent()` | `src/lib/content-parser.ts` |
| Streaming response handler (SSE events) | `useStreamingChat()` hook |
| Pin mention dropdown + keyboard nav | `<PinMentionDropdown />` component |
| Attachment drag-and-drop + file progress | `<AttachmentManager />` component |
| Web search toggle, tone/style submenus | `<ChatToolbar />` component |
| `normalizeUuidReference()`, `normalizeUrlForMatch()` | `src/lib/normalize-utils.ts` |

**Target**: Reduce to ~800 lines main orchestrator + 5 extracted hooks + 3 sub-components + 2 utility modules.

#### 5.2 `app-layout.tsx` — 2,151 lines (Priority: P0)

| What | Extractable As |
|------|---------------|
| `extractMetadata()`, `normalizeBackendMessage()`, `convertBackendEntryToMessages()` | `src/lib/message-transformer.ts` |
| `extractThinkingContent()` (duplicate of chat-interface) | Shared `src/lib/content-parser.ts` |
| `extractFileAttachmentsFromEntry()` | `src/lib/attachment-utils.ts` |
| Chat history state (boards, active chat, rename) | `useChatHistory()` hook |
| Model selection + framework mode | `useModelSelection()` hook |
| Pin operations (create, delete, organize) | `usePinOperations()` hook |

**Target**: Reduce to ~600 lines layout shell + 3 hooks + 2 utility modules.

#### 5.3 `chat-message.tsx` — 2,152 lines (Priority: P0)

| What | Extractable As |
|------|---------------|
| `parseContentSegments()`, `renderInlineContent()`, `renderTextContent()` | `src/lib/markdown-renderer.ts` |
| `renderLatexInlineContent()` | `<LaTeXRenderer />` component |
| Code syntax highlighting rendering | `<CodeBlock />` component |
| Table parsing (`isTableRow()`, `parseTableRow()`) | `src/lib/table-parser.ts` |
| Link preview + favicon fetching | `<LinkPreviewCard />` component |
| Reasoning typewriter effect | `<ReasoningBlock />` component |

**Target**: Reduce to ~500 lines main message + 4 sub-components + 2 utility modules.

#### 5.4 `WorkflowCanvas.tsx` — 1,885 lines (Priority: P1)

| What | Extractable As |
|------|---------------|
| 25+ `useState` calls | `useWorkflowState()` hook |
| `processNode()`, `executeWorkflow()`, `validateWorkflow()` | `src/lib/workflow-executor.ts` |
| History management (undo/redo) | `useHistory()` hook |
| `syncIdCounter()` | `src/lib/workflow-id.ts` |
| Node inspector panel switching | `<NodeInspectorPanel />` component |

**Target**: Reduce to ~700 lines canvas + 2 hooks + 2 utility modules.

#### 5.5 `left-sidebar.tsx` — 1,547 lines (Priority: P1)

| What | Extractable As |
|------|---------------|
| Title typewriter animation | `useTitleAnimation()` hook |
| `window.addEventListener` event bus | `useSidebarEvents()` hook |
| Chat/persona filtering & sorting | `useSidebarSearch()` hook |
| Route-based state determination | `useRouteContext()` hook |
| Settings navigation menu | `<SettingsMenu />` component |

**Target**: Reduce to ~500 lines sidebar + 3 hooks + 1 sub-component.

#### 5.6 `organize-pins-dialog.tsx` — 1,538 lines (Priority: P1)

| What | Extractable As |
|------|---------------|
| Folder tree logic | `useFolderTree()` hook |
| Pin search and filtering | `usePinSearch()` hook |
| Move operation state machine | `useMoveOperation()` hook |
| Custom scrollbar calculation | `useCustomScrollbar()` hook |

**Target**: Reduce to ~500 lines dialog shell + 4 hooks.

#### 5.7 `pin-item.tsx` — 1,255 lines (Priority: P1)

| What | Extractable As |
|------|---------------|
| 20+ `useState` calls | `usePinItemState()` hook |
| Tag management (add/remove/normalize) | `useTags()` hook + `src/lib/tag-utils.ts` |
| Comment editing | `useComments()` hook |
| Folder move + duplicate | `usePinActions()` hook |

**Target**: Reduce to ~400 lines card + 4 hooks + 1 utility module.

### Components That Are Well-Structured (Keep As-Is)

| File | Lines | Why It's Good |
|------|-------|---------------|
| `workflow-api.ts` | 1,911 | Pure business logic, no React state, proper error handling |
| `sidebar.tsx` (UI) | 670 | Clean compound component, good a11y |
| `unified-row.tsx` | 629 | Pure UI, COLUMN_WIDTHS single source of truth |
| `auth-context.tsx` | 235 | Auth logic cleanly isolated in context |
| `api-client.ts` | 251 | Solid resilience patterns (circuit breaker, queue, retry) |
| `security.ts` | 183 | Pure utility functions, focused responsibility |
| `throttle.ts` | 253 | Well-designed generic utilities |
| All `src/components/ui/*` | 26 files | ShadCN primitives with good isolation |

---

## 6. Duplicate Code Detection

### Duplicate Utility Functions

| Function | File A | File B | Fix |
|----------|--------|--------|-----|
| `normalizeTagList()` | `pin-item.tsx` | `right-sidebar.tsx` | → `src/lib/tag-utils.ts` |
| `normalizeCommentStrings()` | `pin-item.tsx` | `right-sidebar.tsx` | → `src/lib/tag-utils.ts` |
| `maskEmail()` | `personas/admin/page.tsx` | `workflows/admin/page.tsx` | → `src/lib/format-utils.ts` |
| `normalizePct()` | `personas/admin/page.tsx` | `workflows/admin/page.tsx` | → `src/lib/format-utils.ts` |
| `formatDate()` | `personas/admin/page.tsx` | `workflows/admin/page.tsx` | → `src/lib/format-utils.ts` |
| `getFullAvatarUrl()` | `personas/admin/page.tsx` | `personas/page.tsx` | → `src/lib/avatar-utils.ts` |
| `extractThinkingContent()` | `chat-interface.tsx` | `app-layout.tsx` | → use existing `src/lib/thinking.ts` |
| `normalizeUrlForMatch()` | `chat-interface.tsx` | `app-layout.tsx` | → `src/lib/normalize-utils.ts` |
| `isValidUUID()` | `WorkflowChatFullPage.tsx` | (inline regex) | → `src/lib/normalize-utils.ts` |

### Duplicate Component Patterns

| Component A | Component B | Overlap | Recommended Fix |
|-------------|-------------|---------|-----------------|
| `model-switch-dialog.tsx` (934 lines) | `model-selector-dialog.tsx` (671 lines) | ~70% | Merge into single `<ModelDialog mode="switch" \| "select" />` |
| `WorkflowChatInterface.tsx` (1,294 lines) | `WorkflowChatFullPage.tsx` (1,089 lines) | ~60% | Extract `useWorkflowChat()` hook |
| `personas/admin/page.tsx` (1,042 lines) | `workflows/admin/page.tsx` (792 lines) | ~50% | Extract `<AdminDataTable />` + `useAdminFilters()` |

### Estimated Savings

| Action | Lines Removed | Files Removed | Files Added |
|--------|--------------|---------------|-------------|
| Merge model dialogs | ~600 | 1 | 0 |
| Extract workflow chat hook | ~800 | 0 | 1 |
| Shared admin table/filters | ~400 | 0 | 2 |
| Extract shared utilities | ~200 | 0 | 3 |
| **Total** | **~2,000** | **1** | **6** |

---

## 7. Security Audit

### Critical (Fix Immediately)

| # | Issue | Location | Risk | Fix |
|---|-------|----------|------|-----|
| S1 | **XSS via `dangerouslySetInnerHTML`** | `chat-message.tsx`, `WorkflowChatInterface.tsx` | HIGH — KaTeX output and regex-processed markdown injected as raw HTML | Sanitize with DOMPurify before injection; use `katex.renderToString()` with `trust: false` |
| S2 | **No CSRF token validation** | All API routes | MEDIUM — state-changing POSTs lack CSRF protection | Add X-CSRF-Token header to `apiFetch()`, validate on server |
| S3 | **Client-side plan enforcement only** | `WorkflowCanvas.tsx`, model dialogs | MEDIUM — `hasReachedLimit()` / `canAccessFramework()` checked only in browser | Enforce limits server-side; client checks are UX-only |
| S4 | **Link injection via markdown regex** | `chat-message.tsx` | MEDIUM — bare URL regex could match crafted malicious URLs | Validate URLs against allowlist or sanitize href attributes |

### High (Fix Soon)

| # | Issue | Location | Risk | Fix |
|---|-------|----------|------|-----|
| S5 | **localStorage stores sensitive data** | 32 usages across codebase | Exposure via XSS | Encrypt sensitive values or move to httpOnly cookies / memory |
| S6 | **Favicon fetch SSRF** | `chat-message.tsx` → `/api/link-metadata` | Server-side URL fetch without validation | Validate URL against allowlist on server, block private IPs |
| S7 | **Window event bus** | `left-sidebar.tsx` (11 `addEventListener` calls) | Any injected script can dispatch fake events | Replace with React context or dedicated event emitter with origin checks |
| S8 | **Console logging of auth headers** | `workflow-api.ts` (dev mode) | Token leakage in browser console | Use structured logger that strips sensitive data |
| S9 | **No input sanitization on folder names** | `organize-pins-dialog.tsx` | Stored XSS if rendered without escaping | Sanitize with `security.ts` `sanitizeInput()` before saving |
| S10 | **File upload client-side only validation** | `chat-interface.tsx`, `PersonaChatFullPage.tsx` | Malicious files bypass client checks | Server-side MIME validation, virus scanning, size limits |

### Moderate (Address in Revamp)

| # | Issue | Location | Risk | Fix |
|---|-------|----------|------|-----|
| S11 | `credentials: 'include'` on all requests | `api-client.ts` | Cookies sent to all origins | Set only for same-origin requests |
| S12 | Node ID generation uses increment counter | `WorkflowCanvas.tsx` | Predictable IDs | Use `crypto.randomUUID()` |
| S13 | Rate limiter resets on page reload | `security.ts` | Browser-only protection | Backend rate limiting required |
| S14 | No Content Security Policy | `next.config.ts` | XSS amplification | Add strict CSP headers |

---

## 8. Dependencies Audit

| Package | Version | Assessment |
|---------|---------|------------|
| `next` | 16.1.1 | ✓ Current |
| `react` | 19.2.3 | ✓ Current — use React Compiler (babel plugin present) |
| `tailwindcss` | v4 | ✓ Current |
| `@auth0/nextjs-auth0` | 4.16.0 | ✓ Current |
| `reactflow` | 11.11.4 | ⚠ Consider upgrading to `@xyflow/react` v12 |
| `katex` | 0.16.33 | ⚠ Heavy (300KB) — consider lazy loading |
| `highlight.js` | 11.11.1 | ⚠ Heavy — lazy load, import only needed languages |
| `gsap` | 3.14.2 | ⚠ Used for animations — evaluate if Tailwind transitions suffice |
| `jspdf` | 4.1.0 | ✓ Used for PDF export |
| `lottie-react` | 2.4.1 | ⚠ Only used for loading animation — consider CSS alternative |
| `mixpanel-browser` | 2.77.0 | ⚠ Analytics — ensure GDPR compliance, lazy load |
| `react-toastify` | 11.0.5 | ⚠ ShadCN `sonner` already present — pick one |
| `stripe` | 21.0.1 | ✓ Server-side only |
| `uuid` | 13.0.0 | ⚠ Can replace with `crypto.randomUUID()` (native) |

### Redundant Dependencies

| Current | Alternative | Action |
|---------|-------------|--------|
| `react-toastify` | `sonner` (already installed via ShadCN) | Remove `react-toastify`, standardize on `sonner` |
| `uuid` | `crypto.randomUUID()` | Remove `uuid` package |
| `lottie-react` | CSS/Tailwind animations | Evaluate if Lottie complexity is needed |

---

## 9. Proposed New Architecture

### Directory Structure

```
src/
├── app/                          # Next.js app routes (pages only)
│   ├── (auth)/                   # Auth-protected layout group
│   ├── (public)/                 # Public routes
│   └── api/                      # API routes
│
├── components/
│   ├── ui/                       # ShadCN primitives (keep as-is)
│   ├── chat/
│   │   ├── ChatInterface.tsx     # ~800 lines (down from 4,454)
│   │   ├── ChatMessage.tsx       # ~500 lines (down from 2,152)
│   │   ├── PinMentionDropdown.tsx
│   │   ├── AttachmentManager.tsx
│   │   ├── ChatToolbar.tsx
│   │   ├── CodeBlock.tsx
│   │   ├── LaTeXRenderer.tsx
│   │   ├── LinkPreviewCard.tsx
│   │   ├── ReasoningBlock.tsx
│   │   └── ModelDialog.tsx       # Merged switch + selector
│   ├── layout/
│   │   ├── AppLayout.tsx         # ~600 lines (down from 2,151)
│   │   ├── LeftSidebar.tsx       # ~500 lines (down from 1,547)
│   │   ├── RightSidebar.tsx
│   │   ├── TopBar.tsx
│   │   ├── SettingsMenu.tsx
│   │   └── ChatHistoryItem.tsx
│   ├── workflows/
│   │   ├── canvas/               # Canvas + node/edge rendering ✅ DONE
│   │   │   ├── WorkflowCanvas.tsx
│   │   │   ├── CustomNode.tsx
│   │   │   ├── CustomEdge.tsx
│   │   │   ├── ContextMenu.tsx
│   │   │   ├── UtilitySection.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── index.ts
│   │   ├── inspectors/           # Node inspector panels ✅ DONE
│   │   │   ├── DocumentNodeInspector.tsx
│   │   │   ├── ChatNodeInspector.tsx
│   │   │   ├── PinNodeInspector.tsx
│   │   │   ├── ModelNodeInspector.tsx
│   │   │   ├── PersonaNodeInspector.tsx
│   │   │   ├── RightInspector.tsx
│   │   │   └── index.ts
│   │   ├── dialogs/              # Modal dialogs ✅ DONE
│   │   │   ├── SelectPinsDialog.tsx
│   │   │   ├── SelectModelDialog.tsx
│   │   │   ├── SelectChatsDialog.tsx
│   │   │   ├── AddPersonaDialog.tsx
│   │   │   ├── LoadWorkflowDialog.tsx
│   │   │   ├── EdgeDetailsDialog.tsx
│   │   │   └── index.ts
│   │   ├── chat/                 # Workflow chat ✅ DONE
│   │   │   ├── WorkflowChat.tsx  # Merged overlay + full-page
│   │   │   ├── WorkflowChatInterface.tsx  # Shim
│   │   │   ├── WorkflowChatFullPage.tsx   # Shim
│   │   │   ├── workflow-chat-interface.module.css
│   │   │   └── index.ts
│   │   ├── workflow-row.tsx
│   │   ├── TopBar.tsx
│   │   ├── LeftSidebar.tsx
│   │   ├── index.ts              # Barrel re-exporting all sub-folders
│   ├── pinboard/
│   │   ├── PinItem.tsx           # ~400 lines (down from 1,255)
│   │   ├── OrganizePinsDialog.tsx
│   │   └── OrganizePinItem.tsx
│   ├── personas/
│   ├── pricing/
│   ├── compare/
│   └── shared/                   # NEW — cross-cutting components
│       └── AdminDataTable.tsx
│
├── hooks/                        # Extracted custom hooks
│   ├── use-chat-state.ts
│   ├── use-streaming-chat.ts
│   ├── use-chat-history.ts
│   ├── use-model-selection.ts
│   ├── use-pin-operations.ts
│   ├── use-workflow-state.ts
│   ├── use-workflow-chat.ts
│   ├── use-history.ts            # Undo/redo
│   ├── use-folder-tree.ts
│   ├── use-pin-search.ts
│   ├── use-tags.ts
│   ├── use-sidebar-events.ts
│   ├── use-title-animation.ts
│   ├── use-admin-filters.ts
│   ├── use-custom-scrollbar.ts
│   ├── use-cleanup.ts            # Existing
│   ├── use-file-drop.ts          # Existing
│   ├── use-mobile.ts             # Existing
│   └── use-toast.ts              # Existing
│
├── lib/
│   ├── api/                      # Keep as-is (good separation)
│   ├── parsers/                  # NEW — content parsing
│   │   ├── content-parser.ts     # extractThinkingContent, extractSources
│   │   ├── markdown-renderer.ts  # parseContentSegments, renderInline
│   │   └── table-parser.ts       # isTableRow, parseTableRow
│   ├── normalizers/              # NEW — data normalization
│   │   ├── chat-normalizers.ts   # normalizeGeneratedFile, normalizeWebSearch
│   │   ├── normalize-utils.ts    # normalizeUrl, normalizeUuid, isValidUUID
│   │   └── message-transformer.ts # extractMetadata, normalizeBackendMessage
│   ├── utils/                    # NEW — shared utilities
│   │   ├── format-utils.ts       # maskEmail, normalizePct, formatDate
│   │   ├── tag-utils.ts          # normalizeTagList, normalizeCommentStrings
│   │   ├── avatar-utils.ts       # getFullAvatarUrl
│   │   └── attachment-utils.ts   # extractFileAttachments, processFiles
│   ├── api-client.ts             # Keep as-is
│   ├── auth0.ts                  # Keep as-is
│   ├── config.ts                 # Keep as-is
│   ├── security.ts               # Enhance with DOMPurify
│   ├── streaming.ts              # Keep as-is
│   ├── thinking.ts               # Move to parsers/
│   └── throttle.ts               # Keep as-is
│
├── context/
│   ├── auth-context.tsx          # Keep as-is
│   └── chat-context.tsx          # NEW — extracted from app-layout
│
└── types/
    ├── ai-model.ts               # Keep
    ├── chat.ts                   # NEW — chat message types
    ├── workflow.ts               # NEW — consolidate from workflows/types.ts
    ├── pin.ts                    # NEW — pin/folder types
    └── css.d.ts                  # Keep
```

---

## 10. Refactoring Roadmap

### Phase 1 — Security Hardening (Week 1)

- [x] **S1**: Add DOMPurify for all `dangerouslySetInnerHTML` usage (4 locations)
- [ ] **S2**: Implement CSRF token in `apiFetch()` and API routes
- [x] **S4**: Sanitize URLs in markdown link rendering
- [x] **S9**: Add input sanitization for folder/tag names
- [x] **S12**: Replace increment counter with `crypto.randomUUID()`
- [ ] **S14**: Add Content Security Policy headers in `next.config.ts`
- [x] Remove console logging of auth headers in `workflow-api.ts`

### Phase 2 — Extract Shared Utilities (Week 2)

- [x] Create `src/lib/utils/format-utils.ts` — `maskEmail`, `normalizePct`, `formatDate`
- [x] Create `src/lib/utils/tag-utils.ts` — `normalizeTagList`, `normalizeCommentStrings`
- [x] Create `src/lib/utils/avatar-utils.ts` — `getFullAvatarUrl`
- [x] Create `src/lib/normalizers/normalize-utils.ts` — `normalizeUrl`, `normalizeUuid`, `isValidUUID`
- [x] Create `src/lib/parsers/content-parser.ts` — `extractThinkingContent`, `extractSources`
- [x] Create `src/lib/normalizers/message-transformer.ts` — `extractMetadata`, `normalizeBackendMessage`
- [x] Update all import sites to use new shared modules
- [x] Delete duplicate function definitions

### Phase 3 — Extract Custom Hooks (Week 3)

- [x] `useChatState()` — from `chat-interface.tsx`
- [x] `useStreamingChat()` — from `chat-interface.tsx`
- [x] `useChatHistory()` — from `app-layout.tsx`
- [x] `useModelSelection()` — from `app-layout.tsx`
- [x] `usePinOperations()` — from `app-layout.tsx`
- [x] `useWorkflowChat()` — shared by `WorkflowChatInterface` + `WorkflowChatFullPage`
- [x] `useWorkflowState()` — from `WorkflowCanvas.tsx`
- [x] `useFolderTree()` — from `organize-pins-dialog.tsx`
- [x] `useTags()` — from `pin-item.tsx`
- [x] `useSidebarEvents()` — from `left-sidebar.tsx`

### Phase 4 — Component Decomposition (Week 4–5)

- [x] Split `chat-interface.tsx` → ChatInterface + PinMentionDropdown + AttachmentManager + ChatToolbar
- [x] Split `chat-message.tsx` → ChatMessage + CodeBlock + LaTeXRenderer + LinkPreviewCard + ReasoningBlock
- [x] Split `app-layout.tsx` → AppLayout (shell only)
- [x] Merge `model-switch-dialog.tsx` + `model-selector-dialog.tsx` → `ModelDialog.tsx`
- [x] Merge `WorkflowChatInterface.tsx` + `WorkflowChatFullPage.tsx` → `WorkflowChat.tsx` + hook
- [x] Reorganize `src/components/workflows/` into sub-folders (canvas/, inspectors/, dialogs/, chat/)

### Phase 5 — CSS Standardization (Week 5–6)

- [ ] Audit and migrate 351 inline `style={}` to Tailwind classes
- [ ] Consolidate CSS variables in `globals.css` — remove unused
- [ ] Add dark mode variables
- [ ] Evaluate if `persona-configure.module.css` (1,778 lines) can use Tailwind
- [ ] Remove redundant CSS module styles that duplicate Tailwind

### Phase 6 — Dependency Cleanup & Performance (Week 6)

- [ ] Remove `react-toastify`, standardize on `sonner`
- [ ] Remove `uuid` package, use `crypto.randomUUID()`
- [ ] Lazy-load `katex` (dynamic import)
- [ ] Lazy-load `highlight.js` with language subset
- [ ] Evaluate `gsap` → Tailwind transitions for simple animations
- [ ] Evaluate `lottie-react` → CSS loading animation
- [ ] Upgrade `reactflow` to `@xyflow/react` v12
- [ ] Add `React.lazy()` / dynamic imports for heavy pages (workflows, compare)

---

## 11. Estimated Impact

| Metric | Before | After (Est.) | Improvement |
|--------|--------|-------------|-------------|
| Largest component | 4,454 lines | ~800 lines | **-82%** |
| Average component size | ~320 lines | ~180 lines | **-44%** |
| Duplicate code | ~2,000 lines | ~0 lines | **-100%** |
| Custom hooks | 7 | ~22 | Hook-driven architecture |
| Inline styles | 351 | ~20 | **-94%** |
| `dangerouslySetInnerHTML` (unsafe) | 4 | 0 (all DOMPurify-wrapped) | **-100%** |
| Security issues (critical) | 4 | 0 | **-100%** |
| Bundle size (dependencies) | Current | -~150KB (uuid, react-toastify, lottie) | Smaller |
| Component reusability | Low | High (shared hooks + utilities) | Significant |

---

## 12. Testing Strategy

For each refactoring phase:

1. **Before refactoring**: Snapshot current behavior (manual test + screenshot critical flows)
2. **During refactoring**: Extract without changing behavior — function signatures remain identical
3. **After refactoring**: Verify identical behavior — same inputs produce same outputs
4. **Key test paths**:
   - Chat send/receive/stream flow
   - Persona creation wizard flow
   - Workflow canvas create/save/execute flow
   - Pin create/organize/search flow
   - Model switch during active chat
   - Settings pages load correctly
   - Auth flow (login → token refresh → logout)
   - Billing/plan upgrade flow

---

## 13. Rules for the Revamp

1. **No behavior changes** — refactoring only, not feature work
2. **One phase at a time** — never mix security fixes with component splits
3. **Shared utilities first** — extract utilities before decomposing components
4. **Hooks before components** — extract custom hooks before splitting JSX
5. **Test after every extraction** — verify the app works after each module move
6. **Security first** — Phase 1 (security) blocks all other phases
7. **Preserve all error handling** — never remove try/catch or error boundaries
8. **Keep API contracts** — exported function signatures must not change
9. **No premature optimization** — extract only what is duplicated or >400 lines
10. **Use TypeScript strictly** — all new files must have full type coverage
