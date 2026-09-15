import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StrategiesPanel } from '@/components/strategies-panel/StrategiesPanel'
import { buildReallocationPanels } from '@/lib/reallocation-panels'
import type { ReallocationData } from '@/types/reallocationTypes'
import type { VaultExtended } from '@/types/vaultTypes'

vi.mock('@/hooks/useStrategiesData', () => ({
  useStrategiesData: () => ({ strategies: [], allocationChartData: [], isLoading: false, error: null })
}))
vi.mock('@/lib/envio-client', () => ({ isEnvioConfigured: () => false }))
vi.mock('@/components/vault-events', () => ({
  VaultEventsPanel: () => null,
  VaultManagementEventsPanel: () => null
}))

const panels = buildReallocationPanels(
  ['2026-08-01', '2026-08-02', '2026-08-03'].map((date) => ({
    sourceKey: date,
    timestampUtc: `${date}T00:00:00Z`,
    tvl: 100,
    tvlUnit: 'USD',
    currentVaultAprPct: null,
    targetVaultAprPct: null,
    strategies: [
      {
        strategyKey: 'alpha',
        strategyAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        name: 'Alpha',
        isUnallocated: false,
        currentAllocationPct: 100,
        targetAllocationPct: 100,
        currentAprPct: null,
        targetAprPct: null
      }
    ]
  }))
)
const vaultDetails = { address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' } as VaultExtended
const data: ReallocationData = {
  vault: vaultDetails.address,
  vaultLabel: 'Test vault',
  chainId: 1,
  chainName: 'Ethereum',
  panels: panels.slice(1)
}

describe('StrategiesPanel allocation history integration', () => {
  it('keeps the selected interval when an older page is prepended and forwards pagination', async () => {
    const loadOlder = vi.fn()
    const { rerender } = render(
      <StrategiesPanel
        vaultChainId={1}
        vaultDetails={vaultDetails}
        reallocationData={data}
        hasOlderReallocations
        onLoadOlderReallocations={loadOlder}
      />
    )
    fireEvent.click(screen.getByText('Historical Allocations'))
    fireEvent.click(screen.getByRole('button', { name: 'Older' }))
    expect(screen.getByText('Aug 2, 2026')).toBeTruthy()
    expect(loadOlder).toHaveBeenCalled()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Newer' }).hasAttribute('disabled')).toBe(false))

    rerender(
      <StrategiesPanel
        vaultChainId={1}
        vaultDetails={vaultDetails}
        reallocationData={{ ...data, panels }}
        hasOlderReallocations={false}
        onLoadOlderReallocations={loadOlder}
      />
    )
    expect(screen.getByText('Aug 2, 2026')).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Older' }).hasAttribute('disabled')).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Older' }))
    expect(screen.getByText('Aug 1, 2026')).toBeTruthy()
  })
})
