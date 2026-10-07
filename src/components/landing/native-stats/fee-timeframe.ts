import type { ChartDateRange } from '@/components/charts/chart-utils'
import type { FeeHistoryInterval } from './canonical-fees'
import { utcMonthStartTimestamp } from './fee-history'

export function defaultFeeTimeRange(now: number): ChartDateRange {
  const end = new Date(now * 1000)
  end.setUTCHours(0, 0, 0, 0)
  // End on the Sunday of the latest completed Monday-to-Monday UTC week.
  end.setUTCDate(end.getUTCDate() - ((end.getUTCDay() + 6) % 7) - 1)
  const start = new Date(end)
  start.setUTCFullYear(start.getUTCFullYear() - 4)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

export function resolveFeeTimeframe(timeframe: '1y' | 'all' | ChartDateRange, now: number) {
  const currentMonthStart = utcMonthStartTimestamp(now)
  if (typeof timeframe !== 'string') {
    const since = Date.parse(`${timeframe.start}T00:00:00Z`) / 1000
    // The calendar includes the end date; the API's until is exclusive.
    const until = Date.parse(`${timeframe.end}T00:00:00Z`) / 1000 + 86400
    return { since, until, interval: (until - since <= 366 * 86400 ? 'weekly' : 'monthly') as FeeHistoryInterval }
  }
  return {
    since: timeframe === '1y' ? utcMonthStartTimestamp(currentMonthStart, -12) : undefined,
    until: currentMonthStart,
    interval: (timeframe === '1y' ? 'weekly' : 'monthly') as FeeHistoryInterval
  }
}
