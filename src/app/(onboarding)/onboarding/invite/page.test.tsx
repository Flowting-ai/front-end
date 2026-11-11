// @vitest-environment jsdom
//
// Drives the invite step's email box in jsdom: Enter / comma / paste / blur turn addresses into
// chips, bad ones stay in the box with the reason under it, likely typos offer a fix, and Send
// is held back until the box is clean. The network is mocked.

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const api = vi.hoisted(() => ({
  inviteMembers:     vi.fn().mockResolvedValue(undefined),
  updateOnboarding:  vi.fn().mockResolvedValue({ completed: false }),
  listOrganizations: vi.fn().mockResolvedValue([]),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/onboarding/invite' }))
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ user: { orgId: 'org-1' } }) }))
vi.mock('@/lib/api/teams', () => ({ inviteMembers: api.inviteMembers }))
vi.mock('@/lib/api/user', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/api/user')>()), updateOnboarding: api.updateOnboarding }))
vi.mock('@/lib/api/organization', () => ({ listOrganizations: api.listOrganizations }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast'), warning: vi.fn(), info: vi.fn() } }))

import InvitePage from './page'
import { WorkspaceOnboardingProvider } from '@/context/workspace-onboarding-context'

let host: HTMLDivElement
let root: Root

beforeEach(async () => {
  vi.clearAllMocks()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<WorkspaceOnboardingProvider><InvitePage /></WorkspaceOnboardingProvider>) })
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const box = () => host.querySelector<HTMLInputElement>('input[aria-label="Email addresses"]')!
const help = () => host.querySelector('#invite-email-help')!.textContent ?? ''
const chips = () => [...host.querySelectorAll('button[aria-label^="Remove "]')].map(b => b.getAttribute('aria-label')!.slice('Remove '.length))
const button = (name: string | RegExp) => [...host.querySelectorAll('button')].find(b => typeof name === 'string' ? b.textContent === name : name.test(b.textContent ?? ''))!

async function type(value: string) {
  const input = box()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function paste(text: string) {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } })
  await act(async () => { box().dispatchEvent(event) })
}
async function press(key: string) {
  await act(async () => { box().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })) })
}
async function click(el: HTMLElement) {
  await act(async () => { el.click() })
}

describe('invite email box', () => {
  it('turns a typed address into a chip on Enter, and on comma', async () => {
    await type('sam@acme.com')
    await press('Enter')
    await type('lee@acme.com')
    await press(',')
    expect(chips()).toEqual(['sam@acme.com', 'lee@acme.com'])
    expect(box().value).toBe('')
    expect(help()).toContain('Press Enter or comma')
  })

  it('keeps an invalid address in the box with the reason, and clears it on typing', async () => {
    await type('sam@acme')
    await press('Enter')
    expect(chips()).toEqual([])
    expect(box().value).toBe('sam@acme')
    expect(help()).toContain(`"sam@acme" isn't a valid email address`)
    expect(box().getAttribute('aria-invalid')).toBe('true')

    await type('sam@acme.io')
    expect(help()).toContain('Press Enter or comma')
    await press('Enter')
    expect(chips()).toEqual(['sam@acme.io'])
  })

  it('offers a fix for a likely typo: Use it takes the fix, Keep takes it as typed', async () => {
    await type('lee@gmial.com')
    await press('Enter')
    expect(chips()).toEqual([])
    expect(help()).toContain('Did you mean lee@gmail.com?')
    await click(button('Use it'))
    expect(chips()).toEqual(['lee@gmail.com'])

    await type('kim@acme.con')
    await press('Enter')
    await click(button(/^Keep /))
    expect(chips()).toEqual(['lee@gmail.com', 'kim@acme.con'])
    expect(box().value).toBe('')
  })

  it('says when an address is already added, ignoring case', async () => {
    await type('sam@acme.com')
    await press('Enter')
    await type('SAM@acme.com')
    await press('Enter')
    expect(chips()).toEqual(['sam@acme.com'])
    expect(help()).toContain('"SAM@acme.com" is already added')
  })

  it('splits a pasted list, adding the good ones and keeping the bad one in the box', async () => {
    // Line breaks, tabs and semicolons too: a text input would strip the breaks and glue
    // p2@acme.com and bad into one "valid" address if the paste weren't split first.
    await paste('p1@acme.com, p2@acme.com\nbad\tp3@acme.com; p4@acme.com')
    expect(chips()).toEqual(['p1@acme.com', 'p2@acme.com', 'p3@acme.com', 'p4@acme.com'])
    expect(box().value).toBe('bad')
    expect(help()).toContain(`"bad" isn't a valid email address`)
  })

  it('lets a single pasted address land in the box to edit', async () => {
    await paste('solo@acme.com')
    expect(chips()).toEqual([])
  })

  it('removes chips with Backspace on an empty box and with their × button', async () => {
    await paste('a@acme.com, b@acme.com, c@acme.com')
    await press('Backspace')
    expect(chips()).toEqual(['a@acme.com', 'b@acme.com'])
    await click(host.querySelector<HTMLButtonElement>('button[aria-label="Remove a@acme.com"]')!)
    expect(chips()).toEqual(['b@acme.com'])
  })

  it('commits what was typed when the box loses focus', async () => {
    await type('zed@acme.com')
    await act(async () => { box().dispatchEvent(new FocusEvent('focusout', { bubbles: true })) })
    expect(chips()).toEqual(['zed@acme.com'])
  })

  it('sends nothing while the box holds an invalid address or an unanswered typo', async () => {
    await type('ok@acme.com')
    await press('Enter')
    await type('broken@')
    await click(button(/^Send /))
    expect(api.inviteMembers).not.toHaveBeenCalled()
    expect(help()).toContain(`"broken@" isn't a valid email address`)

    await type('lee@gmial.com')
    await click(button(/^Send /))
    expect(api.inviteMembers).not.toHaveBeenCalled()
    expect(help()).toContain('Did you mean')
  })

  it('sends the chips plus a valid address still sitting in the box', async () => {
    await type('a@acme.com')
    await press('Enter')
    await type('b@acme.com')
    await click(button(/^Send /))
    expect(api.inviteMembers).toHaveBeenCalledWith('org-1', ['a@acme.com', 'b@acme.com'])
  })
})
