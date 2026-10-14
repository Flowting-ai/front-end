import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { testFile } from '@/lib/library/test-files'

// The row menu needs the app router and chat contexts; the table's own markup is what is under test.
vi.mock('./RowMenu', () => ({ RowMenu: () => <button type="button">menu</button> }))

import { FileRow, FileTable, type FileTableProps } from './FileTable'

const noop = () => {}

function table(overrides: Partial<FileTableProps> = {}) {
  return renderToStaticMarkup(
    <FileTable
      files={[testFile({ id: 'a' }), testFile({ id: 'b' })]}
      kind="all"
      viewerId="u1"
      viewKey="test"
      sort={{ key: 'name', dir: 'asc' }}
      onSort={noop}
      onAction={noop}
      hasNextPage={false}
      isFetchingNextPage={false}
      fetchNextPage={noop}
      {...overrides}
    />,
  )
}

describe('FileTable', () => {
  it('is an ARIA table with a header row and the full row count once everything is loaded', () => {
    const html = table()
    expect(html).toContain('role="table"')
    expect(html).toContain('aria-label="Files"')
    expect(html).toContain('aria-rowcount="3"')
  })

  it('reports an unknown row count while more pages can load', () => {
    expect(table({ hasNextPage: true })).toContain('aria-rowcount="-1"')
  })

  it('marks the active sort on its column and leaves the other sortable column unsorted', () => {
    const html = table({ sort: { key: 'created', dir: 'desc' } })
    expect(html).toMatch(/aria-sort="none"[^>]*>.*?Sort by Name/)
    expect(html).toMatch(/aria-sort="descending"[^>]*>.*?Sort by Created/)
  })

  it('names the date column after the list: Created for All files, Date shared for Shared', () => {
    expect(table()).toContain('Created')
    const shared = table({ kind: 'shared', sort: { key: null, dir: 'desc' } })
    expect(shared).toContain('Date shared')
    expect(shared).not.toContain('>Source<')
  })

  it('shows Source only on All files', () => {
    expect(table()).toContain('>Source<')
  })

  it('marks itself busy while a refetch runs behind the rows', () => {
    const html = table({ isRefreshing: true })
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('data-refreshing="true"')
  })

  it('announces the next page while it loads', () => {
    expect(table({ isFetchingNextPage: true })).toMatch(/role="status"[^>]*>Loading more files</)
    expect(table()).not.toContain('Loading more files')
  })
})

describe('FileRow', () => {
  const row = (file = testFile(), kind: 'all' | 'shared' = 'all') =>
    renderToStaticMarkup(<FileRow file={file} kind={kind} viewerId="u1" rowIndex={2} onAction={noop} />)

  it('links the whole row to the file page and carries its row index', () => {
    const html = row()
    expect(html).toContain('href="/library/files/f1"')
    expect(html).toContain('aria-rowindex="2"')
    expect(html).toContain('Return policy')
  })

  it('marks unread files and says how a file got here', () => {
    expect(row(testFile({ unread: true }))).toContain('data-unread="true"')
    expect(row()).toContain('>Uploaded<')
    expect(row(testFile({ source: 'generated' }))).toContain('>Generated<')
  })

  it('shows a thumbnail when there is one, decorative and lazy', () => {
    const html = row(testFile({ thumbnailUrl: 'https://cdn.example/t.png' }))
    expect(html).toMatch(/<img[^>]*alt=""[^>]*loading="lazy"/)
  })

  it('shows a search snippet under the name', () => {
    expect(row(testFile({ snippet: 'refunds within 30 days' }))).toContain('refunds within 30 days')
  })
})
