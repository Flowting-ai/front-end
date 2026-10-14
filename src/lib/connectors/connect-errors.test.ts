import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api/client'
import { ConnectTimeoutError, MissingAuthUrlError, describeConnectError } from './connect-errors'

describe('describeConnectError', () => {
  it('reports a plain timeout as retryable', () => {
    expect(describeConnectError(new ConnectTimeoutError('slack', 120_000), 'Slack')).toMatchObject({ kind: 'timeout', recovery: 'retry' })
  })

  it('blames a blocked pop-up when one was refused', () => {
    const info = describeConnectError(new ConnectTimeoutError('slack', 1), 'Slack', { popupBlocked: true })
    expect(info).toMatchObject({ kind: 'popup_blocked', recovery: 'allow_popups' })
    expect(info.message).toContain('Allow pop-ups')
  })

  it('sends a missing OAuth URL to an admin', () => {
    expect(describeConnectError(new MissingAuthUrlError('Drive'), 'Drive')).toMatchObject({ kind: 'not_configured', recovery: 'ask_admin' })
  })

  it('prefers the raw backend detail on 403', () => {
    const err = new ApiError(403, 'forbidden', "You don't have permission", 'googledrive is not available in your organization')
    expect(describeConnectError(err, 'Drive')).toEqual({
      kind: 'access_denied',
      message: 'googledrive is not available in your organization',
      recovery: 'ask_admin',
    })
  })

  it('names the status on 5xx', () => {
    expect(describeConnectError(new ApiError(502, 'x', 'Server error'), 'Drive').message).toContain('backend returned 502')
    expect(describeConnectError(new ApiError(500, 'x', 'Server error', 'Composio down'), 'Drive').message).toBe('Drive (500): Composio down')
  })

  it('treats fetch failures as network errors', () => {
    expect(describeConnectError(new TypeError('Failed to fetch'), 'Drive').kind).toBe('network')
  })

  it('falls back to the error message', () => {
    expect(describeConnectError(new Error('boom'), 'Drive')).toEqual({ kind: 'unknown', message: 'boom', recovery: 'retry' })
    expect(describeConnectError('weird', 'Drive').message).toBe('Connection failed')
  })
})
