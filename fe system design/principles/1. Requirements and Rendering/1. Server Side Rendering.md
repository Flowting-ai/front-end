# Principle 1: Server Side Rendering

One file per principle in this folder, written with respect to Next.js (App Router, v16) and TypeScript. Foundation rules live in [base-primitive-rules.md](../../base-primitive-rules.md).

Template: **Definition, Key properties, When to use, When not to, How in Next.js + TypeScript, Tradeoffs, Pitfalls, Checklist.**

---

## 1. Server Side Rendering (SSR)

> Render fresh, personalized HTML on the server for every single request.

### Definition
For each incoming request the server runs the React tree, fetches the data it needs, and returns complete HTML. The browser shows meaningful content before any JS runs, then hydrates interactive parts. In the Next.js App Router this is called **dynamic rendering**: the route is rendered at request time rather than at build time.

### Key properties

**1. Always up to date and user-specific**
- Output is computed per request, so it reflects the current database state and the current viewer. There is no stale window and no flash of generic content followed by a personalized swap.
- Personalization inputs: session cookie, auth header, role, org or workspace, locale, `searchParams`, feature-flag or A/B bucket.
- Security benefit: authorization runs before HTML is produced. A user never receives markup for data they cannot see, and tokens stay on the server.
- In Next.js this follows from reading `cookies()`, `headers()`, `searchParams` or `connection()`. Resolve identity once and share it within the request:

```ts
// lib/session.ts
import { cookies } from "next/headers";
import { cache } from "react";

export type Session = { userId: string; orgId: string; role: "admin" | "member" };

// React cache() dedupes within one request: layout and page share one lookup.
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get("session")?.value;
  return token ? verifySession(token) : null;
});
```

- Because the HTML is user-specific, it must never be stored in a shared cache. Treat cookie-dependent responses as `private`.

**2. Costs compute: cache where personalization allows**
Every request spends server CPU and waits on upstream data, so TTFB equals your slowest blocking dependency. Reduce the cost by caching everything that is not truly per-user and keeping only the personal slice dynamic.

Split the page into layers and pick the cheapest correct layer for each:

| Data kind | Example | Strategy |
|---|---|---|
| Same for everyone | Model list, marketing copy | `use cache` with `cacheLife`, or `fetch` with `revalidate`; can be prerendered |
| Same per segment | Price per currency, content per locale or org | `use cache` with the segment value passed as an **argument** (it becomes part of the cache key) |
| Truly per-user | Credits, inbox, profile | Dynamic; stream inside `<Suspense>` |
| Per-user, reused within one request | Session lookup | React `cache()` (request-scoped dedupe) |
| Per-user, needs runtime APIs inside a cache scope | Compliance cases | `use cache: private` (not stored across requests; use sparingly) |

```tsx
// Shared slice: cached, safe for all users (requires cacheComponents enabled).
async function ModelCatalog({ currency }: { currency: string }) {
  "use cache";
  cacheLife("hours");
  const models = await getModels(currency);   // args are part of the cache key
  return <ModelGrid models={models} />;
}

// Personal slice: dynamic, streamed.
export default function Page() {
  return (
    <>
      <ModelCatalog currency="USD" />
      <Suspense fallback={<CreditsSkeleton />}>
        <UserCredits />   {/* reads cookies(); fresh per request */}
      </Suspense>
    </>
  );
}
```

Rules of thumb:
- Pass user or segment values as **arguments** to cached functions instead of reading `cookies()` inside them. This keeps the cache shareable and safe.
- Never cache a function whose result varies by user without including the user in the key.
- Prefer a static shell plus dynamic holes (Suspense boundaries) over making the whole route dynamic.
- Set deliberate lifetimes with `cacheLife`; invalidate with `revalidateTag` after mutations.
- Also cut compute by parallelizing fetches, trimming payloads, and caching at the API or data layer where the backend allows.

### When to use
- The page depends on **who** is asking: session, cookies, auth headers, role, org or workspace.
- The page depends on **request-only data**: `searchParams`, headers, geolocation, A/B bucket.
- Data must be **fresh on every load** and cannot tolerate stale cache (balances, credits, permissions).
- First paint and SEO or link previews matter and the content is per-user or frequently changing.

### When not to
- Content is identical for all users and rarely changes: use static rendering (SSG) or ISR.
- The view is a highly interactive, in-app surface (live chat stream, editor) where server HTML adds little. Server-render the shell and fetch live data on the client.
- Every request would hit a slow upstream. SSR makes the slowest dependency your TTFB.

### How in Next.js + TypeScript

**Routes become dynamic automatically** when a Server Component reads request-time APIs. In Next 15+/16 these APIs are **async**, so `await` them:

```tsx
// app/(app)/projects/page.tsx  (Server Component, no "use client")
import { cookies, headers } from "next/headers";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function ProjectsPage({ searchParams }: Props) {
  const { q } = await searchParams;        // request-time -> dynamic render
  const token = (await cookies()).get("session")?.value;
  const projects = await getProjects({ token, q });   // typed fetch
  return <ProjectList projects={projects} />;
}
```

**Force or document dynamic behavior** when no request API is read but data must be fresh:

```ts
import { connection } from "next/server";

export default async function Page() {
  await connection();        // opt into request-time rendering
  // ...
}
// or, segment config: export const dynamic = "force-dynamic";
```

**Fetching**
- Fetch in the Server Component, close to where data is used. Run independent requests in parallel with `Promise.all` to avoid waterfalls.
- Fetch is not cached by default in recent Next versions. Opt in to caching deliberately where staleness is acceptable.
- Type responses with explicit interfaces and validate at the boundary (e.g. zod) instead of trusting `as`.

**Streaming to reduce SSR cost**
- Add `loading.tsx` or wrap slow parts in `<Suspense fallback={...}>` so the shell is sent immediately and slow sections stream in. This avoids the whole page waiting on the slowest query.

**Server/client boundary**
- Keep the page a Server Component. Push `"use client"` down to small leaf components (buttons, inputs, stream views).
- Pass server data to client components as serializable, typed props. Never pass functions, class instances, or secrets.

**Auth and personalization**
- Read session on the server (`cookies()`/`headers()`), render the personalized result, and never ship tokens to the client unless required.
- Do not cache personalized responses at a shared layer (CDN, `use cache`) without keying by user.

### Tradeoffs
| Gain | Cost |
|---|---|
| Fresh, personalized HTML; fast first content; SEO and share previews | Higher TTFB than static; server compute per request |
| Secrets and data access stay server-side | No full-page CDN caching of the route |
| Smaller client JS when Server Components do the work | Hydration cost for interactive parts; needs a server runtime |

### Pitfalls
- A single `cookies()` call anywhere in the route makes the whole route dynamic. Isolate it in a Suspense-wrapped component if the rest could be static.
- Sequential `await`s creating request waterfalls.
- Using browser-only APIs (`window`, `localStorage`) in Server Components, or hydration mismatches from `Date.now()`/`Math.random()` in rendered output.
- Forgetting to `await` `cookies()`, `headers()`, `params`, `searchParams` (they are Promises in Next 15+).
- Over-fetching: returning full API objects to client components bloats the HTML payload.
- Treating SSR as always-better: it costs server time on every request.

### Industry best practices
- **Treat TTFB as a budget** (aim for roughly 800 ms or less at p75 per web.dev) and trace which upstream call dominates it; the slowest blocking dependency sets the floor.
- **Co-locate the server with the data.** Run the Node or serverless region next to the database or API; a distant region adds a round trip to every sequential fetch.
- **Create one typed data-access layer** (`lib/data/*`) that server code calls directly. Never have a Server Component fetch its own `/api` route handler, which adds a network hop and a second auth check.
- **Authorize at the data layer, not only in the layout.** Layouts do not re-render on every navigation, so each data function should verify the session itself (a data access layer pattern).
- **Wrap per-user fetches in `React.cache()`** so layout, page and metadata share one lookup per request.
- **Use `Server-Timing` headers or OpenTelemetry (`instrumentation.ts`)** to see per-request render and fetch durations in production, not just in dev.
- **Set a `maxDuration` and upstream fetch timeouts** (`AbortSignal.timeout`) so one hung dependency cannot hold a render open and exhaust concurrency.
- **Use `error.tsx`, `not-found.tsx` and `global-error.tsx`** so a failed fetch degrades one segment instead of the whole response.
- **Use `generateMetadata` for per-request titles and previews**, and dedupe its fetch with the page through `cache()`.
- **Use the `after()` API** to run logging, analytics and cache warming after the response is sent, so they do not add to TTFB.
- **Keep responses `private` or `no-store` when they depend on cookies**, and add `Vary` for any header the output depends on so a CDN never serves one user's HTML to another.
- **Load test with realistic concurrency.** SSR cost scales with requests, so measure p95 under load, not a single warm request.

### Things to avoid
- Fetching your own route handlers from Server Components during render.
- Doing authorization only in `layout.tsx` and assuming it protects every child page and server action.
- Reading `cookies()` or `headers()` at the top of a shared layout when only one child needs them; it makes everything beneath it dynamic.
- Unbounded upstream calls with no timeout, retry budget or fallback UI.
- Running heavy CPU work (image processing, big JSON transforms, PDF generation) inside the render path.
- Placing user-specific HTML behind a shared CDN rule such as long `s-maxage` without a cache key that separates users.
- Serializing whole database rows or API responses into client props and leaking fields such as emails, tokens or internal IDs.
- Using `export const dynamic = "force-dynamic"` as a default on whole route groups instead of isolating the dynamic part.
- Mutating module-level variables during render; module state is shared across concurrent requests and leaks between users.
- Catching errors in a Server Component and returning `null` silently, which hides outages from monitoring.

### Checklist
- [ ] Does this page truly need per-request data? If not, prefer static or ISR.
- [ ] Page is a Server Component; `"use client"` only on leaves.
- [ ] Request APIs (`cookies`, `headers`, `params`, `searchParams`) are awaited and typed.
- [ ] Independent fetches run in parallel; no waterfalls.
- [ ] Slow sections wrapped in `<Suspense>` or covered by `loading.tsx`.
- [ ] API responses typed (and validated at the boundary); only needed fields passed to the client.
- [ ] No secrets or tokens leaked in props or HTML.
- [ ] Error and empty states handled (`error.tsx`, `not-found.tsx`).
- [ ] Verified TTFB and LCP with real data.

### Sources
- Next.js docs: [Server-side Rendering](https://nextjs.org/docs/pages/building-your-application/rendering/server-side-rendering), [Static and Dynamic Rendering](https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic-rendering), [cookies](https://nextjs.org/docs/app/api-reference/functions/cookies), [Dynamic APIs are Asynchronous](https://nextjs.org/docs/messages/sync-dynamic-apis).
- Caching: [use cache](https://nextjs.org/docs/app/api-reference/directives/use-cache), [use cache: private](https://nextjs.org/docs/app/api-reference/directives/use-cache-private), [cacheLife](https://nextjs.org/docs/app/api-reference/functions/cacheLife), [Caching guide](https://nextjs.org/docs/app/guides/caching-without-cache-components).
- Web search summaries only; confirm `connection()`, segment config and `use cache` details against the Next 16 docs before relying on them. `use cache` needs the `cacheComponents` flag in `next.config.ts`.

### In this codebase
- `src/app/(app)/template/[uuid]/page.tsx` and several `api/*` route handlers already use `force-dynamic`/`unstable_noStore`-style opt-outs. Audit other pages before adding SSR to them.
