// Connector slugs whose backend `Connector.provider` is "mcp" — a native MCP
// OAuth flow whose callback redirects back to OUR app domain on success/
// failure (see back-end/services/connectors/router.py's oauth_callback:
// RedirectResponse(`${FRONTEND_BASE_URL}/?connector=...&link=...`)). That
// flow must run in the CURRENT tab: a popup would just land our own app
// inside the small popup window instead of returning control to the tab the
// user started from. Pipedream and Zapier host OAuth on their own domain
// and stay in a popup. Zapier then postMessages `authenticationSuccess`.
//
// Prefer the catalog `provider` field. The slug set is only for payloads
// that predate that field (SSE connect prompts, cached list rows).
const MCP_PROVIDER_CONNECTOR_SLUGS = new Set([
  'customerio',
  'heatmap',
  'klaviyo',
  'metaads',
  'miro',
  'triple-whale',
  'zigpoll',
])

export const ZAPIER_CONNECT_ORIGIN = 'https://connect.zapier.com'

export function isMcpProviderConnector(
  slug: string | null | undefined,
  provider?: string | null,
): boolean {
  if (provider) return provider === 'mcp'
  if (!slug) return false
  return MCP_PROVIDER_CONNECTOR_SLUGS.has(slug.toLowerCase())
}

export function isZapierProviderConnector(
  provider?: string | null,
  redirectUrl?: string | null,
): boolean {
  if (provider) return provider === 'zapier'
  return isZapierConnectUrl(redirectUrl)
}

export function isZapierConnectUrl(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    return new URL(url).origin === ZAPIER_CONNECT_ORIGIN
  } catch {
    return false
  }
}

/** Wait for Connect UI to post the new connection id back to this window. */
export function waitForZapierAuthId(signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== ZAPIER_CONNECT_ORIGIN) return
      const data = event.data as { type?: string; authId?: unknown; connection_id?: unknown; error?: unknown } | null
      if (!data || typeof data !== 'object') return
      if (data.type === 'authenticationSuccess') {
        const id = data.authId ?? data.connection_id
        if (id == null || id === '') {
          cleanup()
          reject(new Error('Zapier did not return a connection id'))
          return
        }
        cleanup()
        resolve(String(id))
        return
      }
      if (data.type === 'authenticationError') {
        cleanup()
        reject(new Error(typeof data.error === 'string' ? data.error : 'Zapier connection failed'))
      }
    }
    const onAbort = () => {
      cleanup()
      reject(new DOMException('Polling aborted', 'AbortError'))
    }
    const cleanup = () => {
      window.removeEventListener('message', onMessage)
      signal?.removeEventListener('abort', onAbort)
    }
    if (signal?.aborted) {
      onAbort()
      return
    }
    window.addEventListener('message', onMessage)
    signal?.addEventListener('abort', onAbort)
  })
}
