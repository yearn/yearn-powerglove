import { useQuery } from '@tanstack/react-query'
import { type ChainTvlSeries, fetchProtocolTvlByChain } from '@/lib/protocol-tvl'

/**
 * Loads Yearn's historical per-chain TVL series from DefiLlama. Cached for 15
 * minutes; failures are surfaced via the returned `error` so the overview can
 * render the in-memory current snapshot instead of blocking.
 */
export function useProtocolTvl(): {
  series: ChainTvlSeries[]
  isLoading: boolean
  isError: boolean
  error: Error | null
} {
  const query = useQuery<ChainTvlSeries[]>({
    queryKey: ['protocol', 'tvl', 'defillama', 'yearn-finance'],
    queryFn: fetchProtocolTvlByChain,
    staleTime: 15 * 60 * 1000
  })

  return {
    series: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: (query.error as Error | null) ?? null
  }
}
