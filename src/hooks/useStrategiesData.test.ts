import { describe, expect, it } from 'vitest'
import {
  buildAllocationChartData,
  hasAllocatedDebt,
  resolveStrategyAllocationAmountUsd
} from '@/hooks/useStrategiesData'
import type { Strategy } from '@/types/dataTypes'

const makeStrategy = (overrides: Partial<Strategy> = {}): Strategy => ({
  id: 1,
  name: 'Alpha Strategy',
  allocationPercent: 40,
  allocationAmount: '$400',
  allocationAmountUsd: 400,
  estimatedAPY: '4.00%',
  estimatedApySource: 'graph',
  tokenSymbol: 'ETH',
  tokenIconUri: '',
  details: {
    chainId: 1,
    vaultAddress: '0x0000000000000000000000000000000000000001',
    managementFee: 0,
    performanceFee: 0,
    isVault: false
  },
  ...overrides
})

describe('hasAllocatedDebt', () => {
  it('treats funded non-active strategies as allocated', () => {
    expect(hasAllocatedDebt({ status: 'not_active', debtRatio: 2500 })).toBe(true)
    expect(hasAllocatedDebt({ status: 'unallocated', debtRatio: 100 })).toBe(true)
  })

  it('returns false when debt ratio is zero', () => {
    expect(hasAllocatedDebt({ status: 'active', debtRatio: 0 })).toBe(false)
  })
})

describe('resolveStrategyAllocationAmountUsd', () => {
  it('prefers total debt usd when available', () => {
    expect(resolveStrategyAllocationAmountUsd({ totalDebtUsd: 250, currentDebtUsd: 100 })).toBe(250)
  })

  it('falls back to current debt usd when total debt usd is missing', () => {
    expect(resolveStrategyAllocationAmountUsd({ totalDebtUsd: 0, currentDebtUsd: 75 })).toBe(75)
  })
})

describe('buildAllocationChartData', () => {
  it('omits the unallocated slice when the vault is fully allocated', () => {
    const chartData = buildAllocationChartData({
      chartStrategies: [
        makeStrategy({
          id: 1,
          name: 'Alpha',
          allocationPercent: 60,
          allocationAmount: '$600',
          allocationAmountUsd: 600
        }),
        makeStrategy({ id: 2, name: 'Beta', allocationPercent: 40, allocationAmount: '$400', allocationAmountUsd: 400 })
      ],
      vaultTvlUsd: 1000
    })

    expect(chartData).toEqual([
      {
        id: '1',
        name: 'Alpha',
        value: 60,
        amount: '$600'
      },
      {
        id: '2',
        name: 'Beta',
        value: 40,
        amount: '$400'
      }
    ])
  })

  it('adds an unallocated slice with the remaining percentage and usd amount', () => {
    const chartData = buildAllocationChartData({
      chartStrategies: [
        makeStrategy({
          id: 1,
          name: 'Alpha',
          allocationPercent: 35,
          allocationAmount: '$350',
          allocationAmountUsd: 350
        }),
        makeStrategy({ id: 2, name: 'Beta', allocationPercent: 25, allocationAmount: '$250', allocationAmountUsd: 250 })
      ],
      vaultTvlUsd: 1000
    })

    expect(chartData).toEqual([
      {
        id: '1',
        name: 'Alpha',
        value: 35,
        amount: '$350'
      },
      {
        id: '2',
        name: 'Beta',
        value: 25,
        amount: '$250'
      },
      {
        id: 'unallocated',
        name: 'Unallocated',
        value: 40,
        amount: '$400'
      }
    ])
  })

  it('builds an unallocated-only chart when no strategies are allocated', () => {
    const chartData = buildAllocationChartData({
      chartStrategies: [],
      vaultTvlUsd: 500
    })

    expect(chartData).toEqual([
      {
        id: 'unallocated',
        name: 'Unallocated',
        value: 100,
        amount: '$500'
      }
    ])
  })
})
