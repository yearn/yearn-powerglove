import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@/constants/featuredVaults'
import { aprToWeeklyApy } from '@/lib/oracle-apy'
import type { TimeseriesDataPoint } from '@/types/dataTypes'
import { useYvUsdChartData } from './useYvUsdChartData'

const mocks = vi.hoisted(() => ({
  useApolloQuery: vi.fn(),
  useRestTimeseries: vi.fn()
}))

vi.mock('@apollo/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@apollo/client')>()
  return {
    ...actual,
    useQuery: (...args: unknown[]) => mocks.useApolloQuery(...args)
  }
})

vi.mock('@/hooks/useRestTimeseries', () => ({
  useRestTimeseries: (...args: unknown[]) => mocks.useRestTimeseries(...args)
}))

const ESTIMATED_APY_LABEL = 'yvusd-estimated-apr'
const LOCKED_ESTIMATED_APY_LABEL = 'locked-yvusd-estimated-apr'
const TIME = '1767225600'
const DATE = 'Jan 1, 2026'

type QueryResult = {
  data?: { timeseries: TimeseriesDataPoint[] }
  loading: boolean
  error?: Error
}

type RestResult = {
  data?: { timeseries: TimeseriesDataPoint[] }
  isLoading: boolean
  error: Error | null
}

const point = (label: string, value: number, component = 'netAPY'): TimeseriesDataPoint => ({
  label,
  component,
  period: '1 day',
  time: TIME,
  value
})

const estimateKey = (address: string, label: string) => `${address.toLowerCase()}:${label}`

const unlockedKey = estimateKey(YVUSD_UNLOCKED_ADDRESS, ESTIMATED_APY_LABEL)
const lockedKey = estimateKey(YVUSD_LOCKED_ADDRESS, LOCKED_ESTIMATED_APY_LABEL)
const lockedFallbackKey = estimateKey(YVUSD_LOCKED_ADDRESS, ESTIMATED_APY_LABEL)

let estimateResults: Map<string, QueryResult>
let restResults: Map<string, RestResult>

const renderYvUsdChartData = (enabled = true) =>
  renderHook(() =>
    useYvUsdChartData({
      enabled,
      unlockedAprApyData: [
        {
          date: DATE,
          sevenDayApy: 4,
          thirtyDayApy: 5,
          derivedApr: 6,
          derivedApy: 6.2,
          oracleNetApr: 6,
          oracleApy: aprToWeeklyApy(0.06) * 100
        }
      ],
      unlockedTvlData: [{ date: DATE, TVL: 1_000_000 }],
      unlockedPpsData: [{ date: DATE, PPS: 1, time: Number(TIME) }],
      lockedFees: { managementFee: 0, performanceFee: 0 }
    })
  )

describe('useYvUsdChartData', () => {
  beforeEach(() => {
    mocks.useApolloQuery.mockReset()
    mocks.useRestTimeseries.mockReset()

    estimateResults = new Map([
      [unlockedKey, { data: { timeseries: [point(ESTIMATED_APY_LABEL, 0.05)] }, loading: false }],
      [lockedKey, { data: { timeseries: [] }, loading: false }],
      [lockedFallbackKey, { data: { timeseries: [point(ESTIMATED_APY_LABEL, 0.08)] }, loading: false }]
    ])
    restResults = new Map([
      [
        'tvl',
        {
          data: { timeseries: [point('tvl', 250_000)] },
          isLoading: false,
          error: null
        }
      ],
      [
        'pps',
        {
          data: { timeseries: [point('pps', 1.1)] },
          isLoading: false,
          error: null
        }
      ],
      [
        'apr-oracle',
        {
          data: {
            timeseries: [
              point('apr-oracle', 0.07, 'apr'),
              point('apr-oracle', 0.055, 'netApr'),
              point('apr-oracle', 0.056, 'netApy')
            ]
          },
          isLoading: false,
          error: null
        }
      ]
    ])

    mocks.useApolloQuery.mockImplementation(
      (_query: unknown, options: { variables: { address: string; label: string }; skip: boolean }) =>
        options.skip
          ? { data: undefined, loading: false }
          : (estimateResults.get(estimateKey(options.variables.address, options.variables.label)) ?? {
              data: undefined,
              loading: false
            })
    )
    mocks.useRestTimeseries.mockImplementation(({ segment, enabled }: { segment: string; enabled: boolean }) =>
      enabled
        ? (restResults.get(segment) ?? { data: undefined, isLoading: false, error: null })
        : { data: undefined, isLoading: false, error: null }
    )
  })

  it('returns an idle state and disables every query when disabled', () => {
    const { result } = renderYvUsdChartData(false)

    expect(result.current).toEqual({ yvUsdChartData: null, isLoading: false, hasErrors: false })
    expect(mocks.useApolloQuery).toHaveBeenCalledTimes(3)
    for (const call of mocks.useApolloQuery.mock.calls) {
      expect(call[1]).toEqual(expect.objectContaining({ skip: true }))
    }
    for (const call of mocks.useRestTimeseries.mock.calls) {
      expect(call[0]).toEqual(expect.objectContaining({ enabled: false }))
    }
  })

  it('prefers the dedicated locked estimate series', () => {
    estimateResults.set(lockedKey, {
      data: { timeseries: [point(LOCKED_ESTIMATED_APY_LABEL, 0.09)] },
      loading: false
    })

    const { result } = renderYvUsdChartData()

    expect(result.current.yvUsdChartData?.lockedAprApyData[0]?.estimatedApy).toBe(9)
  })

  it('uses the shared-label fallback when the dedicated locked query fails', () => {
    estimateResults.set(lockedKey, { data: undefined, loading: false, error: new Error('dedicated failed') })

    const { result } = renderYvUsdChartData()

    expect(result.current.hasErrors).toBe(false)
    expect(result.current.yvUsdChartData?.lockedAprApyData[0]?.estimatedApy).toBe(8)
  })

  it('adds unlocked and locked Oracle net APR before converting the combined rate to APY', () => {
    const { result } = renderYvUsdChartData()

    expect(result.current.yvUsdChartData?.lockedAprApyData[0]?.oracleNetApr).toBeCloseTo(11.5)
    expect(result.current.yvUsdChartData?.lockedAprApyData[0]?.oracleApy).toBeCloseTo(aprToWeeklyApy(0.115) * 100)
    expect(mocks.useRestTimeseries).toHaveBeenCalledWith(
      expect.objectContaining({
        segment: 'apr-oracle',
        address: YVUSD_LOCKED_ADDRESS,
        components: ['netApy', 'netApr', 'apr'],
        enabled: true
      })
    )
  })

  it('keeps the dedicated series when the shared-label fallback fails', () => {
    estimateResults.set(lockedKey, {
      data: { timeseries: [point(LOCKED_ESTIMATED_APY_LABEL, 0.09)] },
      loading: false
    })
    estimateResults.set(lockedFallbackKey, {
      data: undefined,
      loading: false,
      error: new Error('fallback failed')
    })

    const { result } = renderYvUsdChartData()

    expect(result.current.hasErrors).toBe(false)
    expect(result.current.yvUsdChartData?.lockedAprApyData[0]?.estimatedApy).toBe(9)
  })

  it('renders required charts without optional estimate data', () => {
    estimateResults.set(unlockedKey, { data: undefined, loading: false, error: new Error('unlocked failed') })
    estimateResults.set(lockedKey, { data: undefined, loading: false, error: new Error('locked failed') })
    estimateResults.set(lockedFallbackKey, {
      data: undefined,
      loading: false,
      error: new Error('fallback failed')
    })

    const { result } = renderYvUsdChartData()

    expect(result.current.hasErrors).toBe(false)
    expect(result.current.yvUsdChartData).not.toBeNull()
    expect(result.current.yvUsdChartData?.unlockedAprApyData[0]?.estimatedApy).toBeNull()
    expect(result.current.yvUsdChartData?.lockedAprApyData[0]?.estimatedApy).toBeNull()
  })

  it('does not block required charts while optional estimates load', () => {
    estimateResults.set(unlockedKey, { data: undefined, loading: true })
    estimateResults.set(lockedKey, { data: undefined, loading: true })
    estimateResults.set(lockedFallbackKey, { data: undefined, loading: true })

    const { result } = renderYvUsdChartData()

    expect(result.current.isLoading).toBe(false)
    expect(result.current.yvUsdChartData).not.toBeNull()
  })

  it('keeps required locked-data failures fatal', () => {
    restResults.set('tvl', { data: undefined, isLoading: false, error: new Error('tvl failed') })

    const { result } = renderYvUsdChartData()

    expect(result.current.hasErrors).toBe(true)
    expect(result.current.yvUsdChartData).toBeNull()
  })
})
