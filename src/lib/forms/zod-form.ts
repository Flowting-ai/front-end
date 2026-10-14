import { z } from 'zod'

/**
 * Pure core of `useZodForm` (hooks/use-zod-form.ts): validation to a flat
 * `{ field: message }` map and dirty tracking. Kept separate so forms test in Node.
 * A small in-house stand-in for react-hook-form (decision D9).
 */

export type FieldErrors<T> = Partial<Record<keyof T & string, string>>

/** First message per top-level field, or `{}` when valid. */
export function validateForm<T>(schema: z.ZodType<T>, values: unknown): { data: T | null; errors: FieldErrors<T> } {
  const parsed = schema.safeParse(values)
  if (parsed.success) return { data: parsed.data, errors: {} }
  const errors: Record<string, string> = {}
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? '')
    if (key && !(key in errors)) errors[key] = issue.message
  }
  return { data: null, errors: errors as FieldErrors<T> }
}

/** Fields whose value differs from the initial one (shallow, JSON-compared for arrays/objects). */
export function dirtyFields<T extends Record<string, unknown>>(initial: T, values: T): (keyof T & string)[] {
  const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)
  return (Object.keys(values) as (keyof T & string)[]).filter(k => !same(initial[k], values[k]))
}
