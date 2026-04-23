import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { VaultManagementTimelineReallocationItem } from '@/lib/vault-management-display'
import { VaultDebtReallocationRow } from './VaultDebtReallocationRow'

describe('VaultDebtReallocationRow', () => {
  it('styles positive in-moves like debt increases', () => {
    const item: VaultManagementTimelineReallocationItem = {
      kind: 'reallocation',
      id: 'reallocation-1',
      transactionHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      chainId: 1,
      blockNumber: '100',
      blockTimestamp: '3000',
      reason: {
        label: 'Reallocation',
        description: 'Capital moved between strategies.'
      },
      decreases: [
        {
          id: 'decrease-1',
          type: 'debtUpdated',
          chainId: 1,
          blockNumber: '100',
          blockTimestamp: '3000',
          transactionHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
          transactionFrom: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          strategy: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          currentDebt: '2000000',
          newDebt: '1000000'
        }
      ],
      increases: [
        {
          id: 'increase-1',
          type: 'debtUpdated',
          chainId: 1,
          blockNumber: '100',
          blockTimestamp: '3000',
          transactionHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
          transactionFrom: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          strategy: '0xcccccccccccccccccccccccccccccccccccccccc',
          currentDebt: '1000000',
          newDebt: '2500000'
        }
      ]
    }

    render(
      <VaultDebtReallocationRow
        item={item}
        assetSymbol="USDC"
        assetDecimals={6}
        strategyNamesByAddress={{
          '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb': 'Strategy Out',
          '0xcccccccccccccccccccccccccccccccccccccccc': 'Strategy In'
        }}
      />
    )

    const positiveValue = screen.getByText('+1.5 USDC')
    expect(positiveValue.className).toContain('text-green-700')
  })
})
