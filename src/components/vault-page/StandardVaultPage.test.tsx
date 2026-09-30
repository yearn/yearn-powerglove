import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MainInfoPanelProps } from '@/types/dataTypes'
import { StandardVaultPage } from './StandardVaultPage'

const mainInfo: MainInfoPanelProps = {
  vaultId: 'test',
  deploymentDate: '2025-01-01',
  vaultName: 'Test vault',
  vaultAddress: '0x1111111111111111111111111111111111111111',
  description: 'Vault description',
  vaultToken: { icon: '', name: 'USDC' },
  totalSupply: '$1M',
  network: { icon: '', name: 'Ethereum' },
  oneDayAPY: { display: '1%' },
  sevenDayAPY: { display: '2%' },
  thirtyDayAPY: { display: '3%' },
  managementFee: '0%',
  performanceFee: '10%',
  apiVersion: '3.0.4'
}

afterEach(() => vi.unstubAllEnvs())

describe('Vault report activity availability', () => {
  it.each(['', '   '])('omits the activity heading, shell and navigation when Envio is unset (%j)', (env) => {
    vi.stubEnv('VITE_PUBLIC_ENVIO_GRAPHQL_URL', env)
    const { container } = render(
      <StandardVaultPage
        mainInfo={mainInfo}
        charts={<p>Charts</p>}
        strategies={<p>Allocations</p>}
        vaultActivity={null}
      />
    )
    expect(screen.queryByRole('heading', { name: 'Vault activity' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Vault activity' })).toBeNull()
    expect(container.querySelector('#vault-activity')).toBeNull()
    expect(screen.getByText('Vault description')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Performance' })).toBeTruthy()
    expect(screen.getByText('Allocations')).toBeTruthy()
  })

  it('keeps the activity navigation and content when Envio is configured', () => {
    vi.stubEnv('VITE_PUBLIC_ENVIO_GRAPHQL_URL', 'https://events.example/graphql')
    render(
      <StandardVaultPage mainInfo={mainInfo} charts={null} strategies={null} vaultActivity={<p>Recorded activity</p>} />
    )
    expect(screen.getByRole('heading', { name: 'Vault activity' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Vault activity' }).getAttribute('href')).toBe('#vault-activity')
    expect(screen.getByText('Recorded activity')).toBeTruthy()
  })
})
