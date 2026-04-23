import { describe, expect, it } from 'vitest'
import { buildReallocationQueryKey, buildReallocationRequestUrl } from '@/hooks/useReallocationData'

describe('buildReallocationQueryKey', () => {
  it('includes the chain id to avoid cache collisions across chains', () => {
    expect(buildReallocationQueryKey('0xAbC', 1)).toEqual(['reallocation', 'history', 1, '0xabc'])
    expect(buildReallocationQueryKey('0xAbC', 1)).not.toEqual(buildReallocationQueryKey('0xAbC', 10))
  })
})

describe('buildReallocationRequestUrl', () => {
  it('adds both vault and chain id params', () => {
    expect(buildReallocationRequestUrl('https://api.example/reallocation', '0xAbC', 10)).toBe(
      'https://api.example/reallocation?vault=0xabc&chainId=10'
    )
  })

  it('appends params onto existing query strings', () => {
    expect(buildReallocationRequestUrl('https://api.example/reallocation?latest=true', '0xAbC', 8453)).toBe(
      'https://api.example/reallocation?latest=true&vault=0xabc&chainId=8453'
    )
  })

  it('can request history mode for the flow-chart timeline', () => {
    expect(buildReallocationRequestUrl('https://api.example/reallocation', '0xAbC', 10, { history: true })).toBe(
      'https://api.example/reallocation?vault=0xabc&chainId=10&history=1'
    )
  })
})
