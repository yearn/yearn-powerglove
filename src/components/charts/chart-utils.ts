import { format, isValid, parse, parseISO } from 'date-fns'

export type ChartDateRange = { start: string; end: string }
export type ChartTimeframe = string | ChartDateRange

// Chart labels use either ISO dates or the app's "MMM d, yyyy" format.
export function getChartDate(date: string): string | null {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? parseISO(date) : parse(date, 'MMM d, yyyy', new Date())
  return isValid(parsed) ? format(parsed, 'yyyy-MM-dd') : null
}

export function filterChartTimeframe<T extends { date: string }>(data: T[], timeframe: ChartTimeframe): T[] {
  if (typeof timeframe === 'string') return data.slice(-getTimeframeLimit(timeframe))

  return data.filter((point) => {
    const date = getChartDate(point.date)
    return date !== null && date >= timeframe.start && date <= timeframe.end
  })
}

const TIMEFRAME_LIMITS: Record<string, number> = {
  '7d': 8,
  '30d': 31,
  '90d': 91,
  '180d': 181,
  '1y': 366,
  all: Number.MAX_SAFE_INTEGER
}

export function getTimeframeLimit(timeframe: string): number {
  return TIMEFRAME_LIMITS[timeframe] ?? 1000
}

interface PpsPeriodPoint {
  date: string
  PPS: number | null
  time?: number
}

export const PPS_HISTORICAL_APY_PERIODS = [
  { key: 'pps90DayApy', timeframe: '90d', days: 90 },
  { key: 'pps180DayApy', timeframe: '180d', days: 180 },
  { key: 'ppsOneYearApy', timeframe: '1y', days: 365 },
  { key: 'ppsAllTimeApy', timeframe: 'all', days: null }
] as const

export type PpsHistoricalApyKey = (typeof PPS_HISTORICAL_APY_PERIODS)[number]['key']
export type PpsHistoricalApyValues = Record<PpsHistoricalApyKey, number | null>
export type PpsHistoricalApyPoint = { date: string } & PpsHistoricalApyValues

const EMPTY_HISTORICAL_APYS: PpsHistoricalApyValues = {
  pps90DayApy: null,
  pps180DayApy: null,
  ppsOneYearApy: null,
  ppsAllTimeApy: null
}

const annualizePpsReturn = (
  firstPoint: { PPS: number; time: number },
  lastPoint: { PPS: number; time: number }
): number | null => {
  const elapsedDays = (lastPoint.time - firstPoint.time) / 86400

  if (elapsedDays <= 0) {
    return null
  }

  return ((lastPoint.PPS / firstPoint.PPS) ** (365 / elapsedDays) - 1) * 100
}

export function calculatePpsHistoricalApySeries(data: PpsPeriodPoint[]): PpsHistoricalApyPoint[] {
  const validPoints = data
    .filter(
      (point): point is { date: string; PPS: number; time: number } =>
        typeof point.PPS === 'number' && point.PPS > 0 && typeof point.time === 'number' && Number.isFinite(point.time)
    )
    .sort((a, b) => a.time - b.time)

  const series: PpsHistoricalApyPoint[] = validPoints.map((point, index) => ({
    date: point.date,
    ...EMPTY_HISTORICAL_APYS,
    ppsAllTimeApy: index === 0 ? null : annualizePpsReturn(validPoints[0], point)
  }))

  for (const period of PPS_HISTORICAL_APY_PERIODS) {
    if (period.days === null) continue

    let startIndex = 0
    for (let endIndex = 0; endIndex < validPoints.length; endIndex++) {
      const endPoint = validPoints[endIndex]
      const targetTime = endPoint.time - period.days * 86400

      while (startIndex + 1 < endIndex && validPoints[startIndex + 1].time <= targetTime) {
        startIndex++
      }

      if (validPoints[startIndex].time <= targetTime) {
        series[endIndex][period.key] = annualizePpsReturn(validPoints[startIndex], endPoint)
      }
    }
  }

  return series
}
