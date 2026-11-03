// @vitest-environment jsdom

// The shared Button / IconButton (shadcnspace button set): every variant and size renders and
// clicks, loading and send states disable it, and the effect props add their classes.

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Button, IconButton, type ButtonSize, type ButtonVariant, type IconButtonVariant } from '@/components/ui/button'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function render(node: React.ReactNode) {
  await act(async () => root.render(node))
  return container.querySelector('button') as HTMLButtonElement
}

const VARIANTS: ButtonVariant[] = ['default', 'ghost', 'outline', 'secondary', 'danger', 'save', 'cancel', 'approve', 'reject', 'link']
const SIZES: ButtonSize[] = ['xs', 'sm', 'md', 'lg']

describe('Button', () => {
  it.each(VARIANTS)('%s renders and clicks', async variant => {
    const onClick = vi.fn()
    const button = await render(<Button variant={variant} onClick={onClick}>Go</Button>)
    expect(button.textContent).toContain('Go')
    await act(async () => button.click())
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it.each(SIZES)('size %s sets its height class', async size => {
    const button = await render(<Button size={size}>Go</Button>)
    const minH = { xs: 'min-h-6', sm: 'min-h-8', md: 'min-h-9', lg: 'min-h-10' }[size]
    expect(button.className).toContain(minH)
  })

  it('cancel, approve and reject bring their own icon; save is the plain dark button', async () => {
    for (const variant of ['cancel', 'approve', 'reject'] as const) {
      const button = await render(<Button variant={variant}>Go</Button>)
      expect(button.querySelector('svg'), variant).not.toBeNull()
    }
    const save = await render(<Button variant="save">Save</Button>)
    expect(save.querySelector('svg')).toBeNull()
    expect(save.className).toContain('bg-[var(--button-default-bg-to)]')
  })

  it('loading keeps the label, shows the loader and blocks clicks', async () => {
    const onClick = vi.fn()
    const button = await render(<Button loading onClick={onClick}>Saving…</Button>)
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.textContent).toContain('Saving…')
    expect(button.querySelector('svg')).not.toBeNull()
    await act(async () => button.click())
    expect(onClick).not.toHaveBeenCalled()
  })

  it('sendState walks idle → loading → success', async () => {
    const onClick = vi.fn()
    let button = await render(<Button sendState="idle" onClick={onClick}>Send</Button>)
    expect(button.disabled).toBe(false)
    expect(button.textContent).toContain('Send')
    await act(async () => button.click())
    expect(onClick).toHaveBeenCalledTimes(1)

    button = await render(<Button sendState="loading" loadingLabel="Sending…">Send</Button>)
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')

    button = await render(<Button sendState="success" successLabel="Sent">Send</Button>)
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('data-send-state')).toBe('success')
  })

  it('attention and shine add their effect classes; attention sets the pulse colour', async () => {
    let button = await render(<Button variant="approve" attention>Approve</Button>)
    expect(button.className).toContain('kaya-btn-heartbeat')
    expect(button.style.getPropertyValue('--heartbeat-color')).toBe('var(--button-save-bg)')
    button = await render(<Button shine>Upgrade</Button>)
    expect(button.className).toContain('kaya-btn-shine')
  })

  it('keeps caller styles next to the pulse colour', async () => {
    const button = await render(<Button attention style={{ flexShrink: 0 }}>Go</Button>)
    expect(button.style.flexShrink).toBe('0')
    expect(button.style.getPropertyValue('--heartbeat-color')).not.toBe('')
  })

  it('does not fire when disabled', async () => {
    const onClick = vi.fn()
    const button = await render(<Button disabled onClick={onClick}>Go</Button>)
    await act(async () => button.click())
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('IconButton', () => {
  const ICON_VARIANTS: IconButtonVariant[] = ['default', 'ghost', 'ghost-2', 'outline', 'secondary']

  it.each(ICON_VARIANTS)('%s renders and clicks', async variant => {
    const onClick = vi.fn()
    const button = await render(<IconButton variant={variant} aria-label="Act" onClick={onClick} />)
    expect(button.getAttribute('aria-label')).toBe('Act')
    await act(async () => button.click())
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('shiny adds the sweeping highlight', async () => {
    const button = await render(<IconButton aria-label="Send" shiny />)
    expect(button.className).toContain('kaya-btn-shiny')
  })

  it('loading disables it', async () => {
    const button = await render(<IconButton aria-label="Send" loading />)
    expect(button.disabled).toBe(true)
  })
})
