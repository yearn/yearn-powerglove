// src/hooks/useRestTimeseries.ts
import { useQuery } from '@tanstack/react-query'
import { fetchTimeseries } from '@/lib/timeseries-api'
import { TimeseriesDataPoint } from '@/types/dataTypes'

interface UseRestTimeseriesProps {
  segment: string
  chainId: number
  address: string
  components?: string[]
  enabled?: boolean
}

interface UseRestTimeseriesReturn {
  data: { timeseries: TimeseriesDataPoint[] } | undefined
  isLoading: boolean
  error: Error | null
}

/**
 * Hook to fetch timeseries data from the REST API
 * Returns data in the same shape as the Apollo useQuery hook for compatibility
 */
export function useRestTimeseries({
  segment,
  chainId,
  address,
  components,
  enabled = true,
}: UseRestTimeseriesProps): UseRestTimeseriesReturn {
  const { data, isLoading, error } = useQuery({
    queryKey: ['timeseries', segment, chainId, address, components],
    queryFn: () => fetchTimeseries(segment, chainId, address, components),
    enabled,
    staleTime: 1000 * 60 * 15, // 15 minutes
  })

  return {
    data: data ? { timeseries: data } : undefined,
    isLoading,
    error: error as Error | null,
  }
}
