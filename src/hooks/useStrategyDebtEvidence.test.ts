import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildDefiLlamaPriceUrl,
  buildStrategyDebtSourceUrl,
  fetchStrategyDebtEvidence
} from '@/hooks/useStrategyDebtEvidence'

const { readContract } = vi.hoisted(() => ({ readContract: vi.fn() }))

vi.mock('@/lib/public-client', () => ({
  getPublicClient: () => ({ readContract })
}))

const params = {
  chainId: 1 as const,
  vaultAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  strategyAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  assetAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
  assetDecimals: 6
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('strategy debt evidence', () => {
  it('builds direct source links for the on-chain field and price response', () => {
    expect(buildStrategyDebtSourceUrl(1, params.vaultAddress)).toBe(
      `https://etherscan.io/address/${params.vaultAddress}#readContract#F34`
    )
    expect(buildDefiLlamaPriceUrl(1, params.assetAddress)).toBe(
      `https://coins.llama.fi/prices/current/ethereum:${params.assetAddress}`
    )
  })

  it('reconstructs currentDebtUsd from the live debt and underlying price', async () => {
    vi.mocked(readContract).mockResolvedValue([0n, 0n, 1_234_567_000_000n, 0n])
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          coins: {
            [`ethereum:${params.assetAddress}`]: {
              price: 0.999,
              timestamp: 1_700_000_000
            }
          }
        })
      })
    )

    const result = await fetchStrategyDebtEvidence(params)

    expect(result.currentDebtRaw).toBe(1_234_567_000_000n)
    expect(result.currentDebtTokens).toBe(1_234_567)
    expect(result.priceUsd).toBe(0.999)
    expect(result.priceTimestamp).toBe(1_700_000_000)
    expect(result.calculatedDebtUsd).toBeCloseTo(1_233_332.433)
  })

  it('keeps unavailable evidence distinct from a genuine zero', async () => {
    vi.mocked(readContract).mockRejectedValue(new Error('RPC unavailable'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    const result = await fetchStrategyDebtEvidence(params)

    expect(result.currentDebtRaw).toBeNull()
    expect(result.currentDebtTokens).toBeNull()
    expect(result.priceUsd).toBeNull()
    expect(result.calculatedDebtUsd).toBeNull()
  })
  it.each([
    { debt: 0n, price: 1, expected: 0 },
    { debt: 1_000_000n, price: 0, expected: 0 },
    { debt: null, price: 1, expected: null },
    { debt: 1_000_000n, price: null, expected: null }
  ])('distinguishes zero and missing individual inputs: $debt / $price', async ({ debt, price, expected }) => {
    if (debt === null) readContract.mockRejectedValue(new Error('RPC unavailable'))
    else readContract.mockResolvedValue([0n, 0n, debt, 0n])
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ coins: { [`ethereum:${params.assetAddress}`]: { price } } })
      })
    )

    const result = await fetchStrategyDebtEvidence(params)

    expect(result.currentDebtRaw).toBe(debt)
    expect(result.priceUsd).toBe(price)
    expect(result.calculatedDebtUsd).toBe(expected)
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: params.vaultAddress,
        functionName: 'strategies',
        args: [params.strategyAddress]
      })
    )
  })
})
