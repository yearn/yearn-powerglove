import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import config from '@/mock-data/tranche-config.json'
import configText from '@/mock-data/tranche-config.json?raw'
import frozen from '@/mock-data/tranche-simulation.json'
import source from '@/mock-data/tranche-source.json'
import sourceText from '@/mock-data/tranche-source.json?raw'
import { simulateTranches, TRANCHE_IDS, type TrancheSimulationConfig } from './tranche-simulation'
import engineText from './tranche-simulation.ts?raw'

function scenario(prices: string[], targetBps = 0) {
  const start = Date.parse(config.start) / 1000
  const inputs = {
    ...source,
    totalTvl: { time: start, value: '100' },
    lockedTvl: { time: start, value: '30' },
    pps: prices.map((value, index) => ({ time: start + index * 86400, value }))
  }
  const parameters: TrancheSimulationConfig = {
    ...config,
    replayCashFlows: false,
    end: new Date((start + (prices.length - 1) * 86400) * 1000).toISOString(),
    seniorReallocationUsd: '15',
    juniorAdditionUsd: '5',
    equitySeedUsd: '10',
    targetBps: { senior: targetBps, junior: targetBps, equity: 0 }
  }
  return { inputs, parameters }
}

describe('tranche counterfactual accounting', () => {
  it('replays deposits and withdrawals without manufacturing investment returns', () => {
    const { inputs, parameters } = scenario(['1', '1', '1'])
    parameters.replayCashFlows = true
    const rows = (values: string[]) =>
      values.map((value, index) => ({ time: inputs.pps[index].time, value, component: 'test' }))
    inputs.history = {
      ...inputs.history,
      totalTvl: rows(['100', '110', '105']),
      lockedTvl: rows(['30', '30', '25']),
      unlockedPps: rows(['1', '1', '1']),
      lockedPps: rows(['1', '1', '1'])
    }
    const { points } = simulateTranches(inputs, parameters)
    expect(points[1].tranches.senior.nav).toBe(65)
    expect(points[1].tranches.senior.netFlowUsd).toBe(10)
    expect(points[2].tranches.junior.nav).toBe(30)
    expect(points[2].tranches.junior.netFlowUsd).toBe(-5)
    for (const point of points)
      for (const id of TRANCHE_IDS) {
        expect(point.tranches[id].pps).toBe(1)
        expect(point.tranches[id].earningsUsd).toBe(0)
        expect(point.tranches[id].cumulativeReturn).toBe(0)
      }
  })

  it('does not misclassify original locked-vault investment gains as deposits', () => {
    const { inputs, parameters } = scenario(['1', '1.1'])
    parameters.replayCashFlows = true
    const rows = (values: string[]) =>
      values.map((value, index) => ({ time: inputs.pps[index].time, value, component: 'test' }))
    inputs.history = {
      ...inputs.history,
      totalTvl: rows(['100', '113.3']),
      lockedTvl: rows(['30', '36.3']),
      unlockedPps: rows(['1', '1.1']),
      lockedPps: rows(['1', '1.1'])
    }
    const point = simulateTranches(inputs, parameters).points[1]
    // Unlocked grows 70 -> 77, locked grows 30 -> 36.3 (underlying and locker share growth).
    expect(point.tranches.senior.netFlowUsd).toBe(0)
    expect(point.tranches.junior.netFlowUsd).toBe(0)
    expect(point.poolNav).toBe(110)
  })

  it('allocates known excess 80/20 without moving Senior principal', () => {
    const { inputs, parameters } = scenario(['1', '1.1'])
    const { tranches } = simulateTranches(inputs, parameters).points[1]
    expect(tranches.senior.nav).toBe(55)
    expect(tranches.junior.nav).toBe(43)
    expect(tranches.equity.nav).toBe(12)
  })

  it('absorbs losses from Equity, then Junior, then Senior', () => {
    const expected = [
      { pps: '0.95', senior: 55, junior: 35, equity: 5 },
      { pps: '0.8', senior: 55, junior: 25, equity: 0 },
      { pps: '0.4', senior: 40, junior: 0, equity: 0 }
    ]
    for (const row of expected) {
      const { inputs, parameters } = scenario(['1', row.pps])
      const point = simulateTranches(inputs, parameters).points[1]
      for (const id of TRANCHE_IDS) expect(point.tranches[id].nav).toBe(row[id])
    }
  })

  it('pays targets from first-loss capital even when underlying return is zero', () => {
    const { inputs, parameters } = scenario(['1', '1'], 500)
    const point = simulateTranches(inputs, parameters).points[1]
    expect(point.tranches.senior.nav).toBeGreaterThan(55)
    expect(point.tranches.junior.nav).toBeGreaterThan(35)
    expect(point.tranches.equity.nav).toBeLessThan(10)
    expect(point.tranches.equity.accrualPaused).toBe(true)
    expect(TRANCHE_IDS.reduce((sum, id) => sum + BigInt(point.tranches[id].navUnits), 0n)).toBe(100_000_000n)
  })

  it('funds Senior targets from Junior principal when Equity is exhausted', () => {
    const { inputs, parameters } = scenario(['1', '0.9'], 500)
    const point = simulateTranches(inputs, parameters).points[1]
    expect(point.tranches.equity.nav).toBe(0)
    expect(point.tranches.senior.nav).toBeGreaterThan(55)
    expect(point.tranches.junior.nav).toBeLessThan(35)
    expect(point.tranches.junior.accrualPaused).toBe(true)
  })

  it('pauses targets after loss and resumes only after a profitable settlement', () => {
    const { inputs, parameters } = scenario(['1', '0.8', '0.85', '0.9'], 500)
    const { points } = simulateTranches(inputs, parameters)
    expect(points[1].tranches.junior.accrualPaused).toBe(true)
    expect(points[2].tranches.junior.targetAccruedUsd).toBe(0)
    expect(points[2].tranches.junior.accrualPaused).toBe(false)
    expect(points[3].tranches.junior.targetAccruedUsd).toBeGreaterThan(0)
  })

  it('rejects incomplete observations and capital-creating migration parameters', () => {
    const { inputs, parameters } = scenario(['1', '1.01', '1.02'])
    expect(() => simulateTranches({ ...inputs, pps: inputs.pps.slice(1) }, parameters)).toThrow('coverage')
    expect(() => simulateTranches({ ...inputs, totalTvl: { ...inputs.totalTvl, time: 0 } }, parameters)).toThrow(
      'exact'
    )
    expect(() => simulateTranches(inputs, { ...parameters, juniorAdditionUsd: '6' })).toThrow('preserve')
  })

  it('preserves capital, funding, and missing rolling-window semantics across the real replay', () => {
    expect(frozen.points).toHaveLength(93)
    expect(frozen.initial.senior + frozen.initial.junior + frozen.initial.equity).toBeCloseTo(9_059_598.527179, 6)
    expect(frozen.initial.senior).toBeCloseTo(5_073_726.803598, 6)
    expect(frozen.initial.junior).toBeCloseTo(3_735_871.723581, 6)
    for (const point of frozen.points) {
      const claims = TRANCHE_IDS.reduce((sum, id) => sum + BigInt(point.tranches[id].navUnits), 0n)
      expect(claims + BigInt(point.roundingResidualUnits)).toBe(BigInt(point.poolNavUnits))
      expect(BigInt(point.roundingResidualUnits)).toBeLessThanOrEqual(1n)
      for (const id of TRANCHE_IDS) expect(point.tranches[id].nav).toBeGreaterThanOrEqual(0)
    }
    expect(frozen.points[6].tranches.junior.sevenDayApy).toBeNull()
    expect(frozen.points[29].tranches.junior.thirtyDayApy).toBeNull()
    expect(frozen.points[30].tranches.junior.thirtyDayApy).not.toBeNull()
    const final = frozen.points[92]
    expect(final.tranches.senior.nav).toBeCloseTo(8_928_927.294609, 6)
    expect(final.tranches.junior.nav).toBeCloseTo(5_325_932.976733, 6)
    expect(final.tranches.equity.nav).toBeCloseTo(252_576.355048, 6)
  })

  it('reproduces the dataset exactly from the frozen inputs and verifies its input hash', () => {
    const inputSha256 = createHash('sha256').update(sourceText).update(configText).digest('hex')
    const engineSha256 = createHash('sha256').update(engineText).digest('hex')
    expect({ ...simulateTranches(source, config), engineSha256, inputSha256 }).toEqual(frozen)
  })
})
