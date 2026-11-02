import { mutationOptions, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { deleteCustomApi, unlinkAccount, type ConnectorConnection } from '@/lib/api/connectors'
import { queryKeys } from '@/lib/query-keys'

/**
 * Connector writes. Both are pessimistic on purpose:
 * - Removing an account: the open account panel reads that account from the cache, so taking it out
 *   first would unmount the panel under the confirm, and where the screen goes next (back to the
 *   connector or to the list) depends on which accounts the server says are left.
 * - Deleting a custom API: the connector disappears with it, and its detail query 404s afterwards.
 * Settling refetches only the linked list and that connector's detail.
 */
export function unlinkAccountOptions(qc: QueryClient, unlink: typeof unlinkAccount = unlinkAccount) {
  return mutationOptions({
    mutationKey: [...queryKeys.connectors.all(), 'unlink'],
    mutationFn: (account: Pick<ConnectorConnection, 'id' | 'connectorSlug'>) => unlink(account.id),
    onMutate: async (account) => {
      await qc.cancelQueries({ queryKey: queryKeys.connectors.detail(account.connectorSlug), exact: true })
    },
    // Not awaited: the caller's own refetch of the linked list joins this one.
    onSettled: (_data, _err, account) => {
      void qc.invalidateQueries({ queryKey: queryKeys.connectors.linked(), exact: true })
      void qc.invalidateQueries({ queryKey: queryKeys.connectors.detail(account.connectorSlug), exact: true })
    },
  })
}

export function deleteCustomApiOptions(qc: QueryClient, remove: typeof deleteCustomApi = deleteCustomApi) {
  return mutationOptions({
    mutationKey: [...queryKeys.connectors.all(), 'delete-custom-api'],
    mutationFn: (slug: string) => remove(slug),
    onMutate: async (slug) => {
      await qc.cancelQueries({ queryKey: queryKeys.connectors.detail(slug), exact: true })
    },
    onSuccess: (_data, slug) => {
      qc.removeQueries({ queryKey: queryKeys.connectors.detail(slug), exact: true })
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.connectors.linked(), exact: true })
    },
  })
}

export function useUnlinkAccount() {
  return useMutation(unlinkAccountOptions(useQueryClient()))
}

export function useDeleteCustomApi() {
  return useMutation(deleteCustomApiOptions(useQueryClient()))
}
