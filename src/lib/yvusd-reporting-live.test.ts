import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchPawnLooperRates,
  fetchPendlePositionLiquidity,
  fetchPendlePositionSnapshot,
  PENDLE_POSITIONS
} from './yvusd-reporting-client'

const rpc = vi.hoisted(() => ({ getBlock: vi.fn(), multicall: vi.fn() }))
vi.mock('@/lib/public-client', () => ({ getPublicClient: () => rpc }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.unstubAllGlobals()
  rpc.getBlock.mockResolvedValue({ number: 77n, timestamp: 1793800000n })
})

describe('QTOV live observations', () => {
  it('pins looper reads to one block and returns current leverage and its observation time', async () => {
    rpc.multicall.mockResolvedValue([500n, [0n, 0n], 8n * 10n ** 18n, 875n * 10n ** 15n, 915n * 10n ** 15n])
    const value = await fetchPawnLooperRates()
    expect(value).toMatchObject({ leverage: 8, ltv: 0.875, lltv: 0.915, borrowApr: 0.05, blockNumber: '77' })
    expect(rpc.multicall).toHaveBeenCalledWith(expect.objectContaining({ blockNumber: 77n, allowFailure: false }))
  })

  it('quotes the current PT balance rather than a historical snapshot amount', async () => {
    rpc.multicall.mockResolvedValue([123000000n, 6, 1795737600n])
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ markets: [{ address: PENDLE_POSITIONS.usd3Pendle.marketAddress }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          routes: [{ outputs: [{ token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', amount: '120000000' }] }]
        })
      })
    vi.stubGlobal('fetch', fetchMock)
    const value = await fetchPendlePositionLiquidity('usd3Pendle')
    const request = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(request.inputs[0].amount).toBe('123000000')
    expect(value).toMatchObject({
      ptAmount: 123,
      quotedUsdcOut: 120,
      blockNumber: '77',
      discountToRecordedDebt: null,
      marketLiquidityUsd: null,
      priceImpact: null
    })
    expect(rpc.multicall).toHaveBeenCalledWith(expect.objectContaining({ blockNumber: 77n }))
  })

  it('preserves a measured zero PT balance and does not fabricate a quote', async () => {
    rpc.multicall.mockResolvedValue([0n, 18, 1795737600n])
    expect((await fetchPendlePositionSnapshot('sUsdsPendle')).ptBalanceRaw).toBe('0')
    await expect(fetchPendlePositionLiquidity('sUsdsPendle')).rejects.toThrow('No PT balance')
    rpc.multicall.mockRejectedValue(new Error('RPC unavailable'))
    await expect(fetchPawnLooperRates()).rejects.toThrow('RPC unavailable')
  })
})
