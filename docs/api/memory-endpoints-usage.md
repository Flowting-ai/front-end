# Memory Endpoints — Frontend Usage Map

Cross-references the `/memory` backend endpoint against how the front-end calls it. Sibling doc to [`chat-endpoints-usage.md`](./chat-endpoints-usage.md), [`persona-endpoints-usage.md`](./persona-endpoints-usage.md), [`persona-shares-endpoints-usage.md`](./persona-shares-endpoints-usage.md), [`pins-endpoints-usage.md`](./pins-endpoints-usage.md), [`highlights-endpoints-usage.md`](./highlights-endpoints-usage.md), [`users-endpoints-usage.md`](./users-endpoints-usage.md), [`stripe-endpoints-usage.md`](./stripe-endpoints-usage.md), [`projects-endpoints-usage.md`](./projects-endpoints-usage.md), [`connectors-endpoints-usage.md`](./connectors-endpoints-usage.md), [`brain-endpoints-usage.md`](./brain-endpoints-usage.md), [`slack-endpoints-usage.md`](./slack-endpoints-usage.md), [`automations-endpoints-usage.md`](./automations-endpoints-usage.md), [`organizations-endpoints-usage.md`](./organizations-endpoints-usage.md), [`llm-endpoints-usage.md`](./llm-endpoints-usage.md), [`team-invite-endpoints-usage.md`](./team-invite-endpoints-usage.md), [`health-endpoints-usage.md`](./health-endpoints-usage.md), and [`internal-sandbox-endpoints-usage.md`](./internal-sandbox-endpoints-usage.md).

Only 1 endpoint exists in this group. **It's actively used**, though notably it's one of the few endpoints in this entire series called with no dedicated wrapper function at all.

---

## `POST /memory/user` (Set My Memory)
- **`config.ts`**: `MEMORY_USER_ENDPOINT`
- **No dedicated wrapper function** — called directly via `apiFetch(MEMORY_USER_ENDPOINT, { method: 'POST', body: JSON.stringify({ content }) })` from two onboarding pages, rather than through a named function in a `lib/api/*.ts` module the way every other live endpoint in this series is.
- **Used by**:
  - `onboarding/import/page.tsx` and `onboarding/invite/page.tsx` — both fire-and-forget a memory write of `"My role: {free text}"` when the user picked **"Other"** for their role and typed a custom description, since the backend's `user_role` field is a fixed enum that can't store free text (see [`users-endpoints-usage.md`](./users-endpoints-usage.md#patch-usersmeonboarding-patch-my-onboarding)'s `ROLE_API_MAP`).
  - `onboarding/import/page.tsx` additionally sends the user's optional pasted "AI context" blurb (whatever they typed describing how they plan to use the product) as a second memory write — this one is `await`-ed rather than fire-and-forget, since it directly reflects a field the user filled in and errors should be visible.

---

## Summary

| Endpoint | Status |
|---|---|
| `POST /memory/user` | Live — no wrapper, called directly via `apiFetch` |
