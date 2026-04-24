import { describe, expect, it } from 'vitest'
import { getKongNormalizedScalarValue } from './KongDataTab'

const context = {
  assetDecimals: 18,
  assetSymbol: 'TEST',
  blockExplorerBaseUrl: 'https://etherscan.io',
  chainId: 1,
  strategyNameByAddress: {},
  vaultDecimals: 18,
  vaultSymbol: 'yvTEST'
}

describe('getKongNormalizedScalarValue', () => {
  it('normalizes base-unit asset values while preserving the raw value', () => {
    expect(
      getKongNormalizedScalarValue({
        path: ['totalAssets'],
        value: '100000000000000000000',
        context
      })
    ).toEqual({
      value: '100 TEST | 100000000000000000000'
    })
  })

  it('normalizes rates, fees, ratios, USD values, and reward emissions', () => {
    expect(
      getKongNormalizedScalarValue({
        path: ['apy', 'net'],
        value: 0.1234,
        context
      })?.value
    ).toBe('12.34% | 0.1234')

    expect(
      getKongNormalizedScalarValue({
        path: ['fees', 'performanceFee'],
        value: 2000,
        context
      })?.value
    ).toBe('20% | 2000')

    expect(
      getKongNormalizedScalarValue({
        path: ['debts', '0', 'debtRatio'],
        value: 4250,
        context
      })?.value
    ).toBe('42.5% | 4250')

    expect(
      getKongNormalizedScalarValue({
        path: ['debts', '0', 'currentDebtUsd'],
        value: 1234.56,
        context
      })?.value
    ).toBe('$1,234.56 | 1234.56')

    expect(
      getKongNormalizedScalarValue({
        path: ['staking', 'rewards', '0', 'perWeek'],
        value: '2500000',
        parent: {
          decimals: 6,
          symbol: 'USDC'
        },
        context
      })
    ).toEqual({
      value: '2.5 USDC/week | 2500000'
    })
  })

  it('normalizes chain IDs, durations, role masks, timestamps, supply, and profit unlocking rate', () => {
    expect(
      getKongNormalizedScalarValue({
        path: ['chainId'],
        value: 1,
        context
      })?.value
    ).toBe('1 | Ethereum')

    expect(
      getKongNormalizedScalarValue({
        path: ['profitMaxUnlockTime'],
        value: 604800,
        context
      })?.value
    ).toBe('7d | 604800')

    expect(
      getKongNormalizedScalarValue({
        path: ['roles', '0x1111111111111111111111111111111111111111'],
        value: 96,
        context
      })?.value
    ).toBe('REPORTING_MANAGER, DEBT_MANAGER | 96')

    expect(
      getKongNormalizedScalarValue({
        path: ['totalSupply'],
        value: '5000000000000000000',
        context
      })?.value
    ).toBe('5 yvTEST | 5000000000000000000')

    expect(
      getKongNormalizedScalarValue({
        path: ['profitUnlockingRate'],
        value: '1000000000000000000000000000000',
        context
      })?.value
    ).toBe('1 yvTEST/sec | 1000000000000000000000000000000')

    expect(
      getKongNormalizedScalarValue({
        path: ['debts', '0', 'activation'],
        value: 1700000000,
        context
      })?.value
    ).toContain('2023')
  })

  it('normalizes explicit Katana rate fields and max uint sentinels', () => {
    expect(
      getKongNormalizedScalarValue({
        path: ['apy', 'katanaNativeYield'],
        value: 0.042,
        context
      })?.value
    ).toBe('4.2% | 0.042')

    expect(
      getKongNormalizedScalarValue({
        path: ['rewards', 'fixedRateKatanaRewards'],
        value: 0.08,
        context
      })?.value
    ).toBe('8% | 0.08')

    expect(
      getKongNormalizedScalarValue({
        path: ['debts', '0', 'maxDebt'],
        value: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
        context
      })?.value
    ).toBe('Max | 115792089237316195423570985008687907853269984665640564039457584007913129639935')
  })
})
