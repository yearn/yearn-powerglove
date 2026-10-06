import { useEffect, useState } from 'react'
import type { CanonicalFeeHistory } from './canonical-fees'
import type { ChainFeeHistory } from './chain-fee-history'
import { resolveStatsApiBase } from './hooks'

interface HistoryState {
  key: string
  data: ChainFeeHistory[] | null
  error: boolean
}

export function useChainFeeHistories(query: string, chainIds: number[]) {
  const base = resolveStatsApiBase('fees') ?? ''
  const chains = chainIds.join(',')
  const [attempt, setAttempt] = useState(0)
  const key = `${base}?${query}:${chains}:${attempt}`
  const [state, setState] = useState<HistoryState>({ key: '', data: null, error: false })

  useEffect(() => {
    const controller = new AbortController()
    setState({ key, data: null, error: false })
    const ids = chains ? chains.split(',').map(Number) : []
    const datasetId = new URLSearchParams(query).get('datasetId')
    Promise.all(
      ids.map(async (chainId): Promise<ChainFeeHistory> => {
        const params = new URLSearchParams(query)
        params.set('chainId', String(chainId))
        const response = await fetch(`${base}/api/fees/history?${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Chain history request failed')
        const history: CanonicalFeeHistory = await response.json()
        if (
          !Array.isArray(history.buckets) ||
          history.interval !== (params.get('interval') ?? 'monthly') ||
          (datasetId && history.datasetId !== datasetId)
        ) {
          throw new Error('Chain history does not match the selected dataset')
        }
        return { chainId, history }
      })
    )
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data, error: false })
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ key, data: null, error: true })
      })
    return () => controller.abort()
  }, [base, chains, query, key])

  const current = state.key === key
  return {
    data: current ? state.data : null,
    error: current && state.error,
    loading: !current || (state.data === null && !state.error),
    retry: () => setAttempt((value) => value + 1)
  }
}
