import { buildApyDataFromPpsSeries } from '@/lib/yvusd-chart-data'
import dataset from '@/mock-data/tranche-simulation.json'
import type { aprApyChartData, ppsChartData, tvlChartData } from '@/types/dataTypes'
import type { TrancheId } from './tranche-simulation'

export const trancheSimulation = dataset
export const lastSimulationPoint = dataset.points[dataset.points.length - 1]
export const SIMULATED_CHART_START = '2026-04-11'

export function getTrancheMockData(id: TrancheId) {
  const migrationTime = dataset.points[0].time
  const historical = dataset.source.history
  const underlyingByTime = new Map(historical.unlockedPps.map((point) => [point.time, Number(point.value)]))
  const lockedByTime = new Map(historical.lockedTvl.map((point) => [point.time, Number(point.value)]))
  const firstLockedTime = historical.lockedTvl[0].time
  const actualPps: ppsChartData =
    id === 'equity'
      ? []
      : (id === 'senior' ? historical.unlockedPps : historical.lockedPps)
          .filter((point) => point.time <= migrationTime)
          .map((point) => ({
            date: new Date(point.time * 1000).toISOString().slice(0, 10),
            time: point.time,
            // The original locker holds yvUSD; convert its share value into USD, as on the paired yvUSD charts.
            PPS:
              id === 'senior'
                ? Number(point.value)
                : underlyingByTime.has(point.time)
                  ? Number(point.value) * underlyingByTime.get(point.time)!
                  : null
          }))
  const anchor = id === 'equity' ? 1 : actualPps[actualPps.length - 1]?.PPS
  if (anchor == null) throw new Error('Missing migration share-price anchor')
  const ppsData: ppsChartData = [
    ...actualPps.filter((point) => point.time! < migrationTime),
    ...dataset.points.map((point) => ({
      date: point.date,
      time: point.time,
      PPS: point.tranches[id].pps * anchor
    }))
  ]
  const historicalTvl: tvlChartData =
    id === 'equity'
      ? []
      : (id === 'senior' ? historical.totalTvl : historical.lockedTvl)
          .filter((point) => point.time < migrationTime)
          .map((point) => {
            const locked = point.time < firstLockedTime ? 0 : lockedByTime.get(point.time)
            return {
              date: new Date(point.time * 1000).toISOString().slice(0, 10),
              TVL: id === 'junior' ? Number(point.value) : locked === undefined ? null : Number(point.value) - locked
            }
          })
  const tvlData: tvlChartData = [
    ...historicalTvl,
    ...dataset.points.map((point) => ({ date: point.date, TVL: point.tranches[id].nav }))
  ]
  // Recompute rolling windows across the switch using cash-flow-neutral, continuously linked share values.
  const aprApyData: aprApyChartData = buildApyDataFromPpsSeries(ppsData)
  // Preserve the original published Senior APYs before migration; the locker's USD returns use the existing paired-chart calculation.
  if (id === 'senior') {
    const published = new Map(
      historical.seniorApy.map((point) => [`${point.time}-${point.component}`, Number(point.value) * 100])
    )
    for (let index = 0; index < ppsData.length && ppsData[index].time! < migrationTime; index++) {
      const time = ppsData[index].time!
      aprApyData[index].sevenDayApy = published.get(`${time}-weeklyNet`) ?? null
      aprApyData[index].thirtyDayApy = published.get(`${time}-monthlyNet`) ?? null
    }
  }
  // Keep older observations for rolling calculations, then apply the display cutoff consistently.
  return {
    summary: lastSimulationPoint.tranches[id],
    aprApyData: aprApyData.filter((point) => point.date >= SIMULATED_CHART_START),
    tvlData: tvlData.filter((point) => point.date >= SIMULATED_CHART_START),
    ppsData: ppsData.filter((point) => point.date >= SIMULATED_CHART_START)
  }
}
