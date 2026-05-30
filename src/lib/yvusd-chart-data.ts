import { fillMissingDailyData, formatUnixTimestamp } from '@/lib/utils'
import type {
  aprApyChartData,
  ppsChartData,
  TimeseriesDataPoint,
  tvlChartData,
  yvUsdChartData
} from '@/types/dataTypes'

type TimestampRange = {
  earliest: number
  latest: number
}

const getTimeseriesRange = (...series: TimeseriesDataPoint[][]): TimestampRange | null => {
  const times = series.flatMap((points) => points.map((point) => Number(point.time))).filter(Number.isFinite)

  if (times.length === 0) {
    return null
  }

  return {
    earliest: Math.min(...times),
    latest: Math.max(...times)
  }
}

const getValueByDate = <T extends { date: string }>(series: T[]): Map<string, T> => {
  return new Map(series.map((point) => [point.date, point]))
}

export const transformPpsTimeseries = (ppsData: TimeseriesDataPoint[] | undefined): ppsChartData => {
  const range = getTimeseriesRange(ppsData ?? [])
  if (!range) {
    return []
  }

  return fillMissingDailyData(ppsData ?? [], range.earliest, range.latest).map((point) => ({
    date: formatUnixTimestamp(point.time),
    PPS: point.value ?? null,
    time: Number(point.time)
  }))
}

export const transformTvlTimeseries = (tvlData: TimeseriesDataPoint[] | undefined): tvlChartData => {
  const range = getTimeseriesRange(tvlData ?? [])
  if (!range) {
    return []
  }

  return fillMissingDailyData(tvlData ?? [], range.earliest, range.latest).map((point) => ({
    date: formatUnixTimestamp(point.time),
    TVL: point.value ?? null
  }))
}

export const buildUnderlyingLockedPpsSeries = (
  unlockedPpsData: ppsChartData | null,
  lockedPpsData: ppsChartData
): ppsChartData => {
  if (!unlockedPpsData || lockedPpsData.length === 0) {
    return []
  }

  const unlockedByDate = getValueByDate(unlockedPpsData)

  return lockedPpsData.map((lockedPoint) => {
    const unlockedPoint = unlockedByDate.get(lockedPoint.date)
    const lockedPps = lockedPoint.PPS
    const unlockedPps = unlockedPoint?.PPS

    return {
      date: lockedPoint.date,
      PPS: lockedPps !== null && unlockedPps !== null && unlockedPps !== undefined ? lockedPps * unlockedPps : null,
      time: lockedPoint.time
    }
  })
}

const findPreviousPpsPoint = (ppsData: ppsChartData, currentIndex: number, windowDays: number) => {
  const currentTime = ppsData[currentIndex]?.time
  if (!currentTime) {
    return null
  }

  const targetTime = currentTime - windowDays * 86400
  for (let index = currentIndex - 1; index >= 0; index--) {
    const candidate = ppsData[index]
    if (candidate?.time !== undefined && candidate.time <= targetTime) {
      return candidate
    }
  }

  return null
}

const calculateAnnualizedReturnPercent = (
  ppsData: ppsChartData,
  currentIndex: number,
  windowDays: number
): number | null => {
  const current = ppsData[currentIndex]
  const previous = findPreviousPpsPoint(ppsData, currentIndex, windowDays)

  if (!current?.time || !previous?.time || current.PPS === null || previous.PPS === null || previous.PPS <= 0) {
    return null
  }

  const elapsedDays = (current.time - previous.time) / 86400
  if (elapsedDays <= 0) {
    return null
  }

  const periodReturn = current.PPS / previous.PPS - 1
  return ((1 + periodReturn) ** (365 / elapsedDays) - 1) * 100
}

const calculateAnnualizedAprPercent = (
  ppsData: ppsChartData,
  currentIndex: number,
  windowDays: number
): number | null => {
  const current = ppsData[currentIndex]
  const previous = findPreviousPpsPoint(ppsData, currentIndex, windowDays)

  if (!current?.time || !previous?.time || current.PPS === null || previous.PPS === null || previous.PPS <= 0) {
    return null
  }

  const elapsedDays = (current.time - previous.time) / 86400
  if (elapsedDays <= 0) {
    return null
  }

  const periodReturn = current.PPS / previous.PPS - 1
  return periodReturn * (365 / elapsedDays) * 100
}

export const buildApyDataFromPpsSeries = (ppsData: ppsChartData): aprApyChartData => {
  return ppsData.map((point, index) => ({
    date: point.date,
    sevenDayApy: calculateAnnualizedReturnPercent(ppsData, index, 7),
    thirtyDayApy: calculateAnnualizedReturnPercent(ppsData, index, 30),
    derivedApr: calculateAnnualizedAprPercent(ppsData, index, 1),
    derivedApy: calculateAnnualizedReturnPercent(ppsData, index, 1)
  }))
}

export const mergeYvUsdApySeries = (
  unlockedApyData: aprApyChartData | null,
  lockedApyData: aprApyChartData
): yvUsdChartData => {
  if (!unlockedApyData) {
    return []
  }

  const lockedByDate = getValueByDate(lockedApyData)

  return unlockedApyData.map((unlockedPoint) => ({
    date: unlockedPoint.date,
    unlocked: unlockedPoint.oracleApy30dAvg ?? unlockedPoint.thirtyDayApy ?? unlockedPoint.derivedApy ?? null,
    locked: lockedByDate.get(unlockedPoint.date)?.thirtyDayApy ?? null
  }))
}

export const mergeYvUsdPpsSeries = (
  unlockedPpsData: ppsChartData | null,
  lockedUnderlyingPpsData: ppsChartData
): yvUsdChartData => {
  if (!unlockedPpsData) {
    return []
  }

  const lockedByDate = getValueByDate(lockedUnderlyingPpsData)

  return unlockedPpsData.map((unlockedPoint) => ({
    date: unlockedPoint.date,
    unlocked: unlockedPoint.PPS,
    locked: lockedByDate.get(unlockedPoint.date)?.PPS ?? null
  }))
}

export const mergeYvUsdTvlSeries = (
  unlockedTvlData: tvlChartData | null,
  lockedTvlData: tvlChartData
): yvUsdChartData => {
  if (!unlockedTvlData) {
    return []
  }

  const lockedByDate = getValueByDate(lockedTvlData)
  let latestLockedTvl: number | null = null

  return unlockedTvlData.map((unlockedPoint) => {
    const totalTvl = unlockedPoint.TVL
    const sampledLockedTvl = lockedByDate.get(unlockedPoint.date)?.TVL

    if (sampledLockedTvl !== null && sampledLockedTvl !== undefined) {
      const isLikelyBadZero = sampledLockedTvl === 0 && latestLockedTvl !== null && totalTvl !== null && totalTvl > 0
      if (isLikelyBadZero) {
        const carriedLockedTvl = latestLockedTvl ?? 0
        return {
          date: unlockedPoint.date,
          unlocked: Math.max(totalTvl - carriedLockedTvl, 0),
          locked: carriedLockedTvl
        }
      }

      latestLockedTvl = sampledLockedTvl
    }

    const lockedTvl = latestLockedTvl

    return {
      date: unlockedPoint.date,
      unlocked: totalTvl !== null ? Math.max(totalTvl - (lockedTvl ?? 0), 0) : null,
      locked: lockedTvl
    }
  })
}
