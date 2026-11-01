import { describe, expect, it } from 'vitest'
import source from '@/mock-data/tranche-source.json'
import { getTrancheMockData, SIMULATED_CHART_START, trancheSimulation } from './tranche-mock-data'

const migration = Date.parse(trancheSimulation.config.start) / 1000

describe('actual history joined to the simulated migration', () => {
  it.each(['senior', 'junior'] as const)('links %s share growth without a migration return or duplicate date', (id) => {
    const chart = getTrancheMockData(id)
    for (const series of [chart.ppsData, chart.tvlData, chart.aprApyData]) {
      expect(series[0].date).toBe(SIMULATED_CHART_START)
      expect(series.every((point) => point.date >= SIMULATED_CHART_START)).toBe(true)
    }
    expect(chart.ppsData[0].time).toBeLessThan(migration)
    expect(new Set(chart.ppsData.map((point) => point.date)).size).toBe(chart.ppsData.length)
    const atMigration = chart.ppsData.find((point) => point.time === migration)!
    const underlying = Number(source.pps[0].value)
    const locked = Number(source.history.lockedPps.find((point) => point.time === migration)!.value)
    expect(atMigration.PPS).toBeCloseTo(id === 'senior' ? underlying : underlying * locked, 12)
    const next = chart.aprApyData.find((point) => point.date === '2026-08-02')!
    expect(next.sevenDayApy).not.toBeNull()
    expect(next.thirtyDayApy).not.toBeNull()
  })

  it('uses real unlocked/locked TVL before the switch, then simulated TVL including cash flows', () => {
    const before = source.history.totalTvl.find((point) => point.time === migration - 86400)!
    const locked = source.history.lockedTvl.find((point) => point.time === before.time)!
    const senior = getTrancheMockData('senior')
    const junior = getTrancheMockData('junior')
    expect(senior.tvlData.find((point) => point.date === '2026-07-31')!.TVL).toBe(
      Number(before.value) - Number(locked.value)
    )
    expect(junior.tvlData.find((point) => point.date === '2026-07-31')!.TVL).toBe(Number(locked.value))
    expect(senior.tvlData.find((point) => point.date === '2026-08-01')!.TVL).toBe(trancheSimulation.initial.senior)
    expect(senior.tvlData[senior.tvlData.length - 1].TVL).toBe(senior.summary.nav)
    expect(junior.tvlData[junior.tvlData.length - 1].TVL).toBe(junior.summary.nav)
    expect(senior.summary.cumulativeNetFlowUsd).toBeGreaterThan(0)
  })

  it('preserves the original published Senior performance before migration', () => {
    const actual = source.history.seniorApy.find(
      (point) =>
        point.time >= Date.parse(SIMULATED_CHART_START) / 1000 &&
        point.time < migration &&
        point.component === 'monthlyNet'
    )!
    const date = new Date(actual.time * 1000).toISOString().slice(0, 10)
    expect(getTrancheMockData('senior').aprApyData.find((point) => point.date === date)!.thirtyDayApy).toBe(
      Number(actual.value) * 100
    )
  })
})
