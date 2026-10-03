---
name: new-dev-environment
description: Use when a developer is forking this repo, or standing up a new sibling project in the same family, to build a similar app. Bootstraps the environment (Node version, deps, env/secrets) and sets up the component layer with shadcn/ui instead of a packaged UI library. Triggers on "set up a new environment", "fork this repo", "start a new project like this one", "bootstrap the frontend".
version: "1.0.0"
---

# New Dev Environment

Bootstraps a fresh environment that follows this codebase's stack, so a fork or
sibling project stays compatible instead of drifting into a different set of
libraries/versions. The full rationale for every choice below lives in
`docs/onboarding/TECH-STACK.md` — read that first if anything here is unclear,
especially the shadcn/ui vs. Hero UI section.

## 1. Confirm the runtime

```bash
node -v   # want 20.x or 22.x LTS — @types/node is pinned to ^20
npm -v    # 10.x+
```

If there's no `.nvmrc` in the new repo yet, add one (`20` or `22`) so this isn't
tribal knowledge for the next person.

## 2. Install the baseline stack

If this is a genuine fork, `npm install` from the existing `package.json` and skip
to step 3. If it's a new sibling project, install the same core set so nothing has
to be reconciled later:

```bash
npm install next@16 react@19 react-dom@19 typescript zod \
  @tanstack/react-query @tanstack/react-virtual \
  class-variance-authority clsx tailwind-merge lucide-react \
  framer-motion sonner

npm install -D tailwindcss @tailwindcss/postcss @types/node @types/react @types/react-dom \
  eslint eslint-config-next vitest
```

Only add Auth0 (`@auth0/nextjs-auth0`), Stripe (`stripe`), maps
(`@vis.gl/react-maplibre` + `maplibre-gl`), or the markdown/katex pipeline
(`react-markdown` + `remark-*`/`rehype-*` + `katex`) if the new project actually
needs them — don't cargo-cult every dependency from the source repo.

## 3. Set up Tailwind v4 (CSS-first, no config file)

Confirm `postcss.config.mjs` only has `@tailwindcss/postcss` as a plugin, and that
theme tokens live in CSS (`@theme` / CSS variables), not a `tailwind.config.js`. If
you're forking, carry over the token layering pattern from
`src/styles/tokens/` (`primitives.css` → `aliases.css` → `semantic.css` →
`typography.css`) imported once from the app's global stylesheet. Never hardcode
hex values in components — that's what breaks dark mode later.

## 4. Initialize shadcn/ui for the component layer

Do **not** reach for a packaged UI library (Hero UI, MUI, Chakra, etc.) here — see
`docs/onboarding/TECH-STACK.md` §4 for why. Instead:

```bash
npx shadcn@latest init
```

When prompted:
- Base color / CSS variables: yes, wire to the existing token CSS if forking
- Path alias: match whatever `@/*` resolves to in `tsconfig.json` (this repo uses
  `@/*` → `./src/*`)
- Components directory: `src/components/ui`

Then add components as the feature actually needs them:

```bash
npx shadcn@latest add button dialog dropdown-menu tooltip tabs
```

Each add is a source file landing in `src/components/ui/` that you own outright —
no version to track, no upstream package to update. If business logic needs to sit
on top of a shadcn component, wrap it (`AppButton.tsx` next to `button.tsx`) rather
than editing the generated file in place, so a future `shadcn add` re-run doesn't
clobber your logic.

## 5. Wire up secrets (don't commit real env values)

Follow the two-file split from `docs/onboarding/TECH-STACK.md` §8:

1. `.env.local` (gitignored) — bootstrap-only creds (e.g. AWS access key/secret,
   region, secret name), never the real app secrets.
2. A `predev`/`prebuild`/`prestart` script fetches the real secret bundle (AWS
   Secrets Manager, or whatever the new project's secret store is) and writes it to
   a second gitignored file (`.env.development.local`), mode `0600`.
3. Skip the fetch entirely when `process.env.VERCEL` (or the equivalent platform
   flag) is set — deployed environments get env vars injected directly.

If forking, copy `scripts/load-secrets.mjs` as a starting point and repoint
`AWS_SECRET_NAME` at a secret scoped to the new project.

## 6. Verify the environment

```bash
npm run dev     # starts, no missing-env crashes
npm run lint     # ESLint 9 flat config clean
npm run test     # vitest run — should pass with zero tests as a floor
npx tsc --noEmit # strict mode clean
```

If `npm run dev` fails immediately on missing env vars, that's step 5 not done yet
— don't work around it by hardcoding fallback values in code.

## 7. Sanity-check before building features

- [ ] `node -v` matches the LTS pinned in `.nvmrc`
- [ ] Tailwind config is CSS-first (v4), no `tailwind.config.js`
- [ ] `components.json` exists (shadcn initialized) and points at the real token CSS
- [ ] Only one icon library installed (`lucide-react`) — resist adding a second
- [ ] Real secrets never sit in a file that isn't gitignored
- [ ] `npm run dev`, `lint`, `test`, and `tsc --noEmit` all pass clean

At that point the environment matches the source repo's stack and versions, and
new feature work can start.
