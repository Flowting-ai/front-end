import React from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isApplePlatform, modKeyLabel, useModKeyLabel } from './platform'

function stubNavigator(nav: { platform?: string; userAgentData?: { platform?: string } }) {
  vi.stubGlobal('navigator', nav)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isApplePlatform', () => {
  it.each(['MacIntel', 'iPhone', 'iPad', 'iPod touch'])('is true for navigator.platform %s', (platform) => {
    stubNavigator({ platform })
    expect(isApplePlatform()).toBe(true)
  })

  it.each(['Win32', 'Linux x86_64', 'Linux armv81', ''])('is false for navigator.platform %j', (platform) => {
    stubNavigator({ platform })
    expect(isApplePlatform()).toBe(false)
  })

  it('prefers userAgentData.platform over navigator.platform', () => {
    stubNavigator({ platform: 'MacIntel', userAgentData: { platform: 'Windows' } })
    expect(isApplePlatform()).toBe(false)
    stubNavigator({ platform: 'Win32', userAgentData: { platform: 'macOS' } })
    expect(isApplePlatform()).toBe(true)
  })

  it('falls back to navigator.platform when userAgentData.platform is empty', () => {
    stubNavigator({ platform: 'MacIntel', userAgentData: { platform: '' } })
    expect(isApplePlatform()).toBe(true)
  })

  it('does not match Chromium OS', () => {
    stubNavigator({ platform: 'Linux x86_64', userAgentData: { platform: 'Chromium OS' } })
    expect(isApplePlatform()).toBe(false)
  })

  it('is false without a navigator (server)', () => {
    vi.stubGlobal('navigator', undefined)
    expect(isApplePlatform()).toBe(false)
  })
})

describe('modKeyLabel', () => {
  it('is ⌘ on Apple platforms and Ctrl elsewhere', () => {
    stubNavigator({ platform: 'MacIntel' })
    expect(modKeyLabel()).toBe('⌘')
    stubNavigator({ platform: 'Win32' })
    expect(modKeyLabel()).toBe('Ctrl')
  })
})

describe('useModKeyLabel', () => {
  it('renders the server snapshot on the server regardless of platform', () => {
    stubNavigator({ platform: 'Win32' })
    function Label() {
      return React.createElement('span', null, useModKeyLabel())
    }
    expect(renderToString(React.createElement(Label))).toBe('<span>⌘</span>')
  })
})
