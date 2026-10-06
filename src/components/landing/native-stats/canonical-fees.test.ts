import { describe, expect, it } from 'vitest'
import { isCanonicalFeeSummary } from './canonical-fees'

const canonicalSummary = {
  totalFeesPaidUsd: '100',
  grossGainsUsd: '300',
  lossesUsd: '25',
  netLifetimeEarningsUsd: '275',
  lifetimeEarnings: {},
  tokenizedStrategyYield: {},
  feeCoverage: { status: 'partial' }
}

describe('isCanonicalFeeSummary', () => {
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
