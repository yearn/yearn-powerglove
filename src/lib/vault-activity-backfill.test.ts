import { describe, expect, it } from 'vitest'
import {
  annotateDebtReallocationEvents,
  calculateUnlockStateFromRaw,
  getVaultActivityOutputPath,
  mapDebtUpdatedEventToActivity,
  mapStrategyReportedEventToActivity,
  mapV2DebtRatioEventToActivity,
  mapV2StrategyReportedEventToActivity
} from '@/lib/vault-activity-backfill'

const baseLog = {
  chainId: 1,
  vaultAddress: '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD',
  transactionHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
  blockNumber: 123,
  logIndex: 7,
  timestamp: 1776520800
}

describe('vault activity backfill helpers', () => {
  it('builds the public fixture output path', () => {
    expect(getVaultActivityOutputPath(1, '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD')).toBe(
      'public/data/vault-activity/1/0xabcdefabcdefabcdefabcdefabcdefabcdefabcd.json'
    )
  })

  it('maps StrategyReported logs into normalized activity rows', () => {
    const event = mapStrategyReportedEventToActivity(
      {
        ...baseLog,
        args: {
          strategy: '0x2222222222222222222222222222222222222222',
          gain: '1234567',
          loss: '0',
          current_debt: '5000000'
        }
      },
      {
        assetDecimals: 6,
        strategyNamesByAddress: {
          '0x2222222222222222222222222222222222222222': 'Strategy Two'
        }
      }
    )

    expect(event.eventType).toBe('harvest')
    expect(event.strategyName).toBe('Strategy Two')
    expect(event.gain).toBe('1234567')
    expect(event.gainDisplay).toBe(1.234567)
    expect(event.timestampIso).toBe('2026-04-18T14:00:00.000Z')
  })

  it('maps v2 StrategyReported logs with harvest debt movement', () => {
    const event = mapV2StrategyReportedEventToActivity(
      {
        ...baseLog,
        args: {
          strategy: '0x5555555555555555555555555555555555555555',
          gain: '2100000000000000000000',
          loss: '0',
          debtPaid: '500000000000000000000',
          totalGain: '42000000000000000000000',
          totalLoss: '0',
          totalDebt: '1445000000000000000000000',
          debtAdded: '1500000000000000000000',
          debtRatio: '8800'
        }
      },
      {
        assetDecimals: 18,
        strategyNamesByAddress: {
          '0x5555555555555555555555555555555555555555': 'Factory Strategy'
        }
      }
    )

    expect(event.eventType).toBe('harvest')
    expect(event.sourceEventType).toBe('V2StrategyReported')
    expect(event.strategyName).toBe('Factory Strategy')
    expect(event.gainDisplay).toBe(2100)
    expect(event.debtAddedDisplay).toBe(1500)
    expect(event.debtPaidDisplay).toBe(500)
    expect(event.debtDelta).toBe('1000000000000000000000')
    expect(event.debtDeltaDisplay).toBe(1000)
    expect(event.totalDebtDisplay).toBe(1445000)
    expect(event.debtRatio).toBe('8800')
    expect(event.reallocation).toEqual({
      direction: 'increase',
      pairedTransaction: false
    })
  })

  it('maps v2 debt ratio changes as allocation updates', () => {
    const event = mapV2DebtRatioEventToActivity(
      {
        ...baseLog,
        args: {
          strategy: '0x5555555555555555555555555555555555555555',
          debtRatio: '1200'
        }
      },
      'V2StrategyUpdateDebtRatio'
    )

    expect(event.eventType).toBe('debt_update')
    expect(event.sourceEventType).toBe('V2StrategyUpdateDebtRatio')
    expect(event.debtRatio).toBe('1200')
    expect(event.label).toBe('Strategy debt ratio updated')
  })

  it('calculates unlock state from raw reads', () => {
    const state = calculateUnlockStateFromRaw(
      {
        unlockedShares: '25000000000000000000',
        lockedShares: '100000000000000000000',
        totalSupply: '100000000000000000000',
        profitUnlockingRate: '1000000000000000000000000',
        profitMaxUnlockTime: '604800',
        fullProfitUnlockDate: '1777550400',
        totalAssets: '125000000',
        pricePerShare: '1050000'
      },
      {
        chainId: 1,
        vaultAddress: '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD',
        blockNumber: 123,
        timestamp: 1777118400,
        assetDecimals: 6,
        shareDecimals: 18
      }
    )

    expect(state.unlockedShares).toBe('25000000000000000000')
    expect(state.unlockedSharesDisplay).toBe(25)
    expect(state.lockedShares).toBe('100000000000000000000')
    expect(state.lockedSharesDisplay).toBe(100)
    expect(state.remainingLockedShares).toBe('75000000000000000000')
    expect(state.remainingLockedSharesDisplay).toBe(75)
    expect(state.totalAssetsDisplay).toBe(125)
    expect(state.pricePerShareDisplay).toBe(0.00000000000105)
    expect(state.unlockPercent).toBe(25)
    expect(state.lockedProfitPercent).toBe(75)
    expect(state.unlockRatePerDay).toBe(0.0864)
    expect(state.estimatedDaysToUnlock).toBe(5)
    expect(state.profitUnlockMode).toBe('v3_shares')
  })

  it('calculates v2 locked profit unlock state from raw reads', () => {
    const state = calculateUnlockStateFromRaw(
      {
        lockedProfit: '1000000000000000000000',
        lockedProfitDegradation: '23148148148148',
        lastReport: '1777118400',
        totalAssets: '100000000000000000000000',
        totalSupply: '100000000000000000000000',
        pricePerShare: '1000000000000000000'
      },
      {
        chainId: 1,
        vaultAddress: '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD',
        blockNumber: 123,
        timestamp: 1777136400,
        assetDecimals: 18,
        shareDecimals: 18
      }
    )

    expect(state.profitUnlockMode).toBe('v2_locked_profit')
    expect(state.lockedProfit).toBe('583333333333336000000')
    expect(state.lockedProfitDisplay).toBeCloseTo(583.333333)
    expect(state.lockedProfitPercent).toBeCloseTo(0.583333)
    expect(state.unlockPercent).toBeCloseTo(0.583333)
    expect(state.fullProfitUnlockDateIso).toBe('2026-04-26T00:00:01.000Z')
    expect(state.estimatedDaysToUnlock).toBeCloseTo(0.291678)
  })

  it('annotates paired debt updates as reallocations', () => {
    const decrease = mapDebtUpdatedEventToActivity({
      ...baseLog,
      logIndex: 1,
      args: {
        strategy: '0x3333333333333333333333333333333333333333',
        current_debt: '3000000',
        new_debt: '1000000'
      }
    })
    const increase = mapDebtUpdatedEventToActivity({
      ...baseLog,
      logIndex: 2,
      args: {
        strategy: '0x4444444444444444444444444444444444444444',
        current_debt: '1000000',
        new_debt: '3000000'
      }
    })

    const [annotatedDecrease, annotatedIncrease] = annotateDebtReallocationEvents([decrease, increase])

    expect(annotatedDecrease.reallocation).toEqual({
      direction: 'decrease',
      pairedTransaction: true
    })
    expect(annotatedIncrease.reallocation).toEqual({
      direction: 'increase',
      pairedTransaction: true
    })
    expect(annotatedDecrease.label).toBe('Debt reallocated')
  })
})
