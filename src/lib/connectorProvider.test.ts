/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import {
  isMcpProviderConnector,
  isZapierConnectUrl,
  isZapierProviderConnector,
  waitForZapierAuthId,
} from './connectorProvider'

describe('isMcpProviderConnector', () => {
  it('prefers the catalog provider over the slug list', () => {
    expect(isMcpProviderConnector('klaviyo', 'mcp')).toBe(true)
    expect(isMcpProviderConnector('klaviyo', 'zapier')).toBe(false)
    expect(isMcpProviderConnector('slackcliapi', 'mcp')).toBe(true)
  })

  it('falls back to the native-MCP slug set when provider is absent', () => {
    expect(isMcpProviderConnector('klaviyo')).toBe(true)
    expect(isMcpProviderConnector('slackcliapi')).toBe(false)
  })
})

describe('isZapierProviderConnector', () => {
  it('uses provider when present', () => {
    expect(isZapierProviderConnector('zapier')).toBe(true)
    expect(isZapierProviderConnector('pipedream', 'https://connect.zapier.com/to/SlackCLIAPI')).toBe(false)
  })

  it('detects Connect UI by origin when provider is missing', () => {
    expect(isZapierConnectUrl('https://connect.zapier.com/to/SlackCLIAPI?token=x')).toBe(true)
    expect(isZapierConnectUrl('https://pipedream.com/connect')).toBe(false)
    expect(isZapierProviderConnector(undefined, 'https://connect.zapier.com/to/SlackCLIAPI')).toBe(true)
  })
})

describe('waitForZapierAuthId', () => {
  it('resolves the authId from a Connect UI postMessage', async () => {
    const pending = waitForZapierAuthId()
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://connect.zapier.com',
      data: { type: 'authenticationSuccess', authId: 'conn-77' },
    }))
    await expect(pending).resolves.toBe('conn-77')
  })

  it('ignores messages from other origins', async () => {
    const onAbort = vi.fn()
    const controller = new AbortController()
    const pending = waitForZapierAuthId(controller.signal).catch(onAbort)
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://evil.example',
      data: { type: 'authenticationSuccess', authId: 'stolen' },
    }))
    controller.abort()
    await pending
    expect(onAbort).toHaveBeenCalled()
  })
})
