import { describe, expect, it } from 'vitest'
import {
  aprToWeeklyApy,
  deriveNetAprFromGrossApr,
  resolveOracleNetApy,
  resolveOracleRates,
  weeklyApyToApr
} from '@/lib/oracle-apy'

describe('Oracle net APY helpers', () => {
  it('prefers Kong netAPY without recalculating it', () => {
    expect(
      resolveOracleNetApy({
        netApy: 0.04953176996542452,
        netApr: 0.04836661095574275,
        grossApr: 0.053740678839714166,
        performanceFeeBps: 1000
      })
    ).toBe(0.04953176996542452)
  })

  it('converts Kong netAPR with 52 weekly compounding periods', () => {
    expect(resolveOracleNetApy({ netApr: 0.04836661095574275 })).toBeCloseTo(0.04953176996542452)
  })

  it('recovers net APR from a published net APY when netApr is absent', () => {
    const netApy = 0.04953176996542452

    expect(resolveOracleRates({ netApy })).toEqual({
      netApr: weeklyApyToApr(netApy),
      netApy
    })
  })

  it('derives net APR after management fees and before performance fees', () => {
    const grossApr = 0.027882532516103713
    const netApr = deriveNetAprFromGrossApr(grossApr, 25, 1000)

    expect(netApr).toBeCloseTo(0.022844279264493342)
    expect(resolveOracleNetApy({ grossApr, managementFeeBps: 25, performanceFeeBps: 1000 })).toBeCloseTo(
      aprToWeeklyApy(0.022844279264493342)
    )
  })

  it('preserves genuine zero and does not produce a negative net APR', () => {
    expect(deriveNetAprFromGrossApr(0, 25, 1000)).toBe(0)
    expect(resolveOracleNetApy({ netApy: 0, grossApr: 0.1 })).toBe(0)
  })

  it('keeps unavailable Oracle data unavailable', () => {
    expect(resolveOracleNetApy({})).toBeNull()
  })
})
