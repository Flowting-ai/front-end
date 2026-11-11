'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from '@/context/theme-context'

const noSubscribe = () => () => {}

/**
 * The template's `<iframe>`. Its src carries the app's theme so a notice the route serves into the
 * frame (the HTML failed after the details loaded) matches the app: a sandboxed frame can't see the
 * app's theme, and its prefers-color-scheme follows the OS. Rendered once hydrated, when the theme
 * is known, so a dark-theme viewer's frame doesn't load twice.
 */
export function TemplateFrame({ uuid, title }: { uuid: string; title: string }) {
  const { enabled, resolved } = useTheme()
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false)
  if (!hydrated) return <div className="min-h-0 flex-1" />
  const theme = enabled ? resolved : 'light'

  /*
    The document is model-written HTML. `sandbox` without `allow-same-origin`
    gives it an opaque origin: its own scripts run — charts, filters,
    drill-downs — but it cannot reach this page's session or storage.
    The route handler sets the matching CSP so the guarantee holds even if
    the frame is opened directly. The iframe is a normal tab stop, so
    keyboard users reach its content right after the header.
    Popups: `allow-popups` without `allow-popups-to-escape-sandbox` is
    deliberate — a link the document opens inherits the same sandbox, so
    model-written HTML can't use a new window to escape it.
  */
  return (
    <iframe
      src={`/api/template/${uuid}?theme=${theme}`}
      title={title}
      sandbox="allow-scripts allow-popups allow-forms"
      className="block min-h-0 w-full flex-1 border-none"
    />
  )
}
