'use client'

import React, { useEffect, useState } from 'react'
import { useForm, ValidationError } from '@formspree/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ChoiceGroup, FeedbackPage, Field, NextSteps, SentState, feedbackStyles as styles } from '@/components/FeedbackPage'
import { useAuth } from '@/context/auth-context'
import { useGuardedRouter } from '@/context/nav-guard-context'
import { SETTINGS_HELP_ROUTE } from '@/lib/routes'

// Settings → Report a bug. A full page instead of the old modal: room to describe the problem, the steps,
// how bad it is, and a side panel saying what happens next. Same Formspree form and draft key as the
// modal, so a half-written report carries over between them.

type Severity = 'low' | 'medium' | 'high'

const SEVERITIES: { value: Severity; title: string; hint: string; color: string }[] = [
  { value: 'low', title: 'Low', hint: 'Looks wrong, but I can still work', color: 'var(--color-tag-Green-text)' },
  { value: 'medium', title: 'Medium', hint: 'Something is broken; I have a workaround', color: 'var(--color-tag-Yellow-text)' },
  { value: 'high', title: 'High', hint: 'I am blocked and cannot continue', color: 'var(--red-400)' },
]

const DRAFT_KEY = 'kaya:reportBugDraft:v1'

interface Draft { message: string; steps: string; severity: Severity }

function readDraft(): Draft {
  const empty: Draft = { message: '', steps: '', severity: 'low' }
  if (typeof window === 'undefined') return empty
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) ?? 'null') as Partial<Draft> | null
    if (!parsed) return empty
    return {
      message: typeof parsed.message === 'string' ? parsed.message : '',
      steps: typeof parsed.steps === 'string' ? parsed.steps : '',
      severity: parsed.severity === 'medium' || parsed.severity === 'high' ? parsed.severity : 'low',
    }
  } catch {
    return empty
  }
}

export default function ReportBugPage() {
  const { user } = useAuth()
  const { push } = useGuardedRouter()
  const [draft] = useState(readDraft)
  const [message, setMessage] = useState(draft.message)
  const [steps, setSteps] = useState(draft.steps)
  const [severity, setSeverity] = useState<Severity>(draft.severity)
  const [state, handleSubmit, reset] = useForm('xjgjgopw')
  const displayName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name || '' : ''

  // Keep the draft until it is sent.
  useEffect(() => {
    if (state.succeeded) return
    try { window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ message, steps, severity })) } catch { /* private mode */ }
  }, [message, steps, severity, state.succeeded])

  useEffect(() => {
    if (!state.succeeded) return
    try { window.sessionStorage.removeItem(DRAFT_KEY) } catch { /* noop */ }
    toast.success("Bug reported. We'll look into it soon.")
  }, [state.succeeded])

  useEffect(() => {
    const formErrors = state.errors?.getFormErrors() ?? []
    if (!state.submitting && formErrors.length > 0) toast.error(formErrors[0].message ?? 'Could not send the report. Please try again.')
  }, [state.errors, state.submitting])

  const aside = (
    <>
      <NextSteps
        title="What happens next"
        steps={[
          'Your report goes straight to the Souvenir team.',
          'We reproduce it and fix it in a coming release.',
          'If we need more detail, we will email you.',
        ]}
      />
      <div className={styles.divider} />
      <p className={styles.asideTitle}>Tips for a quick fix</p>
      <p className={styles.hint}>Say what you expected and what happened instead, and which page you were on. Screenshots can be shared in the Community Slack.</p>
    </>
  )

  return (
    <FeedbackPage title="Report a bug" description="Tell us what went wrong. The more detail you share, the faster we can fix it." aside={aside}>
      {state.succeeded ? (
        <SentState
          title="Thanks, your report is in"
          text="We read every report. If we need more detail we will reach out by email."
          againLabel="Report another bug"
          onAgain={() => { setMessage(''); setSteps(''); setSeverity('low'); reset() }}
          backLabel="Back to Help & Legal"
          onBack={() => push(SETTINGS_HELP_ROUTE)}
        />
      ) : (
        <form className={styles.card} onSubmit={handleSubmit}>
          <div className={styles.body}>
            <Field label="What went wrong?" htmlFor="bug-message" error={<ValidationError prefix="Description" field="message" errors={state.errors} className={styles.error} />}>
              <textarea
                id="bug-message"
                name="message"
                className={styles.textarea}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe what happened and what you expected instead…"
              />
            </Field>

            <Field label="Steps to reproduce" htmlFor="bug-steps" optional hint="A short list is enough, e.g. 1. Open Library  2. Click Share  3. Nothing happens.">
              <textarea
                id="bug-steps"
                name="steps"
                className={styles.textarea}
                style={{ minHeight: 96 }}
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                placeholder="1. …"
              />
            </Field>

            <Field label="How much is it affecting you?">
              <input type="hidden" name="severity" value={severity} />
              <ChoiceGroup label="Severity" options={SEVERITIES} value={severity} onChange={setSeverity} />
            </Field>

            <div className={styles.row}>
              <Field label="Work email" htmlFor="bug-email" error={<ValidationError prefix="Email" field="email" errors={state.errors} className={styles.error} />}>
                <input id="bug-email" className={styles.input} type="email" name="email" required defaultValue={user?.email ?? ''} placeholder="you@company.com" />
              </Field>
              <Field label="Name" htmlFor="bug-name" optional>
                <input id="bug-name" className={styles.input} type="text" name="name" defaultValue={displayName} placeholder="Jane Smith" />
              </Field>
            </div>
          </div>
          <div className={styles.footer}>
            <span>Your draft is kept while you are signed in.</span>
            <div className={styles.actions}>
              <Button type="submit" variant="default" size="sm" loading={state.submitting} disabled={state.submitting || !message.trim()}>
                Send report
              </Button>
            </div>
          </div>
        </form>
      )}
    </FeedbackPage>
  )
}
