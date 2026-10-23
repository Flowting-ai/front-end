import { describe, expect, it } from 'vitest'
import { argsGenerateImage } from './activity-detail'

describe('argsGenerateImage', () => {
  it('spots image generations in sandbox code', () => {
    expect(argsGenerateImage({ code: 'hero = souvenir.workspace.generation(type="image", name="cover.png")' })).toBe(true)
    expect(argsGenerateImage(JSON.stringify({ code: "g = ws.generation('image', 'a.png')" }))).toBe(true)
    expect(argsGenerateImage('{"code":"ws.generation(type=\\"image\\", name=\\"x.png\\")"}')).toBe(true)
  })
  it('ignores other generations', () => {
    expect(argsGenerateImage({ code: 'ws.generation(type="docx", name="q1.docx")' })).toBe(false)
    expect(argsGenerateImage(undefined)).toBe(false)
  })
})
