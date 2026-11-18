import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { defaultVaultFilters, filterVaults } from '@/hooks/useVaultFiltering'
import { useVaultListData } from '@/hooks/useVaultListData'

describe('simulated vaults in TVL filters', () => {
  it('retains matching mock vaults when a TVL band is selected', () => {
    const { result } = renderHook(() => useVaultListData([], []))
    const filtered = filterVaults(result.current, '', { ...defaultVaultFilters(), tvlRanges: ['1m-10m'] })
    expect(filtered.map((vault) => vault.id)).toEqual(['senior-yvusd-simulation', 'junior-yvusd-simulation'])
    const smaller = filterVaults(result.current, '', { ...defaultVaultFilters(), tvlRanges: ['100k-1m'] })
    expect(smaller.map((vault) => vault.id)).toEqual(['equity-yvusd-simulation'])
  })

  it('uses the exact simulated balance for custom TVL bounds rather than the rounded display', () => {
    const { result } = renderHook(() => useVaultListData([], []))
    const filtered = filterVaults(result.current, '', {
      ...defaultVaultFilters(),
      tvlMin: '5324549',
      tvlMax: '5324550'
    })
    expect(filtered.map((vault) => vault.id)).toEqual(['junior-yvusd-simulation'])
  })
})
