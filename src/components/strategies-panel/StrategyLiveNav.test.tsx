import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { encodeAbiParameters, parseAbiParameters } from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStrategiesData } from '@/hooks/useStrategiesData'
import { mapKongSnapshotToVaultExtended } from '@/lib/kong-vault-derivation'
import { StrategyRow } from './StrategyRow'

const { rpcRequest } = vi.hoisted(() => ({ rpcRequest: vi.fn() }))
vi.mock('@/lib/public-client', async () => {
  const { createPublicClient, custom } = await import('viem')
  return { getPublicClient: () => createPublicClient({ transport: custom({ request: rpcRequest }) }) }
})
vi.mock('@/contexts/useVaults', () => ({ useVaults: () => ({ vaults: [] }) }))
vi.mock('@/contexts/useTokenAssets', () => ({ useTokenAssetsContext: () => ({ assets: [] }) }))

const parent = '0x1111111111111111111111111111111111111111'
const strategy = '0x2222222222222222222222222222222222222222'
const asset = '0x3333333333333333333333333333333333333333'

// Real V2 strategies() return order: fee, activation, ratio, min/max per harvest,
// last report, total debt, gains, losses. V3 incorrectly reads the ratio as debt.
const v2Return = encodeAbiParameters(
  parseAbiParameters('uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256'),
  [0n, 1732230551n, 10000n, 0n, 2n ** 256n - 1n, 1790705795n, 12_446_956_000_000n, 0n, 0n]
)
const v3Return = encodeAbiParameters(parseAbiParameters('uint256, uint256, uint256, uint256'), [
  1n,
  2n,
  800_000_000n,
  0n
])

function ExpandedRow({ apiVersion, name }: { apiVersion: string; name: string }) {
  const vault = mapKongSnapshotToVaultExtended({
    address: parent,
    chainId: 1,
    apiVersion,
    name,
    totalAssets: '12446956000000',
    asset: { address: asset, decimals: 6, symbol: 'USDC' },
    composition: [
      {
        address: strategy,
        name: 'Funded strategy',
        status: 'active',
        debtRatio: '10000',
        totalDebt: '12446956000000',
        totalDebtUsd: 12_446_956,
        currentDebt: '800000000',
        currentDebtUsd: 1600
      }
    ]
  })
  const { strategies } = useStrategiesData(1, vault)
  return <StrategyRow strategy={strategies[0]} isExpanded onToggle={() => {}} />
}

beforeEach(() => {
  rpcRequest.mockReset()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) =>
      input.startsWith('https://coins.llama.fi/')
        ? new Response(JSON.stringify({ coins: { [`ethereum:${asset}`]: { price: 2, timestamp: 1700000000 } } }))
        : new Response('Not found', { status: 404 })
    )
  )
})
afterEach(() => vi.unstubAllGlobals())

function renderRow(apiVersion: string, name: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ExpandedRow apiVersion={apiVersion} name={name} />
    </QueryClientProvider>
  )
  return client
}

describe('Live NAV contract compatibility', () => {
  it('does not guess a contract layout when the version is unknown', async () => {
    const client = renderRow('', 'Unknown vault')
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(screen.queryByRole('button', { name: 'Live NAV calculation' })).toBeNull()
    expect(rpcRequest).not.toHaveBeenCalled()
  })

  it.each(['Curve DOLA-sUSDe Factory yVault', 'USDC yVault'])(
    'reads V2 total debt rather than debt ratio for %s',
    async (name) => {
      rpcRequest.mockResolvedValue(v2Return)
      const client = renderRow('0.4.6', name)
      await waitFor(() => expect(client.isFetching()).toBe(0))
      expect(screen.getByRole('link', { name: /12,446,956 USDC/ })).toBeTruthy()
      expect(screen.getByText(/Live calculation: total debt/).textContent).toContain('$24.9M')
      expect(screen.getByRole('link', { name: /12,446,956 USDC/ }).getAttribute('href')).toBe(
        `https://etherscan.io/address/${parent}#readContract`
      )
      expect(screen.getByRole('button', { expanded: true }).textContent).toContain('$12.4M')
      expect(rpcRequest).toHaveBeenCalledTimes(1)
    }
  )

  it.each([
    {
      response: encodeAbiParameters(
        parseAbiParameters('uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256'),
        [0n, 1n, 10000n, 0n, 0n, 123n, 0n, 0n, 0n]
      ),
      expected: '$0.00'
    },
    { response: '0x', expected: 'Unavailable without both inputs' }
  ])('distinguishes zero V2 debt from unreadable debt: $expected', async ({ response, expected }) => {
    rpcRequest.mockResolvedValue(response)
    const client = renderRow('0.4.6', 'V2 vault')
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(screen.getByText(/Live calculation:/).textContent).toContain(expected)
  })

  it('does not value V2 debt at zero when the underlying price is unavailable', async () => {
    rpcRequest.mockResolvedValue(v2Return)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not found', { status: 404 })))
    const client = renderRow('0.4.6', 'V2 vault')
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(screen.getByRole('link', { name: /12,446,956 USDC/ })).toBeTruthy()
    expect(screen.getByText(/Live calculation:/).textContent).toContain('Unavailable without both inputs')
  })

  it.each(['USDC allocator', 'Factory-named V3 allocator'])(
    'still reads and calculates V3 live debt for %s',
    async (name) => {
      rpcRequest.mockResolvedValue(v3Return)
      renderRow('3.0.4', name)
      expect(await screen.findByRole('link', { name: /800 USDC/ })).toBeTruthy()
      expect(screen.getByText(/Live calculation:/).textContent).toContain('$1,600')
      expect(screen.queryByText('NAV valuation basis: Kong totalDebtUsd')).toBeNull()
      expect(rpcRequest).toHaveBeenCalledTimes(1)
    }
  )
})
