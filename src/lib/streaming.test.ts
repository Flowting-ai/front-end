import { describe, expect, it } from 'vitest'
import { mergeStreamingText } from '@/lib/streaming'

describe('mergeStreamingText', () => {
  it('appends a delta that repeats the text so far', () => {
    expect(mergeStreamingText('ha', 'ha')).toBe('haha')
  })

  it('appends a delta that starts with the text so far', () => {
    expect(mergeStreamingText('a', 'ab')).toBe('aab')
  })

  it('keeps repeated newlines', () => {
    expect(mergeStreamingText(mergeStreamingText('Line\n', '\n'), '\n')).toBe('Line\n\n\n')
  })

  it('treats a missing side as empty', () => {
    expect(mergeStreamingText(undefined, 'first')).toBe('first')
    expect(mergeStreamingText('kept', null)).toBe('kept')
    expect(mergeStreamingText(null, undefined)).toBe('')
  })
})
