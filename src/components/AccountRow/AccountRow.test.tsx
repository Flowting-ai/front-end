import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AccountRow } from './index'

describe('shared account ownership', () => {
  it('keeps details available without offering reconnect for another person’s account', () => {
    const html = renderToStaticMarkup(
      <AccountRow name="Team ClickUp" email="" visibility="shared" addedBy="Ada" canManage={false} state="reconnect-required" />,
    )
    expect(html).toContain('Added by Ada')
    expect(html).toContain('aria-label="Manage Team ClickUp"')
    expect(html).not.toContain('aria-label="Reconnect Team ClickUp"')
    expect(html).toContain('The owner needs to reconnect this account')
  })

  it('offers reconnect to the owner when their account needs authorization', () => {
    const html = renderToStaticMarkup(
      <AccountRow name="Team ClickUp" email="" visibility="shared" canManage state="reconnect-required" />,
    )
    expect(html).toContain('aria-label="Reconnect Team ClickUp"')
    expect(html).not.toContain('aria-label="Manage Team ClickUp"')
  })
})
