import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useMainInfoPanelData } from '@/hooks/useMainInfoPanelData'
import { useVaultListData } from '@/hooks/useVaultListData'
import { buildKatanaApyDisplay, getThirtyDayDisplayApy } from '@/lib/katana-apy'
import { mapKongListItemToVault, mapKongSnapshotToVaultExtended } from '@/lib/kong-vault-derivation'
import type { KongVaultPerformance } from '@/types/kong'

const item = (performance: KongVaultPerformance, chainId = 747474) => ({
  chainId,
  address: '0x1111111111111111111111111111111111111111',
  name: 'Katana Vault',
  apiVersion: '3.0.4',
  performance
})
const performance: KongVaultPerformance = {
  estimated: { apy: 0.03, apr: 0.02, components: { katanaAppRewardsAPR: '0.09' } },
  oracle: { netAPY: 0.05 },
  historical: { monthlyNet: 0.01, weeklyNet: 0.02 }
}

describe('Katana APY parity with yearn.fi', () => {
  it('adds app rewards to estimates and displayed history on both list and details', () => {
    const vault = mapKongListItemToVault(item(performance))
    const details = mapKongSnapshotToVaultExtended(item(performance))
    expect(vault.forwardApyNet).toBeCloseTo(0.12)
    expect(details.forwardApyNet).toBeCloseTo(0.12)
    expect(vault.estimatedApySource).toBe('est-katana')
    expect(getThirtyDayDisplayApy(vault)).toBeCloseTo(0.1)
    expect(getThirtyDayDisplayApy(details)).toBeCloseTo(0.1)
    // Charts and reported PPS rates retain the original history.
    expect(details.apy?.monthlyNet).toBe(0.01)
    expect(vault.historicalMonthlyApy).toBe(0.01)
    const list = renderHook(() => useVaultListData([vault], []))
    expect(list.result.current[0].estimatedAPY.display).toBe('12.00%')
    expect(list.result.current[0].desktopThirtyDayAPY.display).toBe('10.00%')
    expect(list.result.current[0].APY).toBe('10.0%')
    expect(list.result.current[0].apySortValue).toBe(10)
    expect(list.result.current[0].estimatedApySortValue).toBe(12)
    const summary = renderHook(() => useMainInfoPanelData({ vaultDetails: details, tokenAssets: [] }))
    expect(summary.result.current?.oneDayAPY.display).toBe('12.00%')
    expect(summary.result.current?.thirtyDayAPY.display).toBe('10.00%')
    expect(list.result.current[0].estimatedAPY.tooltipItems).toEqual([
      { label: 'Native APY', value: '3.00%' },
      { label: 'Rewards APR', value: '9.00%' }
    ])
    expect(list.result.current[0].desktopThirtyDayAPY.tooltipItems).toEqual([
      { label: 'Native APY', value: '1.00%' },
      { label: 'Rewards APR', value: '9.00%' }
    ])
    expect(summary.result.current?.oneDayAPY.tooltipItems).toEqual(list.result.current[0].estimatedAPY.tooltipItems)
    expect(summary.result.current?.thirtyDayAPY.tooltipItems).toEqual(
      list.result.current[0].desktopThirtyDayAPY.tooltipItems
    )
    expect(summary.result.current?.sevenDayAPY).toEqual({
      display: '11.00%',
      tooltipItems: [
        { label: 'Native APY', value: '2.00%' },
        { label: 'Rewards APR', value: '9.00%' }
      ]
    })
  })

  it.each([0, null, undefined])('falls back to weekly history when monthly is %s', (monthlyNet) => {
    const vault = mapKongListItemToVault(item({ ...performance, historical: { monthlyNet, weeklyNet: 0.02 } }))
    expect(getThirtyDayDisplayApy(vault)).toBeCloseTo(0.11)
  })

  it.each([null, undefined, 'invalid', Infinity])('ignores unavailable or invalid app rewards: %s', (reward) => {
    const vault = mapKongListItemToVault(
      item({
        ...performance,
        estimated: { apy: 0.03, components: { katanaAppRewardsAPR: reward } }
      })
    )
    expect(vault.forwardApyNet).toBe(0.03)
    expect(getThirtyDayDisplayApy(vault)).toBe(0.01)
    expect(buildKatanaApyDisplay(vault, vault.forwardApyNet).tooltipItems?.[1]).toEqual({
      label: 'Rewards APR',
      value: '-'
    })
  })

  it('preserves genuine zero and negative base rates', () => {
    const vault = mapKongListItemToVault(
      item({
        ...performance,
        estimated: { apy: 0, components: { katanaAppRewardsAPR: 0.09 } },
        historical: { monthlyNet: -0.02, weeklyNet: 0.02 }
      })
    )
    expect(vault.forwardApyNet).toBe(0.09)
    expect(getThirtyDayDisplayApy(vault)).toBeCloseTo(0.07)
  })

  it('uses estimated APR before oracle rates when estimated APY is absent', () => {
    const vault = mapKongListItemToVault(item({ ...performance, estimated: { apr: 0.02 } }))
    expect(vault.forwardApyNet).toBe(0.02)
  })

  it('does not compound oracle fallback or add non-app incentives', () => {
    const vault = mapKongListItemToVault(item({ oracle: { netAPR: 0.05 }, historical: { monthlyNet: 0.02 } }))
    expect(vault.forwardApyNet).toBe(0.05)
    expect(getThirtyDayDisplayApy(vault)).toBe(0.02)
  })

  it('preserves list values on a partial snapshot without adding incentives twice', () => {
    const base = mapKongSnapshotToVaultExtended(item(performance))
    const partial = mapKongSnapshotToVaultExtended({ chainId: 747474, address: base.address }, base)
    expect(partial.forwardApyNet).toBeCloseTo(0.12)
    expect(getThirtyDayDisplayApy(partial)).toBeCloseTo(0.1)
    const refreshed = mapKongSnapshotToVaultExtended(
      item({
        estimated: { apy: 0.04, components: { katanaAppRewardsAPR: 0 } },
        historical: { monthlyNet: 0.03 }
      }),
      base
    )
    expect(refreshed.forwardApyNet).toBe(0.04)
    expect(getThirtyDayDisplayApy(refreshed)).toBe(0.03)
  })

  it.each<KongVaultPerformance>([
    { historical: { monthlyNet: 0.01 } },
    { historical: { net: 0.08, monthlyNet: 0.01 } },
    { oracle: { netAPY: 0.05 } },
    { estimated: { apy: null }, oracle: { netAPY: 0.05 } }
  ])('retains the list estimate when snapshot performance lacks an estimated rate: %j', (snapshotPerformance) => {
    const base = mapKongListItemToVault(item(performance))
    const details = mapKongSnapshotToVaultExtended(item(snapshotPerformance), base)
    expect(details.forwardApyNet).toBeCloseTo(0.12)
    expect(buildKatanaApyDisplay(details, details.forwardApyNet).tooltipItems).toEqual([
      { label: 'Native APY', value: '3.00%' },
      { label: 'Rewards APR', value: '9.00%' }
    ])
  })

  it('uses the list native estimate with refreshed snapshot rewards exactly once', () => {
    const base = mapKongListItemToVault(item(performance))
    const details = mapKongSnapshotToVaultExtended(
      item({
        estimated: { components: { katanaAppRewardsAPR: 0.12 } },
        oracle: { netAPY: 0.05 }
      }),
      base
    )
    expect(details.forwardApyNet).toBeCloseTo(0.15)
    expect(buildKatanaApyDisplay(details, details.forwardApyNet).tooltipItems).toEqual([
      { label: 'Native APY', value: '3.00%' },
      { label: 'Rewards APR', value: '12.00%' }
    ])
  })

  it('keeps a genuine zero list estimate ahead of snapshot oracle fallbacks', () => {
    const base = mapKongListItemToVault(
      item({
        ...performance,
        estimated: {
          apy: 0,
          components: { katanaAppRewardsAPR: 0.09 }
        }
      })
    )
    const details = mapKongSnapshotToVaultExtended(item({ oracle: { netAPY: 0.05 } }), base)
    expect(details.forwardApyNet).toBe(0.09)
  })

  it.each([{ apy: 0.04 }, { apr: 0.04 }, { apy: 0 }])(
    'prefers a valid snapshot estimate over the list estimate: %j',
    (estimated) => {
      const base = mapKongListItemToVault(item(performance))
      const details = mapKongSnapshotToVaultExtended(item({ estimated }), base)
      expect(details.forwardApyNet).toBeCloseTo((estimated.apy ?? estimated.apr ?? 0) + 0.09)
    }
  )

  it('uses a fresh snapshot oracle when the list has no estimated base rate', () => {
    const base = mapKongListItemToVault(item({ oracle: { netAPY: 0.05 } }))
    const details = mapKongSnapshotToVaultExtended(item({ oracle: { netAPY: 0.07 } }), base)
    expect(details.forwardApyNet).toBe(0.07)
  })

  it('leaves other chains unchanged even when Katana fields are present', () => {
    const vault = mapKongListItemToVault(item(performance, 1))
    expect(vault.forwardApyNet).toBe(0.03)
    expect(getThirtyDayDisplayApy(vault)).toBe(0.01)
    expect(buildKatanaApyDisplay(vault, 0.03).tooltipItems).toBeUndefined()
  })
})
