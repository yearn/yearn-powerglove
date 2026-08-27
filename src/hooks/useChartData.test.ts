import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useChartData } from '@/hooks/useChartData'
import { aprToWeeklyApy } from '@/lib/oracle-apy'
import type { TimeseriesDataPoint } from '@/types/dataTypes'

const DAY_ONE = '1767225600'
const DAY_TWO = '1767312000'

const point = (time: string, value: number | null, component = 'test'): TimeseriesDataPoint => ({
  label: 'test',
  component,
  period: '1 day',
  time,
  value
})

const series = (...values: Array<number | null>) => ({
  timeseries: values.map((value, index) => point(index === 0 ? DAY_ONE : DAY_TWO, value))
})

const renderChartData = (
  weekly: Array<number | null>,
  oracle: Array<number | null>,
  enabled = true,
  fees: { managementFeeBps?: number; performanceFeeBps?: number } = {}
) =>
  renderHook(() =>
    useChartData({
      apyWeeklyData: series(...weekly),
      apyMonthlyData: series(0.05, 0.05),
      aprOracleAprData: {
        timeseries: oracle.map((value, index) => point(index === 0 ? DAY_ONE : DAY_TWO, value, 'apr'))
      },
      tvlData: series(1_000_000, 1_000_000),
      ppsData: series(1, 1.001),
      includeYBoldEstimatedApy: enabled,
      managementFeeBps: fees.managementFeeBps,
      performanceFeeBps: fees.performanceFeeBps,
      isLoading: false,
      hasErrors: false
    })
  )

describe('useChartData Oracle APY', () => {
  it('uses the larger 7-day PPS APY or fee-adjusted Oracle APY for yBOLD', () => {
    const { result } = renderChartData([0.04, 0.08], [0.06, 0.05], true, { performanceFeeBps: 1000 })
    const firstOracleNetApr = 0.06 * 0.9

    expect(result.current.transformedAprApyData?.[0]?.oracleNetApr).toBeCloseTo(firstOracleNetApr * 100)
    expect(result.current.transformedAprApyData?.[0]?.oracleApy).toBeCloseTo(aprToWeeklyApy(firstOracleNetApr) * 100)
    expect(result.current.transformedAprApyData?.[0]?.yBoldEstimatedApy).toBeCloseTo(
      aprToWeeklyApy(firstOracleNetApr) * 100
    )
    expect(result.current.transformedAprApyData?.[1]?.yBoldEstimatedApy).toBe(8)
  })

  it('prefers published Kong netApy and netApr components over the gross APR fallback', () => {
    const { result } = renderHook(() =>
      useChartData({
        apyWeeklyData: series(0.04, 0.04),
        apyMonthlyData: series(0.05, 0.05),
        aprOracleAprData: {
          timeseries: [point(DAY_ONE, 0.2, 'apr'), point(DAY_ONE, 0.05, 'netApr'), point(DAY_ONE, 0.07, 'netApy')]
        },
        tvlData: series(1_000_000, 1_000_000),
        ppsData: series(1, 1.001),
        includeYBoldEstimatedApy: true,
        managementFeeBps: 200,
        performanceFeeBps: 1000,
        isLoading: false,
        hasErrors: false
      })
    )

    expect(result.current.transformedAprApyData?.[0]?.oracleNetApr).toBe(5)
    expect(result.current.transformedAprApyData?.[0]?.oracleApy).toBeCloseTo(7)
    expect(result.current.transformedAprApyData?.[0]?.yBoldEstimatedApy).toBeCloseTo(7)
  })

  it('keeps the estimate unavailable when either input is missing', () => {
    const { result } = renderChartData([0.04, null], [null, 0.05])

    expect(result.current.transformedAprApyData?.map((point) => point.yBoldEstimatedApy)).toEqual([null, null])
  })

  it('does not add the yBOLD estimate to other vault charts', () => {
    const { result } = renderChartData([0.04, 0.08], [0.06, 0.05], false)

    expect(result.current.transformedAprApyData?.map((point) => point.yBoldEstimatedApy)).toEqual([null, null])
  })
})
