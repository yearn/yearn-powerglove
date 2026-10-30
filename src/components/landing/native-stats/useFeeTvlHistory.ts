import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { FeeHistoryPoint } from './fee-history'
import { feeHistoryBoundary } from './fee-history'
import type { DailyFeeTvlHistory } from './fee-yield'
import { resolveStatsApiBase, useFetch } from './hooks'
import type { TvlSummary } from './types'

export function useFeeTvlHistory(periods: FeeHistoryPoint[]) {
  const summary = useFetch<TvlSummary>('/api/tvl')
  const base = resolveStatsApiBase('tvl') ?? ''
  const datasetId = summary.data?.datasetId
  const from = periods.length ? Date.parse(feeHistoryBoundary(periods[0], 'start')) / 1000 : 0
  const to = periods.length ? Date.parse(feeHistoryBoundary(periods[periods.length - 1], 'end')) / 1000 - 1 : 0
  const client = useQueryClient()
  // A loaded larger window serves shorter selections and every chain locally.
  const cached = client
    .getQueriesData<DailyFeeTvlHistory>({ queryKey: ['fee-yield-daily-tvl', base, datasetId] })
    .find(
      ([key, data]) =>
        data?.datasetId === datasetId &&
        typeof key[3] === 'number' &&
        key[3] <= from &&
        typeof key[4] === 'number' &&
        key[4] >= to
    )
  const scopeFrom = cached ? Number(cached[0][3]) : from
  const scopeTo = cached ? Number(cached[0][4]) : to
  const enabled = !!datasetId && periods.length > 0
  const history = useQuery({
    queryKey: ['fee-yield-daily-tvl', base, datasetId, scopeFrom, scopeTo],
    enabled,
    staleTime: Infinity,
    retry: false,
    queryFn: async ({ signal }): Promise<DailyFeeTvlHistory> => {
      const filters = new URLSearchParams({
        groupBy: 'chain',
        mode: 'external',
        interval: 'daily',
        format: 'chart',
        from: String(scopeFrom),
        to: String(scopeTo),
        datasetId: datasetId ?? ''
      })
      const response = await fetch(`${base}/api/tvl/history/runs/latest?${filters}`, { signal })
      if (!response.ok) throw new Error('Daily TVL could not be loaded')
      const data: DailyFeeTvlHistory = await response.json()
      if (data.datasetId !== datasetId || data.interval !== 'daily' || !Array.isArray(data.chart))
        throw new Error('Daily TVL does not match the selected publication')
      return data
    }
  })
  return {
    data: history.data,
    loading: summary.loading || (enabled && history.isPending),
    error: summary.error || history.error,
    retry: () => {
      summary.retry()
      if (enabled) void history.refetch()
    }
  }
}
