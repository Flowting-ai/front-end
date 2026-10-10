# Principles TL;DR

Quick reference for principles 1-11, all classified under **Requirements & Rendering**. Full detail lives in [principles/](principles/). Written for Next.js (App Router, v16) and TypeScript.

## Requirements & Rendering (1-11)

| # | Principle | One-liner | Key properties | Use when | Avoid when | Next.js tools |
|---|---|---|---|---|---|---|
| 1 | [Server Side Rendering](principles/1.%20Requirements%20and%20Rendering/1.%20Server%20Side%20Rendering.md) | Render fresh, personalized HTML on the server for every request | Always up to date and user-specific; costs compute, so cache where personalization allows | Per-user or request-time data, exact freshness, SEO on personal content | Same content for everyone; slow upstream on every request | `cookies()`, `headers()`, `searchParams`, `connection()`, `<Suspense>`, `use cache`, React `cache()` |
| 2 | [Client Side Rendering](principles/1.%20Requirements%20and%20Rendering/2.%20Client%20Side%20Rendering.md) | Ship an HTML shell plus a JS bundle; the browser mounts React and builds the page | Slow first paint, instant navigation after; great for long-session apps, weak for SEO | Behind login, highly interactive, browser-only APIs, realtime | Public or indexable pages; fast first content on poor networks | `"use client"`, SWR / TanStack Query, `next/dynamic` (`ssr: false`) |
| 3 | [Static Site Generation](principles/1.%20Requirements%20and%20Rendering/3.%20Static%20Site%20Generation.md) | Pre-build every page to HTML at deploy time and serve it from a CDN edge | No server compute and no client fetch on first render; best for low-update content (docs, marketing, blogs) | Identical content for all users, rare changes, known page set | Personalized or fast-changing data; huge page sets | `generateStaticParams`, `dynamicParams`, `force-static`, `output: "export"` |
| 4 | [Incremental Static Regeneration](principles/1.%20Requirements%20and%20Rendering/4.%20Incremental%20Static%20Regeneration.md) | Static pages that rebuild on their own schedule; fresh copy after the window | Stale-while-revalidate on whole HTML pages; per-page revalidation, no full-site redeploy | Shared, slow-changing content (catalogs, CMS blogs, public stats) | Per-user data; must-be-exact data; real-time; `output: "export"` | `revalidate`, `revalidatePath`, `revalidateTag`, `cacheLife`, `generateStaticParams` |
| 5 | [Hybrid Rendering](principles/1.%20Requirements%20and%20Rendering/5.%20Hybrid%20Rendering.md) | Mix strategies per route and per component with Server Components | Speed, freshness and interactivity, each where needed; the App Router default | Almost always: static shell + cached shared parts + streamed personal parts + client leaves | Treating the whole app as one mode | Server Components, `"use client"` leaves, `<Suspense>`, `cacheComponents`, `server-only` |
| 6 | [React Server Components](principles/1.%20Requirements%20and%20Rendering/6.%20React%20Server%20Components.md) | Components render on the server and send a serialised tree; zero JS for them reaches the client | `"use client"` marks the interactive leaf; big bundle savings on data-heavy pages; props across the boundary must be serialisable | Display and data-heavy UI, secrets, heavy libraries; the default for pages and layouts | State, effects, event handlers, browser APIs (use a client leaf); `"use client"` on whole pages | `async` components, `"use client"`, `server-only`, `children` slots, `use()` |
| 7 | [Streaming SSR & Suspense](principles/1.%20Requirements%20and%20Rendering/7.%20Streaming%20SSR%20and%20Suspense.md) | Flush the HTML shell at once and stream sections in as their data resolves | Each `<Suspense>` boundary is a streamable chunk; slow data never blocks fast content; split hydration helps INP; status code is fixed once streaming starts | Pages mixing fast content with slow or personalised data; dashboards, feeds | Awaiting everything at the top of the page; one page-wide skeleton; LCP element inside a slow boundary | `<Suspense>`, `loading.tsx`, `error.tsx`, promises plus `use()`, `React.cache` |
| 8 | [Core Web Vitals](principles/1.%20Requirements%20and%20Rendering/8.%20Core%20Web%20Vitals.md) | LCP, CLS and INP measure response time, stability and latency | LCP < 2.5 s, CLS < 0.1 (unitless), INP < 200 ms at p75 of real users; field data beats lab; a ranking signal for crawlable pages only | Every public route; budgets per route enforced in CI | Optimising the lab score while field p75 stays poor; lazy-loading the hero | `next/image` (`preload`, `sizes`), `next/font`, `next/script`, `next/dynamic`, `useReportWebVitals` |
| 9 | [CDN & Edge Delivery](principles/1.%20Requirements%20and%20Rendering/9.%20CDN%20and%20Edge%20Delivery.md) | Serve assets from the PoP nearest the user; run light logic at the edge | Hashed assets cached a year; `s-maxage` per route type; edge runtime is limited (no full Node); put compute near the data | Static assets, SSG/ISR pages, redirects and header logic | Caching personalised responses; Node-only or database code at the edge | `Cache-Control`, `assetPrefix`, `proxy.ts` (Node runtime in v16), `runtime = "edge"`, `revalidateTag` plus CDN purge |
| 10 | [Service Workers & Caching](principles/1.%20Requirements%20and%20Rendering/10.%20Service%20Workers%20and%20Caching.md) | A background proxy that intercepts requests and decides cache versus network | Cache-first only for hashed URLs; version every cache; the SW file must never be long-cached; invalidation is the hard part | Offline fallback, push, background sync | Caching auth, API, streams or per-user data; "speed" as the only reason | `public/sw.js`, `navigator.serviceWorker.register`, `headers()` for `/sw.js`, Serwist (needs webpack) |
| 11 | [Progressive Web App](principles/1.%20Requirements%20and%20Rendering/11.%20Progressive%20Web%20App.md) | A web app that installs, works offline and sends push | Manifest + service worker + HTTPS; progressive enhancement; iOS push only for home-screen installs; push needs VAPID keys and stored subscriptions | Re-engagement, home-screen presence, store-free distribution | A PWA purely for the label; notification permission on first load | `app/manifest.ts`, `viewport.themeColor`, `beforeinstallprompt`, `web-push`, Push API |

## Gotchas worth remembering
| # | Gotcha |
|---|---|
| 1 | One `cookies()` call makes the whole route dynamic; isolate it behind `<Suspense>`. Never cache per-user output in a shared cache. |
| 2 | Push `"use client"` to leaves; every import under it joins the client bundle. Avoid hydration mismatches (`Date.now()`, `Math.random()`). |
| 3 | Reading `cookies()`/`headers()` silently turns a static page into SSR. Check the `next build` route table (`○` static, `●` SSG, `ƒ` dynamic). |
| 4 | The first visitor after the window still gets the stale page and triggers the rebuild; the next one gets fresh. Authenticate revalidation endpoints. |
| 5 | Keep Suspense boundaries tight so the static shell stays large; pass user or segment values as cache-function arguments. |
| 6 | Moving a Server Component under a `"use client"` file makes it a Client Component. Pass server content as `children`; add `import "server-only"` to secret-bearing modules. |
| 7 | `notFound()` or `redirect()` after streaming starts cannot change the HTTP status. Decide before the first `await` or boundary; check that proxies do not buffer the stream. |
| 8 | CLS is unitless (not seconds); INP replaced FID in 2024. Use real-user p75 data, and keep the LCP element outside slow Suspense boundaries. |
| 9 | `revalidateTag` clears the Next.js cache, not the CDN. Forward the `rsc` header and keep `_rsc` in the CDN cache key. In v16 `proxy.ts` runs on Node, not the edge. |
| 10 | An unchanged `sw.js` never updates; never long-cache it, and version cache names. Never cache auth, `/api`, or streams; clear caches on logout. |
| 11 | Ask for push permission in context, store subscriptions in a database (prune on 404/410), keep the VAPID private key server-only, and test login in standalone mode on iOS. |

## Quick decision flow
1. Same for everyone, rarely changes? **SSG** (3).
2. Same for everyone, changes on a cadence? **ISR** (4) or `use cache` with `cacheLife`.
3. Depends on user or request? **SSR** (1), streamed inside `<Suspense>`.
4. Needs state, effects or browser APIs? **CSR** leaf (2).
5. Real pages need several of these? **Hybrid** (5): server shell, cached shared parts, streamed personal parts, client leaves.
6. Slow data on an otherwise fast page? Stream it behind its own `<Suspense>` (7); keep the LCP element in the shell (8).
7. Public route slow or failing vitals? Fix LCP, CLS and INP in order of field evidence (8), and cache at the CDN (9).
8. Need offline, push or install? Manifest first (11), then a narrow, versioned service worker (10).

> Principles 1-5 derive from web search summaries; 6-11 from the bundled Next.js 16 docs plus general platform knowledge. Next 16 specifics (Cache Components, `revalidateTag` signature) are flagged as unverified in the individual files.
