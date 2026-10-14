'use client'

import { useCallback, useMemo, useState } from 'react'
import type { z } from 'zod'
import { dirtyFields, validateForm, type FieldErrors } from '@/lib/forms/zod-form'

/**
 * Minimal form state with a Zod schema: values, per-field errors (shown after a
 * field is touched or on submit), `isDirty`, `reset`, and `handleSubmit` that
 * only calls through with parsed data. In-house stand-in for react-hook-form
 * (decision D9); swap the internals later without changing callers.
 */
export function useZodForm<T extends Record<string, unknown>, Out = T>(schema: z.ZodType<Out>, initial: T) {
  const [values, setValues] = useState<T>(initial)
  const [base, setBase] = useState<T>(initial)
  const [touched, setTouched] = useState<Partial<Record<keyof T & string, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)

  const result = useMemo(() => validateForm(schema, values), [schema, values])
  const dirty = useMemo(() => dirtyFields(base, values), [base, values])

  const setField = useCallback(<K extends keyof T & string>(key: K, value: T[K]) => {
    setValues(prev => ({ ...prev, [key]: value }))
    setTouched(prev => ({ ...prev, [key]: true }))
  }, [])

  const reset = useCallback((next: T) => {
    setValues(next)
    setBase(next)
    setTouched({})
    setSubmitted(false)
  }, [])

  const handleSubmit = useCallback((onValid: (data: Out) => void) => () => {
    setSubmitted(true)
    if (result.data) onValid(result.data)
  }, [result.data])

  /** Errors to show: touched fields, or all of them after a submit attempt. */
  const visibleErrors = useMemo(() => {
    const out: FieldErrors<T> = {}
    for (const [k, v] of Object.entries(result.errors) as [keyof T & string, string][]) {
      if (submitted || touched[k]) out[k] = v
    }
    return out
  }, [result.errors, submitted, touched])

  return {
    values,
    setField,
    errors: visibleErrors,
    isValid: result.data !== null,
    isDirty: dirty.length > 0,
    dirtyFields: dirty,
    reset,
    handleSubmit,
  }
}
