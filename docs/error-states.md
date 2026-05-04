# Error States

Errors in V2 are inline and non-blocking. They appear inside the message flow — never as modals, never as full-screen states. The user can always dismiss, retry, or keep chatting.

---

## Error Architecture

All errors arrive as an SSE event:
```ts
{ type: 'error', code: string, message: string, retryable: boolean }
```

Or as a failed HTTP response (network error, 401, 429, 5xx) before the SSE stream opens.

Two rendering locations:
1. **Inline in the message bubble** — for errors that happen after stream starts (E1, E2, E3)
2. **Input bar banner** — for errors that happen before the stream starts (auth, rate limit)

---

## Error Types

### E1 — Connector Auth Failure

The user's connected integration (e.g. Google Drive, Notion) has an expired or revoked token. Souvenir attempted to fetch context from it and failed.

**When it fires:** During `researching` or `thinking` phase  
**SSE event code:** `connector_auth_failed`  
**Retryable:** No — user must re-authenticate the connector

**What to render (inline in message):**

```
┌─────────────────────────────────────────────────────┐
│  ⚠  Connector disconnected                          │
│  Your Google Drive connection needs to be           │
│  reconnected. The response above used public        │
│  information only.                                  │
│                                                     │
│  [Reconnect Google Drive]  [Dismiss]                │
└─────────────────────────────────────────────────────┘
```

- Background: `var(--color-surface-warning)` (yellow-tinted)
- Border: `var(--color-border-warning)`
- Icon: HugeIcons `Alert01Icon` 16px
- Primary action → navigates to `/settings/integrations`
- The message above the error card still renders (partial response is valid)
- Do NOT clear the message or prevent future sends

### E2 — Web Search Timeout

A web search was initiated but timed out or returned no usable results.

**When it fires:** During `researching` phase — some sources may have already loaded  
**SSE event code:** `research_timeout` or `research_failed`  
**Retryable:** Yes — "Try again" resends the same message

**What to render (inline in message):**

```
┌─────────────────────────────────────────────────────┐
│  ○  Web search timed out                            │
│  {N} sources were found before the timeout.         │
│  The response below uses those sources only.        │
│                                                     │
│  [Try again]  [Dismiss]                             │
└─────────────────────────────────────────────────────┘
```

- If `N === 0`: "No web sources were found."
- Background: `var(--color-surface-subtle)`
- Border: `var(--color-border-default)`
- Icon: HugeIcons `Search01Icon` 16px (muted)
- The stream continues after this error — do NOT stop rendering the response
- "Try again" sends a new stream request with the same `input` string

### E3 — Model Error (generic)

The model returned an error or the stream ended unexpectedly.

**When it fires:** During `streaming` phase  
**SSE event code:** `model_error`, `stream_interrupted`  
**Retryable:** Yes

**What to render (inline in message):**

```
┌─────────────────────────────────────────────────────┐
│  ✕  Response interrupted                            │
│  Something went wrong while generating the          │
│  response. Partial content may be shown above.      │
│                                                     │
│  [Try again]  [Dismiss]                             │
└─────────────────────────────────────────────────────┘
```

- Background: `var(--color-surface-error)` (red-tinted, very subtle)
- Border: `var(--color-border-error)`
- Icon: HugeIcons `Cancel01Icon` 16px

### E4 — Rate Limit (429)

User has hit their daily message limit.

**When it fires:** HTTP 429 before stream opens  
**Location:** Input bar banner (not inline in message)

**What to render (above the input bar):**

```
┌─────────────────────────────────────────────────────┐
│  You've reached your daily limit ({N} messages).   │
│  Resets at midnight UTC — or upgrade for more.     │
│                               [Upgrade plan]        │
└─────────────────────────────────────────────────────┘
```

- Use `hasReachedLimit(plan, 'webSearchesPerDay', count)` from `plan-config.ts`
- Lock the input (disabled) while banner is visible
- "Upgrade plan" → `/settings/usage-and-billing/change-plan`
- Check `canAccessFeature(plan, 'unlimitedWebSearch')` to determine if the limit is for web searches specifically

### E5 — Auth Expired (401)

The session token expired mid-stream.

**When it fires:** HTTP 401 from the stream endpoint  
**Location:** Full banner, input locked

**What to render:**

```
┌─────────────────────────────────────────────────────┐
│  Your session has expired. Please sign in again.   │
│                                  [Sign in]          │
└─────────────────────────────────────────────────────┘
```

- `apiFetch` in `api/client.ts` already handles 401 with one auto-retry (token refresh).
- This banner only shows if the auto-retry also fails.
- "Sign in" → Auth0 logout flow (`/auth/logout`)

---

## Retry Logic

For retryable errors (E2, E3):

```ts
function retryLastMessage() {
  // Re-send the exact same input that caused the error
  // Clear the error state from the failed message
  // Do NOT show a new user bubble — it's a retry of the same send
  sendMessage(lastUserInput)
}
```

Do NOT re-add the user message to the conversation. The original user bubble stays. Only the assistant response is replaced.

---

## Error Reporting

All errors go through `src/lib/error-reporter.ts` (copied verbatim from V1):

```ts
import { reportError } from '@/lib/error-reporter'

// On any E3/E4/E5:
reportError({
  severity: 'error',
  context: 'chat-stream',
  message: event.message,
  code: event.code,
  chatId,
})
```

Add Sentry alongside `error-reporter.ts` — do NOT replace it. Both can run concurrently.

---

## What not to do

- Do not show a toast notification for stream errors — inline error cards are the pattern
- Do not clear the conversation on error
- Do not show a spinner indefinitely if the stream stalls — set a 30s timeout and transition to E3
- Do not swallow errors silently — always call `reportError()`
