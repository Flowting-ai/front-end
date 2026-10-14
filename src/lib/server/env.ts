import { z } from "zod"

/**
 * Server configuration the app cannot run without, checked at startup
 * (instrumentation.ts) and by /api/health. Reports variable NAMES only, never
 * values. Auth0's own variables (AUTH0_SECRET, AUTH0_CLIENT_SECRET) are read
 * by the SDK, so they are checked for presence here too.
 */
const url = z.string().url()

export const SERVER_ENV_SCHEMA = {
  SERVER_URL: url,
  APP_BASE_URL: url,
  AUTH0_DOMAIN: z.string().min(3).refine(v => !v.startsWith("http"), "a host name, without https://"),
  AUTH0_CLIENT_ID: z.string().min(1),
  AUTH0_CLIENT_SECRET: z.string().min(1),
  AUTH0_SECRET: z.string().min(32, "at least 32 characters"),
} as const

/** Optional but validated when set. */
export const OPTIONAL_SERVER_ENV_SCHEMA = {
  AUTH0_AUDIENCE: z.string().min(1),
  NEXT_PUBLIC_SERVER_URL: url,
  NEXT_PUBLIC_LIBRARY_STORAGE_ORIGIN: url,
  NEXT_PUBLIC_MAP_STYLE_URL: url,
} as const

export interface EnvReport {
  ok: boolean
  missing: string[]
  /** `NAME: reason` — the reason never contains the value. */
  invalid: string[]
}

export function checkServerEnv(env: Record<string, string | undefined> = process.env): EnvReport {
  const missing: string[] = []
  const invalid: string[] = []
  for (const [name, schema] of Object.entries(SERVER_ENV_SCHEMA)) {
    const value = env[name]
    if (!value) { missing.push(name); continue }
    const parsed = schema.safeParse(value)
    if (!parsed.success) invalid.push(`${name}: ${parsed.error.issues[0]?.message ?? "invalid"}`)
  }
  for (const [name, schema] of Object.entries(OPTIONAL_SERVER_ENV_SCHEMA)) {
    const value = env[name]
    if (!value) continue
    const parsed = schema.safeParse(value)
    if (!parsed.success) invalid.push(`${name}: ${parsed.error.issues[0]?.message ?? "invalid"}`)
  }
  return { ok: missing.length === 0 && invalid.length === 0, missing, invalid }
}
