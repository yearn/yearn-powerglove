import { describe, expect, it } from 'vitest'
import {
  deriveKongSnapshotStrategies,
  mapKongListItemToVault,
  mapKongSnapshotToVaultExtended,
  resolveEstimatedApy
} from '@/lib/kong-vault-derivation'
import type { KongVaultListItem, KongVaultSnapshot } from '@/types/kong'

describe('mapKongListItemToVault', () => {
  it('uses estimated APY as forward APY when available', () => {
    const item: KongVaultListItem = {
      chainId: 1,
      address: '0x1111111111111111111111111111111111111111',
      name: 'Test Vault',
      symbol: 'yvTEST',
      apiVersion: '3.0.4',
      kind: 'Multi Strategy',
      inclusion: { isYearn: true },
      asset: {
        address: '0x2222222222222222222222222222222222222222',
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 18
      },
      performance: {
        estimated: { apy: 0.12, type: 'crv' },
        oracle: { apy: 0.08, apr: 0.07 },
        historical: {
          net: 0.05,
          weeklyNet: 0.04,
          monthlyNet: 0.03,
          inceptionNet: 0.02
        }
      },
      tvl: 123456,
      fees: {
        managementFee: 200,
        performanceFee: 1000
      },
      yearn: true,
      v3: true
    }

    const mapped = mapKongListItemToVault(item)

    expect(mapped.forwardApyNet).toBe(0.12)
    expect(mapped.estimatedApySource).toBe('est-crv')
    expect(mapped.vaultType).toBe('1')
    expect(mapped.yearn).toBe(true)
    expect(mapped.apy?.monthlyNet).toBe(0.03)
  })

  it('uses oracle APY only when estimated APY is unavailable', () => {
    expect(
      resolveEstimatedApy({
        estimated: { apy: null, type: 'crv' },
        oracle: { apy: 0.08 },
        historical: { weeklyNet: 0.4 }
      })
    ).toEqual({ value: 0.08, source: 'oracle' })
  })

  it('does not fall back to historical APY', () => {
    expect(resolveEstimatedApy({ historical: { weeklyNet: 0.4, monthlyNet: 0.3 } })).toEqual({
      value: null,
      source: null
    })
  })

  it.each([
    ['crv', 'est-crv'],
    ['aero', 'est-aero'],
    ['velo', 'est-velo'],
    ['katana-estimated-apr', 'est-katana'],
    ['yvusd-estimated-apr', 'est-yvusd'],
    ['future-estimator', 'unknown']
  ])('maps estimated type %s to %s', (type, source) => {
    expect(resolveEstimatedApy({ estimated: { apy: 0.05, type } })).toEqual({ value: 0.05, source })
  })

  it('treats zero as an available estimated APY', () => {
    expect(resolveEstimatedApy({ estimated: { apy: 0, type: 'crv' }, oracle: { apy: 0.1 } })).toEqual({
      value: 0,
      source: 'est-crv'
    })
  })
})

describe('deriveKongSnapshotStrategies', () => {
  it('derives strategy APY fields from composition with latest report fallback', () => {
    const nowSeconds = Math.floor(Date.now() / 1000)
    const snapshot: KongVaultSnapshot = {
      address: '0x1111111111111111111111111111111111111111',
      chainId: 1,
      totalAssets: '100000000000000000000',
      composition: [
        {
          address: '0x3333333333333333333333333333333333333333',
          name: 'Composition Strategy',
          status: 1,
          totalDebt: '40000000000000000000',
          debtRatio: 4000,
          currentDebtUsd: 400,
          totalDebtUsd: 400,
          performanceFee: 1000,
          performance: {
            oracle: { apy: 0.14 },
            historical: { net: 0.09 }
          }
        },
        {
          address: '0x4444444444444444444444444444444444444444',
          status: 'active',
          totalDebt: '10000000000000000000',
          currentDebtUsd: 100,
          totalDebtUsd: 100,
          lastReport: nowSeconds,
          latestReportApr: 0.03,
          performance: {
            estimated: { apy: 0.02 }
          }
        }
      ]
    }

    const strategies = deriveKongSnapshotStrategies(snapshot)

    expect(strategies).toHaveLength(2)
    expect(strategies[0].estimatedApy).toBe(0.14)
    expect(strategies[0].netApr).toBe(0.09)
    expect(strategies[0].status).toBe('active')

    // No historical net, but latestReportApr should be used while report is fresh.
    expect(strategies[1].netApr).toBe(0.03)
    expect(strategies[1].estimatedApy).toBe(0.02)
  })

  it('falls back to debts when composition is missing', () => {
    const snapshot: KongVaultSnapshot = {
      address: '0x1111111111111111111111111111111111111111',
      chainId: 1,
      debts: [
        {
          strategy: '0x5555555555555555555555555555555555555555',
          currentDebt: '20000000000000000000',
          totalDebt: '20000000000000000000',
          currentDebtUsd: 200,
          totalDebtUsd: 200,
          debtRatio: 2000
        }
      ]
    }

    const strategies = deriveKongSnapshotStrategies(snapshot)
    expect(strategies).toHaveLength(1)
    expect(strategies[0].address.toLowerCase()).toBe('0x5555555555555555555555555555555555555555')
    expect(strategies[0].netApr).toBeNull()
    expect(strategies[0].status).toBe('active')
  })
})

describe('mapKongSnapshotToVaultExtended', () => {
  it('maps snapshot with yearn.fi APY precedence and exposes strategy details', () => {
    const snapshot: KongVaultSnapshot = {
      address: '0x1111111111111111111111111111111111111111',
      chainId: 1,
      apiVersion: '3.0.5',
      name: 'Snapshot Vault',
      symbol: 'yvSNAP',
      inceptTime: 1700000000,
      asset: {
        name: 'Snapshot Token',
        symbol: 'SNAP',
        address: '0x2222222222222222222222222222222222222222',
        decimals: 18
      },
      tvl: {
        close: 987654
      },
      fees: {
        managementFee: 0.02,
        performanceFee: 0.2
      },
      apy: {
        net: 0.06,
        weeklyNet: 0.05,
        monthlyNet: 0.04,
        inceptionNet: 0.03
      },
      performance: {
        oracle: {
          apy: 0.08,
          apr: 0.07
        }
      },
      composition: [
        {
          address: '0x3333333333333333333333333333333333333333',
          name: 'Strategy A',
          totalDebt: '1000000000000000000',
          debtRatio: 1000,
          currentDebtUsd: 10,
          totalDebtUsd: 10,
          performance: {
            oracle: {
              apy: 0.11
            },
            historical: {
              net: 0.09
            }
          }
        }
      ],
      inclusion: {
        isYearn: true
      },
      meta: {
        description: 'Snapshot description',
        displayName: 'Snapshot Display Name',
        displaySymbol: 'yvSNAP'
      }
    }

    const mapped = mapKongSnapshotToVaultExtended(snapshot)

    expect(mapped.forwardApyNet).toBe(0.08)
    expect(mapped.estimatedApySource).toBe('oracle')
    expect(mapped.apy?.net).toBe(0.06)
    // Decimal fee values are normalized into bps for existing powerglove formatting.
    expect(mapped.fees.managementFee).toBe(200)
    expect(mapped.fees.performanceFee).toBe(2000)
    expect(mapped.strategyDetails).toHaveLength(1)
    expect(mapped.strategyDetails?.[0].estimatedApy).toBe(0.11)
    expect(mapped.strategyDetails?.[0].netApr).toBe(0.09)
  })
})
