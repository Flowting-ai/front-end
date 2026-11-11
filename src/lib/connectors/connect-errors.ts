import { ApiError } from '@/lib/api/client'

/**
 * Typed failures of the connect flow, so the setup UI can offer the right
 * recovery (retry, allow pop-ups, ask an admin) instead of one string.
 */

/** The poll ran out of time before the new account showed up. */
export class ConnectTimeoutError extends Error {
  constructor(public readonly slug: string, public readonly timeoutMs: number) {
    super(`Connector ${slug} did not become linked within ${timeoutMs}ms`)
    this.name = 'ConnectTimeoutError'
  }
}

/** The backend returned no OAuth URL for a connector that needs one. */
export class MissingAuthUrlError extends Error {
  constructor(connectorName: string) {
    super(`${connectorName} did not return an OAuth URL. The connector provider may be misconfigured on the backend.`)
    this.name = 'MissingAuthUrlError'
  }
}

export type ConnectErrorKind =
  | 'timeout'
  | 'popup_blocked'
  | 'access_denied'
  | 'not_configured'
  | 'server'
  | 'network'
  | 'unknown'

export type ConnectRecovery = 'retry' | 'allow_popups' | 'ask_admin'

export interface ConnectErrorInfo {
  kind:     ConnectErrorKind
  message:  string
  recovery: ConnectRecovery
}

/**
 * What went wrong and what the user can do. `popupBlocked` is true when the
 * flow needed a pop-up and the browser refused it; a timeout in that case is
 * almost always the blocked pop-up, not the provider.
 */
export function describeConnectError(
  error: unknown,
  connectorName: string,
  { popupBlocked = false }: { popupBlocked?: boolean } = {},
): ConnectErrorInfo {
  if (error instanceof ConnectTimeoutError) {
    return popupBlocked
      ? {
          kind: 'popup_blocked',
          message: `Your browser blocked the ${connectorName} sign-in window. Allow pop-ups for this site, then try again.`,
          recovery: 'allow_popups',
        }
      : {
          kind: 'timeout',
          message: `${connectorName} didn't finish connecting in time. If you completed sign-in, try again.`,
          recovery: 'retry',
        }
  }
  if (error instanceof MissingAuthUrlError) {
    return { kind: 'not_configured', message: error.message, recovery: 'ask_admin' }
  }
  if (error instanceof ApiError) {
    // Prefer the raw backend detail on 403/5xx over the laundered generic
    // message — e.g. "googledrive is not available in your organization —
    // request access from an admin first." is far more actionable.
    if (error.status === 403) {
      return { kind: 'access_denied', message: error.rawMessage || error.message, recovery: 'ask_admin' }
    }
    if (error.status >= 500) {
      return {
        kind: 'server',
        message: error.rawMessage
          ? `${connectorName} (${error.status}): ${error.rawMessage}`
          : `${connectorName}: backend returned ${error.status}. The connector provider may not be configured (check backend logs).`,
        recovery: 'retry',
      }
    }
    return { kind: 'unknown', message: error.message, recovery: 'retry' }
  }
  if (error instanceof TypeError) {
    return { kind: 'network', message: `Couldn't reach the server to connect ${connectorName}. Check your connection and try again.`, recovery: 'retry' }
  }
  return {
    kind: 'unknown',
    message: error instanceof Error && error.message ? error.message : 'Connection failed',
    recovery: 'retry',
  }
}
