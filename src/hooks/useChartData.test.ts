import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useChartData } from '@/hooks/useChartData'
import type { TimeseriesDataPoint } from '@/types/dataTypes'

const DAY_ONE = '1767225600'
const DAY_TWO = '1767312000'

const point = (time: string, value: number | null): TimeseriesDataPoint => ({
  label: 'test',
  component: 'test',
  period: '1 day',
  time,
  value
})

const series = (...values: Array<number | null>) => ({
  timeseries: values.map((value, index) => point(index === 0 ? DAY_ONE : DAY_TWO, value))
})

const renderChartData = (weekly: Array<number | null>, oracle: Array<number | null>, enabled = true) =>
  renderHook(() =>
    useChartData({
      apyWeeklyData: series(...weekly),
      apyMonthlyData: series(0.05, 0.05),
      aprOracleAprData: series(...oracle),
      tvlData: series(1_000_000, 1_000_000),
      ppsData: series(1, 1.001),
      includeYBoldEstimatedApy: enabled,
      isLoading: false,
      hasErrors: false
    })
  )

describe('useChartData yBOLD estimated APY', () => {
  it('uses the larger 7-day PPS APY or APR Oracle value for each day', () => {
    const { result } = renderChartData([0.04, 0.08], [0.06, 0.05])

    expect(result.current.transformedAprApyData?.map((point) => point.yBoldEstimatedApy)).toEqual([6, 8])
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
