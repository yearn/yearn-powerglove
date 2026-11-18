import { describe, expect, it } from 'vitest'
import { YVUSD_STRATEGY_ADDRESSES as addresses } from '@/constants/yvUsdStrategies'
import { buildProvisionalDependencyLoss } from '@/lib/tranche-provisional-inputs'
import type { MorphoMarketAllocation, MorphoVaultLookthrough, PawnLooperRates } from '@/lib/yvusd-reporting-client'

const rating = (score: number) => ({ score, observedAt: '2026-11-04T00:00:00Z', state: 'available' as const })
const pawn: PawnLooperRates = {
  leverage: 7.8,
  ltv: 0.87,
  lltv: 0.915,
  borrowApr: 0.045,
  pendingBorrowApr: null,
  pendingBorrowEffectiveAtUtc: null,
  blockNumber: '123',
  observedAt: '2026-11-04T00:00:00Z'
}
const market: MorphoMarketAllocation = {
  marketId: 'market1',
  collateralSymbol: 'USD3',
  collateralAddress: '0x123',
  loanSymbol: 'USDC',
  allocationUsd: 200,
  allocationShare: 0.2,
  marketLiquidityUsd: null,
  utilization: 0.9,
  supplyApy: 0.05,
  lltv: 0.86,
  supplyCapAssets: 1000,
  withdrawQueueIndex: null,
  supplyQueueIndex: null,
  oracleAddress: '0x456',
  irmAddress: '0x789'
}
const morpho: MorphoVaultLookthrough = {
  fetchedAt: '2026-11-04T01:00:00Z',
  address: '0xabc',
  name: 'Vault',
  totalAssetsUsd: 1000,
  owner: '',
  curator: '',
  guardian: '',
  timelockSeconds: 0,
  fee: 0,
  feeRecipient: '',
  zeroAllocationMarketCount: 0,
  markets: [market, { ...market, marketId: 'market2', allocationShare: 0.3 }]
}

describe('provisional Kong and QTOV dependency inputs', () => {
  it('takes the highest linked rating, never an average, and flags missing contributors', () => {
    const partial = buildProvisionalDependencyLoss({ [addresses.morpho]: rating(2) })
    const dependency = partial.dependencies.find((item) => item.name === 'Morpho')!
    expect(dependency.score).toBe(2)
    expect(dependency.lossRate).toBe(0.25)
    expect(dependency.complete).toBe(false)
    expect(dependency.missingRatings).toEqual(['Katana yvUSDC Compounder'])
    const rated = buildProvisionalDependencyLoss({ [addresses.morpho]: rating(2), [addresses.katana]: rating(4) })
    expect(rated.dependencies.find((item) => item.name === 'Morpho')?.score).toBe(4)
    expect(rated.dependencies.find((item) => item.name === 'Morpho')?.complete).toBe(false)
  })

  it('uses measured looper leverage, caps losses at capital and preserves absent leverage', () => {
    const missing = buildProvisionalDependencyLoss({ [addresses.pawn]: rating(1) })
    expect(missing.dependencies.find((item) => item.name === 'Pawn Broker')?.baseLoss).toBeNull()
    const measured = buildProvisionalDependencyLoss({ [addresses.pawn]: rating(1) }, { pawn })
    const dependency = measured.dependencies.find((item) => item.name === 'Pawn Broker')!
    expect(dependency.links[0].leverage).toBe(7.8)
    expect(dependency.links[0].leverageSource).toContain('block 123')
    expect(dependency.baseLoss).toBeCloseTo(dependency.links[0].strategy.allocationUsd * 0.78)
    const capped = buildProvisionalDependencyLoss({ [addresses.pawn]: rating(3) }, { pawn })
    const loss = capped.dependencies.find((item) => item.name === 'Pawn Broker')!
    expect(loss.baseLoss).toBe(loss.links[0].strategy.allocationUsd)
  })

  it('aggregates measured Morpho shares by collateral address and retains observation provenance', () => {
    const result = buildProvisionalDependencyLoss({ [addresses.morpho]: rating(2) }, { morpho })
    const collateral = result.dependencies.filter((item) => item.name.startsWith('Morpho collateral'))
    expect(collateral).toHaveLength(1)
    expect(collateral[0].links[0].weight).toBe(0.5)
    expect(collateral[0].baseLoss).toBeCloseTo(collateral[0].links[0].strategy.allocationUsd * 0.5 * 0.25)
    expect(collateral[0].links[0].weightSource).toContain(morpho.fetchedAt)
    expect(collateral[0].complete).toBe(true)
  })

  it('does not replace unavailable observations, ratings or remote exposure shares with defaults', () => {
    const result = buildProvisionalDependencyLoss({})
    expect(result.maxKnownBaseLoss).toBeNull()
    expect(result.dependencies.every((item) => item.score === null && item.baseLoss === null)).toBe(true)
    expect(result.dependencies.some((item) => item.name.startsWith('Morpho collateral'))).toBe(false)
    expect(
      result.dependencies
        .find((item) => item.name === 'Morpho')
        ?.links.find((link) => link.strategy.address.toLowerCase() === addresses.katana)?.weight
    ).toBeNull()
    expect(
      result.dependencies
        .find((item) => item.name === 'Sky / USDS')
        ?.links.find((link) => link.strategy.address.toLowerCase() === addresses.grove)?.weight
    ).toBeNull()
  })
})
