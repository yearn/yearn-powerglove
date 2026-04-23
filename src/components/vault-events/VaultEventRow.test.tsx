import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { VaultUserEvent } from '@/types/vaultEventTypes'
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
})
