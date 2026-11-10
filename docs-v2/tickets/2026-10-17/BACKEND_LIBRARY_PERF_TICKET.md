# [Backend] Library file page is slow: DB connection per request, serial queries, 4 calls per page

| Field | Value |
|---|---|
| Type | Performance |
| Area | Backend (FastAPI): `db/session.py`, `services/library/*`, document indexing |
| Priority | High (every Library file open takes 2-10s; spikes of 8-20s) |
| Front-end contact | _fill in_ |

---

## 1. Background

Opening a file in the Library (`/library/files/{id}`) calls four endpoints:

| Call | Purpose |
|---|---|
| `GET /library/files/{id}` | details (name, caps, phase, provenance) |
| `GET /library/files/{id}/preview?rowStart=0&rowCount=100` | what the viewer draws (PDF link, text, sheet rows, image/audio link) |
| `GET /library/files/{id}/access` | who has access (info panel) |
| `GET /library/files/{id}/usage` | chats/routines that used it (info panel) |

Measured from the front-end against `devapi.getsouvenir.com` on 2026-10-17 (Playwright, logged-in admin of `test01-workspace`, file `Return policy 2026.pdf`, 803 B detail response):

| Endpoint | Typical | Worst seen |
|---|---|---|
| `GET /library/files/{id}` | 1.5-2.2s | **20.2s**, 12.1s, 8.1s |
| `.../preview` | 1.0-1.9s | 11.8s |
| `.../access` | 1.3-2.4s | 8.4s |
| `.../usage` | 1.3-2.6s | 8.4s |

The responses are tiny (72 B to 3 KB), so the time is spent on the server, not in transfer.

The front-end has already removed its own waiting: details and preview are now requested in parallel, and on Library rows they start loading on hover. What's left is backend time: about 2s before the page can show anything, and 4-5s before a PDF is drawn.

## 2. Findings (code audit)

### 2.1 Every request opens a new Postgres connection (likely the main cost)
`db/session.py` uses `poolclass=NullPool` with `sslmode=require` against Supabase's transaction pooler (Supavisor, port 6543). Every `AsyncSessionLocal()` therefore does TCP connect + TLS handshake + Postgres auth before the first query. That's typically 100-500ms, more across regions, and the file page pays it four times.

The comment explains why: a reused client connection that lands on a different backend raises `EDBHANDLEREXITED` in transaction mode. That rules out keeping a client pool on port 6543, but it doesn't rule out pooling altogether (see 3.1).

### 2.2 Serial, duplicated queries per call (`services/library/library.py`)
Every Library call starts with `join()` → `open()`, which is 3 queries in a row: membership, `db.get(Document)`, shares.

`detail()` then runs `rows([document])`, which:
- **fetches the shares a second time** (`sharesOf`),
- then views, users and chats,

and afterwards `detail()` **calls `chatsOf` again** for the same `origin_chat_id`.

That's about 7 round trips in sequence for one 800-byte response. `preview`, `access` and `usage` each repeat the same 3-query prefix.

### 2.3 The file page needs 4 separate calls
Each call repeats auth, connection setup and the permission prefix, so 4 calls cost 4 connections and at least 12 queries before any real work starts.

### 2.4 The first PDF preview downloads the whole PDF (`services/library/preview.py:46`)
When `document.page_count is None`, `pdfPreview` downloads the entire object from S3 and opens it with PyMuPDF just to count pages. Indexing already computes the page count (`services/document/indexing.py:138`, `pdfPageCount`), but it isn't saved onto the document.

### 2.5 Probable cause of the 8-20s spikes: indexing runs in the API workers
OCR, extraction and PDF processing run via `asyncio.to_thread` (`indexing.py:138-164`) inside the same uvicorn workers that serve requests (`start.sh`: 4 workers). CPU-heavy threads compete with the event loop for the GIL and can stall every request on that worker. The spikes come and go, which fits this. **Not yet verified**: needs server metrics.

### 2.6 Minor
- The sheet workbook cache (`preview.py`, `LRU(8)`) is per worker. With 4 workers, paging rows often lands on a worker that has to download and parse the file again.
- Checked and fine: JWKS keys are cached (`core/security.py`), the boto3 client is cached, and `document_id` / `user_id` / `organization_id` are indexed.

## 3. Proposed changes

### 3.1 Pool database connections (P0)
Pick one:
- **(a)** Use Supabase's **session-mode** pooler (port 5432) or a direct connection, with a normal SQLAlchemy pool: `pool_size=5`, `max_overflow=5`, `pool_pre_ping=True`, `pool_recycle=300`. Confirm the per-project connection limit allows `workers × (pool_size + max_overflow)`.
- **(b)** Stay on transaction mode but put a pooler next to the app (e.g. PgBouncer sidecar), so the app connects over a cheap local link instead of doing TLS to Supabase on each request.

Also confirm the API host and the Supabase project are in **the same region**. A cross-region link multiplies every round trip in 2.2.

### 3.2 Cut the queries in `detail` (P0)
- Pass the shares already loaded by `open()` into `rows()`, e.g. `rows(documents, db, shares=...)`, instead of fetching them again.
- Reuse the chat loaded in `rows()` instead of the second `chatsOf` call in `detail()`.
- Fold membership + document + shares into one query (join, or `selectinload`).
- Run the independent lookups (views, users, chats) in one query with CTEs or a `UNION`. They can't run concurrently on one `AsyncSession`.

Target: `detail` ≤ 3 round trips, `access` / `usage` ≤ 2.

### 3.3 Combined file-page endpoint (P1)
`GET /library/files/{id}?include=preview,access,usage` (or `GET /library/files/{id}/page`). It returns `FileDetail` plus optional `preview`, `access` and `usage` blocks, using one connection and one permission check. Request params: the same `sheet`, `rowStart`, `rowCount` as `/preview`.

Expected behaviour:
- If the preview isn't available (`no_preview`, `preview_processing`, `preview_failed`), return `preview: null` with an error `code` instead of failing the whole response.
- Keep the existing endpoints. The front-end still uses `/preview` for sheet paging, and `/access` after share changes.

### 3.4 Store the PDF page count at index time (P1)
In indexing, write `pdfPageCount` (or the page count of the converted PDF for Office files) to `Document.page_count`. Then `pdfPreview` never reads the object. Backfill existing rows with a one-off script.

### 3.5 Move document processing off the API workers (P1, verify first)
Measure event-loop lag and request latency while a document is indexing. If indexing correlates with the spikes, run indexing in a separate worker process or service, or at least in a `ProcessPoolExecutor` instead of threads.

### 3.6 Optional
- Shared cache (Redis) for parsed workbooks, or set the cache size from settings.
- `Cache-Control: private, max-age=30` on `GET /library/files/{id}`, so the browser's back/forward navigation can reuse it.

## 4. How to verify
1. Turn on per-query timing (`echo=True` or SQLAlchemy event listeners) and time a single `GET /library/files/{id}` on the server. Record connection-setup time vs. query time vs. total.
2. Repeat after each change.
3. Re-run the front-end measurement (Playwright script available from front-end on request) for the same file.

## 5. Acceptance criteria
- [ ] `GET /library/files/{id}` p50 **< 300ms**, p95 **< 800ms** server-side (measured at the app, excluding the client network).
- [ ] `preview`, `access` and `usage` p50 < 300ms each.
- [ ] No request opens a new TLS connection to Postgres in steady state (connection count stays flat under load).
- [ ] `detail` runs ≤ 3 SQL round trips (assert in a test with a query counter).
- [ ] PDF preview never downloads the object from S3 once indexing has finished.
- [ ] No 5s+ outliers on Library endpoints over a 1-hour window while documents are being indexed.
- [ ] (If 3.3 is done) the combined endpoint is documented in `openapi.yaml`, and the front-end is notified so it can switch.

## 6. Open questions
1. Which Supabase pooler mode is preferred: session-mode pooling (3.1a) or a local PgBouncer (3.1b)? Are there other services relying on `NullPool` behaviour?
2. What region are the API and the Supabase project in?
3. Does indexing run inside the web workers in dev/prod, or in a separate DBOS worker?
4. Do the Library endpoints rely on any workspace header? The front-end assumes not (workspace comes from membership server-side) and now starts requests before the org role is known.

## 7. Front-end status (for reference)
Already done in `front-end` (2026-10-17, uncommitted):
- Details and preview are requested in parallel, on page mount and on row hover (`src/lib/library/warm.ts`).
- Library queries wait only for the org id, not the role (`orgIdReady`).

Measured result: a direct link shows content in ~4.3s (was 8.2s); a click from the list makes the page usable in ~3.2s. What remains is mostly backend time from section 1.
