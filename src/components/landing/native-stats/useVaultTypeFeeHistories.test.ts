import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchVaultTypeFeeHistories } from './useVaultTypeFeeHistories'

afterEach(() => vi.unstubAllGlobals())

const january = { period: '2026-01', startTimestamp: 1767225600, endTimestamp: 1769904000 }
const february = { period: '2026-02', startTimestamp: 1769904000, endTimestamp: 1772323200 }
const response = (overrides = {}) => ({
  aggregationScope: 'contract',
  datasetId: 'selected',
  interval: 'monthly',
  dataCutoffTimestamp: february.endTimestamp,
  buckets: [
    { ...january, vaults: [] },
    { ...february, vaults: [] }
  ],
  ...overrides
})
function mockResponse(payload: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('vault type grouped history requests', () => {
  it('loads all periods in one request, pins product scope and preserves requested order', async () => {
    const vault = {
      address: '0xvault',
      chainId: 1,
      contractFamily: 'v3',
      lifetimeEarnings: { netYieldUsd: null },
      totalFeesPaidUsd: '0'
    }
    const fetchMock = mockResponse(
      response({
        aggregationScope: 'product',
        buckets: [
          { ...january, vaults: [vault] },
          { ...february, vaults: [] }
        ]
      })
    )
    const signal = new AbortController().signal
    const result = await fetchVaultTypeFeeHistories(
      '/fees',
      'datasetId=selected&chainId=137&scope=product',
      [february, january],
      signal
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(new URL(url, 'https://example.com').pathname).toBe('/fees/api/fees/vaults/history')
    const params = new URL(url, 'https://example.com').searchParams
    expect(Object.fromEntries(params)).toEqual({
      datasetId: 'selected',
      chainId: '137',
      scope: 'product',
      interval: 'monthly',
      since: String(january.startTimestamp),
      until: String(february.endTimestamp)
    })
    expect(options.signal).toBe(signal)
    expect(result).toEqual([[], [vault]])
  })

  it('retains clipped weekly boundaries', async () => {
    const period = {
      period: '2025-09-29',
      startTimestamp: Date.parse('2025-10-01') / 1000,
      endTimestamp: Date.parse('2025-10-06') / 1000
    }
    const fetchMock = mockResponse(
      response({
        interval: 'weekly',
        dataCutoffTimestamp: period.endTimestamp - 86400,
        buckets: [{ ...period, vaults: [] }]
      })
    )
    expect(
      await fetchVaultTypeFeeHistories('', 'datasetId=selected&interval=weekly', [period], new AbortController().signal)
    ).toEqual([[]])
    const params = new URL(fetchMock.mock.calls[0][0], 'https://example.com').searchParams
    expect(params.get('since')).toBe(String(period.startTimestamp))
    expect(params.get('until')).toBe(String(period.endTimestamp))
    expect(params.get('interval')).toBe('weekly')
  })

  it.each([
    ['missing cutoff', { dataCutoffTimestamp: undefined }],
    ['invalid cutoff', { dataCutoffTimestamp: Number.NaN }],
    ['wrong dataset', { datasetId: 'other' }],
    ['entirely unobserved period', { dataCutoffTimestamp: february.startTimestamp }],
    ['wrong interval', { interval: 'weekly' }],
    ['missing period', { buckets: [{ ...january, vaults: [] }] }],
    [
      'duplicate period',
      {
        buckets: [
          { ...january, vaults: [] },
          { ...january, vaults: [] },
          { ...february, vaults: [] }
        ]
      }
    ],
    [
      'wrong boundary',
      {
        buckets: [
          { ...january, startTimestamp: 0, vaults: [] },
          { ...february, vaults: [] }
        ]
      }
    ],
    ['missing vaults', { buckets: [january, { ...february, vaults: [] }] }],
    [
      'malformed vault',
      {
        buckets: [
          { ...january, vaults: [null] },
          { ...february, vaults: [] }
        ]
      }
    ],
    [
      'missing amounts',
      {
        buckets: [
          { ...january, vaults: [{ address: '0xvault', chainId: 1, contractFamily: 'v3', lifetimeEarnings: {} }] },
          { ...february, vaults: [] }
        ]
      }
    ],
    [
      'invalid amount',
      {
        buckets: [
          {
            ...january,
            vaults: [
              {
                address: '0xvault',
                chainId: 1,
                contractFamily: 'v3',
                totalFeesPaidUsd: 'NaN',
                lifetimeEarnings: { netYieldUsd: null }
              }
            ]
          },
          { ...february, vaults: [] }
        ]
      }
    ],
    ['malformed bucket', { buckets: [null] }]
  ])('rejects %s rather than charting incomplete data', async (_, overrides) => {
    mockResponse(response(overrides))
    await expect(
      fetchVaultTypeFeeHistories('', 'datasetId=selected', [january, february], new AbortController().signal)
    ).rejects.toThrow('selected dataset')
  })

  it('rejects wrong aggregation scope and transport failure', async () => {
    mockResponse(response({ aggregationScope: 'contract' }))
    await expect(
      fetchVaultTypeFeeHistories('', 'datasetId=selected&scope=product', [january], new AbortController().signal)
    ).rejects.toThrow('aggregation scope')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    await expect(
      fetchVaultTypeFeeHistories('', 'datasetId=selected', [january], new AbortController().signal)
    ).rejects.toThrow('request failed')
  })

  it('does not request an empty period selection', async () => {
    const fetchMock = mockResponse(response())
    expect(await fetchVaultTypeFeeHistories('', '', [], new AbortController().signal)).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
