import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { VaultActivityEvent, VaultUserEvent } from '@/types/vaultEventTypes'
import { VaultEventRow } from './VaultEventRow'

describe('VaultEventRow', () => {
  it('formats transfer events in share units', () => {
    const transferEvent: VaultUserEvent = {
      id: 'transfer-1',
      type: 'transfer',
      sender: '0x1111111111111111111111111111111111111111',
      receiver: '0x2222222222222222222222222222222222222222',
      value: '12345',
      vaultAddress: '0x3333333333333333333333333333333333333333',
      chainId: 1,
      blockNumber: '1',
      blockTimestamp: '0',
      transactionHash: '0x4444444444444444444444444444444444444444444444444444444444444444'
    }

    render(
      <VaultEventRow
        event={transferEvent}
        assetSymbol="USDC"
        assetDecimals={6}
        shareSymbol="yvUSDC"
        shareDecimals={2}
      />
    )

    expect(screen.getByText('123.45 yvUSDC')).not.toBeNull()
    expect(screen.queryByText('0.0123 USDC')).toBeNull()
  })

  it('renders management debt updates with direction and strategy names', () => {
    const managementEvent: VaultActivityEvent = {
      id: 'management-1',
      type: 'debtUpdated',
      chainId: 1,
      blockNumber: '1',
      blockTimestamp: '0',
      transactionHash: '0x5555555555555555555555555555555555555555555555555555555555555555',
      transactionFrom: '0x1111111111111111111111111111111111111111',
      vaultAddress: '0x3333333333333333333333333333333333333333',
      strategy: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      currentDebt: '1000000',
      newDebt: '2500000'
    }

    render(
      <VaultEventRow
        event={managementEvent}
        assetSymbol="USDC"
        assetDecimals={6}
        strategyNamesByAddress={{
          '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa': 'Aave v3 USDC Lender'
        }}
      />
    )

    expect(screen.getByText('Debt Increased')).not.toBeNull()
    expect(screen.getByText('Aave v3 USDC Lender')).not.toBeNull()
    expect(screen.getByText('The vault increased capital allocated to this strategy.')).not.toBeNull()
    expect(screen.getByText('+1.5 USDC')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Expand details' }))

    expect(screen.getByText('Previous Debt')).not.toBeNull()
    expect(screen.getByText('1 USDC')).not.toBeNull()
    expect(screen.getByText('New Debt')).not.toBeNull()
    expect(screen.getByText('2.5 USDC')).not.toBeNull()
  })

  it('decodes strategy change types', () => {
    const strategyChangedEvent: VaultActivityEvent = {
      id: 'strategy-change-1',
      type: 'strategyChanged',
      chainId: 1,
      blockNumber: '1',
      blockTimestamp: '0',
      transactionHash: '0x6666666666666666666666666666666666666666666666666666666666666666',
      vaultAddress: '0x3333333333333333333333333333333333333333',
      strategy: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      changeType: '2'
    }

    render(
      <VaultEventRow
        event={strategyChangedEvent}
        strategyNamesByAddress={{
          '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb': 'Morpho Steakhouse USDC Compounder'
        }}
      />
    )

    expect(screen.getByText('Strategy Revoked')).not.toBeNull()
    expect(screen.getByText('Morpho Steakhouse USDC Compounder')).not.toBeNull()
    expect(screen.getByText('Revoked')).not.toBeNull()
  })
})
