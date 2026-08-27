import { redirect } from 'next/navigation'
import { z } from 'zod'
import { auth0 } from '@/lib/auth0'

export const dynamic = 'force-dynamic'

const BACKEND_BASE = (process.env.SERVER_URL ?? '').replace(/\/+$/, '')

const ParamsSchema = z.object({ uuid: z.uuid() })

/** Mirrors services/templates/schemas.py TemplateResponse. */
const templateSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  url: z.string(),
  byte_size: z.number(),
  created_at: z.string(),
  revoked: z.boolean(),
})

type Template = z.infer<typeof templateSchema>

type LoadResult =
  | { state: 'ok'; template: Template }
  | { state: 'forbidden' | 'not_found' | 'revoked' | 'error' }

async function loadTemplate(uuid: string, token: string): Promise<LoadResult> {
  let upstream: Response
  try {
    upstream = await fetch(`${BACKEND_BASE}/templates/${uuid}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
  } catch {
    return { state: 'error' }
  }

  if (upstream.status === 403) return { state: 'forbidden' }
  if (upstream.status === 404) return { state: 'not_found' }
  if (upstream.status === 410) return { state: 'revoked' }
  if (!upstream.ok) return { state: 'error' }

  const parsed = templateSchema.safeParse(await upstream.json())
  if (!parsed.success) return { state: 'error' }
  return { state: 'ok', template: parsed.data }
}

const NOTICES: Record<Exclude<LoadResult['state'], 'ok'>, { heading: string; body: string }> = {
  forbidden: {
    heading: "You don't have access",
    body: 'This page belongs to someone in another organization. Ask whoever sent the link to share it from your workspace.',
  },
  not_found: { heading: 'Link not found', body: "This template doesn't exist." },
  revoked: {
    heading: 'This page was revoked',
    body: 'Its creator took it down. Ask them for a fresh one.',
  },
  error: {
    heading: 'Something went wrong',
    body: "The template couldn't be loaded. Try again in a moment.",
  },
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatBuilt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function Notice({ heading, body }: { heading: string; body: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: '100%',
        padding: '48px 16px',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 20,
          lineHeight: '28px',
          color: '#1a1916',
          margin: 0,
        }}
      >
        {heading}
      </p>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          lineHeight: '22px',
          color: 'var(--neutral-500)',
          margin: 0,
          maxWidth: 380,
        }}
      >
        {body}
      </p>
    </div>
  )
}

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const parsedParams = ParamsSchema.safeParse(await params)
  if (!parsedParams.success) {
    return <Notice heading="Link not found" body="That isn't a template address." />
  }
  const { uuid } = parsedParams.data

  // Signing in has to come back here, not to the app root — this page is
  // usually opened straight from a Slack link by someone with no session yet.
  const audience = process.env.AUTH0_AUDIENCE?.trim() || undefined
  let token: string
  try {
    token = (await auth0.getAccessToken({ audience })).token
  } catch {
    redirect(`/auth/login?returnTo=${encodeURIComponent(`/template/${uuid}`)}`)
  }

  const result = await loadTemplate(uuid, token)
  if (result.state !== 'ok') {
    return <Notice {...NOTICES[result.state]} />
  }

  const { template } = result

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          flexWrap: 'wrap',
          padding: '14px 20px',
          borderBottom: '1px solid var(--neutral-100)',
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-title)',
            fontWeight: 400,
            fontSize: 18,
            lineHeight: '26px',
            color: '#1a1916',
            margin: 0,
          }}
        >
          {template.title}
        </h1>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            lineHeight: '20px',
            color: 'var(--neutral-500)',
          }}
        >
          Built {formatBuilt(template.created_at)} · {formatBytes(template.byte_size)}
        </span>
      </header>

      {/*
        The document is model-written HTML. `sandbox` without `allow-same-origin`
        gives it an opaque origin: its own scripts run — charts, filters,
        drill-downs — but it cannot reach this page's session or storage.
        The route handler sets the matching CSP so the guarantee holds even if
        the frame is opened directly.
      */}
      <iframe
        src={`/api/template/${uuid}`}
        title={template.title}
        sandbox="allow-scripts allow-popups allow-forms"
        style={{ flex: 1, width: '100%', border: 'none', minHeight: 0, display: 'block' }}
      />
    </div>
  )
}
