import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SimulatedTranchePage } from './SimulatedTranchePage'

vi.mock('@/hooks/useVaultPageData', () => ({
  useVaultPageData: () => ({ vaultDetails: null, hasErrors: true, isInitialLoading: false })
}))
vi.mock('@/lib/envio-client', () => ({ isEnvioConfigured: () => false }))
vi.mock('@/components/charts/charts-panel', () => ({ ChartsPanel: () => <div>Simulated charts</div> }))

describe('frozen tranche pages', () => {
  it.each([
    { tranche: 'senior' as const, name: 'Senior yvUSD', tvl: '$8,928,927.29' },
    { tranche: 'junior' as const, name: 'Junior yvUSD', tvl: '$5,325,932.98' },
    { tranche: 'equity' as const, name: 'Equity yvUSD', tvl: '$252,576.36' }
  ])('shows $name simulation even when the live reference fails', async ({ tranche, name, tvl }) => {
    render(<SimulatedTranchePage tranche={tranche} />)
    expect(screen.getByRole('heading', { name })).toBeTruthy()
    expect(screen.getAllByText(tvl).length).toBeGreaterThan(0)
    expect(screen.getByText('Last-day APY (sim.)')).toBeTruthy()
    expect(screen.queryByText('Expected APY')).toBeNull()
    expect(await screen.findByText('Simulated charts')).toBeTruthy()
    expect(screen.getByText(/Live strategy reference is unavailable/)).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: /equity/i })).toBeTruthy()
  })
})
