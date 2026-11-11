// @vitest-environment jsdom
//
// ChatMessage's own markup (attachment chips, generated images and files,
// the error notice, the action bar…) pinned as snapshots, and the memo
// comparator: same props don't re-render a message, changed content does.
// Child components that live in other files are stubbed so the snapshots
// only cover what ChatMessage renders itself.

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UIMessage } from '@/types/chat'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const counts = vi.hoisted(() => ({ content: 0, bubble: 0 }))
vi.mock('@/lib/content-renderer', () => ({
  ContentRenderer: ({ content }: { content: string }) => {
    counts.content++
    return <div data-testid="text">{content}</div>
  },
}))
vi.mock('@/components/MessageBubble', () => ({
  MessageBubble: ({ content, hideActions }: { content: string; hideActions?: boolean }) => {
    counts.bubble++
    return <div data-testid="bubble" data-hide-actions={String(Boolean(hideActions))}>{content}</div>
  },
}))
vi.mock('./ReasoningBlock', () => ({
  ReasoningBlock: () => <div data-testid="reasoning" />,
  ModelLogo: () => <span data-testid="model-logo" />,
  AnimatedLogo: () => <span data-testid="animated-logo" />,
}))
vi.mock('./ResponseBlocks', () => ({ BlockSequenceRenderer: () => <div data-testid="blocks" /> }))
vi.mock('./CitationChip', () => ({ SourceList: () => <div data-testid="sources" /> }))
vi.mock('./ActivityRow', () => ({ ActivitiesSection: () => <div data-testid="activities" /> }))
vi.mock('./ImageGenerationPreview', () => ({
  ImageGenerationPreview: () => <div data-testid="image-preview" />,
  findPendingImageGeneration: () => undefined,
}))
vi.mock('@/components/Library/chat/SentLibraryAttachment', () => ({
  SentLibraryAttachment: ({ children }: { children: React.ReactNode }) => <div data-testid="library-attachment">{children}</div>,
}))
vi.mock('@/components/Tooltip', () => ({ Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('@/components/SelectionPopover', () => ({ SelectionPopover: () => null }))
vi.mock('@/context/pinboard-context', () => ({
  usePinboardActions: () => ({ addPin: vi.fn(), removePinByMessage: vi.fn(), open: vi.fn(), close: vi.fn() }),
}))
vi.mock('@/context/highlight-context', () => ({
  useHighlight: () => ({ addHighlight: vi.fn(), open: vi.fn(), close: vi.fn(), highlights: [] }),
}))
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => { const { unoptimized, ...rest } = props; void unoptimized; return <img {...rest} /> },
}))
vi.mock('@/lib/analytics/events', () => ({ trackFeature: vi.fn(), trackBrowserEvent: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { ChatMessage, ChatMessageMemo } from './ChatMessage'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  counts.content = 0
  counts.bubble = 0
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

const base = { id: 'm1', content: '', created_at: '2026-01-01T00:00:00Z' }
const user = (extra: Partial<UIMessage>) => ({ ...base, role: 'user', ...extra }) as UIMessage
const assistant = (extra: Partial<UIMessage>) => ({ ...base, role: 'assistant', model: 'gpt-4o', ...extra }) as UIMessage

const html = () => container.innerHTML

describe('ChatMessage markup', () => {
  it.each([
    ['user with attachments', user({
      content: 'see files',
      attachments: [
        { id: 'a1', file_name: 'pic.png', file_type: 'image/png', url: 'https://x/pic.png' },
        { id: 'a2', file_name: 'doc.txt', file_type: 'text/plain', uploading: true, uploadProgress: 40 },
        { id: 'a3', file_name: 'up.pdf', file_type: 'application/pdf', uploading: true },
        { id: 'a4', file_name: 'lib.md', file_type: 'text/markdown', url: 'https://x/lib.md', libraryFileId: 'f1' },
      ],
    } as Partial<UIMessage>)],
    ['assistant answer', assistant({ content: 'Hello **there**' })],
    ['assistant images and files', assistant({
      content: 'Here you go',
      images: [{ url: 'https://x/img.png', s3Key: 'a/b/img.png' }],
      generatedFiles: [
        { url: 'https://x/r.pdf', filename: 'r.pdf', mimeType: 'application/pdf' },
        { url: 'https://x/s.xlsx', filename: 's.xlsx' },
        { url: 'https://x/n', filename: 'notes.md', mimeType: 'text/markdown' },
      ],
    } as Partial<UIMessage>)],
    ['assistant stopped with error notice', assistant({ content: 'Half', stoppedByUser: true, errorNotice: 'Rate limit exceeded' })],
    ['assistant error', assistant({ content: 'Failed', isError: true })],
    ['assistant activities', assistant({ content: 'Done', activities: [{ id: 'x', status: 'done' }] } as Partial<UIMessage>)],
    ['assistant loading', { ...base, role: 'assistant', isLoading: true } as UIMessage],
  ])('%s', (_name, message) => {
    act(() => root.render(<ChatMessage message={message} isLast onRegenerate={() => {}} onRetry={() => {}} />))
    expect(html()).toMatchSnapshot()
  })

  it('archived hides the action bar', () => {
    act(() => root.render(<ChatMessage message={assistant({ content: 'x', errorNotice: 'oops' })} isLast archived onRegenerate={() => {}} />))
    expect(container.querySelector('[aria-label="Copy"]')).toBeNull()
    expect(container.querySelector('[aria-label="Regenerate"]')).toBeNull()
    expect(container.querySelector('button')?.textContent).not.toBe('Retry')
  })
})

describe('ChatMessageMemo comparator', () => {
  it('skips a re-render for the same props and re-renders on changed content', () => {
    const message = assistant({ content: 'first' })
    const onRegenerate = () => {}
    act(() => root.render(<ChatMessageMemo message={message} isLast onRegenerate={onRegenerate} />))
    const after1 = counts.content
    // New callback identities but same message and flags: no re-render.
    act(() => root.render(<ChatMessageMemo message={message} isLast onRegenerate={() => {}} onFollowUp={() => {}} />))
    expect(counts.content).toBe(after1)
    act(() => root.render(<ChatMessageMemo message={{ ...message, content: 'second' }} isLast onRegenerate={onRegenerate} />))
    expect(counts.content).toBeGreaterThan(after1)
    expect(container.textContent).toContain('second')
  })

  it('re-renders when a compared flag flips', () => {
    const message = user({ content: 'hi' })
    act(() => root.render(<ChatMessageMemo message={message} isLast={false} />))
    const n = counts.bubble
    act(() => root.render(<ChatMessageMemo message={message} isLast={false} />))
    expect(counts.bubble).toBe(n)
    act(() => root.render(<ChatMessageMemo message={message} isLast={false} archived />))
    expect(counts.bubble).toBe(n + 1)
    act(() => root.render(<ChatMessageMemo message={message} isLast={false} archived onRegenerate={() => {}} />))
    expect(counts.bubble).toBe(n + 2)
  })
})
