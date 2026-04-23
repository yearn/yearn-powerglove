const TIMEFRAME_LIMITS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '180d': 180,
  '1y': 365
}

export function getTimeframeLimit(timeframe: string): number {
  return TIMEFRAME_LIMITS[timeframe] ?? 1000
}

interface PpsPeriodPoint {
  PPS: number | null
  time?: number
}

export function calculatePpsPeriodApy(data: PpsPeriodPoint[], timeframe: string): number | null {
  const filteredData = data.slice(-getTimeframeLimit(timeframe))
  const validPoints = filteredData.filter(
    (point): point is { PPS: number; time: number } =>
      typeof point.PPS === 'number' && point.PPS > 0 && typeof point.time === 'number' && Number.isFinite(point.time)
  )

  if (validPoints.length < 2) {
    return null
  }

  const firstPoint = validPoints[0]
  const lastPoint = validPoints[validPoints.length - 1]
  const elapsedDays = (lastPoint.time - firstPoint.time) / 86400

  if (elapsedDays <= 0) {
    return null
  }

  return ((lastPoint.PPS / firstPoint.PPS) ** (365 / elapsedDays) - 1) * 100
}
