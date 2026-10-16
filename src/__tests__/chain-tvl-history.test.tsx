import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { cloneElement, type ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChainTvlHistory } from '@/components/landing/native-stats/ChainTvlHistory'
import type { ConstantPriceTvlHistory } from '@/components/landing/native-stats/types'

vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>()
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: ReactElement<{ width: number; height: number }> }) =>
      cloneElement(children, { width: 900, height: 300 })
  }
})

const history: ConstantPriceTvlHistory = {
  runId: 42,
  createdAt: '2033-05-18 03:33:20',
  schemaVersion: 1,
  methodology: 'assetUnits × first valid price in the selected timeframe',
  mode: 'external',
  groupBy: 'vault',
  chainId: 1,
  range: { from: 1_900_000_000, to: 2_000_000_000 },
  points: [
    {
      timestamp: 1_900_000_000,
      series: 'Ethereum Vault',
      actualTvlUsd: 100,
      constantPriceTvlUsd: 90
    }
  ],
  actualChart: [{ timestamp: 1_900_000_000, 'Ethereum Vault': 100 }],
  constantPriceChart: [{ timestamp: 1_900_000_000, 'Ethereum Vault': 90 }],
  references: [],
  meta: {
    rawPointCount: 1,
    valuedVaults: 1,
    skippedVaults: 0,
    depegCandidatesSkipped: 0,
    referenceWindowPoints: 7
  }
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('chain TVL history drilldown', () => {
  it('pins native chain history across timeframe changes', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => history
    } as Response)
    render(
      <ChainTvlHistory
        chainId={1}
        chainLabel="Ethereum"
        datasetId="native-dataset"
        allTimeRange={{ from: 1_900_000_000, to: 2_000_000_000 }}
      />
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(String(fetchMock.mock.calls[0][0])).toContain('datasetId=native-dataset')
    fireEvent.click(screen.getByRole('button', { name: '1 Year' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(String(fetchMock.mock.calls[1][0])).toContain('datasetId=native-dataset')
  })

  it('fetches chain-scoped vault history and refetches when the timeframe changes', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => history
    } as Response)

    render(
      <ChainTvlHistory chainId={1} chainLabel="Ethereum" allTimeRange={{ from: 1_900_000_000, to: 2_000_000_000 }} />
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      '/api/tvl/history/runs/latest/constant-price?mode=external&groupBy=vault&interval=weekly&chainId=1&from=1900000000&to=2000000000&includeCurrent=true&format=chart&top=10'
    )
    expect(screen.getByText('Ethereum TVL History')).not.toBeNull()
    expect(screen.getByRole('tab', { name: 'Vaults' }).getAttribute('data-state')).toBe('active')
    expect(screen.getByRole('tab', { name: 'Version' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Price-neutral TVL' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '1 Year' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(String(fetchMock.mock.calls[1][0])).toContain(`from=${2_000_000_000 - 365 * 86_400}`)
  })

  it('keeps all server-selected vaults when the remainder is larger than individual vaults', async () => {
    const topSeries = [...Array.from({ length: 10 }, (_, i) => `Selected vault ${i + 1}`), 'All other vaults']
    const compactHistory: ConstantPriceTvlHistory = {
      ...history,
      points: [],
      actualChart: [
        {
          timestamp: 1_900_000_000,
          ...Object.fromEntries(topSeries.map((name, i) => [name, i === 10 ? 1000 : 10 - i]))
        }
      ],
      constantPriceChart: [{ timestamp: 1_900_000_000, 'Price-neutral TVL': 1055 }],
      meta: { ...history.meta, topSeries }
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => compactHistory
    } as Response)

    render(
      <ChainTvlHistory
        chainId={1}
        chainLabel="Ethereum"
        datasetId="compact-history"
        allTimeRange={{ from: 1_900_000_000, to: 2_000_000_000 }}
      />
    )

    await waitFor(() => expect(document.querySelectorAll('.recharts-bar')).toHaveLength(11))
  })

  it('switches a chain history from vaults to versions', async () => {
    const versionHistory: ConstantPriceTvlHistory = {
      ...history,
      groupBy: 'category',
      points: [{ timestamp: 1_900_000_000, series: 'v3', actualTvlUsd: 100, constantPriceTvlUsd: 90 }],
      actualChart: [{ timestamp: 1_900_000_000, v3: 100 }],
      constantPriceChart: [{ timestamp: 1_900_000_000, v3: 90 }]
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => versionHistory
    } as Response)

    render(
      <ChainTvlHistory chainId={10} chainLabel="Optimism" allTimeRange={{ from: 1_900_000_000, to: 2_000_000_000 }} />
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Version' }), { button: 0, ctrlKey: false })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(String(fetchMock.mock.calls[1][0])).toContain('groupBy=category')
    expect(screen.getByText('Vault versions on Optimism')).not.toBeNull()
    expect(screen.getByRole('tab', { name: 'Version' }).getAttribute('data-state')).toBe('active')
  })

  it('keeps price-neutral comparison on lines and removes it from bars', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => history
    } as Response)

    render(
      <ChainTvlHistory chainId={1} chainLabel="Ethereum" allTimeRange={{ from: 1_900_000_000, to: 2_000_000_000 }} />
    )

    await waitFor(() => expect(document.querySelector('[data-chain-history="Ethereum"]')).not.toBeNull())
    expect(screen.getByRole('button', { name: 'Show Ethereum TVL as bars' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('button', { name: '30D' })).toBeNull()
    expect(screen.queryByRole('button', { name: '90D' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show Ethereum TVL as lines' }))
    expect(document.querySelector('[data-price-neutral-overlay="true"]')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Show Ethereum TVL as bars' }))

    expect(screen.queryByRole('button', { name: 'Price-neutral TVL' })).toBeNull()
    expect(document.querySelector('[data-price-neutral-overlay="false"]')).not.toBeNull()
  })
})
