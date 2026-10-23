import { describe, expect, it } from 'vitest'
import { isCanonicalFeeSummary } from './canonical-fees'

const canonicalSummary = {
  totalFeesPaidUsd: '100',
  grossGainsUsd: '300',
  lossesUsd: '25',
  netLifetimeEarningsUsd: '275',
  lifetimeEarnings: { grossGainsUsd: '300', lossesUsd: '25', netYieldUsd: '275' }
}

describe('isCanonicalFeeSummary', () => {
  it('accepts unavailable monetary values without diagnostic fields', () => {
    expect(
      isCanonicalFeeSummary({
        ...canonicalSummary,
        totalFeesPaidUsd: null,
        grossGainsUsd: null,
        lossesUsd: null,
        netLifetimeEarningsUsd: null,
        lifetimeEarnings: { grossGainsUsd: null, lossesUsd: null, netYieldUsd: null }
      })
    ).toBe(true)
    expect(isCanonicalFeeSummary({ ...canonicalSummary, totalFeesPaidUsd: 'NaN' })).toBe(false)
    expect(isCanonicalFeeSummary({ ...canonicalSummary, lifetimeEarnings: {} })).toBe(false)
  })

  it('accepts the canonical summary contract', () => {
    expect(isCanonicalFeeSummary(canonicalSummary)).toBe(true)
  })

  it.each(['totalGains', 'totalLosses', 'totalFeeRevenue'])('rejects the legacy %s field', (field) => {
    expect(isCanonicalFeeSummary({ ...canonicalSummary, [field]: 123 })).toBe(false)
  })

  it('rejects the Kong report aggregation source', () => {
    expect(isCanonicalFeeSummary({ ...canonicalSummary, meta: { source: 'kong-vault-reports' } })).toBe(false)
  })

  it('rejects summaries missing canonical lifetime earnings fields', () => {
    expect(isCanonicalFeeSummary({ totalFeesPaidUsd: '100', feeCoverage: {} })).toBe(false)
  })
})
