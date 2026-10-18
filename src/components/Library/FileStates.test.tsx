import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const flags = vi.hoisted(() => ({ LIBRARY_REQUEST_ACCESS_ENABLED: false }))

vi.mock('@/lib/feature-flags', () => flags)
vi.mock('@/lib/library/viewer', () => ({ useLibraryViewer: () => ({ viewerId: 'maya', orgKey: 'org', orgId: 'org', isAdmin: false, ready: true }) }))
vi.mock('@/lib/library/mutations', () => ({
  useRequestAccess: () => ({ mutate: () => {}, isPending: false }),
  useRestoreFile: () => ({ mutate: () => {}, isPending: false }),
  useRetryProcessing: () => ({ mutate: () => {}, isPending: false }),
}))

import { LockedState } from './FileStates'

beforeEach(() => {
  flags.LIBRARY_REQUEST_ACCESS_ENABLED = false
})

describe('LockedState', () => {
  it('says there is no access and names nothing about the file', () => {
    const html = renderToStaticMarkup(<LockedState fileId="f-1" />)
    expect(html).toContain("You don&#x27;t have access")
    expect(html).toContain('Ask the owner to share it')
    expect(html).not.toContain('f-1')
  })

  it('has no Request access button while the backend has no endpoint for it', () => {
    expect(renderToStaticMarkup(<LockedState fileId="f-1" />)).not.toContain('Request access')
  })

  it('shows Request access once it is switched on', () => {
    flags.LIBRARY_REQUEST_ACCESS_ENABLED = true
    expect(renderToStaticMarkup(<LockedState fileId="f-1" />)).toContain('Request access')
  })

  it('shows no button without a file to ask about', () => {
    flags.LIBRARY_REQUEST_ACCESS_ENABLED = true
    expect(renderToStaticMarkup(<LockedState />)).not.toContain('Request access')
  })
})
