import { useMemo } from 'react'
import { resolveOracleRates } from '@/lib/oracle-apy'
import {
  calculateAprFromPps,
  calculateApyFromApr,
  fillMissingDailyData,
  formatUnixTimestamp,
  getEarliestAndLatestTimestamps
} from '@/lib/utils'
import type { aprApyChartData, ppsChartData, TimeseriesDataPoint, tvlChartData } from '@/types/dataTypes'

interface TimeseriesQueryResult {
  timeseries: TimeseriesDataPoint[]
}

/**
 * Calculates the average of the last N values in a timeseries, ending at a specific index.
 *
 * Computes a rolling average by looking back `windowSize` positions from `endIndexInclusive`.
 * Null and undefined values are excluded from the calculation - only numeric values contribute
 * to both the sum and count.
 *
 * @param series - Array of nullable numbers representing a timeseries
 * @param endIndexInclusive - The index to end the averaging window at (inclusive)
 * @param windowSize - Number of values to include in the average (looking backward)
 * @returns The average of non-null values in the window, or null if no valid values exist
 *
 * @example
 * averageLast([1, 2, null, 4, 5], 4, 3) // returns 4.5 (avg of [null, 4, 5])
 */
const averageLast = (series: Array<number | null>, endIndexInclusive: number, windowSize: number): number | null => {
  const start = Math.max(0, endIndexInclusive - windowSize + 1)
  let sum = 0
  let count = 0
  for (let i = start; i <= endIndexInclusive; i++) {
    const value = series[i]
    if (value === null || value === undefined) continue
    sum += value
    count++
  }
  return count > 0 ? sum / count : null
}

interface UseChartDataProps {
  apyWeeklyData: TimeseriesQueryResult | undefined
  apyMonthlyData: TimeseriesQueryResult | undefined
  aprOracleAprData?: TimeseriesQueryResult | undefined
  tvlData: TimeseriesQueryResult | undefined
  ppsData: TimeseriesQueryResult | undefined
  includeYBoldEstimatedApy?: boolean
  managementFeeBps?: number
  performanceFeeBps?: number
  isLoading: boolean
  hasErrors: boolean
}

interface UseChartDataReturn {
  transformedAprApyData: aprApyChartData | null
  transformedTvlData: tvlChartData | null
  transformedPpsData: ppsChartData | null
}

/**
 * Processes raw timeseries data into chart-ready format
 * Extracted from the original processChartData function
 */
export function useChartData({
  apyWeeklyData,
  apyMonthlyData,
  aprOracleAprData,
  tvlData,
  ppsData,
  includeYBoldEstimatedApy = false,
  managementFeeBps = 0,
  performanceFeeBps = 0,
  isLoading,
  hasErrors
}: UseChartDataProps): UseChartDataReturn {
  return useMemo(() => {
    // Only process data if all queries are complete and successful
    if (isLoading || hasErrors || !apyWeeklyData || !apyMonthlyData || !tvlData || !ppsData) {
      return {
        transformedAprApyData: null,
        transformedTvlData: null,
        transformedPpsData: null
      }
    }

    // Extract clean data arrays
    const apy7DayDataClean = apyWeeklyData.timeseries || []
    const apy30DayDataClean = apyMonthlyData.timeseries || []
    const tvlDataClean = tvlData.timeseries || []
    const ppsDataClean = ppsData.timeseries || []
    const oracleDataClean = aprOracleAprData?.timeseries || []
    const oracleSeries = (component: string) =>
      oracleDataClean.filter((point) => point.component?.toLowerCase() === component.toLowerCase())
    const oracleNetApyDataClean = oracleSeries('netApy')
    const oracleNetAprDataClean = oracleSeries('netApr')
    const oracleAprDataClean = oracleSeries('apr')

    // Get timestamp range for data alignment
    const { earliest, latest } = getEarliestAndLatestTimestamps(
      apy7DayDataClean,
      apy30DayDataClean,
      tvlDataClean,
      ppsDataClean,
      oracleDataClean
    )

    if (!Number.isFinite(earliest) || !Number.isFinite(latest) || earliest > latest) {
      return {
        transformedAprApyData: [],
        transformedTvlData: [],
        transformedPpsData: []
      }
    }

    // Fill missing data points
    const apy7DayFilled = fillMissingDailyData(apy7DayDataClean, earliest, latest)
    const apy30DayFilled = fillMissingDailyData(apy30DayDataClean, earliest, latest)
    const tvlFilled = fillMissingDailyData(tvlDataClean, earliest, latest)
    const ppsFilled = fillMissingDailyData(ppsDataClean, earliest, latest)
    const oracleNetApyFilled = fillMissingDailyData(oracleNetApyDataClean, earliest, latest)
    const oracleNetAprFilled = fillMissingDailyData(oracleNetAprDataClean, earliest, latest)
    const oracleAprFilled = fillMissingDailyData(oracleAprDataClean, earliest, latest)

    // Calculate APR from PPS data
    const aprFilled = calculateAprFromPps(ppsFilled)
    const aprAsApyFilled = calculateApyFromApr(aprFilled)

    const oracleRates = oracleAprFilled.map((point, index) =>
      resolveOracleRates({
        netApy: oracleNetApyFilled[index]?.value,
        netApr: oracleNetAprFilled[index]?.value,
        grossApr: point.value,
        managementFeeBps,
        performanceFeeBps
      })
    )
    const oracleNetAprValues = oracleRates.map((rates) => rates?.netApr ?? null)
    const oracleApyValues = oracleRates.map((rates) => rates?.netApy ?? null)
    const oracleApy30dAvgValues = oracleApyValues.map((_, index) => averageLast(oracleApyValues, index, 30))

    // Transform TVL data
    const transformedTvlData: tvlChartData = tvlFilled.map((dataPoint) => ({
      date: formatUnixTimestamp(dataPoint.time),
      TVL: dataPoint.value ?? null
    }))

    // Transform PPS data
    const transformedPpsData: ppsChartData = ppsFilled.map((dataPoint) => ({
      date: formatUnixTimestamp(dataPoint.time),
      PPS: dataPoint.value ?? null,
      time: Number(dataPoint.time)
    }))

    const transformedAprApyData: aprApyChartData = aprFilled.map((aprDataPoint, index) => {
      const sevenDayPpsApy = apy7DayFilled[index]?.value ?? null
      const oracleNetApr = oracleNetAprValues[index] ?? null
      const oracleApy = oracleApyValues[index] ?? null

      return {
        date: formatUnixTimestamp(aprDataPoint.time),
        sevenDayApy: sevenDayPpsApy !== null ? sevenDayPpsApy * 100 : null,
        thirtyDayApy: apy30DayFilled[index]?.value !== null ? apy30DayFilled[index]!.value! * 100 : null,
        derivedApr: aprDataPoint.value !== null ? aprDataPoint.value * 100 : null,
        derivedApy: aprAsApyFilled[index]?.value !== null ? aprAsApyFilled[index]!.value! * 100 : null,
        oracleNetApr: oracleNetApr !== null ? oracleNetApr * 100 : null,
        oracleApy: oracleApy !== null ? oracleApy * 100 : null,
        oracleApy30dAvg: oracleApy30dAvgValues[index] !== null ? oracleApy30dAvgValues[index]! * 100 : null,
        yBoldEstimatedApy:
          includeYBoldEstimatedApy && sevenDayPpsApy !== null && oracleApy !== null
            ? Math.max(sevenDayPpsApy, oracleApy) * 100
            : null
      }
    })

    return {
      transformedAprApyData,
      transformedTvlData,
      transformedPpsData
    }
  }, [
    apyWeeklyData,
    apyMonthlyData,
    aprOracleAprData,
    tvlData,
    ppsData,
    includeYBoldEstimatedApy,
    managementFeeBps,
    performanceFeeBps,
    isLoading,
    hasErrors
  ])
}
