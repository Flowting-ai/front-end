import { describe, expect, it } from 'vitest'

import { connectorToolBooleans, connectorToolPermission } from './connectors'


describe('connectorToolPermission', () => {
  it('preserves the backend boolean truth table', () => {
    expect(connectorToolPermission({ allowed: true, blocked: false })).toBe('allowed')
    expect(connectorToolPermission({ allowed: false, blocked: true })).toBe('blocked')
    expect(connectorToolPermission({ allowed: false, blocked: false })).toBe('ask')
  })

  it('keeps blocked as the winning state', () => {
    expect(connectorToolPermission({ allowed: true, blocked: true, permission: 'allowed' })).toBe('blocked')
  })

  it('uses the response projection for a legacy shape without booleans', () => {
    expect(connectorToolPermission({ permission: 'allowed' })).toBe('allowed')
  })

  it('maps editable states back to the binary API shape', () => {
    expect(connectorToolBooleans('allowed')).toEqual({ allowed: true, blocked: false })
    expect(connectorToolBooleans('ask')).toEqual({ allowed: false, blocked: false })
    expect(connectorToolBooleans('blocked')).toEqual({ allowed: false, blocked: true })
  })
})
