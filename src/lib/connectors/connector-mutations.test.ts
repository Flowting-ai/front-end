import { describe, expect, it, vi } from 'vitest'
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { deleteCustomApiOptions, unlinkAccountOptions } from './connector-mutations'

const client = () => new QueryClient({ defaultOptions: { mutations: { retry: false } } })

describe('unlinkAccountOptions (pessimistic)', () => {
  it('calls the API, then invalidates only the linked list and that connector', async () => {
    const qc = client()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const unlink = vi.fn().mockResolvedValue(undefined)
    await new MutationObserver(qc, unlinkAccountOptions(qc, unlink)).mutate({ id: 'x', connectorSlug: 'gmail' })
    expect(unlink).toHaveBeenCalledWith('x')
    expect(spy.mock.calls.map(c => c[0]?.queryKey)).toEqual([queryKeys.connectors.linked(), queryKeys.connectors.detail('gmail')])
  })

  it('leaves the cached account untouched on error', async () => {
    const qc = client()
    const detail = { slug: 'gmail', connections: [{ id: 'x' }] }
    qc.setQueryData(queryKeys.connectors.detail('gmail'), detail)
    const unlink = vi.fn().mockRejectedValue(new Error('no'))
    await expect(new MutationObserver(qc, unlinkAccountOptions(qc, unlink)).mutate({ id: 'x', connectorSlug: 'gmail' })).rejects.toThrow('no')
    expect(qc.getQueryData(queryKeys.connectors.detail('gmail'))).toBe(detail)
  })
})

describe('deleteCustomApiOptions (pessimistic)', () => {
  it('drops the detail query on success only', async () => {
    const qc = client()
    qc.setQueryData(queryKeys.connectors.detail('api'), { slug: 'api' })
    await expect(new MutationObserver(qc, deleteCustomApiOptions(qc, vi.fn().mockRejectedValue(new Error('x')))).mutate('api')).rejects.toThrow('x')
    expect(qc.getQueryData(queryKeys.connectors.detail('api'))).toBeDefined()
    await new MutationObserver(qc, deleteCustomApiOptions(qc, vi.fn().mockResolvedValue(undefined))).mutate('api')
    expect(qc.getQueryData(queryKeys.connectors.detail('api'))).toBeUndefined()
  })
})
