'use client'

import React, { useEffect, useState } from 'react'
import { useForm, ValidationError } from '@formspree/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ChoiceGroup, FeedbackPage, Field, NextSteps, SentState, feedbackStyles as styles } from '@/components/FeedbackPage'
import { useAuth } from '@/context/auth-context'
import { useGuardedRouter } from '@/context/nav-guard-context'
import { SETTINGS_HELP_ROUTE } from '@/lib/routes'

// Settings → Feature request. A full page instead of the old modal: the idea, the part of Souvenir it
// touches, how much it matters, and a side panel on how requests are used. Same Formspree form and draft
// key as the modal.

type Importance = 'nice' | 'important' | 'critical'

const IMPORTANCE: { value: Importance; title: string; hint: string }[] = [
  { value: 'nice', title: 'Nice to have', hint: 'Would make things a bit easier' },
  { value: 'important', title: 'Important', hint: 'Would save real time every week' },
  { value: 'critical', title: 'Critical', hint: 'We need this to keep using Souvenir' },
]

const AREAS = ['Chat', 'Agents', 'Library', 'Schedules', 'Connectors', 'Slack', 'Projects', 'Billing', 'Other'] as const

const DRAFT_KEY = 'kaya:requestFeatureDraft:v1'

export default function FeatureRequestPage() {
  const { user } = useAuth()
  const { push } = useGuardedRouter()
  const [message, setMessage] = useState(() => {
    if (typeof window === 'undefined') return ''
    try { return window.sessionStorage.getItem(DRAFT_KEY) ?? '' } catch { return '' }
  })
  const [importance, setImportance] = useState<Importance>('important')
  const [areas, setAreas] = useState<string[]>([])
  const [state, handleSubmit, reset] = useForm('mrerelnz')
  const displayName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name || '' : ''

  useEffect(() => {
    if (state.succeeded) return
    try { window.sessionStorage.setItem(DRAFT_KEY, message) } catch { /* private mode */ }
  }, [message, state.succeeded])

  useEffect(() => {
    if (!state.succeeded) return
    try { window.sessionStorage.removeItem(DRAFT_KEY) } catch { /* noop */ }
    toast.success('Feature request sent. Thanks for the idea!')
  }, [state.succeeded])

  useEffect(() => {
    const formErrors = state.errors?.getFormErrors() ?? []
    if (!state.submitting && formErrors.length > 0) toast.error(formErrors[0].message ?? 'Could not send the request. Please try again.')
  }, [state.errors, state.submitting])

  const toggleArea = (area: string) => setAreas((current) => (current.includes(area) ? current.filter((a) => a !== area) : [...current, area]))

  const aside = (
    <>
      <NextSteps
        title="How we use requests"
        steps={[
          'Every request is read by the product team.',
          'Similar ideas are grouped, so votes add up.',
          'The most requested ideas shape the roadmap.',
        ]}
      />
      <div className={styles.divider} />
      <p className={styles.asideTitle}>Write a great request</p>
      <p className={styles.hint}>Describe the problem you are trying to solve, not only the solution. Tell us what you do today instead.</p>
    </>
  )

  return (
    <FeedbackPage title="Request a feature" description="Tell us what would make Souvenir more useful for you and your team." aside={aside}>
      {state.succeeded ? (
        <SentState
          title="Thanks for the idea"
          text="We read every request. Ideas that come up often move up the roadmap."
          againLabel="Send another idea"
          onAgain={() => { setMessage(''); setAreas([]); setImportance('important'); reset() }}
          backLabel="Back to Help & Legal"
          onBack={() => push(SETTINGS_HELP_ROUTE)}
        />
      ) : (
        <form className={styles.card} onSubmit={handleSubmit}>
          <div className={styles.body}>
            <Field label="What would help you?" htmlFor="fr-message" error={<ValidationError prefix="Message" field="message" errors={state.errors} className={styles.error} />}>
              <textarea
                id="fr-message"
                name="message"
                className={styles.textarea}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us about your team and what you're trying to solve…"
              />
            </Field>

            <Field label="Which part of Souvenir?" optional hint="Pick any that apply.">
              <input type="hidden" name="areas" value={areas.join(', ')} />
              <div className={styles.chips} role="group" aria-label="Product areas">
                {AREAS.map((area) => (
                  <button key={area} type="button" className={styles.chip} aria-pressed={areas.includes(area)} onClick={() => toggleArea(area)}>
                    {area}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="How important is it?">
              <input type="hidden" name="importance" value={importance} />
              <ChoiceGroup label="Importance" options={IMPORTANCE} value={importance} onChange={setImportance} />
            </Field>

            <div className={styles.row}>
              <Field label="Work email" htmlFor="fr-email" error={<ValidationError prefix="Email" field="email" errors={state.errors} className={styles.error} />}>
                <input id="fr-email" className={styles.input} type="email" name="email" required defaultValue={user?.email ?? ''} placeholder="you@company.com" />
              </Field>
              <Field label="Name" htmlFor="fr-name" optional>
                <input id="fr-name" className={styles.input} type="text" name="name" defaultValue={displayName} placeholder="Jane Smith" />
              </Field>
            </div>
          </div>
          <div className={styles.footer}>
            <span>Your draft is kept while you are signed in.</span>
            <div className={styles.actions}>
              <Button type="submit" variant="default" size="sm" loading={state.submitting} disabled={state.submitting || !message.trim()}>
                Send request
              </Button>
            </div>
          </div>
        </form>
      )}
    </FeedbackPage>
  )
}
