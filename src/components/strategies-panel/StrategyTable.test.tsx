import { fireEvent, render, screen } from '@testing-library/react'
import { type ReactNode, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Strategy } from '@/types/dataTypes'
import { StrategyTable } from './StrategyTable'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params,
    to: _to,
    ...props
  }: {
    children: ReactNode
    params: { chainId: string; vaultAddress: string }
    to: string
  }) => (
    <a href={`/vaults/${params.chainId}/${params.vaultAddress}`} {...props}>
      {children}
    </a>
  )
}))

vi.mock('@/components/ui/use-mobile', () => ({
  useIsMobile: () => false
}))

vi.mock('@/hooks/useStrategyDebtEvidence', () => ({
  useStrategyDebtEvidence: (_params: unknown, enabled: boolean) => ({
    isPending: false,
    data: enabled
      ? {
          currentDebtRaw: 400_000_000n,
          currentDebtTokens: 400,
          priceUsd: 0.9999,
          priceTimestamp: 1_700_000_000,
          calculatedDebtUsd: 399.96,
          debtSourceUrl: 'https://etherscan.io/address/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#readContract#F34',
          priceSourceUrl: 'https://coins.llama.fi/prices/current/ethereum:0x3333333333333333333333333333333333333333'
        }
      : undefined
  })
}))

const strategies: Strategy[] = [
  {
    id: 1,
    name: 'Alpha strategy',
    allocationPercent: 60,
    allocationAmount: '$600',
    allocationAmountUsd: 600,
    valuationBasis: 'totalDebtUsd',
    estimatedAPY: '5.00%',
    tokenSymbol: 'USDC',
    tokenIconUri: '',
    details: {
      chainId: 1,
      parentVaultChainId: 1,
      parentVaultAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      vaultAddress: '0x1111111111111111111111111111111111111111',
      assetAddress: '0x3333333333333333333333333333333333333333',
      assetDecimals: 6,
      assetSymbol: 'USDC',
      managementFee: 0,
      performanceFee: 0,
      isVault: false
    }
  },
  {
    id: 2,
    name: 'Beta strategy',
    allocationPercent: 40,
    allocationAmount: '$400',
    allocationAmountUsd: 400,
    valuationBasis: 'currentDebtUsd',
    estimatedAPY: '4.00%',
    tokenSymbol: 'USDC',
    tokenIconUri: '',
    details: {
      chainId: 1,
      parentVaultChainId: 1,
      parentVaultAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      vaultAddress: '0x2222222222222222222222222222222222222222',
      assetAddress: '0x3333333333333333333333333333333333333333',
      assetDecimals: 6,
      assetSymbol: 'USDC',
      managementFee: 0,
      performanceFee: 0,
      isVault: true,
      isEndorsed: true
    }
  },
  {
    id: 3,
    name: 'Gamma allocator',
    allocationPercent: 20,
    allocationAmount: '$200',
    allocationAmountUsd: 200,
    valuationBasis: 'currentDebtUsd',
    estimatedAPY: '3.00%',
    tokenSymbol: 'USDC',
    tokenIconUri: '',
    details: {
      chainId: 1,
      parentVaultChainId: 1,
      parentVaultAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      vaultAddress: '0x3333333333333333333333333333333333333333',
      assetAddress: '0x4444444444444444444444444444444444444444',
      assetDecimals: 6,
      assetSymbol: 'USDC',
      managementFee: 0,
      performanceFee: 0,
      isVault: true,
      isEndorsed: true
    }
  }
]

function ExpandableStrategyTable() {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(() => new Set())

  return (
    <StrategyTable
      allocatedStrategies={strategies}
      unallocatedStrategies={[]}
      sortColumn="allocationPercent"
      sortDirection="desc"
      onSort={() => {}}
      expandedRows={expandedRows}
      onToggleRow={(id) => {
        setExpandedRows((current) => {
          const next = new Set(current)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        })
      }}
      showUnallocated={false}
      onToggleUnallocated={() => {}}
    />
  )
}

describe('StrategyTable expansion', () => {
  it('keeps previously expanded strategies open', async () => {
    render(<ExpandableStrategyTable />)

    const strategyRows = screen.getAllByRole('button', { expanded: false })
    fireEvent.click(strategyRows[0])
    fireEvent.click(strategyRows[1])
    fireEvent.click(strategyRows[2])

    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(3)
    expect(screen.getByText('NAV valuation basis: Kong totalDebtUsd')).toBeTruthy()
    expect(screen.getAllByText('Current debt:', { exact: false })).toHaveLength(2)
    expect(screen.getAllByText('Underlying price:', { exact: false })).toHaveLength(2)
    expect(screen.getAllByText('Live calculation:', { exact: false })).toHaveLength(2)
    const liveNavTriggers = screen.getAllByRole('button', { name: 'Live NAV calculation' })
    expect(liveNavTriggers).toHaveLength(2)
    fireEvent.focus(liveNavTriggers[0])
    const tooltipCopies = await screen.findAllByText(
      /may differ from other values on this site because each data source can update/i
    )
    expect(tooltipCopies.length).toBeGreaterThan(0)
    expect(screen.queryByText(/Kong snapshot:/)).toBeNull()
    expect(screen.getAllByRole('link', { name: /400 USDC/ })[0].getAttribute('href')).toBe(
      'https://etherscan.io/address/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#readContract#F34'
    )
    expect(screen.getAllByRole('link', { name: /via DefiLlama/ })[0].getAttribute('href')).toBe(
      'https://coins.llama.fi/prices/current/ethereum:0x3333333333333333333333333333333333333333'
    )
    expect(screen.queryByText('NAV contribution')).toBeNull()
    expect(screen.queryByText('Computed from vault-reported debt')).toBeNull()
  })
})
