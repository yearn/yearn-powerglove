import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchVaultTypeFeeHistories } from './useVaultTypeFeeHistories'

afterEach(() => vi.unstubAllGlobals())

describe('vault type history requests', () => {
  it('pins the dataset and chain, using clipped UTC period boundaries', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ datasetId: 'selected', vaults: [] }) })
    vi.stubGlobal('fetch', fetchMock)
    const signal = new AbortController().signal
    const result = await fetchVaultTypeFeeHistories(
      '/fees',
      'datasetId=selected&chainId=137&interval=weekly',
      [
        {
          period: '2025-09-29',
          startTimestamp: Date.parse('2025-10-01') / 1000,
          endTimestamp: Date.parse('2025-10-06') / 1000
        }
      ],
      signal
    )
    const [url, options] = fetchMock.mock.calls[0]
    const params = new URL(url, 'https://example.com').searchParams
    expect(params.get('datasetId')).toBe('selected')
    expect(params.get('chainId')).toBe('137')
    expect(params.get('since')).toBe(String(Date.parse('2025-10-01') / 1000))
    expect(params.get('until')).toBe(String(Date.parse('2025-10-06') / 1000))
    expect(params.has('interval')).toBe(false)
    expect(options.signal).toBe(signal)
    expect(result).toEqual([[]])
  })

  it('rejects partial or mismatched datasets rather than charting an incomplete breakdown', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ datasetId: 'other', vaults: [] }) })
    )
    await expect(
      fetchVaultTypeFeeHistories('', 'datasetId=selected', [{ period: '2026-01' }], new AbortController().signal)
    ).rejects.toThrow('selected dataset')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    await expect(
      fetchVaultTypeFeeHistories('', 'datasetId=selected', [{ period: '2026-01' }], new AbortController().signal)
    ).rejects.toThrow('request failed')
  })
})
