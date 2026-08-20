import { describe, expect, it } from 'vitest'
import { aprToWeeklyApy } from '@/lib/oracle-apy'
import {
  applyYvUsdEstimatedApySeries,
  applyYvUsdLockedOracleApySeries,
  buildApyDataFromPpsSeries,
  buildUnderlyingLockedPpsSeries,
  mergeYvUsdTvlSeries
} from '@/lib/yvusd-chart-data'
import type { ppsChartData, TimeseriesDataPoint, tvlChartData } from '@/types/dataTypes'

describe('yvUSD chart data helpers', () => {
  it('adds estimated APY to an existing historical series', () => {
    const point = (time: string, value: number): TimeseriesDataPoint => ({
      label: 'yvusd-estimated-apr',
      component: 'netAPY',
      period: '1 day',
      time,
      value
    })

    expect(
      applyYvUsdEstimatedApySeries(
        [
          { date: 'Jan 1, 2026', derivedApy: 4, derivedApr: 4, sevenDayApy: 4, thirtyDayApy: 4 },
          { date: 'Jan 2, 2026', derivedApy: 5, derivedApr: 5, sevenDayApy: 5, thirtyDayApy: 5 }
        ],
        [point('1767225600', 0.05), point('1767312000', 0.06)]
      )
    ).toEqual([
      {
        date: 'Jan 1, 2026',
        derivedApy: 4,
        derivedApr: 4,
        sevenDayApy: 4,
        thirtyDayApy: 4,
        estimatedApy: 5,
        estimatedApy30dAvg: 5
      },
      {
        date: 'Jan 2, 2026',
        derivedApy: 5,
        derivedApr: 5,
        sevenDayApy: 5,
        thirtyDayApy: 5,
        estimatedApy: 6,
        estimatedApy30dAvg: 5.5
      }
    ])
  })

  it('fee-adjusts the locked Oracle APR and converts the combined net APR to APY', () => {
    const lockedBase = [
      { date: 'Jan 1, 2026', derivedApy: 4, derivedApr: 4, sevenDayApy: 4, thirtyDayApy: 4 },
      { date: 'Jan 2, 2026', derivedApy: 5, derivedApr: 5, sevenDayApy: 5, thirtyDayApy: 5 }
    ]
    const unlocked = [
      { ...lockedBase[0], oracleNetApr: 4.5 },
      { ...lockedBase[1], oracleNetApr: null }
    ]
    const oraclePoint: TimeseriesDataPoint = {
      label: 'apr-oracle',
      component: 'apr',
      period: '1 day',
      time: '1767225600',
      value: 0.05
    }

    const result = applyYvUsdLockedOracleApySeries(lockedBase, unlocked, [oraclePoint], {
      managementFee: 25,
      performanceFee: 1000
    })
    const combinedNetApr = 0.045 + (0.05 - 0.0025) * 0.9

    expect(result[0].oracleNetApr).toBeCloseTo(combinedNetApr * 100)
    expect(result[0].oracleApy).toBeCloseTo(aprToWeeklyApy(combinedNetApr) * 100)
    expect(result[1].oracleNetApr).toBeNull()
    expect(result[1].oracleApy).toBeNull()
  })

  it('prefers locked Kong net rate components over the gross APR fallback', () => {
    const lockedBase = [{ date: 'Jan 1, 2026', derivedApy: 4, derivedApr: 4, sevenDayApy: 4, thirtyDayApy: 4 }]
    const unlocked = [{ ...lockedBase[0], oracleNetApr: 4.5 }]
    const oraclePoints: TimeseriesDataPoint[] = [
      {
        label: 'apr-oracle',
        component: 'apr',
        period: '1 day',
        time: '1767225600',
        value: 0.1
      },
      {
        label: 'apr-oracle',
        component: 'netApr',
        period: '1 day',
        time: '1767225600',
        value: 0.03
      },
      {
        label: 'apr-oracle',
        component: 'netApy',
        period: '1 day',
        time: '1767225600',
        value: 0.031
      }
    ]

    const result = applyYvUsdLockedOracleApySeries(lockedBase, unlocked, oraclePoints, {
      managementFee: 200,
      performanceFee: 1000
    })

    expect(result[0].oracleNetApr).toBeCloseTo(7.5)
    expect(result[0].oracleApy).toBeCloseTo(aprToWeeklyApy(0.075) * 100)
  })

  it('uses published locked net rates without fees but does not treat gross APR as net', () => {
    const lockedBase = [
      { date: 'Jan 1, 2026', derivedApy: 4, derivedApr: 4, sevenDayApy: 4, thirtyDayApy: 4 },
      { date: 'Jan 2, 2026', derivedApy: 4, derivedApr: 4, sevenDayApy: 4, thirtyDayApy: 4 }
    ]
    const unlocked = lockedBase.map((point) => ({ ...point, oracleNetApr: 4.5 }))
    const oraclePoints: TimeseriesDataPoint[] = [
      {
        label: 'apr-oracle',
        component: 'netApr',
        period: '1 day',
        time: '1767225600',
        value: 0.03
      },
      {
        label: 'apr-oracle',
        component: 'apr',
        period: '1 day',
        time: '1767312000',
        value: 0.1
      }
    ]

    const result = applyYvUsdLockedOracleApySeries(lockedBase, unlocked, oraclePoints, null)

    expect(result[0].oracleNetApr).toBeCloseTo(7.5)
    expect(result[0].oracleApy).toBeCloseTo(aprToWeeklyApy(0.075) * 100)
    expect(result[1].oracleNetApr).toBeNull()
    expect(result[1].oracleApy).toBeNull()
  })

  it('converts locked PPS into underlying yvUSD terms', () => {
    const unlockedPps: ppsChartData = [
      { date: 'Jan 1, 2026', PPS: 1.1, time: 1767225600 },
      { date: 'Jan 2, 2026', PPS: 1.2, time: 1767312000 }
    ]
    const lockedPps: ppsChartData = [
      { date: 'Jan 1, 2026', PPS: 1.5, time: 1767225600 },
      { date: 'Jan 2, 2026', PPS: 1.6, time: 1767312000 }
    ]

    expect(buildUnderlyingLockedPpsSeries(unlockedPps, lockedPps)).toEqual([
      { date: 'Jan 1, 2026', PPS: 1.6500000000000001, time: 1767225600 },
      { date: 'Jan 2, 2026', PPS: 1.92, time: 1767312000 }
    ])
  })

  it('calculates locked APY from combined underlying yvUSD PPS', () => {
    const combinedPps: ppsChartData = Array.from({ length: 31 }, (_, index) => ({
      date: `Day ${index + 1}`,
      PPS: 1 + index * 0.01,
      time: 1767225600 + index * 86400
    }))

    const apyData = buildApyDataFromPpsSeries(combinedPps)
    const finalPoint = apyData[30]

    expect(finalPoint?.derivedApy).toBeCloseTo(((1.3 / 1.29) ** 365 - 1) * 100)
    expect(finalPoint?.sevenDayApy).toBeCloseTo(((1.3 / 1.23) ** (365 / 7) - 1) * 100)
    expect(finalPoint?.thirtyDayApy).toBeCloseTo(((1.3 / 1) ** (365 / 30) - 1) * 100)
  })

  it('splits yvUSD total TVL into unlocked and locked values', () => {
    const unlockedTotalTvl: tvlChartData = [
      { date: 'Jan 1, 2026', TVL: 1_000_000 },
      { date: 'Jan 2, 2026', TVL: 900_000 }
    ]
    const lockedTvl: tvlChartData = [
      { date: 'Jan 1, 2026', TVL: 250_000 },
      { date: 'Jan 2, 2026', TVL: 1_100_000 }
    ]

    expect(mergeYvUsdTvlSeries(unlockedTotalTvl, lockedTvl)).toEqual([
      { date: 'Jan 1, 2026', unlocked: 750_000, locked: 250_000 },
      { date: 'Jan 2, 2026', unlocked: 0, locked: 1_100_000 }
    ])
  })

  it('carries the latest locked TVL across missing locked samples', () => {
    const unlockedTotalTvl: tvlChartData = [
      { date: 'Jan 1, 2026', TVL: 1_000_000 },
      { date: 'Jan 2, 2026', TVL: 1_050_000 },
      { date: 'Jan 3, 2026', TVL: 1_100_000 }
    ]
    const lockedTvl: tvlChartData = [
      { date: 'Jan 1, 2026', TVL: 250_000 },
      { date: 'Jan 3, 2026', TVL: 300_000 }
    ]

    expect(mergeYvUsdTvlSeries(unlockedTotalTvl, lockedTvl)).toEqual([
      { date: 'Jan 1, 2026', unlocked: 750_000, locked: 250_000 },
      { date: 'Jan 2, 2026', unlocked: 800_000, locked: 250_000 },
      { date: 'Jan 3, 2026', unlocked: 800_000, locked: 300_000 }
    ])
  })

  it('treats isolated locked TVL zeroes as bad samples after locked TVL is positive', () => {
    const unlockedTotalTvl: tvlChartData = [
      { date: 'Jan 1, 2026', TVL: 1_000_000 },
      { date: 'Jan 2, 2026', TVL: 1_100_000 },
      { date: 'Jan 3, 2026', TVL: 1_200_000 }
    ]
    const lockedTvl: tvlChartData = [
      { date: 'Jan 1, 2026', TVL: 250_000 },
      { date: 'Jan 2, 2026', TVL: 0 },
      { date: 'Jan 3, 2026', TVL: 275_000 }
    ]

    expect(mergeYvUsdTvlSeries(unlockedTotalTvl, lockedTvl)).toEqual([
      { date: 'Jan 1, 2026', unlocked: 750_000, locked: 250_000 },
      { date: 'Jan 2, 2026', unlocked: 850_000, locked: 250_000 },
      { date: 'Jan 3, 2026', unlocked: 925_000, locked: 275_000 }
    ])
  })
})
