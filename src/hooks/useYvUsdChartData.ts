import { useQuery } from '@apollo/client'
import { useMemo } from 'react'
import { YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@/constants/featuredVaults'
import { GET_VAULT_TIMESERIES } from '@/graphql/queries/timeseries'
import { useRestTimeseries } from '@/hooks/useRestTimeseries'
import {
  applyYvUsdEstimatedApySeries,
  applyYvUsdLockedOracleAprSeries,
  buildApyDataFromPpsSeries,
  buildUnderlyingLockedPpsSeries,
  mergeYvUsdPpsSeries,
  mergeYvUsdTvlSeries,
  transformPpsTimeseries,
  transformTvlTimeseries
} from '@/lib/yvusd-chart-data'
import type {
  aprApyChartData,
  ppsChartData,
  TimeseriesDataPoint,
  tvlChartData,
  yvUsdChartData
} from '@/types/dataTypes'

const ESTIMATED_APY_LABEL = 'yvusd-estimated-apr'
const LOCKED_ESTIMATED_APY_LABEL = 'locked-yvusd-estimated-apr'
const ESTIMATED_APY_COMPONENT = 'netAPY'
const TIMESERIES_LIMIT = 10_000

type TimeseriesQueryData = {
  timeseries: TimeseriesDataPoint[]
}

const useEstimatedApyTimeseries = (address: string, label: string, enabled: boolean) =>
  useQuery<TimeseriesQueryData>(GET_VAULT_TIMESERIES, {
    variables: {
      chainId: YVUSD_CHAIN_ID,
      address,
      label,
      component: ESTIMATED_APY_COMPONENT,
      limit: TIMESERIES_LIMIT
    },
    skip: !enabled
  })

interface UseYvUsdChartDataProps {
  enabled: boolean
  unlockedAprApyData: aprApyChartData | null
  unlockedTvlData: tvlChartData | null
  unlockedPpsData: ppsChartData | null
}

interface UseYvUsdChartDataReturn {
  yvUsdChartData: {
    unlockedAprApyData: aprApyChartData
    lockedAprApyData: aprApyChartData
    lockedPpsData: ppsChartData
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
  const { data: unlockedEstimatedApyData } = useEstimatedApyTimeseries(
    YVUSD_UNLOCKED_ADDRESS,
    ESTIMATED_APY_LABEL,
    enabled
  )

  const { data: lockedEstimatedApyData } = useEstimatedApyTimeseries(
    YVUSD_LOCKED_ADDRESS,
    LOCKED_ESTIMATED_APY_LABEL,
    enabled
  )

  // Kong currently stores the locked-address rows under the shared yvUSD label.
  // Prefer the dedicated label when it starts emitting, but retain the populated
  // address-scoped series in the meantime.
  const { data: lockedEstimatedApyFallbackData } = useEstimatedApyTimeseries(
    YVUSD_LOCKED_ADDRESS,
    ESTIMATED_APY_LABEL,
    enabled
  )

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

  const { data: lockedOracleAprData } = useRestTimeseries({
    segment: 'apr-oracle',
    chainId: YVUSD_CHAIN_ID,
    address: YVUSD_LOCKED_ADDRESS,
    components: ['apr'],
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
    const lockedEstimatedApySeries = lockedEstimatedApyData?.timeseries.length
      ? lockedEstimatedApyData.timeseries
      : (lockedEstimatedApyFallbackData?.timeseries ?? [])
    const unlockedChartApyData = applyYvUsdEstimatedApySeries(
      unlockedAprApyData,
      unlockedEstimatedApyData?.timeseries ?? []
    )
    const lockedChartApyData = applyYvUsdLockedOracleAprSeries(
      applyYvUsdEstimatedApySeries(lockedApySeries, lockedEstimatedApySeries),
      unlockedChartApyData,
      lockedOracleAprData?.timeseries ?? []
    )

    return {
      yvUsdChartData: {
        unlockedAprApyData: unlockedChartApyData,
        lockedAprApyData: lockedChartApyData,
        lockedPpsData: lockedUnderlyingPpsSeries,
        ppsData: mergeYvUsdPpsSeries(unlockedPpsData, lockedUnderlyingPpsSeries),
        tvlData: mergeYvUsdTvlSeries(unlockedTvlData, lockedTvlSeries)
      },
      isLoading,
      hasErrors
    }
  }, [
    enabled,
    unlockedEstimatedApyData,
    lockedEstimatedApyData,
    lockedEstimatedApyFallbackData,
    lockedTvlLoading,
    lockedPpsLoading,
    lockedTvlError,
    lockedPpsError,
    lockedTvlData,
    lockedPpsData,
    lockedOracleAprData,
    unlockedAprApyData,
    unlockedTvlData,
    unlockedPpsData
  ])
}
