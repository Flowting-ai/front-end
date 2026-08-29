# Internal Sandbox Endpoints — Frontend Usage Map

Cross-references every `/internal/sandbox/*` backend endpoint against how the front-end calls it. Sibling doc to [`chat-endpoints-usage.md`](./chat-endpoints-usage.md), [`persona-endpoints-usage.md`](./persona-endpoints-usage.md), [`persona-shares-endpoints-usage.md`](./persona-shares-endpoints-usage.md), [`pins-endpoints-usage.md`](./pins-endpoints-usage.md), [`highlights-endpoints-usage.md`](./highlights-endpoints-usage.md), [`users-endpoints-usage.md`](./users-endpoints-usage.md), [`stripe-endpoints-usage.md`](./stripe-endpoints-usage.md), [`projects-endpoints-usage.md`](./projects-endpoints-usage.md), [`connectors-endpoints-usage.md`](./connectors-endpoints-usage.md), [`brain-endpoints-usage.md`](./brain-endpoints-usage.md), [`slack-endpoints-usage.md`](./slack-endpoints-usage.md), [`automations-endpoints-usage.md`](./automations-endpoints-usage.md), [`organizations-endpoints-usage.md`](./organizations-endpoints-usage.md), [`llm-endpoints-usage.md`](./llm-endpoints-usage.md), [`team-invite-endpoints-usage.md`](./team-invite-endpoints-usage.md), [`memory-endpoints-usage.md`](./memory-endpoints-usage.md), and [`health-endpoints-usage.md`](./health-endpoints-usage.md).

34 endpoints exist under this prefix — the full list below. **None have any frontend implementation, and none are expected to.** This is the backend's own agent-tool-execution sandbox: the machinery an agent run uses internally to read/write files, query tables, search knowledge, browse the web, call tools, and talk to Slack on the agent's behalf. It's infrastructure the backend calls on itself mid-run, not a surface a browser client ever hits directly.

---

## The 34 paths

| Method | Path | Summary |
|---|---|---|
| POST | `/internal/sandbox/action` | Action |
| POST | `/internal/sandbox/call_many` | Call Many |
| GET | `/internal/sandbox/capabilities` | Capabilities |
| POST | `/internal/sandbox/documents/{name}/assets` | Document Assets |
| POST | `/internal/sandbox/documents/{name}/pages` | Document Pages |
| POST | `/internal/sandbox/drain` | Drain |
| POST | `/internal/sandbox/embed` | Embed |
| GET | `/internal/sandbox/files` | Files |
| GET | `/internal/sandbox/files/{name}` | File Bytes |
| POST | `/internal/sandbox/generate` | Generate |
| GET | `/internal/sandbox/knowledge` | Knowledge |
| POST | `/internal/sandbox/knowledge/search` | Knowledge Search |
| POST | `/internal/sandbox/list_tools` | List Tools |
| POST | `/internal/sandbox/persona/ask` | Persona Ask |
| POST | `/internal/sandbox/persona/find` | Persona Find |
| POST | `/internal/sandbox/persona/wait` | Persona Wait |
| POST | `/internal/sandbox/progress` | Progress |
| POST | `/internal/sandbox/pull_page` | Pull Page |
| POST | `/internal/sandbox/query_data` | Query Data |
| POST | `/internal/sandbox/request` | Proxy Request |
| POST | `/internal/sandbox/save_rows` | Save Rows |
| POST | `/internal/sandbox/search` | Search |
| POST | `/internal/sandbox/search_tools` | Search Tools |
| GET | `/internal/sandbox/slack` | Slack Here |
| POST | `/internal/sandbox/slack/channel` | Slack Channel |
| GET | `/internal/sandbox/slack/channels` | Slack Channels |
| POST | `/internal/sandbox/slack/dm` | Slack DM |
| GET | `/internal/sandbox/slack/people` | Slack People |
| POST | `/internal/sandbox/slack/person` | Slack Person |
| POST | `/internal/sandbox/slack/post` | Slack Post |
| POST | `/internal/sandbox/slack/thread` | Slack Thread |
| GET | `/internal/sandbox/tables` | Tables |
| POST | `/internal/sandbox/tool_schema` | Tool Schema |
| POST | `/internal/sandbox/web/read` | Web Read |

## Verification

No `config.ts` constant, no wrapper function, and no reference of any kind exists anywhere in `src/` for any of these 34 paths — confirmed via grep across the full frontend source tree, including the `persona/*` and `slack/*` sub-paths (which mirror real, live user-facing features by name — `persona/ask`/`persona/find`/`persona/wait` and the Slack `channel`/`dm`/`people`/`post`/`thread` verbs — but are a completely separate, backend-only surface from the actual persona and Slack endpoints documented in [`persona-endpoints-usage.md`](./persona-endpoints-usage.md#a-internal-sandbox-endpoints--all-dead) and [`slack-endpoints-usage.md`](./slack-endpoints-usage.md#out-of-scope--not-implemented-at-all)).

## Summary

| Group | Status |
|---|---|
| All 34 `/internal/sandbox/*` paths | Backend-only — no frontend implementation, none expected |
