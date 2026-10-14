'use client'

import { Button } from '@/components/ui/button'
import { LinkButton } from '@/components/Library/LinkButton'
import { RouteState } from '@/components/RouteState'
import { SCHEDULES_ROUTE } from '@/lib/routes'

/** /schedules/[id] for an id that is neither yours nor in your organization. */
export function ScheduleNotFound() {
  return (
    <RouteState
      heading="Schedule not found"
      body="It may have been deleted, or it belongs to someone outside your organization."
      actions={<LinkButton href={SCHEDULES_ROUTE}>Back to Schedules</LinkButton>}
    />
  )
}

/** /schedules/[id] when loading failed for a reason a retry may fix. */
export function ScheduleLoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <RouteState
      tone="alert"
      heading="Couldn't load this schedule"
      body="Check your connection and try again."
      actions={
        <>
          <Button variant="default" size="sm" onClick={onRetry}>Try again</Button>
          <LinkButton href={SCHEDULES_ROUTE}>Back to Schedules</LinkButton>
        </>
      }
    />
  )
}
