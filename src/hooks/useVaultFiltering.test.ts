import { describe, expect, it } from 'vitest'
import type { VaultListData } from '@/components/vaults-list/VaultRow'
import { defaultVaultFilters, filterVaults, sortVaults } from '@/hooks/useVaultFiltering'

const buildVault = (overrides: Partial<VaultListData>): VaultListData => ({
  id: overrides.id ?? '0x0',
  name: overrides.name ?? 'Vault',
  chain: overrides.chain ?? 'Ethereum',
  chainIconUri: overrides.chainIconUri ?? '',
  token: overrides.token ?? 'TKN',
  tokenUri: overrides.tokenUri ?? '',
  type: overrides.type ?? 'Vault',
  estimatedAPY: overrides.estimatedAPY ?? { display: '-' },
  estimatedApySortValue: overrides.estimatedApySortValue ?? Number.NaN,
  APY: overrides.APY ?? '0%',
  desktopThirtyDayAPY: overrides.desktopThirtyDayAPY ?? { display: '0%' },
  apySortValue: overrides.apySortValue ?? 0,
  apyRawValue: overrides.apyRawValue ?? 0,
  tvl: overrides.tvl ?? '$0',
  tvlUsd: overrides.tvlUsd,
  isRetired: overrides.isRetired,
  apiVersion: overrides.apiVersion
})

describe('sortVaults', () => {
  it('pins Senior then Junior above real vaults regardless of sort direction', () => {
    const vaults = [
      buildVault({ id: 'real', tvl: '$100M' }),
      { ...buildVault({ id: 'junior', tvl: '$5M' }), isTranchedMockup: true, isJuniorMockup: true },
      { ...buildVault({ id: 'senior', tvl: '$10M' }), isTranchedMockup: true }
    ]
    for (const direction of ['asc', 'desc'] as const) {
      expect(sortVaults(vaults, 'tvl', direction).map((vault) => vault.id)).toEqual(['senior', 'junior', 'real'])
    }
  })

  it('sorts APY correctly when display values are capped or infinite', () => {
    const vaults: VaultListData[] = [
      buildVault({ id: 'low', APY: '12.3%', apySortValue: 12.3, apyRawValue: 12.3 }),
      buildVault({ id: 'cap-low', APY: '≥ 500%', apySortValue: 500, apyRawValue: 510 }),
      buildVault({ id: 'cap-high', APY: '≥ 500%', apySortValue: 500, apyRawValue: 650 }),
      buildVault({
        id: 'inf',
        APY: '∞%',
        apySortValue: Number.POSITIVE_INFINITY,
        apyRawValue: Number.POSITIVE_INFINITY
      })
    ]

    const sorted = sortVaults(vaults, 'APY', 'desc')

    expect(sorted.map((vault) => vault.id)).toEqual(['inf', 'cap-high', 'cap-low', 'low'])
  })

  it('sorts estimated APY numerically and puts unavailable values last', () => {
    const vaults = [
      buildVault({ id: 'missing', estimatedApySortValue: Number.NaN }),
      buildVault({ id: 'high', estimatedApySortValue: 8 }),
      buildVault({ id: 'low', estimatedApySortValue: 2 })
    ]

    expect(sortVaults(vaults, 'estimatedAPY', 'desc').map((vault) => vault.id)).toEqual(['high', 'low', 'missing'])
    expect(sortVaults(vaults, 'estimatedAPY', 'asc').map((vault) => vault.id)).toEqual(['low', 'high', 'missing'])
  })
})

describe('vault filters', () => {
  const vaults = [
    buildVault({ id: 'active', isRetired: false, apiVersion: '3.0.4', tvlUsd: 100000 }),
    buildVault({ id: 'retired', isRetired: true, apiVersion: '0.3.0', tvlUsd: 1000000 }),
    buildVault({ id: 'unknown', tvlUsd: null }),
    buildVault({ id: 'zero', apiVersion: '3.0.4', tvlUsd: 0 }),
    buildVault({ id: 'boundary', apiVersion: '3.0.4', tvlUsd: 10000000 })
  ]
  it('hides explicitly retired vaults by default and includes them only on request', () => {
    expect(filterVaults(vaults, '', defaultVaultFilters()).map((v) => v.id)).toEqual([
      'active',
      'unknown',
      'zero',
      'boundary'
    ])
    expect(filterVaults(vaults, '', { ...defaultVaultFilters(), showRetired: true })).toHaveLength(5)
  })
  it('combines exact versions and half-open TVL bands without rounding displayed values', () => {
    expect(
      filterVaults(vaults, '', {
        ...defaultVaultFilters(),
        versions: ['3.0.4'],
        tvlRanges: ['100k-1m', 'over-10m']
      }).map((v) => v.id)
    ).toEqual(['active', 'boundary'])
    expect(filterVaults(vaults, '', { ...defaultVaultFilters(), tvlRanges: ['under-100k'] }).map((v) => v.id)).toEqual([
      'zero'
    ])
    expect(filterVaults(vaults, '', { ...defaultVaultFilters(), versions: ['Unknown'] }).map((v) => v.id)).toEqual([
      'unknown'
    ])
  })
  it('applies search, chains, and types alongside retirement and numeric filters', () => {
    const filters = {
      ...defaultVaultFilters(),
      chains: [1],
      types: ['Vault'],
      versions: ['3.0.4'],
      tvlRanges: ['100k-1m']
    }
    expect(filterVaults(vaults, ' tkn ', filters).map((v) => v.id)).toEqual(['active'])
    expect(filterVaults(vaults, 'missing', filters)).toHaveLength(0)
    expect(filterVaults(vaults, '', { ...filters, chains: [8453] })).toHaveLength(0)
  })
})

it('filters exact custom TVL bounds inclusively and rejects invalid ranges', () => {
  const vaults = [
    buildVault({ id: 'zero', tvlUsd: 0 }),
    buildVault({ id: 'min', tvlUsd: 100.25 }),
    buildVault({ id: 'max', tvlUsd: 200.75 }),
    buildVault({ id: 'missing', tvlUsd: null })
  ]
  const filters = { ...defaultVaultFilters(), tvlMin: '100.25', tvlMax: '200.75' }
  expect(filterVaults(vaults, '', filters).map((v) => v.id)).toEqual(['min', 'max'])
  expect(filterVaults(vaults, '', { ...filters, tvlMin: '', tvlMax: '0' }).map((v) => v.id)).toEqual(['zero'])
  expect(filterVaults(vaults, '', { ...filters, tvlMax: '' }).map((v) => v.id)).toEqual(['min', 'max'])
  for (const bounds of [
    { tvlMin: '-1', tvlMax: '' },
    { tvlMin: '300', tvlMax: '200' },
    { tvlMin: 'Infinity', tvlMax: '' }
  ]) {
    expect(filterVaults(vaults, '', { ...filters, ...bounds })).toHaveLength(0)
  }
})
