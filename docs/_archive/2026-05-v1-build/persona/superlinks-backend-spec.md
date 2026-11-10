# SuperLinks Backend Implementation Spec

> **Scope:** SuperLinks — per-persona shareable URLs with token budgets, session tracking, and analytics.
> **Reference:** Existing persona endpoints at `docs/openapi/openapi.yaml`. All new endpoints follow the same REST + JSON conventions.
> **Auth:** Authenticated endpoints require `Authorization: Bearer <token>`. Public endpoints (link resolution + chat) are token-budget–gated, not auth-gated.

---

## Table of Contents

1. [What is a SuperLink?](#1-what-is-a-superlink)
2. [Data Models](#2-data-models)
3. [Authentication & Access Rules](#3-authentication--access-rules)
4. [SuperLink CRUD Endpoints](#4-superlink-crud-endpoints)
5. [Session Endpoints](#5-session-endpoints)
6. [Analytics Endpoints](#6-analytics-endpoints)
7. [Public Endpoints (unauthenticated)](#7-public-endpoints-unauthenticated)
8. [Hardcoded Values → Dynamic API Mapping](#8-hardcoded-values--dynamic-api-mapping)
9. [Business Logic Reference](#9-business-logic-reference)

---

## 1. What is a SuperLink?

A SuperLink is a shareable URL generated for a published persona. It allows external users (no account required) to chat with that persona up to a token budget. Each link:

- Is scoped to a single persona (`repoId`)
- Has a configurable token limit (1,000 – 50,000 tokens; default 10,000; step 100)
- Tracks sessions, messages, unique users, and daily token consumption
- Can be paused, revoked, or have its budget edited at any time
- Is owned by the workspace admin/editor who created it

---

## 2. Data Models

### SuperLink

```typescript
interface SuperLink {
  id: string                      // e.g. "sl_01abc"
  repoId: string                  // Persona repo this link is scoped to
  personaName: string
  avatarColor: string             // CSS color string for the persona avatar
  avatarUrl?: string | null       // Optional image URL
  url: string                     // Full public URL e.g. "https://souvenir.ai/l/<token>"
  linkToken: string               // Opaque URL token (slug after /l/)
  tokenUsed: number               // Cumulative tokens consumed across all sessions
  tokenLimit: number              // Budget cap (min 1000, max 50000, step 100)
  conversations: number           // Total session count
  uniqueUsers: number             // Unique visitor count (fingerprinted, not auth-based)
  tokensPerConvo: number          // tokenUsed / max(1, conversations) — computed
  lastUsedAt: string | null       // ISO 8601; null if never used
  status: SuperLinkStatus
  dailyTokens: number[]           // Rolling 7-day token usage array (oldest first)
  createdAt: string               // ISO 8601
  createdBy: string               // memberId
}

type SuperLinkStatus = 'active' | 'paused' | 'limit-reached' | 'revoked'
```

### SuperLinkSession

```typescript
interface SuperLinkSession {
  id: string                      // e.g. "sess_01"
  linkId: string
  startedAt: string               // ISO 8601
  endedAt?: string                // ISO 8601; null if still active
  messages: number                // Turn count in session
  tokens: number                  // Tokens consumed in session
  status: 'active' | 'completed' | 'abandoned' | 'limit_hit'
  userFingerprint?: string        // Anonymised user identifier
  location?: string               // Country/city (optional, privacy-safe)
}
```

### SuperLinkSummaryStats

```typescript
interface SuperLinkSummaryStats {
  workspaceLabel: string          // e.g. "Personas · Acme Inc."
  periodFrom: string              // ISO 8601 date
  periodTo: string                // ISO 8601 date
  tokensThisMonth: number         // Total tokens across all links this period
  conversations: number           // Total sessions this period
  activeLinks: number             // Count of links with status === 'active'
  estimatedCostUsd: number        // tokenUsed / 1_000_000 * costPerMToken
}
```

### SuperLinkCreateRequest

```typescript
interface SuperLinkCreateRequest {
  tokenLimit: number              // 1000–50000, step 100
  label?: string                  // Optional display label (not in URL)
}
```

### SuperLinkUpdateRequest

```typescript
interface SuperLinkUpdateRequest {
  tokenLimit?: number
  status?: 'active' | 'paused' | 'revoked'
}
```

---

## 3. Authentication & Access Rules

### Authenticated (workspace users)

All management endpoints require a valid bearer token.

| Action | admin | editor | member |
|--------|-------|--------|--------|
| List all workspace SuperLinks | ✅ | ✅ | ❌ |
| List own-persona SuperLinks | ✅ | ✅ | ✅ (own personas only) |
| Create SuperLink | ✅ | ✅ | ❌ |
| Pause / resume SuperLink | ✅ | ✅ (own) | ❌ |
| Edit token limit | ✅ | ✅ (own) | ❌ |
| Revoke SuperLink | ✅ | ✅ (own) | ❌ |
| View sessions | ✅ | ✅ (own) | ❌ |
| View analytics | ✅ | ✅ | ❌ |

### Public (link visitors)

Visitors access via the public URL (`/l/<linkToken>`). No account needed. Rate-limited by IP and fingerprint.

---

## 4. SuperLink CRUD Endpoints

### `GET /persona/{repoId}/superlinks`

List all SuperLinks for a persona.

**Query params:**
- `status` — `active | paused | limit-reached | revoked | all` (default: `all`)

**Response `200`:**
```json
[
  {
    "id": "sl_01",
    "repoId": "repo_abc",
    "personaName": "Sales Assistant",
    "avatarColor": "#FF6B6B",
    "avatarUrl": null,
    "url": "https://souvenir.ai/l/xyz123",
    "linkToken": "xyz123",
    "tokenUsed": 3450,
    "tokenLimit": 10000,
    "conversations": 12,
    "uniqueUsers": 9,
    "tokensPerConvo": 287,
    "lastUsedAt": "2026-06-08T14:30:00Z",
    "status": "active",
    "dailyTokens": [120, 450, 230, 890, 340, 780, 640],
    "createdAt": "2026-05-12T10:00:00Z",
    "createdBy": "usr_01"
  }
]
```

**Notes:**
- `dailyTokens` always has exactly 7 entries (last 7 days, oldest first); days with no usage emit `0`
- `tokensPerConvo` is a server-computed field, not stored separately

---

### `POST /persona/{repoId}/superlinks`

Create a new SuperLink for this persona.

**Request body:**
```json
{
  "tokenLimit": 10000,
  "label": "External Demo Link"
}
```

**Response `201`:**
```json
{
  "id": "sl_new_01",
  "repoId": "repo_abc",
  "personaName": "Sales Assistant",
  "avatarColor": "#FF6B6B",
  "avatarUrl": null,
  "url": "https://souvenir.ai/l/newtoken",
  "linkToken": "newtoken",
  "tokenUsed": 0,
  "tokenLimit": 10000,
  "conversations": 0,
  "uniqueUsers": 0,
  "tokensPerConvo": 0,
  "lastUsedAt": null,
  "status": "active",
  "dailyTokens": [0, 0, 0, 0, 0, 0, 0],
  "createdAt": "2026-06-09T10:00:00Z",
  "createdBy": "usr_01"
}
```

**Notes:**
- `linkToken` is a cryptographically random URL-safe string (e.g. 16 chars)
- The persona must be published (`visibility !== 'private'`) before a SuperLink can be created
- Multiple SuperLinks can exist for the same persona — each has an independent budget and session history

---

### `GET /persona/{repoId}/superlinks/{linkId}`

Get full detail for a single SuperLink, including sessions and extended stats.

**Response `200`:** Full `SuperLink` object.

---

### `PATCH /persona/{repoId}/superlinks/{linkId}`

Update a SuperLink's token limit or status.

**Request body:**
```json
{
  "tokenLimit": 25000,
  "status": "paused"
}
```

**Response `200`:** Updated `SuperLink` object.

**Status transition rules:**
- `active` → `paused` — pausing stops new sessions from starting; in-flight sessions complete
- `paused` → `active` — resumes the link
- `active | paused` → `revoked` — permanent; cannot be un-revoked; existing sessions terminate
- `limit-reached` — system-set when `tokenUsed >= tokenLimit`; to re-enable, increase `tokenLimit` via a `PATCH` with a new higher value, which automatically transitions status back to `active`

---

### `DELETE /persona/{repoId}/superlinks/{linkId}`

Hard-delete a SuperLink record and all associated session data.

**Response `200`:** `{}`

**Notes:**
- Prefer `PATCH { status: 'revoked' }` to stop a link while preserving analytics history
- Hard-delete is for permanent removal and GDPR erasure scenarios

---

### `POST /persona/{repoId}/superlinks/{linkId}/regenerate`

Generate a new `linkToken` (and thus a new `url`) while keeping the same budget, sessions, and analytics.

**Response `200`:**
```json
{
  "id": "sl_01",
  "url": "https://souvenir.ai/l/newtoken456",
  "linkToken": "newtoken456"
}
```

**Notes:**
- The old `linkToken` immediately stops resolving
- Use when a link URL has been shared with unintended recipients

---

### `GET /workspace/superlinks`

List all SuperLinks across all personas in the workspace (admin/editor only).

**Query params:**
- `status` — filter by status
- `repoId` — filter by persona
- `limit` — integer (default: `50`)
- `cursor` — pagination cursor

**Response `200`:**
```json
{
  "links": [ /* SuperLink objects */ ],
  "nextCursor": null,
  "total": 3
}
```

---

## 5. Session Endpoints

### `GET /persona/{repoId}/superlinks/{linkId}/sessions`

List all chat sessions for a SuperLink.

**Query params:**
- `status` — `active | completed | abandoned | limit_hit | all` (default: `all`)
- `limit` — integer (default: `50`)
- `cursor` — pagination cursor

**Response `200`:**
```json
{
  "sessions": [
    {
      "id": "sess_01",
      "linkId": "sl_01",
      "startedAt": "2026-06-08T14:00:00Z",
      "endedAt": "2026-06-08T14:22:00Z",
      "messages": 8,
      "tokens": 420,
      "status": "completed",
      "userFingerprint": "fp_anon_abc",
      "location": "London, UK"
    }
  ],
  "nextCursor": null
}
```

---

### `GET /persona/{repoId}/superlinks/{linkId}/sessions/{sessionId}`

Get detail for a single session including message-level breakdown.

**Response `200`:**
```json
{
  "id": "sess_01",
  "linkId": "sl_01",
  "startedAt": "2026-06-08T14:00:00Z",
  "endedAt": "2026-06-08T14:22:00Z",
  "messages": 8,
  "tokens": 420,
  "status": "completed",
  "turns": [
    {
      "index": 0,
      "role": "user",
      "tokens": 25,
      "timestamp": "2026-06-08T14:00:05Z"
    },
    {
      "index": 1,
      "role": "assistant",
      "tokens": 112,
      "timestamp": "2026-06-08T14:00:08Z"
    }
  ]
}
```

**Notes:**
- Turn content (message text) is NOT returned in this endpoint for privacy reasons
- Token counts are available per turn for budget auditing

---

## 6. Analytics Endpoints

### `GET /workspace/superlinks/analytics/summary`

Workspace-level SuperLink summary for the template header.

**Query params:**
- `from` — ISO 8601 date (default: 30 days ago)
- `to` — ISO 8601 date (default: today)

**Response `200`:**
```json
{
  "workspaceLabel": "Personas · Acme Inc.",
  "periodFrom": "2026-04-12",
  "periodTo": "2026-05-12",
  "tokensThisMonth": 18420,
  "conversations": 67,
  "activeLinks": 3,
  "estimatedCostUsd": 0.055
}
```

**Notes:**
- `workspaceLabel` is currently hardcoded as `"Personas · Acme inc."` — must be built from `workspace.name`
- `dateRange` is currently hardcoded as `"Apr 12 – May 12"` — must be derived from `from`/`to` params
- `estimatedCostUsd` formula: `tokenUsed / 1_000_000 * costPerMToken`; `costPerMToken` must be a server-side config value, not hardcoded `3` in the front-end
- The 4 stat cards (tokensThisMonth, conversations, activeLinks, estimatedCostUsd) must all come from this endpoint

---

### `GET /persona/{repoId}/superlinks/{linkId}/analytics`

Per-link analytics: daily sparkline + aggregate stats.

**Query params:**
- `days` — integer (default: `7`, max: `90`)

**Response `200`:**
```json
{
  "linkId": "sl_01",
  "period": {
    "from": "2026-06-03",
    "to": "2026-06-09"
  },
  "dailyTokens": [120, 450, 230, 890, 340, 780, 640],
  "dailyConversations": [2, 8, 4, 14, 6, 12, 10],
  "totals": {
    "tokenUsed": 3450,
    "conversations": 56,
    "uniqueUsers": 38,
    "tokensPerConvo": 61,
    "estimatedCostUsd": 0.010
  }
}
```

---

### `GET /workspace/superlinks/analytics/chart`

Aggregate sparkline data across all links for the workspace overview chart.

**Query params:**
- `from` — ISO 8601 date
- `to` — ISO 8601 date
- `groupBy` — `link | day` (default: `link`)

When `groupBy=link`: returns a per-link bar chart suitable for the sidebar-selected view.
When `groupBy=day`: returns a time-series for the overview sparkline.

**Response `200` (groupBy=day):**
```json
{
  "days": ["2026-06-03", "...", "2026-06-09"],
  "tokens": [840, 1200, 960, 2100, 1440, 2340, 2080]
}
```

**Response `200` (groupBy=link):**
```json
{
  "links": [
    {
      "linkId": "sl_01",
      "personaName": "Sales Assistant",
      "dailyTokens": [120, 450, 230, 890, 340, 780, 640]
    }
  ]
}
```

**Notes:**
- The SuperLinks template shows either a global sparkline or per-link bars depending on selection
- 3 mock links with fixed `dailyTokens` arrays are currently hardcoded in the template — these must come from this endpoint

---

## 7. Public Endpoints (unauthenticated)

These endpoints are called by link visitors with no account. No bearer token required.

### `GET /public/superlinks/{linkToken}`

Resolve a SuperLink by its token. Returns persona info and budget status.

**Response `200`:**
```json
{
  "linkId": "sl_01",
  "personaName": "Sales Assistant",
  "avatarColor": "#FF6B6B",
  "avatarUrl": null,
  "status": "active",
  "tokenLimit": 10000,
  "tokenUsed": 3450,
  "tokenRemaining": 6550,
  "percentUsed": 34.5,
  "workspaceName": "Acme Inc."
}
```

**Error responses:**
- `404` — token not found
- `403` with `{ "reason": "revoked" }` — link has been revoked
- `403` with `{ "reason": "paused" }` — link is paused
- `402` with `{ "reason": "limit-reached" }` — token budget exhausted

---

### `POST /public/superlinks/{linkToken}/sessions`

Start a new chat session on a SuperLink.

**Request body:**
```json
{
  "userFingerprint": "string (anonymised client-side hash)"
}
```

**Response `201`:**
```json
{
  "sessionId": "sess_new",
  "expiresAt": "2026-06-09T22:00:00Z"
}
```

**Error responses:**
- `403` with `{ "reason": "paused | revoked" }` — link not accepting new sessions
- `402` with `{ "reason": "limit-reached", "tokenUsed": 10000, "tokenLimit": 10000 }` — budget exhausted

---

### `POST /public/superlinks/{linkToken}/sessions/{sessionId}/stream`

Stream a chat turn in a SuperLink session. Uses the same SSE format as `/chats/{id}/stream`.

**Request body (multipart/form-data):**
- `message` — string (user input)
- `sessionId` — string

**Response `200` (SSE stream):**
Same event types as the main chat stream: `content`, `done`, `error`, `tool_progress`, etc.

**Additional SSE event — budget warning:**
```
event: budget_warning
data: {"tokenUsed": 9200, "tokenLimit": 10000, "percentUsed": 92}
```

**Additional SSE event — budget exhausted:**
```
event: budget_exhausted
data: {"tokenUsed": 10000, "tokenLimit": 10000}
```

After `budget_exhausted`, the session is automatically closed and the link status transitions to `limit-reached`.

---

## 8. Hardcoded Values → Dynamic API Mapping

This section lists every hardcoded value in the SuperLinks front-end that must become a dynamic API response.

### SuperLinks Template (`src/templates/SuperLinks/index.tsx`)

| Hardcoded Value | Should Come From |
|-----------------|-----------------|
| `workspaceLabel: 'Personas · Acme inc.'` | `GET /workspace/superlinks/analytics/summary` (workspaceLabel) |
| `dateRange: 'Apr 12 – May 12'` | Derived from query params `from`/`to` on the analytics endpoint |
| 3 mock link objects with fixed data | `GET /workspace/superlinks` |
| Fixed `dailyTokens: [120, 45, ...]` arrays | `GET /workspace/superlinks/analytics/chart?groupBy=link` |
| Summary stat values (tokensThisMonth, conversations, activeLinks, estimatedCostUsd) | `GET /workspace/superlinks/analytics/summary` |

### SuperLink Component (`src/components/SuperLink/index.tsx`)

| Hardcoded Value | Should Come From |
|-----------------|-----------------|
| Token limit min/max/default/step (`1000`/`50000`/`10000`/`100`) | Server config or `GET /workspace/plan` (plan limits) — or hard-enforce these same constants server-side |
| Placeholder URL (`"https://souvenir.ai/l/..."`) | `GET /persona/{repoId}/superlinks` (url field) |

### SuperLinkDrawer (`src/components/SuperLinkDrawer/index.tsx`)

| Hardcoded Value | Should Come From |
|-----------------|-----------------|
| Drawer stats (tokenUsed, tokenLimit, conversations, uniqueUsers, tokensPerConvo, lastUsedAt) | `GET /persona/{repoId}/superlinks/{linkId}` |
| 7-day sparkline (`dailyTokens` array) | `GET /persona/{repoId}/superlinks/{linkId}/analytics?days=7` |
| Sessions list (id, time, messages, tokens, status) | `GET /persona/{repoId}/superlinks/{linkId}/sessions` |
| Credit budget bar percentage | Computed from `tokenUsed / tokenLimit * 100` |

### Cost Formula

| Hardcoded Value | Should Come From |
|-----------------|-----------------|
| `estimatedCostUsd = tokenUsed / 1_000_000 * 3` | The multiplier `3` ($/M tokens) must be a server-side config value returned with the analytics summary |

---

## 9. Business Logic Reference

### Token Budget Enforcement

1. Before each streamed turn, the server checks: `link.tokenUsed + estimatedTurnTokens <= link.tokenLimit`
2. If the check would fail, the stream returns `budget_exhausted` and closes
3. After each turn, `tokenUsed` is incremented by the actual tokens consumed
4. When `tokenUsed >= tokenLimit`, link status transitions to `limit-reached` automatically
5. To re-activate a `limit-reached` link, the owner patches with a higher `tokenLimit`

### `dailyTokens` Array Semantics

- Always 7 entries (or the requested `days` count)
- Index 0 = oldest day, index N-1 = today
- Server rolls this array daily at midnight UTC
- Entries are pre-aggregated — clients do not need to compute sums

### Unique User Counting

- Visitors are not authenticated; uniqueness is tracked via a browser fingerprint
- The client generates the fingerprint and sends it with `POST /public/superlinks/{token}/sessions`
- The server counts distinct fingerprints per link
- This is approximate — treat `uniqueUsers` as an estimate, not a precise count

### Link Status State Machine

```
not_created
     │
     ▼
  active  ←───────────────────────────────┐
     │                                    │
     ├──── user pauses ──────► paused ────┘ (resume → active)
     │                           │
     ├──── budget hit ──► limit-reached ──► (increase limit → active)
     │
     └──── user revokes ──► revoked (terminal)
```

### Session Lifecycle

1. `POST /public/superlinks/{token}/sessions` — creates session, returns `sessionId`
2. Visitor streams turns via `POST /public/superlinks/{token}/sessions/{sessionId}/stream`
3. Session ends when: visitor leaves, no activity for 30 min (idle timeout), or budget hit
4. Session status: `active` → `completed` (normal end) | `abandoned` (idle timeout) | `limit_hit` (budget exhausted during session)

### Cost Calculation

```
estimatedCostUsd = tokenUsed / 1_000_000 * SERVER_COST_PER_MILLION_TOKENS
```

`SERVER_COST_PER_MILLION_TOKENS` is a server-side config value (currently implied as `3.0` USD/M in the front-end). This should be stored in workspace billing config and returned with analytics responses so the front-end never needs to hardcode the rate.
