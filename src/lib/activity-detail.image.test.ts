import { describe, expect, it } from 'vitest'
import { argsGenerateImage, argsImageHints } from './activity-detail'

describe('argsImageHints', () => {
  it('reads the prompt and aspect ratio from streamed sandbox code', () => {
    const args = JSON.stringify({
      command: "img = ws.generation(type='image', name='a.png')\nimg.prompt('A red fox in snow at sunset', aspect_ratio='16:9').save()",
    })
    expect(argsImageHints(args)).toEqual({ prompt: 'A red fox in snow at sunset', aspect: 16 / 9 })
  })

  it('returns what it can from a half-streamed call', () => {
    expect(argsImageHints('{"command":"img = ws.generation(type=\'image\'')).toEqual({})
  })
})

describe('argsGenerateImage', () => {
  it('spots image generations in sandbox code', () => {
    // The exact shape a live turn streamed (2026-10-18).
    expect(argsGenerateImage(JSON.stringify({
      command: "python - <<'PY'\nimport souvenir\nimg = souvenir.workspace.generation(type='image', name='fox.png')\nPY",
    }))).toBe(true)
    expect(argsGenerateImage({ code: 'ws.generation("image", "a.png")' })).toBe(true)
    expect(argsGenerateImage({ code: 'ws.generation(name="a.png", type="image")' })).toBe(true)
    expect(argsGenerateImage('{"code":"ws.generation(type=\\"image\\", name=\\"x.png\\")"}')).toBe(true)
  })

  it('ignores other generations', () => {
    expect(argsGenerateImage({ code: 'ws.generation(type="docx", name="image.docx")' })).toBe(false)
    expect(argsGenerateImage({ code: 'print("image")' })).toBe(false)
    expect(argsGenerateImage(undefined)).toBe(false)
  })
})
