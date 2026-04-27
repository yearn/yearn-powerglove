import { describe, expect, it } from 'vitest'
import {
  buildVaultActivityChartSeries,
  buildVaultLockedProfitChartSeries,
  buildVaultLockedSharesChartSeries,
  normalizeVaultActivityData
} from '@/lib/vault-activity'
import type { VaultActivityEvent } from '@/types/vaultActivityTypes'

describe('normalizeVaultActivityData', () => {
  it('preserves integer strings and only divides token amounts for display fields', () => {
    const data = normalizeVaultActivityData({
      schemaVersion: 1,
      generatedAt: '2026-04-26T00:00:00.000Z',
      chainId: 1,
      vaultAddress: '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD',
      currentUnlock: null,
      events: [
        {
          eventType: 'strategy_reported',
          txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
          blockNumber: 123,
          logIndex: 4,
          timestamp: '2026-04-20T09:30:00.000Z',
          gain: '123456789012345678901234567890',
          assetsDelta: '1234567',
          sharesDelta: '2000000000000000000'
        }
      ],
      meta: {
        assetDecimals: 6,
        shareDecimals: 18
      }
    })

    expect(data.vaultAddress).toBe('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')
    expect(data.events[0].gain).toBe('123456789012345678901234567890')
    expect(data.events[0].assetsDelta).toBe('1234567')
    expect(data.events[0].assetsDeltaDisplay).toBe(1.234567)
    expect(data.events[0].sharesDelta).toBe('2000000000000000000')
    expect(data.events[0].sharesDeltaDisplay).toBe(2)
  })

  it('normalizes timestamps to UTC seconds and ISO strings', () => {
    const data = normalizeVaultActivityData({
      schemaVersion: 1,
      generatedAt: 1777118400000,
      chainId: 1,
      vaultAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      currentUnlock: {
        updatedAt: '2026-04-25T12:00:00.000Z'
      },
      events: [
        {
          eventType: 'unlock_update',
          txHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
          blockNumber: 456,
          timestamp: 1776876300000
        }
      ]
    })

    expect(data.generatedAt).toBe('2026-04-25T12:00:00.000Z')
    expect(data.currentUnlock?.updatedAt).toBe(1777118400)
    expect(data.currentUnlock?.updatedAtIso).toBe('2026-04-25T12:00:00.000Z')
    expect(data.events[0].timestamp).toBe(1776876300)
    expect(data.events[0].timestampIso).toBe('2026-04-22T16:45:00.000Z')
  })

  it('allows missing unlock fields', () => {
    const data = normalizeVaultActivityData({
      schemaVersion: 1,
      generatedAt: '2026-04-26T00:00:00.000Z',
      chainId: 1,
      vaultAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      currentUnlock: {
        updatedAt: '2026-04-25T12:00:00.000Z'
      },
      events: []
    })

    expect(data.currentUnlock).toMatchObject({
      unlockedShares: null,
      profitUnlockingRate: null,
      unlockPercent: null,
      unlockRatePerDay: null
    })
  })

  it('normalizes v2 strategy report debt fields without losing integer precision', () => {
    const data = normalizeVaultActivityData({
      schemaVersion: 1,
      generatedAt: '2026-04-26T00:00:00.000Z',
      chainId: 1,
      vaultAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      currentUnlock: null,
      events: [
        {
          eventType: 'harvest',
          sourceEventType: 'V2StrategyReported',
          txHash: '0x3333333333333333333333333333333333333333333333333333333333333333',
          blockNumber: 789,
          timestamp: '2026-04-23T12:00:00.000Z',
          debtAdded: '250000000',
          debtPaid: '50000000',
          debtDelta: '200000000',
          totalDebt: '123456789012345678901234567890',
          totalGain: '75000000',
          totalLoss: '25000000',
          debtRatio: '8800'
        }
      ],
      meta: {
        assetDecimals: 6
      }
    })

    expect(data.events[0].debtAdded).toBe('250000000')
    expect(data.events[0].debtAddedDisplay).toBe(250)
    expect(data.events[0].debtPaidDisplay).toBe(50)
    expect(data.events[0].debtDeltaDisplay).toBe(200)
    expect(data.events[0].totalDebt).toBe('123456789012345678901234567890')
    expect(data.events[0].totalGainDisplay).toBe(75)
    expect(data.events[0].totalLossDisplay).toBe(25)
    expect(data.events[0].debtRatio).toBe('8800')
  })
})

describe('buildVaultActivityChartSeries', () => {
  it('renders v2 locked profit as linear decay with report-time jumps', () => {
    const events: VaultActivityEvent[] = [
      {
        id: 'harvest-1',
        eventType: 'harvest',
        sourceEventType: 'V2StrategyReported',
        chainId: 1,
        vaultAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        blockNumber: 1,
        timestamp: 100,
        timestampIso: '1970-01-01T00:01:40.000Z',
        label: 'Harvest reported',
        description: 'Harvest report',
        gain: '100',
        gainDisplay: 100,
        unlockPercent: 10,
        unlockRatePerDay: 2,
        fullProfitUnlockDate: 500,
        profitUnlockMode: 'v2_locked_profit'
      },
      {
        id: 'harvest-2',
        eventType: 'harvest',
        sourceEventType: 'V2StrategyReported',
        chainId: 1,
        vaultAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        txHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
        blockNumber: 2,
        timestamp: 300,
        timestampIso: '1970-01-01T00:05:00.000Z',
        label: 'Harvest reported',
        description: 'Harvest report',
        gain: '100',
        gainDisplay: 100,
        unlockPercent: 8,
        unlockRatePerDay: 3,
        fullProfitUnlockDate: 500,
        profitUnlockMode: 'v2_locked_profit'
      }
    ]

    const series = buildVaultActivityChartSeries({
      events,
      currentUnlock: null,
      series: []
    })

    expect(
      series.map((point) => ({
        timestamp: point.timestamp,
        harvestCount: point.harvestCount,
        unlockPercent: point.unlockPercent,
        unlockRatePerDay: point.unlockRatePerDay
      }))
    ).toEqual([
      { timestamp: 100, harvestCount: 1, unlockPercent: 10, unlockRatePerDay: 2 },
      { timestamp: 300, harvestCount: 0, unlockPercent: 5, unlockRatePerDay: 2 },
      { timestamp: 300, harvestCount: 1, unlockPercent: 8, unlockRatePerDay: 3 },
      { timestamp: 499, harvestCount: 0, unlockPercent: 0.04, unlockRatePerDay: 3 },
      { timestamp: 500, harvestCount: 0, unlockPercent: 0, unlockRatePerDay: 0 }
    ])
  })
})

describe('buildVaultLockedProfitChartSeries', () => {
  it('renders remaining locked profit as linear decay with report-time jumps', () => {
    const events: VaultActivityEvent[] = [
      {
        id: 'harvest-1',
        eventType: 'harvest',
        sourceEventType: 'StrategyReported',
        chainId: 1,
        vaultAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        blockNumber: 1,
        timestamp: 100,
        timestampIso: '1970-01-01T00:01:40.000Z',
        label: 'Harvest reported',
        description: 'Harvest report',
        gain: '100',
        gainDisplay: 100,
        lockedProfitPercent: 12,
        unlockRatePerDay: 2,
        fullProfitUnlockDate: 500,
        profitUnlockMode: 'v3_shares'
      },
      {
        id: 'harvest-2',
        eventType: 'harvest',
        sourceEventType: 'StrategyReported',
        chainId: 1,
        vaultAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        txHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
        blockNumber: 2,
        timestamp: 300,
        timestampIso: '1970-01-01T00:05:00.000Z',
        label: 'Harvest reported',
        description: 'Harvest report',
        gain: '100',
        gainDisplay: 100,
        lockedProfitPercent: 9,
        unlockRatePerDay: 3,
        fullProfitUnlockDate: 600,
        profitUnlockMode: 'v3_shares'
      }
    ]

    const series = buildVaultLockedProfitChartSeries({
      events,
      currentUnlock: null,
      series: []
    })

    expect(
      series.map((point) => ({
        timestamp: point.timestamp,
        harvestCount: point.harvestCount,
        lockedProfitPercent: point.lockedProfitPercent,
        unlockRatePerDay: point.unlockRatePerDay
      }))
    ).toEqual([
      { timestamp: 100, harvestCount: 1, lockedProfitPercent: 12, unlockRatePerDay: 2 },
      { timestamp: 300, harvestCount: 0, lockedProfitPercent: 6, unlockRatePerDay: 2 },
      { timestamp: 300, harvestCount: 1, lockedProfitPercent: 9, unlockRatePerDay: 3 },
      { timestamp: 599, harvestCount: 0, lockedProfitPercent: 0.03, unlockRatePerDay: 3 },
      { timestamp: 600, harvestCount: 0, lockedProfitPercent: 0, unlockRatePerDay: 0 }
    ])
  })
})

describe('buildVaultLockedSharesChartSeries', () => {
  it('renders remaining locked shares as linear decay with report-time jumps', () => {
    const events: VaultActivityEvent[] = [
      {
        id: 'harvest-1',
        eventType: 'harvest',
        sourceEventType: 'StrategyReported',
        chainId: 1,
        vaultAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        blockNumber: 1,
        timestamp: 100,
        timestampIso: '1970-01-01T00:01:40.000Z',
        label: 'Harvest reported',
        description: 'Harvest report',
        gain: '100',
        gainDisplay: 100,
        remainingLockedSharesDisplay: 12_000,
        fullProfitUnlockDate: 500,
        profitUnlockMode: 'v3_shares'
      },
      {
        id: 'harvest-2',
        eventType: 'harvest',
        sourceEventType: 'StrategyReported',
        chainId: 1,
        vaultAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        txHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
        blockNumber: 2,
        timestamp: 300,
        timestampIso: '1970-01-01T00:05:00.000Z',
        label: 'Harvest reported',
        description: 'Harvest report',
        gain: '100',
        gainDisplay: 100,
        remainingLockedSharesDisplay: 9_000,
        fullProfitUnlockDate: 600,
        profitUnlockMode: 'v3_shares'
      }
    ]

    const series = buildVaultLockedSharesChartSeries({
      events,
      currentUnlock: null,
      series: []
    })

    expect(
      series.map((point) => ({
        timestamp: point.timestamp,
        harvestCount: point.harvestCount,
        remainingLockedSharesDisplay: point.remainingLockedSharesDisplay
      }))
    ).toEqual([
      { timestamp: 100, harvestCount: 1, remainingLockedSharesDisplay: 12_000 },
      { timestamp: 300, harvestCount: 0, remainingLockedSharesDisplay: 6_000 },
      { timestamp: 300, harvestCount: 1, remainingLockedSharesDisplay: 9_000 },
      { timestamp: 599, harvestCount: 0, remainingLockedSharesDisplay: 30 },
      { timestamp: 600, harvestCount: 0, remainingLockedSharesDisplay: 0 }
    ])
  })
})
