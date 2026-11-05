'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOrgIdentity } from '@/context/org-context'
import { ApiError } from '@/lib/api/client'
import {
  deleteMetric, draftMetric, fetchMetricCatalog, fetchWorkspace, measure, putMetric,
  type CustomMetric, type MeasureRequest, type MetricChatMessage,
} from '@/lib/api/warehouse'
import { orgScope, queryKeys } from '@/lib/query-keys'
import { syncOf } from './present'

const BUILDING_POLL_MS = 5_000

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
    // A first sync is minutes; the page watches for it to land instead of asking for a reload.
    refetchInterval: query => (query.state.data && syncOf(query.state.data).state === 'building' ? BUILDING_POLL_MS : false),
  })
}

export function useMetricCatalog(enabled: boolean) {
  const { orgId } = useOrgIdentity()
  return useQuery({
    queryKey: queryKeys.warehouse.catalog(orgScope(orgId)),
    queryFn: ({ signal }) => fetchMetricCatalog(signal),
    enabled,
    staleTime: 60_000,
  })
}

/** Adding or removing a metric changes the catalog and every measurement, so the whole warehouse scope refetches. */
function useWarehouseMutation<Input>(run: (input: Input) => Promise<unknown>) {
  const { orgId } = useOrgIdentity()
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.warehouse.all(orgScope(orgId)) }),
  })
}

export function usePutMetric() {
  return useWarehouseMutation((metric: CustomMetric) => putMetric(metric))
}

export function useDeleteMetric() {
  return useWarehouseMutation((name: string) => deleteMetric(name))
}

/** One turn of the metric conversation; nothing is saved until the proposal is put. */
export function useDraftMetric() {
  return useMutation({ mutationFn: (messages: MetricChatMessage[]) => draftMetric(messages) })
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
