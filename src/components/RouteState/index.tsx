import type { ReactNode } from 'react'

/**
 * Full-area message for a route that can't show its content: not found, no
 * access, revoked, or a failed load. Shared by Projects, Schedules and
 * Templates. Works in server and client components.
 *
 * `tone="alert"` for failures the viewer didn't expect (announced at once),
 * `status` for normal outcomes.
 */
export function RouteState({
  heading,
  body,
  tone = 'status',
  actions,
  headingLevel = 'h1',
  fill = false,
}: {
  heading: string
  body: ReactNode
  tone?: 'status' | 'alert'
  actions?: ReactNode
  headingLevel?: 'h1' | 'h2'
  /** Stretch to the parent's height and centre vertically (else padded block). */
  fill?: boolean
}) {
  const Heading = headingLevel
  return (
    <div
      role={tone}
      className={`flex flex-col items-center justify-center gap-3 px-4 text-center ${fill ? 'h-full min-h-full flex-1 py-12' : 'py-24'}`}
    >
      <Heading className="m-0 font-[family-name:var(--font-title)] text-2xl leading-8 font-normal text-[var(--neutral-900)]">
        {heading}
      </Heading>
      <p className="m-0 max-w-[420px] text-sm leading-[22px] text-[var(--neutral-600)]">
        {body}
      </p>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  )
}
