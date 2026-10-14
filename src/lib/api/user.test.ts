import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))

vi.mock('./client', async importOriginal => {
  const actual = await importOriginal<typeof import('./client')>()
  return { ...actual, apiFetch }
})

import { saveTone, saveUser } from './user'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('Settings saves report failure', () => {
  beforeEach(() => {
    apiFetch.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('saveUser resolves the saved profile', async () => {
    apiFetch.mockResolvedValue(json({ data: { first_name: 'Ada', last_name: 'L' } }))
    await expect(saveUser({ first_name: 'Ada' })).resolves.toMatchObject({ first_name: 'Ada' })
  })

  it('saveUser rejects on a failed PATCH instead of resolving null', async () => {
    apiFetch.mockResolvedValue(json({ detail: 'nope' }, 500))
    await expect(saveUser({ first_name: 'Ada' })).rejects.toThrow('Profile was not saved')
  })

  it('saveTone rejects on a failed PATCH', async () => {
    apiFetch.mockResolvedValue(json({ detail: 'bad' }, 422))
    await expect(saveTone('Warm')).rejects.toThrow('Style was not saved')
  })

  it('saveTone resolves when the backend accepts it', async () => {
    apiFetch.mockResolvedValue(json({ completed: true, ai_tone: 'warm' }))
    await expect(saveTone('Warm')).resolves.toBeUndefined()
  })
})
