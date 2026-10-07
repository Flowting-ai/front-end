// @vitest-environment jsdom
//
// Code blocks highlight synchronously once highlight.js (and the block's
// grammar) are loaded, load lazy grammars on demand, and accept spellings
// like `c++` / `objective-c`.

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ensureHighlighter } from '@/lib/highlight-loader'
import { CodeBlock } from './CodeBlock'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const keyword = () => container.querySelector('code.hljs .hljs-keyword')?.textContent

describe('CodeBlock highlighting', () => {
  it('highlights on the first render when hljs and the grammar are already loaded', async () => {
    await ensureHighlighter('sql')
    // A synchronous act: an effect + promise based highlighter could not have
    // produced highlighted markup by the time it returns.
    act(() => root.render(<CodeBlock language="sql" value="SELECT id FROM users" elementKey="k" />))

    expect(keyword()).toBe('SELECT')
  })

  it('loads a lazy grammar and re-highlights when it arrives', async () => {
    await ensureHighlighter()
    act(() => root.render(<CodeBlock language="go" value={'func main() {}'} elementKey="k" />))
    expect(container.querySelector('code')?.textContent).toBe('func main() {}')

    await act(async () => { await ensureHighlighter('go') })
    expect(keyword()).toBe('func')
  })

  it('accepts c++ and objective-c fence names', async () => {
    await ensureHighlighter('c++')
    act(() => root.render(<CodeBlock language="c++" value="int main() { return 0; }" elementKey="k" />))
    expect(container.textContent).toContain('c++')
    expect(container.querySelector('code.hljs .hljs-type, code.hljs .hljs-keyword')).not.toBeNull()

    await ensureHighlighter('objective-c')
    const hljs = (await import('@/lib/highlight')).default
    expect(hljs.getLanguage('c++')?.name).toBe(hljs.getLanguage('cpp')?.name)
    expect(hljs.getLanguage('objective-c')?.name).toBe('Objective-C')
    act(() => root.render(<CodeBlock language="objective-c" value={'@interface Foo : NSObject\n@end'} elementKey="k" />))
    expect(container.querySelector('code.hljs [class^="hljs-"]')).not.toBeNull()
  })

  it('auto-detects a block without a language and keeps copying the raw value', async () => {
    await ensureHighlighter()
    act(() => root.render(<CodeBlock value={'def greet(name):\n    return f"hi {name}"\n'} elementKey="k" />))

    expect(container.querySelector('code.hljs')).not.toBeNull()
    expect(container.querySelector('code')?.textContent).toBe('def greet(name):\n    return f"hi {name}"')
  })
})
