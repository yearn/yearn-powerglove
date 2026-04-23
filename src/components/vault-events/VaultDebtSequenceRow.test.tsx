import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { VaultManagementTimelineSequenceItem } from '@/lib/vault-management-display'
import { VaultDebtSequenceRow } from './VaultDebtSequenceRow'

describe('VaultDebtSequenceRow', () => {
  it('keeps grouped subitems expandable', () => {
    const item: VaultManagementTimelineSequenceItem = {
      kind: 'sequence',
      id: 'sequence-1',
      title: 'Withdrawal Debt Changes',
      blockNumber: '100',
      blockTimestamp: '3000',
      direction: 'decrease',
      reason: {
        label: 'Withdrawal',
        description: 'Grouped withdrawal-driven debt decreases.'
      },
      items: [
        {
          kind: 'event',
          id: 'debt-1',
          reason: {
            label: 'Withdrawal',
            description: 'Withdrawal-driven debt decrease.'
          },
          event: {
            id: 'debt-1',
            type: 'debtUpdated',
            chainId: 1,
            blockNumber: '100',
            blockTimestamp: '3000',
            transactionHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
            transactionFrom: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            vaultAddress: '0xvault',
            strategy: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            currentDebt: '2000000',
            newDebt: '1500000'
          }
        },
        {
          kind: 'event',
          id: 'debt-2',
          reason: {
            label: 'Withdrawal',
            description: 'Withdrawal-driven debt decrease.'
          },
          event: {
            id: 'debt-2',
            type: 'debtUpdated',
            chainId: 1,
            blockNumber: '99',
            blockTimestamp: '2000',
            transactionHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
            transactionFrom: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            vaultAddress: '0xvault',
            strategy: '0xcccccccccccccccccccccccccccccccccccccccc',
            currentDebt: '1500000',
            newDebt: '1000000'
          }
        }
      ]
    }

    render(
      <VaultDebtSequenceRow
        item={item}
        assetSymbol="USDC"
        assetDecimals={6}
        strategyNamesByAddress={{
          '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb': 'Strategy One',
          '0xcccccccccccccccccccccccccccccccccccccccc': 'Strategy Two'
        }}
      />
    )

    fireEvent.click(screen.getByLabelText('Expand details'))

    expect(screen.getByText('Strategy One')).not.toBeNull()
    expect(screen.getByText('Strategy Two')).not.toBeNull()

    const nestedExpandButtons = screen.getAllByRole('button', { name: 'Expand details' })
    fireEvent.click(nestedExpandButtons[0]!)

    expect(screen.getByText('Previous Debt')).not.toBeNull()
    expect(screen.getByText('2 USDC')).not.toBeNull()
    expect(screen.getByText('1.5 USDC')).not.toBeNull()
  })
})
