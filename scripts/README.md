# scripts/

Node scripts used by the front-end. None of them run in the browser or in production requests.

| Script | npm entry | What it does | When to run |
|---|---|---|---|
| `load-secrets.mjs` | `npm run load-secrets` (runs before `dev`, `build`, `start`) | Reads `.env.local` for the AWS bootstrap, fetches the app secrets from AWS Secrets Manager and writes `.env.development.local`. | Automatic. Needs AWS credentials. |
| `perf-bundle.mjs` | `npm run perf:bundle`, `npm run perf:bundle:check` | Bundle-size report from a finished `next build` (reads `.next/` only); `--check` fails when a page exceeds its budget. | After a build; `:check` in CI. |
| `generate-llm-icons.mjs` | `npm run generate:llm-icons` | Writes `src/lib/llm-icons.generated.ts` with only the provider logos the app renders (the icon package ships ~9.5 MB). | When a model provider is added. |
| `generate-dark-theme.mjs` | — (`node scripts/generate-dark-theme.mjs`) | Generates `src/styles/tokens/theme.css` (dark theme) from the tokens; additive only. `theme.test.tsx` checks the output is in sync. | After changing design tokens. |
| `theme-legacy-colors.mjs` | — (data module) | The hard-coded colours that must follow the theme; read by the dark-theme generator and the migration below. | Edit when a legacy colour is found. |
| `migrate-inline-colors.mjs` | — (one-off) | Reviewable migration that points inline colours at theme tokens without changing light-theme pixels. | One-off; kept for reference. |
| `split-openapi.mjs` | — (`node scripts/split-openapi.mjs`) | Splits `docs/openapi/openapi.yaml` into per-tag files in `docs/openapi/api_yaml/`. | After refreshing the backend OpenAPI spec. |
| `sse-probe.mjs` | — (`node scripts/sse-probe.mjs`) | Calls the backend `/chats/create` with a JWT and prints every SSE event as it arrives. | Debugging streaming. Needs a token; never commit one. |

Conventions: scripts are ESM (`.mjs`), read the repo from `import.meta.dirname`, and never write outside the repo. A script that needs secrets reads them from the environment.
