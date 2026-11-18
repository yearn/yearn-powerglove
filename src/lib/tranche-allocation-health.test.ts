import { describe, expect, it } from 'vitest'
import { allocationStatus, getTrancheAllocationHealth } from './tranche-allocation-health'

describe('allocation guideline assessment', () => {
  it('distinguishes limits, proximity, breaches, zero and unavailable inputs', () => {
    expect(allocationStatus(0.4, 0.15, 'min')).toBe('Within limit')
    expect(allocationStatus(0.16, 0.15, 'min')).toBe('Near limit')
    expect(allocationStatus(0.14, 0.15, 'min')).toBe('Breach')
    expect(allocationStatus(0.23, 0.25, 'max')).toBe('Near limit')
    expect(allocationStatus(0.26, 0.25, 'max')).toBe('Breach')
    expect(allocationStatus(0, 0.25, 'max')).toBe('Within limit')
    expect(allocationStatus(null, 0.25, 'max')).toBe('Needs data')
    expect(allocationStatus(0, null, 'min')).toBe('Needs data')
    expect(allocationStatus(Number.NaN, 0.25, 'max')).toBe('Needs data')
  })

  it('uses combined Junior and Equity capital from one simulation date', () => {
    const report = getTrancheAllocationHealth()
    expect(report.date).toBe('2026-11-01')
    expect(report.juniorCapital).toBeCloseTo(5428509.331781, 6)
    expect(report.checks.find((check) => check.rule === 8)?.value).toBeCloseTo(0.3741880438, 9)
    expect(report.checks.find((check) => check.rule === 1)?.limit).toBeCloseTo(1357127.332945, 5)
    expect(report.requiredYield).toBeCloseTo(0.049124724284, 10)
    expect(report.reliableYieldMin).toBeCloseTo(0.058949669141, 10)
    expect(report.checks.filter((check) => check.status !== 'Needs data')).toHaveLength(9)
    expect(report.riskGroups.map((group) => group.status)).toEqual([
      'Breach',
      'Within limit',
      'Near limit',
      'Within limit'
    ])
    expect(report.checks.find((check) => check.rule === 1)?.status).toBe('Needs data')
    expect(report.checks.find((check) => check.rule === 2)?.status).toBe('Breach')
    expect(report.checks.find((check) => check.rule === 6)?.status).toBe('Breach')
    expect(report.checks.find((check) => check.rule === 7)?.status).toBe('Within limit')
    expect(report.dependencies.find((dependency) => dependency.name === 'Morpho')!.headroom).toBeNull()
  })

  it('sums actual position debts once per dependency without rescaling to simulated TVL', () => {
    const report = getTrancheAllocationHealth()
    const pendle = report.dependencies.find((dependency) => dependency.name === 'Pendle')!
    expect(pendle.strategies).toHaveLength(2)
    expect(pendle.exposure).toBeCloseTo(994924.5993037318, 6)
    expect(pendle.loss).toBeNull()
    expect(pendle.lossRate).toBeNull()
    expect(pendle.exposureShare).toBeCloseTo(pendle.exposure / report.exposures.totalAllocationUsd, 12)
    expect(pendle.exposure).not.toBeCloseTo(pendle.exposureShare * report.tvl, 2)
    expect(
      report.exposures.strategies.reduce((sum, strategy) => sum + strategy.allocationUsd, report.exposures.idleUsd)
    ).toBeCloseTo(report.exposures.totalAllocationUsd, 6)
    for (const strategy of report.exposures.strategies) {
      expect(
        report.dependencies.some((dependency) =>
          dependency.strategies.some((item) => item.address === strategy.address)
        )
      ).toBe(true)
    }
  })

  it('keeps provisional Kong proxy inputs separate from the complete assessment', () => {
    const report = getTrancheAllocationHealth({
      '0x0e297de4005883c757c9f09fdf7cf1363c20e626': {
        score: 2,
        state: 'available',
        observedAt: '2026-11-04T00:00:00Z'
      }
    })
    const provisional = report.provisionalLoss.dependencies.find((dependency) => dependency.name === 'Morpho')!
    expect(provisional.lossRate).toBe(0.25)
    expect(provisional.baseLoss).toBeCloseTo(1771339.40644483, 6)
    expect(provisional.complete).toBe(false)
    expect(provisional.links[0].ratingObservedAt).toBe('2026-11-04T00:00:00Z')
    expect(report.dependencies.every((dependency) => dependency.lossRate === null && dependency.loss === null)).toBe(
      true
    )
    expect(report.checks.find((check) => check.rule === 1)?.status).toBe('Needs data')
  })

  it('does not assign a verdict to the conflicting locked-income policy while assessing illustrative liquidity', () => {
    const report = getTrancheAllocationHealth()
    const locked = report.checks.find((check) => check.rule === 5)!
    expect(locked.status).toBe('Needs data')
    expect(locked.limit).toBeNull()
    expect(locked.detail).toContain('25%')
    expect(locked.detail).toContain('50%')
    const cash = report.checks.find((check) => check.rule === 7)!
    expect(cash.value).toBe(3000000)
    expect(cash.limit).toBe(2650000)
    expect(report.cash24hFloor).toBeCloseTo(2232231.823652, 5)
  })
})
