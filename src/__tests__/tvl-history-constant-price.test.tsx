import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useFetch } from '@/components/landing/native-stats/hooks'
import { filterPartialHistoryRows, TvlHistoryTooltip } from '@/components/landing/native-stats/TvlOverview'
import {
  buildChainTvlHistoryUrl,
  buildConstantPriceTvlUrl,
  buildTvlHistoryUrl,
  getAvailableRowTotal,
  getPriceNeutralCoverageLabel,
  getTvlHistoryErrorMessage,
  getTvlHistoryRangeBounds,
  isPriceNeutralOverlayVisible,
  labelVersionHistoryChart,
  mergePriceNeutralTotal,
  PRICE_NEUTRAL_TOTAL_SERIES,
  selectConstantPriceChart,
  type TvlHistoryRange
} from '@/components/landing/native-stats/tvl-history'
import type { ConstantPriceTvlHistory } from '@/components/landing/native-stats/types'

const END_TIMESTAMP = 2_000_000_000
const ALL_TIME_START = 1_900_000_000

const constantPriceHistory: ConstantPriceTvlHistory = {
  runId: 42,
  createdAt: '2033-05-18 03:33:20',
  schemaVersion: 1,
  methodology: 'assetUnits × first valid price in the selected timeframe',
  mode: 'external',
  groupBy: 'chain',
  range: { from: ALL_TIME_START, to: END_TIMESTAMP },
  points: [
    { timestamp: 100, series: 'Ethereum', actualTvlUsd: 100, constantPriceTvlUsd: 90 },
    { timestamp: 200, series: 'Base', actualTvlUsd: 50, constantPriceTvlUsd: 55 }
  ],
  actualChart: [
    { timestamp: 100, Ethereum: 100 },
    { timestamp: 200, Base: 50 }
  ],
  constantPriceChart: [
    { timestamp: 100, Ethereum: 90 },
    { timestamp: 200, Base: 55 }
  ],
  references: [],
  meta: {
    rawPointCount: 2,
    valuedVaults: 2,
    skippedVaults: 1,
    depegCandidatesSkipped: 0,
    referenceWindowPoints: 7
  }
}

function ConstantPriceFetchHarness({ range }: { range: TvlHistoryRange }) {
  const bounds = getTvlHistoryRangeBounds(range, END_TIMESTAMP, ALL_TIME_START)
  const url = buildConstantPriceTvlUrl(bounds)
  useFetch<ConstantPriceTvlHistory>(url)
  return <output>{url}</output>
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('constant-price TVL history integration', () => {
  it('constructs a version-grouped history query', () => {
    expect(buildTvlHistoryUrl({ breakdown: 'category', mode: 'external', interval: 'weekly' })).toBe(
      '/api/tvl/history/runs/latest?groupBy=category&mode=external&interval=weekly'
    )
  })

  it('constructs the canonical endpoint query', () => {
    expect(buildConstantPriceTvlUrl({ from: 100, to: 200 })).toBe(
      '/api/tvl/history/runs/latest/constant-price?mode=external&groupBy=chain&interval=weekly&from=100&to=200'
    )
  })

  it('constructs chain-scoped vault and version queries', () => {
    const vaultUrl = buildChainTvlHistoryUrl({ breakdown: 'vault', chainId: 1, from: 100, to: 200 })
    const versionUrl = buildChainTvlHistoryUrl({ breakdown: 'category', chainId: 1, from: 100, to: 200 })

    expect(vaultUrl).toContain('groupBy=vault')
    expect(versionUrl).toContain('groupBy=category')
    expect(vaultUrl).toContain('includeCurrent=true')
    expect(versionUrl).toContain('includeCurrent=true')
  })

  it('refetches with a new reference window when the timeframe changes', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => constantPriceHistory
    } as Response)

    const { rerender } = render(<ConstantPriceFetchHarness range="365d" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(String(fetchMock.mock.calls[0][0])).toContain(`from=${END_TIMESTAMP - 365 * 86_400}`)

    rerender(<ConstantPriceFetchHarness range="all" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(String(fetchMock.mock.calls[1][0])).toContain(`from=${ALL_TIME_START}`)
  })

  it('selects actual and price-neutral response data without recalculating it', () => {
    expect(selectConstantPriceChart(constantPriceHistory, 'actual')).toBe(constantPriceHistory.actualChart)
    expect(selectConstantPriceChart(constantPriceHistory, 'constant-price')).toBe(
      constantPriceHistory.constantPriceChart
    )
  })

  it('labels version series for presentation without filling missing values', () => {
    expect(
      labelVersionHistoryChart(
        [
          { timestamp: 100, v2: 50 },
          { timestamp: 200, v3: 75, curation: 25 }
        ],
        ['v2', 'v3', 'curation']
      )
    ).toEqual({
      rows: [
        { timestamp: 100, V2: 50 },
        { timestamp: 200, V3: 75, Curation: 25 }
      ],
      series: ['V2', 'V3', 'Curation']
    })
  })

  it('overlays the price-neutral total on line charts only', () => {
    const rows = mergePriceNeutralTotal(constantPriceHistory.actualChart, constantPriceHistory.constantPriceChart, [
      'Ethereum',
      'Base'
    ])

    expect(rows).toEqual([
      { timestamp: 100, Ethereum: 100, [PRICE_NEUTRAL_TOTAL_SERIES]: 90 },
      { timestamp: 200, Base: 50, [PRICE_NEUTRAL_TOTAL_SERIES]: 55 }
    ])
    expect(isPriceNeutralOverlayVisible('line', true)).toBe(true)
    expect(isPriceNeutralOverlayVisible('bar', true)).toBe(false)
    expect(isPriceNeutralOverlayVisible('line', false)).toBe(false)
  })

  it('keeps missing series unavailable instead of converting them to zero', () => {
    const rows = selectConstantPriceChart(constantPriceHistory, 'constant-price')
    expect(rows[0]).not.toHaveProperty('Base')
    expect(getAvailableRowTotal(rows[0], ['Ethereum', 'Base'])).toBe(90)
    expect(getAvailableRowTotal({ timestamp: 300 }, ['Ethereum', 'Base'])).toBeNull()
  })

  it('removes incomplete snapshots after full history coverage begins', () => {
    expect(
      filterPartialHistoryRows(
        [
          { timestamp: 100, Alpha: 10 },
          { timestamp: 200, Alpha: 10, Beta: 20, Gamma: 30 },
          { timestamp: 201, Beta: 20 },
          { timestamp: 202, Gamma: 30 },
          { timestamp: 300, Alpha: 15, Beta: 25, Gamma: 35 }
        ],
        4
      )
    ).toEqual([
      { timestamp: 100, Alpha: 10 },
      { timestamp: 200, Alpha: 10, Beta: 20, Gamma: 30 },
      { timestamp: 300, Alpha: 15, Beta: 25, Gamma: 35 }
    ])
  })

  it('shows an explicit stacked tooltip total', () => {
    render(
      <TvlHistoryTooltip
        active
        label={100}
        payload={
          [
            { name: 'Ethereum', dataKey: 'Ethereum', value: 100, color: '#0657f9' },
            { name: 'Base', dataKey: 'Base', value: 50, color: '#46a2ff' },
            {
              name: PRICE_NEUTRAL_TOTAL_SERIES,
              dataKey: PRICE_NEUTRAL_TOTAL_SERIES,
              value: 140,
              color: '#6f83c7'
            }
          ] as never
        }
        canonicalTotalByTimestamp={{}}
        remainingSeries="All other chains"
        comparisonSeries={PRICE_NEUTRAL_TOTAL_SERIES}
      />
    )

    expect(screen.getByText('Actual TVL')).not.toBeNull()
    expect(screen.getByText(PRICE_NEUTRAL_TOTAL_SERIES)).not.toBeNull()
    expect(screen.getByTestId('tvl-history-tooltip-total').textContent).toContain('$150')
    expect(screen.getByTestId('tvl-history-tooltip-price-neutral').textContent).toContain('$140')
  })

  it('provides honest 409 and partial-coverage states', () => {
    expect(
      getTvlHistoryErrorMessage({
        isConstantPrice: true,
        status: 409,
        error: 'Conflict'
      })
    ).toContain('must be backfilled with raw asset quantities')
    expect(getPriceNeutralCoverageLabel(constantPriceHistory.meta)).toBe(
      'Coverage excludes 1 vault without a usable reference price; 2 valued.'
    )
    expect(getPriceNeutralCoverageLabel({ skippedVaults: 0, valuedVaults: 2 })).toBeNull()
    expect(getPriceNeutralCoverageLabel({})).toBeNull()
  })
})
