# Health Endpoint — Frontend Usage Map

Cross-references the `/health` backend endpoint against how the front-end calls it. Sibling doc to [`chat-endpoints-usage.md`](./chat-endpoints-usage.md), [`persona-endpoints-usage.md`](./persona-endpoints-usage.md), [`persona-shares-endpoints-usage.md`](./persona-shares-endpoints-usage.md), [`pins-endpoints-usage.md`](./pins-endpoints-usage.md), [`highlights-endpoints-usage.md`](./highlights-endpoints-usage.md), [`users-endpoints-usage.md`](./users-endpoints-usage.md), [`stripe-endpoints-usage.md`](./stripe-endpoints-usage.md), [`projects-endpoints-usage.md`](./projects-endpoints-usage.md), [`connectors-endpoints-usage.md`](./connectors-endpoints-usage.md), [`brain-endpoints-usage.md`](./brain-endpoints-usage.md), [`slack-endpoints-usage.md`](./slack-endpoints-usage.md), [`automations-endpoints-usage.md`](./automations-endpoints-usage.md), [`organizations-endpoints-usage.md`](./organizations-endpoints-usage.md), [`llm-endpoints-usage.md`](./llm-endpoints-usage.md), [`team-invite-endpoints-usage.md`](./team-invite-endpoints-usage.md), [`memory-endpoints-usage.md`](./memory-endpoints-usage.md), and [`internal-sandbox-endpoints-usage.md`](./internal-sandbox-endpoints-usage.md).

Only 1 endpoint exists in this group, and it's dead from the frontend's perspective.

---

## `GET /health` (Health) — dead
- **`config.ts`**: `HEALTH_ENDPOINT` — defined, but verified via grep to appear nowhere else in `src/`. No wrapper function, no caller anywhere.
- This is an infra liveness-check endpoint — the kind a load balancer or container orchestrator polls to decide if the backend instance is up — not something a browser client would ever call. Its presence in `config.ts` at all is likely just for completeness/consistency with every other backend path having an entry, not because any frontend code was ever meant to use it.

---

## Summary

| Endpoint | Status |
|---|---|
| `GET /health` | Dead — constant defined, zero references, not meant to be called from the frontend |
