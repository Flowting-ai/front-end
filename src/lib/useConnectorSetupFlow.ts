'use client'

// Connect/reconnect state machine for the Connectors Setup screen (S11, S18).
// Carries over every edge case documented in §4 of
// docs v1.5/connectors-v1.5-migration-plan.md.
//
// There is one connect path. Sharing is not a different kind of link — the
// account is always vaulted under the person who authorized it, and `shared`
// is a flag flipped on the row afterwards, so connecting shared is just
// connecting and then PATCHing.

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api/client'
import {
  completeZapierLink,
  initiateLink,
  updateAccount,
  unlinkAccount,
  pollConnectorUntilActive,
  ConnectorCatalog,
} from '@/lib/api/connectors'
import { isMcpProviderConnector, isZapierProviderConnector, waitForZapierAuthId, zapierConnectHref } from '@/lib/connectorProvider'

export type SetupState = 'idle' | 'opening' | 'polling' | 'submitting' | 'error'

export interface SetupFlowResult {
  /** The refreshed catalog entry, with the account that was just linked on it. */
  entry: ConnectorCatalog
}

interface UseConnectorSetupFlowArgs {
  connectorSlug: string
  connectorName: string
  connectorProvider?: string | null
  onConnected: (result: SetupFlowResult) => void
}

export function useConnectorSetupFlow({ connectorSlug, connectorName, connectorProvider, onConnected }: UseConnectorSetupFlowArgs) {
  const [state, setState] = useState<SetupState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const abortedRef = useRef(false)
  const pollAbortRef = useRef<AbortController | null>(null)
  // Tracks the popup across the whole flow so unmounting (e.g. the user
  // clicking Cancel while still "Waiting for auth…") can close it too, not
  // just abort the poll — otherwise a cancelled flow can leave an orphaned
  // OAuth popup open in the background.
  const popupRef = useRef<Window | null>(null)

  // React StrictMode double-mount guard: reset on every effect setup, not just
  // once — otherwise dev-mode's mount->cleanup->mount leaves abortedRef stuck
  // at true and every async handler silently bails ("click Connect, nothing
  // happens").
  useEffect(() => {
    abortedRef.current = false
    return () => {
      abortedRef.current = true
      pollAbortRef.current?.abort()
      popupRef.current?.close()
    }
  }, [])

  const connect = useCallback((
    { initData, shared, accountLabel, knownAccountIds, reconnecting }: {
      initData?: Record<string, string>
      shared?: boolean
      /** Renames the row this link produces; the backend seeds a default. */
      accountLabel?: string
      /** The accounts already on file, so a new one can be told apart. */
      knownAccountIds?: string[]
      /** Re-authorizing this account rather than adding one. */
      reconnecting?: string
    } = {},
  ) => {
    const known = knownAccountIds ?? []
    const target = reconnecting ? { healthy: reconnecting } : { known }
    const isMcp = isMcpProviderConnector(connectorSlug, connectorProvider)
    // Opened without noopener deliberately — noopener leaves the popup stuck
    // at about:blank in some browsers once we later assign popup.location.
    const popup = isMcp ? null : window.open('', '_blank', 'width=900,height=700')
    popupRef.current = popup
    setState('opening')
    setErrorMsg('')

    initiateLink(connectorSlug, initData)
      .then(link => {
        if (abortedRef.current) { popup?.close(); return }
        const url = link.redirectUrl
        if (!url) {
          popup?.close()
          throw new Error(`${connectorName} did not return an OAuth URL. The connector provider may be misconfigured on the backend.`)
        }
        if (isMcp) {
          // Native MCP connectors' OAuth callback redirects back to our own
          // app domain, so this must navigate the current tab — a popup would
          // just land the app inside the small popup window.
          //
          // Nothing survives that navigation: the account does not exist until
          // the callback lands, so there is no row to name or share yet. Say so
          // rather than dropping the choice silently.
          if (shared || accountLabel) {
            toast.info(`Finish authorizing ${connectorName}, then set its name and sharing from the account's settings.`)
          }
          window.location.href = url
          return
        }
        const hosted = isZapierProviderConnector(connectorProvider, url)
        const openUrl = hosted ? zapierConnectHref(url) : url
        if (popup && !popup.closed) popup.location.href = openUrl
        else window.open(openUrl, hosted ? 'zapier-connect' : '_blank')
        setState('polling')

        pollAbortRef.current?.abort()
        pollAbortRef.current = new AbortController()
        const { signal } = pollAbortRef.current
        let settled = false

        const finish = (entry: ConnectorCatalog) => {
          if (settled || abortedRef.current) return
          settled = true
          popup?.close()
          // The row the authorization produced: the owned account that was not
          // on file when this started. Each remote account is its own row, so
          // a genuinely new one is identifiable — and re-authorizing an
          // account already held produces none, in which case there is nothing
          // this link may name or share. Guessing a row here is what turned a
          // private account shared.
          const held = new Set(known)
          const row = entry.ownedConnections.find(a => !held.has(a.id)) ?? null
          const wanted = {
            ...(shared ? { shared: true } : {}),
            ...(accountLabel ? { accountLabel } : {}),
          }
          if (Object.keys(wanted).length === 0) {
            setState('idle')
            toast.success(`${connectorName} connected`)
            onConnected({ entry })
            return
          }
          if (row === null) {
            setState('idle')
            // Said plainly rather than applied to whichever row was handy.
            toast.info(
              `${connectorName} re-authorized the account you already had. Set its name and sharing from that account's settings.`,
            )
            onConnected({ entry })
            return
          }
          // Naming it and sharing it are edits to the row we just linked, not
          // part of the link itself.
          setState('submitting')
          updateAccount(row.id, wanted)
            .then(() => {
              if (abortedRef.current) return
              setState('idle')
              toast.success(shared ? `${connectorName} connected and shared` : `${connectorName} connected`)
              onConnected({ entry })
            })
            .catch((err: unknown) => {
              if (abortedRef.current) return
              setState('idle')
              // The account is linked and usable either way — say what did not happen.
              toast.warning(
                `${connectorName} connected, but saving its ${
                  shared ? 'sharing' : 'name'
                } failed: ${
                  err instanceof Error ? err.message : 'unknown error'
                }. Set it from the account's settings.`,
              )
              onConnected({ entry })
            })
        }

        // A closed popup is not immediately cancellation — Pipedream's hosted
        // success screen often stays open after the account is actually
        // linked. Abort the long poll and run a short grace-window poll
        // first; only report "cancelled" if that still comes back empty.
        // Zapier never flips `linked` until we POST /complete with the
        // postMessage id, so a closed popup is cancellation.
        const closedCheck = setInterval(() => {
          if (!popup?.closed || settled) return
          clearInterval(closedCheck)
          if (abortedRef.current) return
          pollAbortRef.current?.abort()
          if (hosted) {
            settled = true
            setState('idle')
            toast.info(`${connectorName} connection cancelled`)
            return
          }
          pollAbortRef.current = new AbortController()
          pollConnectorUntilActive(connectorSlug, {
            signal: pollAbortRef.current.signal,
            initialIntervalMs: 1_000,
            maxIntervalMs: 2_000,
            timeoutMs: 12_000,
            target,
          })
            .then(finish)
            .catch((err: unknown) => {
              if (settled || abortedRef.current) return
              settled = true
              if (err instanceof DOMException && err.name === 'AbortError') return
              setState('idle')
              toast.info(`${connectorName} connection cancelled`)
            })
        }, 1_000)

        const pending = hosted
          ? waitForZapierAuthId(signal).then(id => completeZapierLink(connectorSlug, id))
          : pollConnectorUntilActive(connectorSlug, { signal, target })

        return pending.then(entry => {
          clearInterval(closedCheck)
          if (entry) finish(entry)
        }).catch((err: unknown) => {
          clearInterval(closedCheck)
          if (settled || abortedRef.current) return
          if (err instanceof DOMException && err.name === 'AbortError') return
          popup?.close()
          settled = true
          setState('error')
          let msg = err instanceof Error ? err.message : 'Connection failed'
          // Prefer the raw backend detail on 5xx/403 over the laundered generic
          // message — e.g. "googledrive is not available in your organization —
          // request access from an admin first." is far more actionable than
          // "You don't have permission to perform this action."
          if (err instanceof ApiError && err.status >= 500) {
            msg = err.rawMessage
              ? `${connectorName} (${err.status}): ${err.rawMessage}`
              : `${connectorName}: backend returned ${err.status}. The connector provider may not be configured (check backend logs).`
          } else if (err instanceof ApiError && err.status === 403 && err.rawMessage) {
            msg = err.rawMessage
          }
          setErrorMsg(msg)
          toast.error(msg)
        })
      })
      .catch((err: unknown) => {
        if (abortedRef.current) return
        popup?.close()
        setState('error')
        const msg = err instanceof ApiError && err.status === 403 && err.rawMessage
          ? err.rawMessage
          : err instanceof Error ? err.message : 'Connection failed'
        setErrorMsg(msg)
        toast.error(msg)
      })
  }, [connectorSlug, connectorName, connectorProvider, onConnected])

  // One account, one id — shared or not, and whatever vault it lives in.
  const disconnect = useCallback((accountId: string) => unlinkAccount(accountId), [])

  return {
    state,
    errorMsg,
    connect,
    disconnect,
  }
}
