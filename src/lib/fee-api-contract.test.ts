import { describe, expect, it } from 'vitest'
import { assertCanonicalFeeResponse } from './fee-api-contract'

describe('canonical fee API boundary', () => {
  it('rejects a legacy publication even when its fee amount looks plausible', () => {
    expect(() => assertCanonicalFeeResponse({ datasetId: 'old', totalFeesPaidUsd: '624567.52' })).toThrow(
      'Fee API is outdated'
    )
  })
  it('rejects a contract response when product fees were requested', () => {
    expect(() => assertCanonicalFeeResponse({ datasetId: 'current', aggregationScope: 'contract' }, 'product')).toThrow(
      'wrong aggregation scope'
    )
  })
  it('accepts corrected contract and product responses', () => {
    for (const scope of ['contract', 'product']) {
      expect(() => assertCanonicalFeeResponse({ datasetId: 'current', aggregationScope: scope }, scope)).not.toThrow()
    }
  })
})
