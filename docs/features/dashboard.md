# Dashboard: how the frontend talks to the store warehouse

Read this before touching `src/app/(app)/dashboard`, `src/components/Dashboard` or `src/lib/warehouse`.
It is written for an AI coding agent working in this repository only. You have no access to the backend
repositories (`souvenir-server`, `souvenir-warehouse`). Everything below the API line is a fixed contract
from your point of view. When the Dashboard needs something the API does not offer, you open a GitHub
issue; you do not work around it in the frontend. See "When the backend has to change" at the end.

## What the Dashboard is

Every organization has at most one **store workspace** in the warehouse. The warehouse pulls the org's
connected store apps (today: Shopify) into clean tables, keeps them synced on a schedule, and measures
a library of metrics over them. The Dashboard tab shows that workspace: a headline strip, every metric
over a chosen range with a daily line chart, and a short chat that adds a custom metric.

The workspace is created automatically. When a member links a connector that feeds a category, the
backend hands the link to the warehouse in the background, which creates the workspace or attaches
the connection to the existing one. The frontend never creates, names or deletes a workspace. Until
the first link, `GET /warehouse` returns 404, and the page shows the "connect a store" empty state.

Status of the feature: shipped on the `test` branch and the dev backend. It has been proven end to end
on a real store of about 139k orders (metrics answer in 2 to 3 seconds over the full history). It is not
on production yet.

## Files

| Path | Role |
|---|---|
| `src/lib/api/warehouse.ts` | zod schemas, TypeScript types and one fetch function per endpoint. The only file that knows URLs. |
| `src/lib/warehouse/queries.ts` | React Query hooks: `useWorkspace`, `useMetricCatalog`, `useMeasurement`, `useDraftMetric`, `usePutMetric`, `useDeleteMetric`. |
| `src/lib/warehouse/present.ts` | Pure functions turning API data into what the page draws: ranges, tiles, headline, chart points, sync state. |
| `src/lib/query-keys.ts` | `queryKeys.warehouse.*`, scoped by org. Mutations invalidate `queryKeys.warehouse.all(org)`. |
| `src/app/(app)/dashboard/DashboardScreen.tsx` | Route screen: loading, 404 empty state, building state, the metrics panel. |
| `src/components/Dashboard/*` | `DashboardHeader`, `MetricsPanel`, `MetricRows`, `MetricEditor` (the chat modal), `MetricLineChart`, `WorkspaceEmpty` (+ `WorkspaceBuilding`). Styles in `Dashboard.module.css`, tests in `Dashboard.test.tsx`. |

The Dashboard reuses Home's building blocks (`MetricStrip`, `Dropdown.Float`, `ConfirmModal`, `Dialog`,
`Button`) and Home's formatters in `src/lib/home/format.ts`. Keep that: the two pages are
meant to look like one product.

## The API

All calls go through `apiFetchJson` / `apiFetchVoid` in `src/lib/api/client.ts`, which attach the Auth0
bearer token and turn failures into `ApiError` (`status`, `code`, `message`, `fieldErrors` for 422).
Base URL is `API_BASE_URL` from `src/lib/config.ts` (same-origin proxy `/api/backend` in local dev,
the backend origin when deployed). Every endpoint is scoped to the caller's organization by the
backend; there is no org or workspace id in any URL.

Dates are ISO `YYYY-MM-DD`, inclusive on both ends. Timestamps are ISO 8601 strings.

### `GET /warehouse` → Workspace

```json
{
  "id": "74ec0f6b-…", "name": "Acme Store", "slug": "acme-store", "timezone": "America/Chicago",
  "connectors": ["shopify", "triple_whale"],
  "categories": [
    { "category": "store",       "status": "ready",          "lastSyncedAt": "2026-11-04T18:24:41Z" },
    { "category": "ab_testing",  "status": "not_applicable", "lastSyncedAt": null }
  ]
}
```

- `connectors`: connector slugs feeding the workspace. `channelsOf()` maps `shopify` / `shopify_app`
  to the Shopify mark on the headline strip.
- `categories[].status` is one of `queued`, `building`, `syncing`, `ready`, `failed`, `not_applicable`.
  `not_applicable` means the connector has nothing for that category (for example a store with no
  A/B tests) and must be ignored when judging health. `syncOf()` in `present.ts` folds the list into
  one `building | syncing | ready | failed` state. The API gives no error text for a `failed` category.
- 404 means no workspace yet (`"No store workspace yet"` or `"Join an organization first"`).
  `useWorkspace` does not retry a 404 and polls every 5 s while the state is `building`.

### `GET /warehouse/metrics` → MetricEntry[]

The workspace's metric catalog: the warehouse library plus this org's custom metrics.

```json
[
  { "name": "revenue", "label": "Revenue", "unit": "money", "description": "What customers paid, with shipping and tax, cancelled orders left out", "category": "store" },
  { "name": "aov", "label": "Average order value", "unit": "money", "description": "Revenue per order", "category": "store" },
  { "name": "shipping_share", "label": "Shipping share", "unit": "ratio", "description": "shipping_revenue / revenue", "category": "custom" }
]
```

`unit` is `money | count | ratio`. Ratios come back as fractions (0.034), and `formatValue` multiplies
by 100 for display. `category` is the library category or `custom`. The store library today:
`orders`, `revenue`, `subtotal`, `discounts`, `shipping_revenue`, `taxes`, `refunds`, `gross_sales`,
`net_sales`, `aov`, `refund_rate`. The headline strip is `HEADLINE` in `present.ts`
(`revenue`, `orders`, `aov`, `refund_rate`).

### `POST /warehouse/metrics` → Measurement

Measures named metrics over a range at a grain. This is the hot path; it is how every number on the
page is produced.

Request:

```json
{ "metrics": ["revenue", "orders"], "start": "2026-10-06", "end": "2026-11-04", "grain": "day" }
```

`grain` is `day | week | month | total` (default `total`). Validation: `end >= start`; an unknown
metric name is a 422 with `"unknown metrics ['x']"`.

Response:

```json
{
  "grain": "day", "start": "2026-10-06", "end": "2026-11-04", "timezone": "America/Chicago",
  "periods": [
    { "start": "2026-10-06", "values": { "revenue": 81234.5, "orders": 240 } },
    { "start": "2026-10-07", "values": { "revenue": null, "orders": 0 } }
  ],
  "unavailable": { "refund_rate": "no connection fills refunds" }
}
```

- `periods` are bucketed in the store's timezone, one per grain step, in order. For `total` there is
  exactly one period. A `null` value is "no rows in that bucket", not an error.
- `unavailable` lists metrics this store cannot measure (a table no connector fills) with the reason.
  Those names are absent from `values`. `MetricRows` shows the reason and `n/a` for them, and
  `headlineFrom` drops them from the strip.
- `MetricsPanel` issues three measurements per range: the current window at `total`, the previous
  window of the same length at `total` (for the deltas), and the current window at `day` (for the
  chart). `periodFor` / `previousPeriodFor` compute the windows in UTC from the browser clock.

### `POST /warehouse/metrics/draft` → MetricDraft

One turn of the custom-metric chat. The frontend keeps the whole conversation in component state and
sends all of it every turn; nothing is stored on the server and nothing is created until the proposal
is put with `PUT /warehouse/metrics`. The server shows the model the catalog and the store tables, so
the frontend sends neither.

Request:

```json
{ "messages": [ { "role": "user", "content": "shipping as a share of revenue" } ] }
```

`role` is `user | assistant`, every `content` non-empty, at least one message.

Response:

```json
{
  "reply": "Shipping charged on non-cancelled orders over revenue, as a percent.",
  "metric": { "name": "shipping_share", "label": "Shipping share", "unit": "ratio", "description": "shipping_revenue / revenue",
              "value": { "op": "ratio", "numerator": "shipping_revenue", "denominator": "revenue" } }
}
```

`metric` is `null` while the model still has a question; `reply` then is that question. When it is set,
it is exactly the body `PUT /warehouse/metrics` accepts. `MetricEditor` shows it as a proposal card with
an "Add metric" button and keeps the chat open for changes. A 502 is the model or warehouse not
answering; the editor restores the typed message and shows the error.

### `PUT /warehouse/metrics` → MetricEntry[]

Adds or replaces one custom metric for the org and returns the whole catalog. The backend stamps the
caller as `requested_by`; the frontend does not send it.

```json
{
  "name": "shipping_share", "label": "Shipping share", "unit": "ratio",
  "description": "shipping_revenue / revenue",
  "value": { "op": "ratio", "numerator": "shipping_revenue", "denominator": "revenue" }
}
```

`name` must match `^[a-z][a-z0-9_]*$`, at most 64 chars (`metricNameOf(label)` derives it).
`value` is one of:

- an **aggregate** `{ "kind": "sum" | "count", "table", "column" (sum only, else null), "day", "where" }`
  where `day` is the table's timestamp column that places a row on a day and `where` is an optional
  SQL filter over that table's columns (the library uses `"cancelled_at is null"` for orders);
- an **expression** `{ "op": "add", "terms": [...] }`, `{ "op": "subtract", "left", "right" }`,
  `{ "op": "multiply", "terms": [...] }`, `{ "op": "ratio", "numerator", "denominator" }`, where each
  term is a metric name, a number, or a nested expression.

Errors: 409 when `name` collides with a library metric; 422 when the value reads an unknown table or
column, references an unknown metric, or forms a cycle. The message is the thing to show the user.

### `DELETE /warehouse/metrics/{name}` → 204

Removes a custom metric. 404 for an unknown custom name, 409 when another custom metric still uses it.
Any org member can delete any custom metric; there is no ownership check.

### `GET /warehouse/tables` → TableSummary[]

The store category's tables, with columns and row counts. The Dashboard no longer shows tables; the
route stays for the draft endpoint's server side and for anything else that needs the schema.

```json
[{ "name": "orders", "meaning": "one row is one order",
   "columns": [{ "name": "order_id", "type": "string" }, { "name": "placed_at", "type": "timestamp" }, { "name": "total", "type": "decimal" }],
   "rows": 139095 }]
```

Store tables: `orders`, `order_lines`, `order_line_properties`, `order_attributes`, `order_tags`,
`refunds`, `refund_lines`, `customers`, `products`, `variants`, `product_attributes`. The backend pins
`category=store`; the frontend cannot ask for another category's tables.

### `GET /warehouse/tables/{name}?limit=50&offset=0` → TableRows

```json
{ "name": "orders", "columns": [...], "rows": [{ "order_id": "123", "total": "84.00", ... }], "total": 139095 }
```

`limit` is 1 to 500, `offset` is 0 or more. 404 for an unknown table. Cell values are plain JSON:
money columns are numbers, timestamps are ISO strings, list columns are arrays, missing values are
`null`. Not called by the frontend today.

## Working in this area

- Run `npm test` (vitest) and `npm run lint` before you finish. `Dashboard.test.tsx` covers the
  presenters and the metric rows; extend it when you change behaviour.
- Add new API shapes in `src/lib/api/warehouse.ts` with a zod schema first, then a hook in
  `queries.ts`, then the component. Never fetch from a component.
- Keep presentation logic pure in `present.ts` so it stays testable without React.
- A metric `name` is the key everywhere (catalog, measurement values, delete). Labels are display only.
- The warehouse is a separate service behind the API, so a slow first call after idle is normal. Reads
  are cached 60 s by React Query; a metric mutation invalidates the whole warehouse scope.

## Known gaps on the frontend side

These need no backend change. Pick them up freely.

- Only the `day` grain is drawn; `week` and `month` are supported by the API but have no UI. Ranges
  are fixed at 7, 30 and 90 days; the API accepts any dates, so a custom range or year-over-year view
  is frontend work.
- Range windows are computed in UTC from the browser clock while the warehouse buckets in the store's
  timezone; near midnight the "today" bucket can differ from what a user in the store's zone expects.
- The empty state links to connectors but does not say which connectors feed the Dashboard.

## Known gaps that need the backend

These are not possible from this repo today. If a task needs one, open an issue (next section) and
build the frontend part behind the missing piece only when it can degrade cleanly.

- Only the store category's tables are exposed. Ads, attribution, email, reviews and the other
  categories exist in the warehouse but the API has no route for their tables or metrics.
- A `failed` category carries no error message in `GET /warehouse`.
- There is no way to trigger a sync, see sync progress, or detach a connector from the workspace.
- Custom metrics have no owner on the read side (`requested_by` is stored, not returned), so the UI
  cannot show who added a metric or restrict deletes.
- Metric values are totals per bucket only. There is no breakdown by dimension (by channel, by
  product, by discount code) in the measurement API.
- Nothing is on production yet; the dev backend serves the dev database.

## When the backend has to change

You do not have the backend repositories and must not try to obtain, clone, or guess their code.
If the Dashboard needs any of the following, stop and file an issue instead of improvising:

- a new endpoint, parameter, field, status value, or error;
- a change in how an existing endpoint behaves (pagination, grain, filters, auth);
- data that is not in any response above;
- a bug whose cause is on the server side (wrong numbers, 5xx, slow responses, inconsistent statuses).

File it in this repository with the `backend` label:

```bash
gh issue create -R Flowting-ai/front-end --label backend \
  --title "Dashboard: <what the frontend needs, in one line>" \
  --body-file issue.md
```

The body should contain, in this order:

1. **What the user sees or should see.** One or two sentences about the Dashboard behaviour.
2. **What the frontend tried.** Which endpoint, with the exact request and response (or error) you got.
3. **What the API would need.** The endpoint, field or behaviour that would unblock it, and the exact
   response shape you want, as JSON. Propose the smallest change that works.
4. **Frontend work waiting on it.** The branch or file where the frontend half is, if you started it.

Do not add mock data, feature flags, or client-side workarounds that fake a backend capability. Do not
change `src/lib/api/warehouse.ts` to accept shapes the backend does not send. Finish every part of the
task that does not depend on the missing piece, state clearly in your summary what is blocked and link
the issue.
