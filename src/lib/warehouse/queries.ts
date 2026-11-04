'use client'

import { useQuery } from '@tanstack/react-query'
import { useOrgIdentity } from '@/context/org-context'
import { ApiError } from '@/lib/api/client'
import {
  fetchMetricCatalog, fetchRows, fetchTables, fetchWorkspace, measure,
  type MeasureRequest,
} from '@/lib/api/warehouse'
import { orgScope, queryKeys } from '@/lib/query-keys'

export const ROWS_PER_PAGE = 50

/** A 404 is the workspace not existing yet, which is a state the page shows, not an error to retry. */
function retryUnlessMissing(count: number, error: unknown): boolean {
  return !(error instanceof ApiError && error.status === 404) && count < 2
}

export function useWorkspace() {
  const { orgId, orgIdReady } = useOrgIdentity()
  return useQuery({
    queryKey: queryKeys.warehouse.workspace(orgScope(orgId)),
    queryFn: ({ signal }) => fetchWorkspace(signal),
    enabled: orgIdReady,
    retry: retryUnlessMissing,
    staleTime: 60_000,
  })
}

export function useMetricCatalog(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.warehouse.catalog(),
    queryFn: ({ signal }) => fetchMetricCatalog(signal),
    enabled,
    staleTime: Infinity,
  })
}

export function useMeasurement(request: MeasureRequest, enabled: boolean) {
  const { orgId } = useOrgIdentity()
  return useQuery({
    queryKey: queryKeys.warehouse.measure(orgScope(orgId), request),
    queryFn: ({ signal }) => measure(request, signal),
    enabled,
    staleTime: 60_000,
  })
}

export function useTables(enabled: boolean) {
  const { orgId } = useOrgIdentity()
  return useQuery({
    queryKey: queryKeys.warehouse.tables(orgScope(orgId)),
    queryFn: ({ signal }) => fetchTables(signal),
    enabled,
    staleTime: 60_000,
  })
}

export function useRows(table: string | null, page: number) {
  const { orgId } = useOrgIdentity()
  return useQuery({
    queryKey: queryKeys.warehouse.rows(orgScope(orgId), table ?? '', page),
    queryFn: ({ signal }) => fetchRows(table ?? '', ROWS_PER_PAGE, page * ROWS_PER_PAGE, signal),
    enabled: table !== null,
    placeholderData: previous => previous,
    staleTime: 60_000,
  })
}
