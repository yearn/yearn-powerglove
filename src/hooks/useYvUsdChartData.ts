import { useMemo } from 'react'
import { YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS } from '@/constants/featuredVaults'
import { useRestTimeseries } from '@/hooks/useRestTimeseries'
import {
  buildApyDataFromPpsSeries,
  buildUnderlyingLockedPpsSeries,
  mergeYvUsdApySeries,
  mergeYvUsdPpsSeries,
  mergeYvUsdTvlSeries,
  transformPpsTimeseries,
  transformTvlTimeseries
} from '@/lib/yvusd-chart-data'
import type { aprApyChartData, ppsChartData, tvlChartData, yvUsdChartData } from '@/types/dataTypes'

interface UseYvUsdChartDataProps {
  enabled: boolean
  unlockedAprApyData: aprApyChartData | null
  unlockedTvlData: tvlChartData | null
  unlockedPpsData: ppsChartData | null
}

interface UseYvUsdChartDataReturn {
  yvUsdChartData: {
    aprApyData: yvUsdChartData
    lockedAprApyData: aprApyChartData
    ppsData: yvUsdChartData
    tvlData: yvUsdChartData
  } | null
  isLoading: boolean
  hasErrors: boolean
}

export function useYvUsdChartData({
  enabled,
  unlockedAprApyData,
  unlockedTvlData,
  unlockedPpsData
}: UseYvUsdChartDataProps): UseYvUsdChartDataReturn {
  const {
    data: lockedTvlData,
    isLoading: lockedTvlLoading,
    error: lockedTvlError
  } = useRestTimeseries({
    segment: 'tvl',
    chainId: YVUSD_CHAIN_ID,
    address: YVUSD_LOCKED_ADDRESS,
    enabled
  })

  const {
    data: lockedPpsData,
    isLoading: lockedPpsLoading,
    error: lockedPpsError
  } = useRestTimeseries({
    segment: 'pps',
    chainId: YVUSD_CHAIN_ID,
    address: YVUSD_LOCKED_ADDRESS,
    components: ['humanized'],
    enabled
  })

  return useMemo(() => {
    if (!enabled) {
      return {
        yvUsdChartData: null,
        isLoading: false,
        hasErrors: false
      }
    }

    const isLoading = lockedTvlLoading || lockedPpsLoading
    const hasErrors = Boolean(lockedTvlError || lockedPpsError)

    if (isLoading || hasErrors || !lockedTvlData || !lockedPpsData) {
      return {
        yvUsdChartData: null,
        isLoading,
        hasErrors
      }
    }

    const lockedPpsSeries = transformPpsTimeseries(lockedPpsData.timeseries)
    const lockedUnderlyingPpsSeries = buildUnderlyingLockedPpsSeries(unlockedPpsData, lockedPpsSeries)
    const lockedApySeries = buildApyDataFromPpsSeries(lockedUnderlyingPpsSeries)
    const lockedTvlSeries = transformTvlTimeseries(lockedTvlData.timeseries)

    return {
      yvUsdChartData: {
        aprApyData: mergeYvUsdApySeries(unlockedAprApyData, lockedApySeries),
        lockedAprApyData: lockedApySeries,
        ppsData: mergeYvUsdPpsSeries(unlockedPpsData, lockedUnderlyingPpsSeries),
        tvlData: mergeYvUsdTvlSeries(unlockedTvlData, lockedTvlSeries)
      },
      isLoading,
      hasErrors
    }
  }, [
    enabled,
    lockedTvlLoading,
    lockedPpsLoading,
    lockedTvlError,
    lockedPpsError,
    lockedTvlData,
    lockedPpsData,
    unlockedAprApyData,
    unlockedTvlData,
    unlockedPpsData
  ])
}
