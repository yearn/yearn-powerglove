import { describe, expect, it } from 'vitest'
import { assertHarvestSummary } from './harvest-api-contract'

const summary = {
  datasetId: 'a'.repeat(64),
  reportCount: 3,
  startTimestamp: 1793232000,
  endTimestamp: 1793836800,
  chainIds: [1, 10],
  byContractFamily: { 'yearn-v2-vault': 1, 'yearn-v3-allocator': 1, 'yearn-v3-tokenized-strategy': 1 },
  methodology: 'published-contract-reports-v1'
}

describe('harvest response validation', () => {
  it('accepts a full published week and a genuine zero', () => {
    expect(() => assertHarvestSummary(summary)).not.toThrow()
    expect(() =>
      assertHarvestSummary({
        ...summary,
        reportCount: 0,
        byContractFamily: { 'yearn-v2-vault': 0, 'yearn-v3-allocator': 0, 'yearn-v3-tokenized-strategy': 0 }
      })
    ).not.toThrow()
  })

  it.each([
    null,
    {},
    { ...summary, reportCount: null },
    { ...summary, reportCount: -1 },
    { ...summary, reportCount: '3' },
    { ...summary, reportCount: 1.5 },
    { ...summary, reportCount: 4 },
    { ...summary, startTimestamp: summary.startTimestamp + 1 },
    { ...summary, methodology: 'estimated' },
    { ...summary, chainIds: [] },
    { ...summary, byContractFamily: {} }
  ])('rejects malformed or incomplete counts: %j', (payload) => {
    expect(() => assertHarvestSummary(payload)).toThrow('Weekly harvest data is invalid')
  })
})
