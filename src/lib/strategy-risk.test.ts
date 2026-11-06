import { describe, expect, it } from 'vitest'
import { getStrategyRiskLevel } from './strategy-risk'

describe('Kong strategy risk levels', () => {
  it('uses the aggregate rating rather than a scoring dimension or a default', () => {
    expect(getStrategyRiskLevel({ risk: { riskLevel: 2, riskScore: { review: 3 } } })).toBe(2)
    expect(getStrategyRiskLevel({ risk: { riskLevel: '4' } })).toBe(4)
    for (const risk of [null, { riskLevel: null }, { riskScore: { review: 3 } }, { riskLevel: 0 }, { riskLevel: 6 }]) {
      expect(getStrategyRiskLevel({ risk })).toBeNull()
    }
  })
})
