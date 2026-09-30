import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { type ReactNode, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useVaultPageData } from '@/hooks/useVaultPageData'
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

// Keep the real snapshot client, query cache and destination-page mapping.
// Chart requests and the unrelated live debt reader are outside this behavior.
vi.mock('@/contexts/useVaults', () => ({ useVaults: () => ({ vaults: [] }) }))
vi.mock('@/hooks/useRestTimeseries', () => ({
  useRestTimeseries: () => ({ data: undefined, isLoading: false, error: null })
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
      supportsStrategyPage: false,
      supportsVaultAction: false,
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
      supportsStrategyPage: true,
      supportsVaultAction: false,
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
      supportsStrategyPage: true,
      supportsVaultAction: true,
      isVault: true,
      isEndorsed: true
    }
  }
]

function ExpandableStrategyTable({ rows }: { rows: Strategy[] }) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(() => new Set())

  return (
    <StrategyTable
      allocatedStrategies={rows}
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

function renderTable(rows = strategies) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ExpandableStrategyTable rows={rows} />
    </QueryClientProvider>
  )
  return queryClient
}

describe('StrategyTable expansion', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const snapshots: Record<string, { address: string; chainId: number; apiVersion: string; name: string }> = {
        '/api/rest/snapshot/1/0x2222222222222222222222222222222222222222': {
          address: '0x2222222222222222222222222222222222222222',
          chainId: 1,
          apiVersion: '3.0.4',
          name: 'Beta strategy'
        },
        '/api/rest/snapshot/1/0x3333333333333333333333333333333333333333': {
          address: '0x3333333333333333333333333333333333333333',
          chainId: 1,
          apiVersion: '3.0.4',
          name: 'Gamma allocator'
        }
      }
      const snapshot = snapshots[new URL(String(input)).pathname]
      return snapshot ? new Response(JSON.stringify(snapshot)) : new Response('Not found', { status: 404 })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps previously expanded strategies open', async () => {
    renderTable()
    expect(fetch).not.toHaveBeenCalled()

    const strategyRows = screen.getAllByRole('button', { expanded: false })
    fireEvent.click(strategyRows[0])
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.click(strategyRows[1])
    fireEvent.click(strategyRows[2])

    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(3)
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Data' })).toHaveLength(2))
    const strategyPageLinks = screen.getAllByRole('link', { name: 'Data' })
    expect(strategyPageLinks[0].getAttribute('href')).toBe('/vaults/1/0x2222222222222222222222222222222222222222')
    const vaultLinks = screen.getAllByRole('link', { name: 'Vault' })
    expect(vaultLinks).toHaveLength(1)
    expect(vaultLinks[0].getAttribute('href')).toBe('https://yearn.fi/v3/1/0x3333333333333333333333333333333333333333')
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
    expect(screen.getAllByRole('link', { name: /400 USDC/ })[0].getAttribute('href')).toBe(
      'https://etherscan.io/address/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#readContract#F34'
    )
    expect(screen.getAllByRole('link', { name: /via DefiLlama/ })[0].getAttribute('href')).toBe(
      'https://coins.llama.fi/prices/current/ethereum:0x3333333333333333333333333333333333333333'
    )
  })

  it.each([404, 503])('hides Data on HTTP %s while retaining the strategy and other links', async (status) => {
    vi.mocked(fetch).mockResolvedValue(new Response('Unavailable', { status }))
    const queryClient = renderTable()
    fireEvent.click(screen.getAllByRole('button', { expanded: false })[2])

    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('link', { name: 'Data' })).toBeNull()
    expect(screen.getByRole('button', { expanded: true }).textContent).toContain('Gamma allocator')
    expect(screen.getByRole('link', { name: 'Vault' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /0x333333/ }).getAttribute('href')).toContain('etherscan.io/address/')
  })

  it('waits for a snapshot before showing Data and shares it with the destination page', async () => {
    let resolveResponse!: (response: Response) => void
    vi.mocked(fetch).mockReturnValue(
      new Promise((resolve) => {
        resolveResponse = resolve
      })
    )
    const queryClient = renderTable()
    const row = screen.getAllByRole('button', { expanded: false })[1]
    fireEvent.click(row)
    expect(screen.queryByRole('link', { name: 'Data' })).toBeNull()

    const snapshot = {
      address: strategies[1].details.vaultAddress,
      chainId: 1,
      apiVersion: '3.0.4',
      name: 'Beta strategy'
    }
    await act(async () => resolveResponse(new Response(JSON.stringify(snapshot))))
    expect(await screen.findByRole('link', { name: 'Data' })).toBeTruthy()
    const destination = renderHook(
      () => useVaultPageData({ vaultAddress: '0x2222222222222222222222222222222222222222', vaultChainId: 1 }),
      { wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider> }
    )
    await waitFor(() => expect(destination.result.current.vaultDetails?.name).toBe('Beta strategy'))
    expect(destination.result.current.isInitialLoading).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(1)
    destination.unmount()

    fireEvent.click(row)
    fireEvent.click(row)
    expect(screen.getByRole('link', { name: 'Data' })).toBeTruthy()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each([404, 503])('restores Data on a later visit after HTTP %s', async (status) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Unavailable', { status }))
    const queryClient = renderTable()
    const row = screen.getAllByRole('button', { expanded: false })[1]
    fireEvent.click(row)
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    expect(screen.queryByRole('link', { name: 'Data' })).toBeNull()

    fireEvent.click(row)
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60 * 60 * 1000)
    fireEvent.click(row)
    expect(await screen.findByRole('link', { name: 'Data' })).toBeTruthy()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it.each([404, 503])('withdraws a previously working Data link after HTTP %s', async (status) => {
    const queryClient = renderTable()
    const row = screen.getAllByRole('button', { expanded: false })[1]
    fireEvent.click(row)
    expect(await screen.findByRole('link', { name: 'Data' })).toBeTruthy()

    fireEvent.click(row)
    vi.mocked(fetch).mockResolvedValue(new Response('Unavailable', { status }))
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60 * 60 * 1000)
    fireEvent.click(row)
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('link', { name: 'Data' })).toBeNull()
    expect(screen.getByRole('link', { name: /0x222222/ })).toBeTruthy()
  })

  it('checks the target chain even when the same strategy address worked on another chain', async () => {
    const queryClient = renderTable([
      strategies[1],
      {
        ...strategies[2],
        details: { ...strategies[2].details, chainId: 8453, vaultAddress: strategies[1].details.vaultAddress }
      }
    ])
    fireEvent.click(screen.getByRole('button', { name: /Beta strategy/, expanded: false }))
    expect(await screen.findByRole('link', { name: 'Data' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Gamma allocator/, expanded: false }))
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))

    const links = screen.getAllByRole('link', { name: 'Data' })
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toBe('/vaults/1/0x2222222222222222222222222222222222222222')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
