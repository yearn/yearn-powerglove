import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { type ComponentProps, cloneElement, type ReactElement, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StatsContext } from './StatsContext'
import { TvlOverview } from './TvlOverview'

vi.mock('recharts', async (original) => {
  const actual = await original<typeof import('recharts')>()
  return {
    ...actual,
    ComposedChart: (props: ComponentProps<typeof actual.ComposedChart>) => {
      capturedChartRows = props.data
      return <actual.ComposedChart {...props} />
    },
    ResponsiveContainer: ({ children }: { children: ReactElement<{ width: number; height: number }> }) =>
      cloneElement(children, { width: 640, height: 300 })
  }
})
vi.mock('./ChainTvlHistory', () => ({
  ChainTvlHistory: ({
    selectedRange,
    renderType
  }: {
    selectedRange: { from: number; to: number }
    renderType: string
  }) => <output data-testid="drilldown" data-range={JSON.stringify(selectedRange)} data-type={renderType} />
}))
vi.mock('./hooks', async (original) => ({
  ...(await original<typeof import('./hooks')>()),
  useFetch: (url: string) => {
    urls.push(url)
    const params = new URLSearchParams(url.split('?')[1])
    const scoped = params.has('chainId')
    const chartRows = legacyPricingGaps ? gapRows : rows
    const data =
      url.split('?')[0] === '/api/tvl'
        ? legacyPricingGaps
          ? { ...summary, datasetId: undefined, totalTvl: 300 }
          : summary
        : url.includes('constant-price')
          ? { actualChart: chartRows, constantPriceChart: chartRows, meta: {}, range: history.range }
          : {
              ...history,
              mode: legacyPricingGaps ? 'raw' : history.mode,
              series: scoped
                ? ['Ethereum']
                : legacyPricingGaps
                  ? ['Ethereum', 'Base', 'Gamma', 'Delta']
                  : history.series,
              chart: scoped ? chartRows.map(({ timestamp, Ethereum }) => ({ timestamp, Ethereum })) : chartRows
            }
    return {
      data,
      loading: false,
      error: failEthereum && url === '/api/tvl?chainId=1' ? 'Summary unavailable' : null,
      fetchedAt: null,
      retry: vi.fn()
    }
  }
}))
const timestamp = (date: string) => Date.parse(`${date}T00:00:00Z`) / 1000
const rows = ['2023-01-01', '2024-01-01', '2026-01-01'].map((date) => ({
  timestamp: timestamp(date),
  Ethereum: 100,
  Base: 50
}))
const history = {
  id: 1,
  groupBy: 'chain',
  mode: 'external',
  interval: 'weekly',
  points: [],
  chart: rows,
  series: ['Ethereum', 'Base'],
  meta: {},
  pointCount: 3,
  range: { from: rows[0].timestamp, to: rows[2].timestamp }
}
const summary = {
  datasetId: 'selected',
  totalTvl: 150,
  tvlByChain: { Ethereum: 100, Base: 50 },
  vaultCount: { active: 2 }
}
let urls: string[] = []
const gapRows = [
  { timestamp: timestamp('2023-01-01'), Ethereum: 100 },
  { timestamp: timestamp('2024-01-01'), Ethereum: 100, Base: 50, Gamma: 10, Delta: 20 },
  { timestamp: timestamp('2025-01-01'), Base: 75 },
  { timestamp: timestamp('2026-01-01'), Ethereum: 90, Base: 50 }
]
let failEthereum = false
let legacyPricingGaps = false
let capturedChartRows: unknown
function Overview() {
  const [chainFilter, setChainFilter] = useState('all')
  return (
    <StatsContext.Provider
      value={{ chainFilter, density: 'comfortable', lastFetchedAt: null, setLastFetchedAt: vi.fn() }}
    >
      <TvlOverview
        chainSelector={
          <select aria-label="Chain" value={chainFilter} onChange={(event) => setChainFilter(event.target.value)}>
            <option value="all">All Chains</option>
            <option value="1">Ethereum</option>
          </select>
        }
      />
    </StatsContext.Provider>
  )
}
afterEach(() => {
  cleanup()
  urls = []
  failEthereum = false
  legacyPricingGaps = false
  capturedChartRows = undefined
})

describe('shared TVL chart controls', () => {
  it('renders API amounts and sparse dates without headline scaling or invented zero TVL', () => {
    legacyPricingGaps = true
    render(<Overview />)
    expect(capturedChartRows).toEqual([
      { ...gapRows[0], 'Total TVL': 100 },
      { ...gapRows[1], 'Total TVL': 180 },
      { ...gapRows[2], 'Total TVL': 75 },
      { ...gapRows[3], 'Total TVL': 140 }
    ])
  })

  it('filters selected dates locally while preserving the full timeline and pinned history', () => {
    const { container } = render(<Overview />)
    const start = screen.getByRole('slider', { name: 'Range start' })
    const end = screen.getByRole('slider', { name: 'Range end' })
    const axisMax = end.getAttribute('aria-valuemax')
    expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(6)
    start.focus()
    fireEvent.keyDown(start, { key: 'ArrowRight' })
    expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(4)
    expect(end.getAttribute('aria-valuemax')).toBe(axisMax)
    expect(screen.queryByRole('button', { name: '1 Year' })).toBeNull()
    for (const url of urls.filter((url) => url.includes('/history/'))) {
      expect(url).toContain('datasetId=selected')
      if (!url.includes('constant-price')) expect(url).not.toContain('from=')
    }
    fireEvent.click(screen.getByRole('button', { name: 'Collapse chart controls' }))
    expect(screen.queryByRole('slider')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Expand chart controls' }))
    expect(screen.getByRole('slider', { name: 'Range start' })).toBe(start)
  })

  it('applies the shared render type and range to drilldowns and scopes actual and price-neutral history by chain', () => {
    const { container } = render(<Overview />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Chain' }), { target: { value: '1' } })
    expect(container.querySelectorAll('.recharts-bar')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Show TVL as lines' }))
    fireEvent.click(screen.getByRole('button', { name: /Ethereum/ }))
    expect(screen.getByTestId('drilldown').getAttribute('data-type')).toBe('line')
    const start = screen.getByRole('slider', { name: 'Range start' })
    start.focus()
    fireEvent.keyDown(start, { key: 'ArrowRight' })
    expect(JSON.parse(screen.getByTestId('drilldown').getAttribute('data-range') ?? '{}')).toEqual({
      from: timestamp('2023-01-02'),
      to: timestamp('2026-01-02') - 1
    })
    const requests = urls.filter((url) => url.includes('/history/') && url.includes('chainId=1'))
    expect(
      requests.some((url) => url.includes('constant-price') && url.includes(`from=${timestamp('2023-01-02')}`))
    ).toBe(true)
    expect(requests.some((url) => !url.includes('constant-price'))).toBe(true)
    expect(requests.every((url) => url.includes('datasetId=selected'))).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Show TVL as bars' }))
    expect(screen.getByTestId('drilldown').getAttribute('data-type')).toBe('bar')
  })
  it('keeps the chain controls available to recover from a failed summary', () => {
    failEthereum = true
    render(<Overview />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Chain' }), { target: { value: '1' } })
    expect(screen.getByText('Error: Summary unavailable')).toBeTruthy()
    fireEvent.change(screen.getByRole('combobox', { name: 'Chain' }), { target: { value: 'all' } })
    expect(screen.queryByText('Error: Summary unavailable')).toBeNull()
    expect(screen.getByRole('heading', { name: 'TVL History' })).toBeTruthy()
  })
})
