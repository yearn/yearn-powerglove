import { expect, it } from 'vitest'
import { buildTopSeriesChart, getStackRenderSeries } from './tvl-history'

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
