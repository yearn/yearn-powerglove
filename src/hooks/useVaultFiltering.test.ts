import { describe, expect, it } from 'vitest'
import type { VaultListData } from '@/components/vaults-list/VaultRow'
import { sortVaults } from '@/hooks/useVaultFiltering'

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
  tvl: overrides.tvl ?? '$0'
})

describe('sortVaults', () => {
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
