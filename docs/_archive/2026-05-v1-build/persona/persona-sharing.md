# Persona Sharing

Lets an owner **A** share a persona with someone else **B**. B gets their own
copy — but when B uses that copy, the **credits are billed to A**, and A can cap
how much B can spend.

## The pieces

- **One table — `persona_shares`** (see `models.py`). Its `id` (a UUID) *is* the
  share link token. Key columns:
  - `persona_id` → the exact persona version being shared (frozen at share time)
  - `shared_by_user_id` → **A**, who pays
  - `share_type` → `"link"` or `"email"`
  - `recipient_emails` → who to email (email shares only)
  - `credit_limit` / `credit_used` → the shared spending pool (null limit = unlimited)
  - `expires_at`, `is_active` → validity window + revoke flag
- **`Persona.source_share_id`** — set on B's copy; it's the link back to the
  share that says "bill usage of this persona to the sharer."

## How a share works

```
A: POST /persona-shares ──► creates a persona_shares row
        │                    returns { id, share_url, ... }
        │                    share_url = https://devapp.getsouvenir.com/share/{id}
        │
        ├─ type "link"  → A just copies the share_url and sends it however
        └─ type "email" → same link, also emailed to recipient_emails
                          (via core/email.py::send_email — SMTP)
```

Both types are the **same link**; "email" only adds delivery. Anyone holding the
link can accept it.

## How accepting works

```
B opens  https://devapp.getsouvenir.com/share/{id}
   │
   ├─ FE calls  GET /persona-shares/{id}        (login required)
   │     → preview: persona name, prompt, model, temperature, image,
   │               + who shared (name, email), expiry, credits remaining
   │
   ├─ FE shows a confirmation screen
   │
   └─ on confirm: POST /persona-shares/{id}/accept
         → copies the persona into B's account as a NEW repo + version
           (core fields only: name, prompt, model, temperature, tags)
         → sets copy.source_share_id = share.id   ← the billing link
```

If the share is expired / revoked / its persona was deleted, preview and accept
return 404/410.

## How billing is delegated (the important part)

A normal persona is billed to its owner. A **copy accepted from a share** is
billed to the **sharer (A)** instead, drawn from the share's single shared pool.

`service.resolve_billing_user(persona)` decides who pays:

```
persona.source_share_id is None ?
   ├─ yes → bill the persona's owner (ordinary persona)
   └─ no  → look up the share:
            • share missing / inactive / expired   → BLOCK (410)
            • credit_used >= credit_limit (if set)  → BLOCK (402)
            • otherwise                             → bill A (shared_by_user_id)
```

- **Shared pool:** every accepter draws from the same `credit_limit`;
  `credit_used` grows across all of them.
- **Block, never silent fallback:** when the pool is spent or the share is
  gone/expired, B simply can't use the copy — it never quietly charges B.

Two places enforce this:

1. **Pre-flight gate** — `require_persona_budget(persona)` runs at the two
   persona-chat routes in `services/persona/router.py` (before any streaming).
   It resolves the billing user (applying the block rules above) and checks
   *that* user's wallet budget.
2. **The debit** — `charge_persona_usage(persona_id, cost)` bills the resolved
   user via `users.service.record_usage` and draws down `credit_used`.

> ⚠️ The actual per-message debit lives in `services/llm/service.py::run_stream`
> cost-accounting, which is stubbed in this scaffold. `charge_persona_usage` is
> the ready seam; it must be called there (when `usage_category == "persona"`,
> with `resource_id` = the persona id). Until that one line is wired, the gate
> works but the live debit does not.

## Endpoints (`/persona-shares`)

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/persona-shares` | A | create a link/email share → returns `id` + `share_url` |
| GET | `/persona-shares` | A | list A's shares |
| GET | `/persona-shares/{id}` | logged-in | preview persona + who shared |
| POST | `/persona-shares/{id}/accept` | logged-in | copy the persona into the caller's account |
| DELETE | `/persona-shares/{id}` | A | revoke (sets `is_active = false`) |

## Config & migration

- `FRONTEND_BASE_URL` (in `core/config.py`) builds the link → `…/share/{id}`.
- Email needs the `SMTP_*` settings; without them `send_email` just logs and the
  share still succeeds.
- Migration `c4e6a8b0d2f5` creates `persona_shares` + adds
  `Persona.source_share_id`. Run `alembic upgrade head` to apply.

## Not copied / deferred

- Accept copies **core fields only** — persona documents and connectors are not
  carried over (they reference the sharer's files/connections).
- A share freezes the active version at create time; later edits to A's persona
  don't change what was shared.
