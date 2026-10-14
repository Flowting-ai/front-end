import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { BACKEND_BASE, getSessionToken } from '@/lib/server/backend'
import {
  decodeEntities,
  formatBuilt,
  formatBytes,
  loadTemplate,
  type TemplateLoadState,
} from '@/lib/templates/template-view'
import { TemplateNotice } from './TemplateNotice'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const ParamsSchema = z.object({ uuid: z.uuid() })

const NOTICES: Record<Exclude<TemplateLoadState, 'not_found'>, { heading: string; body: string; tone: 'status' | 'alert' }> = {
  forbidden: {
    heading: "You don't have access",
    body: 'This page belongs to someone in another organization. Ask whoever sent the link to share it from your workspace.',
    tone: 'status',
  },
  revoked: {
    heading: 'This page was revoked',
    body: 'Its creator took it down. Ask them for a fresh one.',
    tone: 'status',
  },
  too_large: {
    heading: 'This page is too large to show',
    body: 'Ask whoever made it for a smaller version.',
    tone: 'alert',
  },
  timeout: {
    heading: 'This is taking too long',
    body: "The template didn't load in time. Try again in a moment.",
    tone: 'alert',
  },
  error: {
    heading: 'Something went wrong',
    body: "The template couldn't be loaded. Try again in a moment.",
    tone: 'alert',
  },
}

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const parsedParams = ParamsSchema.safeParse(await params)
  if (!parsedParams.success) notFound()
  const { uuid } = parsedParams.data

  // Signing in has to come back here, not to the app root — this page is
  // usually opened straight from a Slack link by someone with no session yet.
  const token = await getSessionToken()
  if (!token) redirect(`/auth/login?returnTo=${encodeURIComponent(`/template/${uuid}`)}`)

  const result = await loadTemplate(BACKEND_BASE, uuid, token)
  // One countable line per failed view (no ids or titles).
  if (result.state !== 'ok') logger.event('template_view_failed', { state: result.state })
  if (result.state === 'not_found') notFound()
  if (result.state !== 'ok') {
    return <TemplateNotice {...NOTICES[result.state]} />
  }

  const { template } = result
  const title = decodeEntities(template.title)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-baseline gap-2.5 border-b border-[var(--neutral-100)] px-5 py-3.5">
        <h1 className="m-0 font-[family-name:var(--font-title)] text-lg leading-[26px] font-normal text-[var(--neutral-900)]">
          {title}
        </h1>
        <span className="text-[13px] leading-5 text-[var(--neutral-500)]">
          Built {formatBuilt(template.created_at)} · {formatBytes(template.byte_size)}
        </span>
      </header>

      {/*
        The document is model-written HTML. `sandbox` without `allow-same-origin`
        gives it an opaque origin: its own scripts run — charts, filters,
        drill-downs — but it cannot reach this page's session or storage.
        The route handler sets the matching CSP so the guarantee holds even if
        the frame is opened directly. The iframe is a normal tab stop, so
        keyboard users reach its content right after the header.
        Popups: `allow-popups` without `allow-popups-to-escape-sandbox` is
        deliberate — a link the document opens inherits the same sandbox, so
        model-written HTML can't use a new window to escape it.
        Metadata loads before the frame on purpose: the not-found / no-access /
        revoked states replace the frame, so they must be known first.
      */}
      <iframe
        src={`/api/template/${uuid}`}
        title={title}
        sandbox="allow-scripts allow-popups allow-forms"
        className="block min-h-0 w-full flex-1 border-none"
      />
    </div>
  )
}
