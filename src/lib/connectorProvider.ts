// Connector slugs whose backend `Connector.provider` is "mcp" — a native MCP
// OAuth flow whose callback redirects back to OUR app domain on success/
// failure (see back-end/services/connectors/router.py's oauth_callback:
// RedirectResponse(`${FRONTEND_BASE_URL}/?connector=...&link=...`)). That
// flow must run in the CURRENT tab: a popup would just land our own app
// inside the small popup window instead of returning control to the tab the
// user started from. Every other provider (pipedream/nango/composio) hosts
// its OAuth UI on the broker's own domain and is fine to keep in a popup.
//
// The backend does not expose `provider` on any connector API response
// (`ConnectorCatalogEntry`, `LinkResponse`), so this list is maintained by
// hand — keep it in sync with `Connector.provider == 'mcp'` rows on the
// backend (see back-end/alembic/versions/*_native_mcp*.py and
// *_heatmap_*.py for the current set).
const MCP_PROVIDER_CONNECTOR_SLUGS = new Set([
  'customerio',
  'granola_mcp',
  'heatmap',
  'klaviyo',
  'metaads',
  'miro',
  'triple-whale',
  'zigpoll',
])

export function isMcpProviderConnector(slug: string | null | undefined): boolean {
  if (!slug) return false
  return MCP_PROVIDER_CONNECTOR_SLUGS.has(slug.toLowerCase())
}
