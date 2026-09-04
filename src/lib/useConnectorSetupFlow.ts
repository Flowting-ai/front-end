'use client'

// Connect/reconnect state machine for the Connectors v1.5 Setup screen (S11, S18).
// Carries over every edge case documented in §4 of
// docs v1.5/connectors-v1.5-migration-plan.md from the old useConnectFlow
// (personal) and AddSharedAccountModal (org-shared) implementations, unified
// behind one hook that branches on visibility instead of living in two
// separate files.

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api/client'
import {
  completeZapierLink,
  initiateLink,
  updateConnector,
  unlinkConnector,
  pollConnectorUntilActive,
  ConnectorCatalog,
  type AccountVisibility,
} from '@/lib/api/connectors'
import {
  createOrgConnectorAccount,
  updateOrgConnectorAccount,
  deleteOrgConnectorAccount,
  pollOrgConnectorAccountUntilConnected,
} from '@/lib/api/org-connectors'
import { isMcpProviderConnector, isZapierProviderConnector, waitForZapierAuthId, zapierConnectHref } from '@/lib/connectorProvider'

export type SetupState = 'idle' | 'opening' | 'polling' | 'submitting' | 'error'

export interface SetupFlowResult {
  /** For a private connect, the refreshed catalog entry. For a shared connect, the new account id. */
  kind: 'private' | 'shared'
  entry?: ConnectorCatalog
  sharedAccountId?: string
}

interface UseConnectorSetupFlowArgs {
  connectorSlug: string
  connectorName: string
  connectorProvider?: string | null
  orgId: string | null
  onConnected: (result: SetupFlowResult) => void
}

export function useConnectorSetupFlow({ connectorSlug, connectorName, connectorProvider, orgId, onConnected }: UseConnectorSetupFlowArgs) {
  const [state, setState] = useState<SetupState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const abortedRef = useRef(false)
  const pollAbortRef = useRef<AbortController | null>(null)

  // React StrictMode double-mount guard: reset on every effect setup, not just
  // once — otherwise dev-mode's mount->cleanup->mount leaves abortedRef stuck
  // at true and every async handler silently bails ("click Connect, nothing
  // happens").
  useEffect(() => {
    abortedRef.current = false
    return () => {
      abortedRef.current = true
      pollAbortRef.current?.abort()
    }
  }, [])

  const connectPrivate = useCallback((initData?: Record<string, string>) => {
    const isMcp = isMcpProviderConnector(connectorSlug, connectorProvider)
    // Opened without noopener deliberately — noopener leaves the popup stuck
    // at about:blank in some browsers once we later assign popup.location.
    const popup = isMcp ? null : window.open('', '_blank', 'width=900,height=700')
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
          setState('idle')
          toast.success(`${connectorName} connected`)
          onConnected({ kind: 'private', entry })
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
          : pollConnectorUntilActive(connectorSlug, { signal })

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

  const submitApiKeyPrivate = useCallback((values: Record<string, string>) => {
    setState('submitting')
    setErrorMsg('')
    updateConnector(connectorSlug, { credentials: values })
      .then(entry => {
        if (abortedRef.current) return
        setState('idle')
        toast.success(`${connectorName} connected`)
        onConnected({ kind: 'private', entry })
      })
      .catch((err: unknown) => {
        if (abortedRef.current) return
        setState('error')
        const msg = err instanceof ApiError && err.status === 403 && err.rawMessage
          ? err.rawMessage
          : err instanceof Error ? err.message : 'Failed to save credentials'
        setErrorMsg(msg)
        toast.error(msg)
      })
  }, [connectorSlug, connectorName, onConnected])

  const connectShared = useCallback((accountLabel: string, accountIdentifier: string | undefined, initData: Record<string, string> | undefined, apiKeyValues: Record<string, string> | undefined) => {
    if (!orgId) {
      toast.error('No organization to share this account with.')
      return
    }
    setState('submitting')
    setErrorMsg('')
    // Connector sharing is workspace-wide by construction now — creating the
    // org account is enough, there's no separate "make it shared" flip left
    // (no smaller scope exists to distinguish it from).
    createOrgConnectorAccount(orgId, connectorSlug, { accountLabel, accountIdentifier, initData })
      .then(async res => {
        if (abortedRef.current) return

        if (apiKeyValues && Object.keys(apiKeyValues).length > 0) {
          await updateOrgConnectorAccount(orgId, res.sharedAccountId, { credentials: apiKeyValues })
        }

        if (res.redirectUrl) {
          const isMcp = isMcpProviderConnector(connectorSlug, connectorProvider)
          if (isMcp) {
            window.location.href = res.redirectUrl
            return
          }
          const hosted = isZapierProviderConnector(connectorProvider, res.redirectUrl)
          const openUrl = hosted ? zapierConnectHref(res.redirectUrl) : res.redirectUrl
          const popup = window.open('', '_blank', 'width=900,height=700')
          if (popup && !popup.closed) popup.location.href = openUrl
          else window.open(openUrl, hosted ? 'zapier-connect' : '_blank')
          setState('polling')
          try {
            if (isZapierProviderConnector(connectorProvider, res.redirectUrl)) {
              pollAbortRef.current?.abort()
              pollAbortRef.current = new AbortController()
              const connectionId = await waitForZapierAuthId(pollAbortRef.current.signal)
              await completeZapierLink(connectorSlug, connectionId, res.sharedAccountId)
            } else {
              await pollOrgConnectorAccountUntilConnected(orgId, connectorSlug, res.sharedAccountId)
            }
            popup?.close()
          } catch {
            popup?.close()
            toast.warning('OAuth flow timed out. The account was created; refresh the account list after finishing auth.')
            setState('idle')
            return
          }
        }

        if (abortedRef.current) return
        setState('idle')
        toast.success('Shared account created')
        onConnected({ kind: 'shared', sharedAccountId: res.sharedAccountId })
      })
      .catch((err: unknown) => {
        if (abortedRef.current) return
        setState('error')
        const msg = err instanceof ApiError && err.status === 403 && err.rawMessage
          ? err.rawMessage
          : err instanceof Error ? err.message : 'Failed to create shared account'
        setErrorMsg(msg)
        toast.error(msg)
      })
  }, [orgId, connectorSlug, connectorProvider, onConnected])

  const disconnectPrivate = useCallback(async () => {
    await unlinkConnector(connectorSlug)
  }, [connectorSlug])

  const disconnectShared = useCallback(async (accountId: string) => {
    if (!orgId) throw new Error('No organization context.')
    await deleteOrgConnectorAccount(orgId, accountId)
  }, [orgId])

  const disconnect = useCallback((visibility: AccountVisibility, accountId: string) => (
    visibility === 'shared' ? disconnectShared(accountId) : disconnectPrivate()
  ), [disconnectPrivate, disconnectShared])

  return {
    state,
    errorMsg,
    connectPrivate,
    submitApiKeyPrivate,
    connectShared,
    disconnect,
  }
}
