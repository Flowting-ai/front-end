/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import {
  opensInCurrentTab,
  rememberConnectReturn,
  takeConnectReturn,
  isZapierConnectUrl,
  isZapierProviderConnector,
  waitForZapierAuthId,
  zapierConnectHref,
} from './connectorProvider'

describe('opensInCurrentTab', () => {
  it('prefers the catalog provider over the slug list', () => {
    expect(opensInCurrentTab('klaviyo', 'mcp')).toBe(true)
    expect(opensInCurrentTab('klaviyo', 'zapier')).toBe(false)
    expect(opensInCurrentTab('slackcliapi', 'mcp')).toBe(true)
    expect(opensInCurrentTab('shopify_app', 'shopify')).toBe(true)
    expect(opensInCurrentTab('shopify', 'pipedream')).toBe(false)
  })

  it('falls back to the current-tab slug set when provider is absent', () => {
    expect(opensInCurrentTab('klaviyo')).toBe(true)
    expect(opensInCurrentTab('slackcliapi')).toBe(false)
    expect(opensInCurrentTab('shopify_app')).toBe(true)
    expect(opensInCurrentTab('shopify')).toBe(false)
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

describe('zapierConnectHref', () => {
  it('encodes AESGCM token bytes so + is not a space', () => {
    const href = zapierConnectHref(
      'https://connect.zapier.com/to/GoogleSheetsV2CLIAPI?token=$AESGCM$abc+def/ghi=',
    )
    expect(href).toContain('token=%24AESGCM%24abc%2Bdef%2Fghi%3D')
    expect(href).not.toContain('+def')
  })

  it('leaves an already-encoded token alone', () => {
    const url = 'https://connect.zapier.com/to/SlackCLIAPI?token=%24AESGCM%24abc%2Bdef'
    expect(zapierConnectHref(url)).toBe(url)
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

describe('connect return', () => {
  it('gives back the page and answer address the card left, once', () => {
    window.history.replaceState(null, '', '/chat?id=abc')
    rememberConnectReturn('metaads', '/chats/abc/questions/q1')
    expect(takeConnectReturn('metaads')).toEqual({ slug: 'metaads', path: '/chat?id=abc', respondUrl: '/chats/abc/questions/q1' })
    expect(takeConnectReturn('metaads')).toBeNull()
  })

  it('is not handed to a different app', () => {
    rememberConnectReturn('metaads', '/chats/abc/questions/q1')
    expect(takeConnectReturn('klaviyo')).toBeNull()
  })
})
