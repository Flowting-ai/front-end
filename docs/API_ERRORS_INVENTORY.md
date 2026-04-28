# API Errors Inventory

> Auto-generated scan of all API errors across the codebase — messages, conditions, and source locations.

---

## Table of Contents

1. [Core HTTP Client](#1-core-http-client)
2. [Throttle & Resilience](#2-throttle--resilience)
3. [Chat API](#3-chat-api)
4. [User & Billing API](#4-user--billing-api)
5. [Personas API](#5-personas-api)
6. [Pins API](#6-pins-api)
7. [Models API](#7-models-api)
8. [Stub APIs (always throw)](#8-stub-apis-always-throw)
9. [Workflow API](#9-workflow-api)
10. [Chat Interface](#10-chat-interface)
11. [App Layout](#11-app-layout)
12. [Compare Models](#12-compare-models)
13. [Next.js API Routes](#13-nextjs-api-routes)
    - [Chat Route](#chat-route)
    - [Link Metadata Route](#link-metadata-route)
    - [Stripe Checkout](#stripe-checkout)
    - [Stripe Subscription](#stripe-subscription)
    - [Stripe Top-ups](#stripe-top-ups)

---

## 1. Core HTTP Client

**File:** `src/lib/api-client.ts`

| # | Error Message | Condition |
|---|---|---|
| 1 | `'Invalid URL provided'` | `url` is falsy or not a string before `fetch` is called |
| 2 | `'Rate limit exceeded. Please try again later.'` | Client-side `RateLimiter.canProceed()` returns `false` |
| 3 | `` `HTTP ${status}: ${errorText}` `` | `!response.ok` — body text used as detail, fallback `'Unknown error'` |
| 4 | `'Request timeout'` | `error.name === 'AbortError'` (timeout or abort signal fired) |
| 5 | `'File too large. Maximum size is 10MB.'` | `file.size > 10MB` inside `secureUpload` |
| 6 | `'Invalid file type. Allowed: …'` | `file.type` not in the allowed MIME type list in `secureUpload` |
| 7 | `` `HTTP ${status}` `` | `!response.ok` inside `handleStream` |
| 8 | `'No response body'` | `response.body` has no `getReader()` inside `handleStream` |
| 9 | _(rethrown original error)_ | Non-`AbortError` fetch exceptions — rethrown after logging (line 97) |

---

## 2. Throttle & Resilience

**File:** `src/lib/throttle.ts`

| # | Error | Condition |
|---|---|---|
| 1 | _(pass-through)_ | `RequestQueue` rejects with the inner function's own error |
| 2 | `lastError` rethrown | `exponentialBackoff` exhausts all configured retries |
| 3 | `'Circuit breaker is open'` | `CircuitBreaker.state === 'open'` and the cooldown period has not elapsed |

---

## 3. Chat API

**File:** `src/lib/api/chat.ts`

| # | Error Message | Condition |
|---|---|---|
| 1 | `` `Failed to load chats: ${statusText}` `` | `!response.ok` on `GET /chats` |
| 2 | `` `Failed to load messages for chat ${chatId} (${statusInfo})${detail}` `` | `!response.ok` on messages fetch; `detail` taken from response body if present |
| 3 | `msg \|\| "Failed to create chat"` | `!response.ok` on `POST /chats/create`; `msg` = `response.text()` |
| 4 | `msg \|\| "Failed to rename chat"` | `!response.ok` on `PATCH /chats/rename` |

---

## 4. User & Billing API

**File:** `src/lib/api/user.ts`

| # | Error Message | Condition |
|---|---|---|
| 1 | `data.error \|\| "Failed to create checkout session."` | `!response.ok` or no `checkout_url` in JSON from Stripe checkout `POST` |
| 2 | `data.error \|\| "Failed to update subscription."` | `!response.ok` or response lacks both `new_plan` and `checkout_url` |
| 3 | `data.error \|\| "Failed to cancel subscription."` | `!response.ok` or missing `data.status` on `DELETE` subscription |
| 4 | `data.error \|\| "Failed to create top-up payment."` | `!response.ok` or no `topup_id` in JSON response |

---

## 5. Personas API

**File:** `src/lib/api/personas.ts`

| # | Error Message | Condition |
|---|---|---|
| 1 | `text \|\| "Failed to create persona"` | `!response.ok` on create |
| 2 | `text \|\| "Failed to update persona"` | `!response.ok` on update |
| 3 | `text \|\| "Failed to toggle persona status"` | `!response.ok` on pause/resume toggle |
| 4 | `text \|\| "Failed to enhance persona prompt"` | `!response.ok` on enhance |
| 5 | `text \|\| "Failed to create persona chat"` | `!response.ok` on create chat |
| 6 | `text \|\| "Failed to test persona"` _(via `onError` callback)_ | `!response.ok` or no stream reader during persona test stream |
| 7 | SSE `error` event / read errors _(via `onError` callback)_ | Stream read failure during `streamPersonaMessage` |

---

## 6. Pins API

**File:** `src/lib/api/pins.ts`

| # | Error Message | Condition |
|---|---|---|
| 1 | `text \|\| "Failed to create pin"` | `!response.ok` on `POST` create pin |
| 2 | `"Folder name must not be empty."` | `sanitizeFolderName()` returns an empty string |
| 3 | `text \|\| "Failed to create pin folder"` | `!response.ok` on create folder |
| 4 | `text \|\| "Failed to move pin"` | `!response.ok` on move pin |
| 5 | `"Rename folder is not supported in the current backend."` | **Stub** — always throws |
| 6 | `"Delete folder is not supported in the current backend."` | **Stub** — always throws |
| 7 | `"Pin comments are not supported in the current backend."` | **Stub** — always throws |

---

## 7. Models API

**File:** `src/lib/api/models.ts`

| # | Error Message | Condition |
|---|---|---|
| 1 | `"Failed to update model status."` | `!response.ok` on `PATCH` block model request |

---

## 8. Stub APIs (always throw)

These files contain stub implementations that unconditionally throw.

| File | Error Message | Condition |
|---|---|---|
| `src/lib/api/messages.ts` | `"Message reactions are not supported in the current backend."` | Always — stub |
| `src/lib/api/images.ts` | `"Image generation is not supported in the current backend."` | Always — stub |
| `src/lib/api/documents.ts` | `"Document upload is not supported in the current backend."` | Always — stub |

---

## 9. Workflow API

**File:** `src/components/workflows/workflow-api.ts`

Uses a custom **`WorkflowAPIError`** class (fields: `message`, `status`, `code`).

The central `handleResponse` helper (lines 449–476) extracts the error message from JSON `message` / `detail` / `error` fields, falls back to `statusText`, then `"API request failed"`, and always throws `WorkflowAPIError` with the response `status`.

| # | Error Message | Code | Condition |
|---|---|---|---|
| 1 | `"Request timeout"` | `TIMEOUT` / 408 | `AbortError` from timeout inside `fetchWithTimeout` |
| 2 | _Extracted from response body_ | _From JSON `code` field_ | Any `!response.ok` response through `handleResponse` |
| 3 | `"Unable to upload file."` | `DOCUMENT_UPLOAD_FAILED` / 400 | `uploadFn(file)` throws during document node preparation |
| 4 | `` `Document node "…" is missing an uploaded file.` `` | `MISSING_DOCUMENT_FILE` | Document node has no `File` attached when one is required |
| 5 | `"file count mismatch…"` | `INVALID_DOCUMENT_FILE_COUNT` | `files.length !== documentNodeCount` after `extractDocumentFiles` |
| 6 | `"Backend workflow update endpoint is not available yet."` | `UNSUPPORTED_UPDATE` | `PUT` returns 405 or 501 |
| 7 | `"Workflow update requires full payload (name, nodes, edges)."` | `INVALID_PAYLOAD` | `update()` called with missing `name`, `nodes`, or `edges` |
| 8 | `"Delete workflow is not supported by backend yet."` | `UNSUPPORTED` | `DELETE` returns 404, 405, or 501 |
| 9 | `"input is required to execute a workflow."` | `INVALID_INPUT` | Empty trimmed input passed to `execute()` or `executeStream()` |
| 10 | `"input is required."` | `INVALID_INPUT` | Empty input passed to `chatNew()` or `chatContinue()` |
| 11 | `"Share workflow is not supported by backend yet."` | `UNSUPPORTED` / 501 | `share()` — always throws |

> **SSE / stream errors** (not `throw`, via `onError` callback): HTTP or read errors during `execute`, `executeStream`, `chatNew`, and `chatContinue` streams are forwarded via `onError` with response text or `` `HTTP ${status}` ``.

---

## 10. Chat Interface

**File:** `src/components/chat/chat-interface.tsx`

| # | Error Message | Condition |
|---|---|---|
| 1 | `friendlyApiError(text \|\| "API request failed", status)` | `!response.ok` or no `response.body` on stream `POST` (line ~1423) |
| 2 | `friendlyApiError(…, status)` | `!response.ok` on `DELETE` message (line ~3339) |
| 3 | `friendlyApiError(…, status)` | `!response.ok` on `DELETE` chat (line ~3405) |

> **Note:** 401 responses handled in `src/lib/api/client.ts` do **not** throw — they dispatch an `auth:session-expired` event and show a toast silently.

---

## 11. App Layout

**File:** `src/components/layout/app-layout.tsx`

| # | Error Message | Condition |
|---|---|---|
| 1 | `errorText \|\| "Failed to delete chat"` | `!response.ok` on `DELETE` chat via `apiFetch` (line ~889) |
| 2 | `errorText \|\| "Failed to update star"` | `!response.ok` on `PATCH` star endpoint (line ~1093) |

---

## 12. Compare Models

**File:** `src/components/compare/compare-models.tsx`

| # | Error Message | Condition |
|---|---|---|
| 1 | `"No valid model IDs found"` | After UUID filter, zero valid model IDs remain |
| 2 | `` `Failed to test models: ${status}` `` | `!response.ok` on `POST /models/test` |
| 3 | `"No response body"` | No `response.body` reader available for SSE stream |

---

## 13. Next.js API Routes

### Chat Route

**File:** `src/app/api/chat/route.ts`

| # | Error / Response Body | HTTP Status | Condition |
|---|---|---|---|
| 1 | `"Empty stream from upstream."` | 502 | Upstream response has stream content-type but no body |
| 2 | `"Sorry, I'm having trouble responding right now."` | 500 | Any unhandled exception in the handler (e.g. `req.json()` fail, upstream `fetch` error) |

---

### Link Metadata Route

**File:** `src/app/api/link-metadata/route.ts`

| # | Error / Response Body | HTTP Status | Condition |
|---|---|---|---|
| 1 | `"Missing url"` | 400 | No `url` search param provided |
| 2 | `"Invalid url"` | 400 | `new URL(rawUrl)` throws (malformed URL) |
| 3 | `"Protocol not allowed"` | 400 | Protocol is not `https:` or `http:` |
| 4 | `` `Fetch failed: ${status}` `` | 502 | `!res.ok` on the target URL fetch |
| 5 | `error.message` or generic | 502 | `fetch` throws (timeout, DNS failure, other network error) |

---

### Stripe Checkout

**File:** `src/app/api/stripe/checkout/route.ts`

| # | Error / Response Body | HTTP Status | Condition |
|---|---|---|---|
| 1 | `"You must be logged in to subscribe."` | 401 | No Auth0 session found |
| 2 | `"Invalid request body."` | 400 | `req.json()` throws (malformed JSON) |
| 3 | `"Invalid plan or billing period."` | 400 | Bad or missing `plan` / `billing_period` in body |
| 4 | `"Price not configured for this plan."` | 500 | Required Stripe price ID env variable is missing |
| 5 | `"Failed to create checkout session."` | 500 | `stripe.checkout.sessions.create` throws |

---

### Stripe Subscription

**File:** `src/app/api/stripe/subscription/route.ts`

| # | Error / Response Body | HTTP Status | Method | Condition |
|---|---|---|---|---|
| 1 | `"You must be logged in to update your subscription."` | 401 | PATCH | No Auth0 session |
| 2 | `"Invalid request body."` | 400 | PATCH | `req.json()` throws |
| 3 | `"Invalid plan type."` | 400 | PATCH | Bad or missing `plan_type` in body |
| 4 | `"Price not configured for this plan."` | 500 | PATCH | Price ID env variable missing |
| 5 | `"Failed to update subscription."` | 500 | PATCH | Stripe or internal logic error |
| 6 | `"You must be logged in to cancel your subscription."` | 401 | DELETE | No Auth0 session |
| 7 | `"No active subscription found."` | 404 | DELETE | No Stripe customer record or no active subscription |
| 8 | `"Failed to cancel subscription."` | 500 | DELETE | Unhandled exception in delete handler |

---

### Stripe Top-ups

**File:** `src/app/api/stripe/topups/route.ts`

| # | Error / Response Body | HTTP Status | Condition |
|---|---|---|---|
| 1 | `"You must be logged in to purchase extra credits."` | 401 | No Auth0 session |
| 2 | `"Invalid request body."` | 400 | `req.json()` throws (malformed JSON) |
| 3 | `"Amount is required and must be a number."` | 400 | `Number.isFinite(amount)` is `false` |
| 4 | `"Amount must be between $1 and $10."` | 400 | Amount is below min or above max allowed value |
| 5 | `"Stripe top-up source is not configured."` | 500 | `STRIPE_TOPUP_SOURCE_ID` env variable is missing |
| 6 | `"Failed to create Stripe top-up."` | 500 | `stripe.topups.create` throws |

---

## Key Patterns & Notes

| Pattern | Description |
|---|---|
| `text \|\| "Fallback message"` | Most client-side errors read `response.text()` and fall back to a hardcoded message if the body is empty |
| `WorkflowAPIError` | The **only** typed/structured error class in the codebase; all others are plain `Error` |
| Stub errors | `messages`, `images`, and `documents` APIs **always throw** — they are not yet implemented |
| 401 silent path | 401 responses in `src/lib/api/client.ts` dispatch `auth:session-expired` and toast — they do **not** throw |
| SSE errors via `onError` | Stream errors in personas, workflows, and compare-models are forwarded via callback, not thrown |
| Circuit breaker | Protects all requests through `src/lib/throttle.ts`; opens after consecutive failures |
