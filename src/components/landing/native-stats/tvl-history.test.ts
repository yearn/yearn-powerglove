import { expect, it } from 'vitest'
import { buildChainTvlHistoryUrl, buildTopSeriesChart, getStackRenderSeries } from './tvl-history'

it('keeps known zero in the remaining bucket and leaves missing values unavailable', () => {
  const chart = buildTopSeriesChart(
    [
      { timestamp: 1, Leading: 100, Other: 0 },
      { timestamp: 2, Leading: 200 }
    ],
    ['Leading', 'Other'],
    'Remaining',
    1
  )
  expect(chart.rows).toEqual([
    { timestamp: 1, Leading: 100, Remaining: 0 },
    { timestamp: 2, Leading: 200 }
  ])
  expect(getStackRenderSeries(chart.series, 'Remaining')).toEqual(['Leading', 'Remaining'])
})

it('requests compact top vaults ranked by the selected TVL metric', () => {
  const input = { breakdown: 'vault' as const, chainId: 1, from: 100, to: 200 }
  const actual = new URL(buildChainTvlHistoryUrl(input), 'http://localhost')
  const adjusted = new URL(buildChainTvlHistoryUrl({ ...input, priceAdjusted: true }), 'http://localhost')
  expect(actual.searchParams.get('format')).toBe('chart')
  expect(actual.searchParams.get('top')).toBe('10')
  expect(actual.searchParams.has('topMetric')).toBe(false)
  expect(adjusted.searchParams.get('format')).toBe('chart')
  expect(adjusted.searchParams.get('top')).toBe('10')
  expect(adjusted.searchParams.get('topMetric')).toBe('constant-price')
  expect(adjusted.searchParams.get('chainId')).toBe('1')
  expect(adjusted.searchParams.get('from')).toBe('100')
  expect(adjusted.searchParams.get('to')).toBe('200')
  const version = new URL(
    buildChainTvlHistoryUrl({ ...input, breakdown: 'category', priceAdjusted: true }),
    'http://localhost'
  )
  expect(version.searchParams.get('format')).toBe('chart')
  expect(version.searchParams.has('top')).toBe(false)
  expect(version.searchParams.has('topMetric')).toBe(false)
})
