import { afterEach, describe, expect, it, vi } from 'vitest'
import { YVUSD_STRATEGY_ADDRESSES } from '@/constants/yvUsdStrategies'
import {
  calculateStrategyMarketAllocationUsd,
  fetchMorphoVaultLookthrough,
  normalizeMorphoLltv,
  PENDLE_POSITIONS
} from '@/lib/yvusd-reporting-client'

describe('yvUSD reporting client', () => {
  it('normalizes Morpho LLTV values returned in either decimal or 1e18-scaled form', () => {
    expect(normalizeMorphoLltv(0.86)).toBe(0.86)
    expect(normalizeMorphoLltv(915_000_000_000_000_000)).toBeCloseTo(0.915)
  })

  it('applies the nested market share to the strategy assets', () => {
    expect(calculateStrategyMarketAllocationUsd(6_842_233.32, 0.3972)).toBeCloseTo(2_717_735.07, 2)
    expect(calculateStrategyMarketAllocationUsd(null, 0.3972)).toBeNull()
  })

  it('maps Pendle positions to their funded yvUSD strategy addresses', () => {
    expect(PENDLE_POSITIONS.sUsdsPendle.strategyAddress).toBe(YVUSD_STRATEGY_ADDRESSES.sUsdsPendle)
    expect(PENDLE_POSITIONS.usd3Pendle.strategyAddress).toBe(YVUSD_STRATEGY_ADDRESSES.usd3Pendle)
  })
})

const morphoAddress = '0x68aea7b82df6ccdf76235d46445ed83f85f845a3'
function morphoResponse(liquidity: number | null = 0) {
  return {
    data: {
      vaultByAddress: {
        address: morphoAddress,
        name: 'Yearn USDC',
        state: {
          totalAssetsUsd: 10,
          owner: morphoAddress,
          curator: morphoAddress,
          guardian: morphoAddress,
          timelock: 0,
          fee: 0,
          feeRecipient: morphoAddress,
          allocation: [
            {
              supplyAssetsUsd: 0.1,
              supplyCap: '1000000',
              supplyQueueIndex: 0,
              withdrawQueueIndex: 0,
              market: {
                marketId: 'market',
                lltv: 0,
                irmAddress: morphoAddress,
                oracle: null,
                loanAsset: { address: morphoAddress, symbol: 'USDC', decimals: 6 },
                collateralAsset: null,
                state: { liquidityAssetsUsd: liquidity, utilization: 0, supplyApy: 0 }
              }
            }
          ]
        }
      }
    }
  }
}
afterEach(() => vi.unstubAllGlobals())
describe('Morpho strategy enrichment', () => {
  it('preserves sub-dollar funded markets and genuine zero liquidity, with token-denominated caps', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => morphoResponse() }))
    const data = await fetchMorphoVaultLookthrough(morphoAddress)
    expect(data.markets).toHaveLength(1)
    expect(data.markets[0]).toMatchObject({ allocationUsd: 0.1, marketLiquidityUsd: 0, supplyCapAssets: 1 })
    expect(data.zeroAllocationMarketCount).toBe(0)
  })
  it('does not turn missing market liquidity into zero', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => morphoResponse(null) }))
    await expect(fetchMorphoVaultLookthrough(morphoAddress)).rejects.toThrow('unavailable')
  })
})
