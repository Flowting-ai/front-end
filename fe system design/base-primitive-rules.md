# Base Primitive Rules

Foundation rules for building a better web app (code quality + performance). Distilled from the GreatFrontEnd Front End System Design Playbook and applied to our stack: Next.js 16 (App Router), React 19, TypeScript 5.

Sources: [Introduction](https://www.greatfrontend.com/front-end-system-design-playbook/introduction), [Cheatsheet](https://www.greatfrontend.com/front-end-system-design-playbook/cheatsheet), [Types of questions](https://www.greatfrontend.com/front-end-system-design-playbook/types-of-questions), [RADIO framework](https://www.greatfrontend.com/front-end-system-design-playbook/framework), [Evaluation axes](https://www.greatfrontend.com/front-end-system-design-playbook/evaluation-axes), [Common mistakes](https://www.greatfrontend.com/front-end-system-design-playbook/common-mistakes).

> Note: the playbook is written for interviews. Here it is reused as a design-review checklist for features we build. Content was gathered from web search summaries, not full page reads.

## 1. Frontend system design is client-centric
Front end design focuses on what happens in the client and on the API contract between client and server, not on distributed back-end infrastructure.
- **Rule:** Every feature design states its client architecture (components, state, rendering) and its API contract (shape, errors, pagination).
- The backend is read-only for us, so the API contract is something we adapt to and document, not change.

## 2. Two kinds of problems
1. **Applications** (feed, chat, editor, dashboard): many components, data flow, caching, real-time.
2. **UI components** (dropdown, modal, table, carousel): API surface, accessibility, reusability, states.
- **Rule:** Identify which kind it is first. Applications need an architecture diagram. Components need a props API and an a11y spec.

## 3. RADIO: the structure for every design
| Step | Meaning | Rule for us |
|---|---|---|
| **R**equirements | Clarify scope, users, devices, scale, non-goals | Write requirements before code. Ask who, what, where (mobile/desktop), how much data. |
| **A**rchitecture | Key components and how they interact | Draw server/client component boundaries and data flow. |
| **D**ata model | Entities, fields, where state lives (server vs client) | Define TypeScript types first. Separate server state from UI state. |
| **I**nterface | APIs between components and between client and server | Define props, route handlers, and request/response types. |
| **O**ptimizations | Performance, a11y, i18n, security, UX polish | Deep dive only after the high-level design is settled. |

## 4. Evaluation axes (what "good" means)
1. **Problem exploration**: understood the real problem, asked clarifying questions.
2. **Architecture**: sensible decomposition, clear responsibilities between parts.
3. **Technical proficiency**: performance, networking, accessibility, i18n, security.
4. **Exploration and tradeoffs**: more than one approach, with pros and cons.
5. **Product and UX sense**: loading, empty, error states; perceived speed; real user needs.
6. **Communication and collaboration**: clear writing, open to feedback.
- **Rule:** A feature design or PR description touches each axis. Missing axis = incomplete review.

## 5. Common mistakes to avoid
- Jumping into building without gathering requirements (answering the wrong question well is worse than the right one poorly).
- Unstructured approach: no framework, ad hoc decisions.
- Insisting on a single solution; not recording tradeoffs.
- Diving into one component before the high-level design exists.
- Spending time on unimportant areas.
- Using buzzwords (SSR, edge, CDN, memoization) without being able to say why they apply here.
- Silent decisions: reasoning must be written down.

## 6. Cheatsheet-level technical checklist
Every feature is reviewed against these areas:
- **Performance:** rendering strategy, bundle size, code splitting, lazy loading, image optimization, caching, avoiding waterfalls, Core Web Vitals (LCP, INP, CLS).
- **Networking:** pagination or infinite scroll, request dedupe, retries, optimistic updates, real-time transport (SSE/WebSocket/polling).
- **Accessibility:** semantic HTML, keyboard navigation, focus management, ARIA only when needed, contrast, reduced motion.
- **i18n:** no hard-coded strings in new reusable components, locale-safe dates and numbers, RTL awareness.
- **Security:** XSS (escape and sanitize), CSRF, no secrets in client bundles, validate on the server, safe handling of tokens and cookies.
- **UX states:** loading, empty, error, offline, partial data.

## 7. Applying to our stack
- **TypeScript:** strict types for all API payloads and props. No `any` at boundaries.
- **Server vs client:** default to Server Components. Add `"use client"` only for interactivity, browser APIs, or client state.
- **Data:** fetch on the server where possible. Keep client state minimal.
- **Decisions:** each principle in the files in [principles/](principles/) records what it is, when to use it, how in Next.js + TypeScript, tradeoffs, and a checklist.
