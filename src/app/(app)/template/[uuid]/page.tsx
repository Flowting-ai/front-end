import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { BACKEND_BASE, getSessionToken } from '@/lib/server/backend'
import {
  decodeEntities,
  formatBuilt,
  formatBytes,
  loadTemplate,
  TEMPLATE_NOTICES,
} from '@/lib/templates/template-view'
import { TemplateFrame } from './TemplateFrame'
import { TemplateNotice } from './TemplateNotice'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const ParamsSchema = z.object({ uuid: z.uuid() })

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
    return <TemplateNotice {...TEMPLATE_NOTICES[result.state]} />
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

      {/* Metadata loads before the frame on purpose: the not-found / no-access /
          revoked states replace the frame, so they must be known first. */}
      <TemplateFrame uuid={uuid} title={title} />
    </div>
  )
}
