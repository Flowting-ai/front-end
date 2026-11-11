import { describe, expect, it } from 'vitest'
import { messageCopyText } from './copy-text'

describe('messageCopyText', () => {
  it('drops web-citation markers but keeps them inside code', () => {
    expect(messageCopyText('Revenue grew 12% [1] last year {2}.\n\n```py\nxs[1] = {2}\n```\nUse `a[1]`.'))
      .toBe('Revenue grew 12% last year.\n\n```py\nxs[1] = {2}\n```\nUse `a[1]`.')
  })

  it('turns a widget block into readable lines', () => {
    const text = messageCopyText('Here are the numbers:\n<metrics><metric label="Revenue" value="$4.2M" trend="up"/><metric label="Churn" value="2.1%"/></metrics>\nThat is all.')
    expect(text).toBe('Here are the numbers:\n\nRevenue: $4.2M\nChurn: 2.1%\n\nThat is all.')
    expect(text).not.toContain('<')
  })

  it('copies a table row by row', () => {
    expect(messageCopyText('<table><tr><th>Plan</th><th>Price</th></tr><tr><td>Core</td><td>$125</td></tr></table>'))
      .toBe('Plan | Price\nCore | $125')
  })

  it('leaves plain text alone', () => {
    expect(messageCopyText('Just an answer, see a[2] in the formula.')).toBe('Just an answer, see a[2] in the formula.')
  })
})
