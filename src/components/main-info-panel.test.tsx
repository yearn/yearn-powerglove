import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MainInfoPanel } from '@/components/main-info-panel'
import type { MainInfoPanelProps } from '@/types/dataTypes'

const props: MainInfoPanelProps = {
  vaultId: 'yvUSD',
  deploymentDate: '2025-01-01',
  vaultName: 'yvUSD',
  vaultAddress: '0x1111111111111111111111111111111111111111',
  description: 'Vault description',
  vaultToken: { icon: '', name: 'yvUSD' },
  totalSupply: '$1M',
  network: { icon: '', name: 'Ethereum' },
  oneDayAPY: {
    display: '7.00% | 3.00%',
    tooltipItems: [
      { label: 'Locked yvUSD', value: '7.00%' },
      { label: 'Unlocked yvUSD', value: '3.00%' }
    ]
  },
  thirtyDayAPY: {
    display: '8.00% | 2.00%',
    tooltipItems: [
      { label: 'Locked yvUSD', value: '8.00%' },
      { label: 'Unlocked yvUSD', value: '2.00%' }
    ]
  },
  managementFee: '0.00%',
  performanceFee: '0.00%',
  apiVersion: '3.0.0',
  blockExplorerLink: '#',
  yearnVaultLink: '#'
}

describe('MainInfoPanel APY metrics', () => {
  it('shows locked values first and exposes the value identities on focus', async () => {
    render(<MainInfoPanel {...props} />)

    expect(screen.getByRole('button', { name: '7.00% | 3.00%' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '8.00% | 2.00%' })).toBeTruthy()

    fireEvent.focus(screen.getByRole('button', { name: '7.00% | 3.00%' }))

    expect((await screen.findAllByText('Locked yvUSD')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Unlocked yvUSD').length).toBeGreaterThan(0)
  })
})
