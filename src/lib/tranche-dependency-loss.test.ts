import { describe, expect, it } from 'vitest'
import { dependencyPositionLoss, policyLossRate } from './tranche-dependency-loss'

describe('policy dependency loss', () => {
  it('derives every rate from the policy table and preserves unknown ratings', () => {
    expect([1, 2, 3, 4, 5].map(policyLossRate)).toEqual([0.1, 0.25, 0.5, 0.75, 1])
    for (const score of [null, 0, 6, 2.5, Number.NaN]) expect(policyLossRate(score)).toBeNull()
  })

  it('applies leverage, affected share and additive exit loss, capped at affected capital', () => {
    const position = { capital: 1000, score: 2, leverage: 2, weight: 0.5, exitDiscount: 0.05 }
    expect(dependencyPositionLoss(position)).toBe(300)
    expect(dependencyPositionLoss({ ...position, leverage: 8 })).toBe(500)
    expect(dependencyPositionLoss({ ...position, score: 5, exitDiscount: 0.2 })).toBe(500)
    expect(dependencyPositionLoss({ ...position, weight: 0 })).toBe(0)
    expect(dependencyPositionLoss({ ...position, capital: 0 })).toBe(0)
  })

  it('does not invent missing measurements or accept invalid inputs', () => {
    const position = { capital: 1000, score: 2, leverage: 1, weight: 1, exitDiscount: 0 }
    for (const field of ['score', 'leverage', 'weight', 'exitDiscount']) {
      expect(dependencyPositionLoss({ ...position, [field]: null })).toBeNull()
    }
    expect(dependencyPositionLoss({ ...position, leverage: Number.NaN })).toBeNull()
    expect(dependencyPositionLoss({ ...position, exitDiscount: -0.1 })).toBeNull()
    expect(dependencyPositionLoss({ ...position, weight: 1.1 })).toBeNull()
  })
})
