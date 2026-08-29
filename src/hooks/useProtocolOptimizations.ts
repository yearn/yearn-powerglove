import { useQuery } from '@tanstack/react-query'
import {
  dedupeLatestOptimizations,
  fetchProtocolOptimizations,
  type ProtocolOptimizationItem,
  shapeOptimizerVaults
} from '@/lib/protocol-optimizations'

const STALE_TIME = 15 * 60 * 1000
const SIDEBAR_LIMIT = 60

export interface ProtocolOptimizationsResult {
  /** Vaults ordered by APR delta (most impactful first), capped for the sidebar. */
  vaults: ProtocolOptimizationItem[]
  total: number
  isLoading: boolean
  isError: boolean
  error: Error | null
}

/**
 * Loads the protocol-wide vault optimizations from the reallocation API (global
 * `/api/change` list), shaped and ordered by APR delta for the optimizer panel
 * sidebar. Each item carries its per-strategy current vs proposed allocations
 * so the allocation chart needs no follow-up fetch. Cached 15 min; failures
 * surface via `error` so the panel can degrade gracefully.
 */
export function useProtocolOptimizations(): ProtocolOptimizationsResult {
  const query = useQuery({
    queryKey: ['protocol', 'optimizations'],
    queryFn: async () => {
      const records = await fetchProtocolOptimizations()
      const distinct = dedupeLatestOptimizations(records)
      return {
        vaults: shapeOptimizerVaults(distinct, SIDEBAR_LIMIT),
        total: distinct.length
      }
    },
    staleTime: STALE_TIME
  })

  return {
    vaults: query.data?.vaults ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: (query.error as Error | null) ?? null
  }
}
