import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DIRECT_DEPOSIT_REGISTRY } from '@/constants/direct-deposit-registry'
import type { DepositBalances } from '@/lib/direct-deposit-balances'
import { EffectiveFeesTable } from './EffectiveFeesTable'
import type { FeeStackSummary } from './types'
import type { OriginAudit, OriginGraph } from './vault-origin'

const { findBlock, readBatch } = vi.hoisted(() => ({ findBlock: vi.fn(), readBatch: vi.fn() }))
vi.mock('@/lib/direct-deposit-balances', () => ({
  findDepositSnapshotBlock: findBlock,
  readDepositBalanceBatch: readBatch,
  readDepositBalances: vi.fn()
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>
}))
vi.mock('@/lib/kong-vault-client', () => ({
  fetchKongVaultListRaw: async () => [],
  fetchKongVaultSnapshotRaw: async () => null
}))
vi.mock('@/lib/kong-strategy-names', () => ({ fetchStrategyDisplayNames: async () => ({}) }))
vi.mock('./hooks', async (original) => ({
  ...(await original<typeof import('./hooks')>()),
  useFetch: (url: string) => ({
    data: url.startsWith('/api/audit') ? currentAudit : currentGraph,
    error: null,
    retry: vi.fn()
  })
}))

const vault = { chainId: 1, address: DIRECT_DEPOSIT_REGISTRY[1].depositors[2].vaultAddress, name: 'Treasury vault' }
const id = `1:${vault.address.toLowerCase()}`
const child = {
  vault: { chainId: 1, address: '0xchild', name: 'Child' },
  capitalUsd: 100,
  perfFee: 500,
  mgmtFee: 0,
  children: []
}
const root = { vault, capitalUsd: 200, perfFee: 1000, mgmtFee: 0, children: [child] }
const other = {
  vault: { chainId: 10, address: '0x1111111111111111111111111111111111111111', name: 'Other vault' },
  capitalUsd: 110,
  perfFee: 1000,
  mgmtFee: 0,
  children: []
}
const stack: FeeStackSummary = {
  meta: { tvlDatasetId: 'published' },
  chains: [],
  entries: [root, other].map((node) => ({
    vault: node.vault,
    roots: [node],
    memberAddresses: [node.vault.address],
    performanceFee: 1900,
    managementFee: 0,
    feeRateBasis: 'stack',
    adjustedTvlUsd: node === root ? 120 : 110
  })),
  maxDepth: 2,
  maxEffectivePerfFee: 1900,
  avgEffectivePerfFee: 1900,
  totalStackedCapital: 230
}
const audit: OriginAudit = {
  datasetId: 'published',
  vaults: [
    {
      ...vault,
      category: 'v3',
      vaultType: 1,
      tvlUsd: 200,
      countedTvlUsd: 120,
      isRetired: false,
      strategies: [
        { address: '0xchild', debtUsd: 100, targetVaultAddress: '0xchild', targetVaultChainId: 1 },
        { address: '0xordinary', debtUsd: 80, targetVaultAddress: null, targetVaultChainId: null }
      ]
    },
    { ...other.vault, category: 'v3', vaultType: 1, tvlUsd: 110, countedTvlUsd: 110, isRetired: false, strategies: [] }
  ]
}
const graph: OriginGraph = {
  datasetId: 'published',
  asOfTimestamp: 1000,
  nodes: [
    { id, ...vault, nodeType: 'vault', category: 'v3', rawTvlUsd: 200, externalTvlUsd: 120, isRetired: false },
    {
      id: '1:0xchild',
      ...child.vault,
      name: 'Child',
      nodeType: 'vault',
      category: 'v3',
      rawTvlUsd: 100,
      externalTvlUsd: 0,
      isRetired: false
    },
    {
      id: '1:0xupstream',
      address: '0xupstream',
      chainId: 1,
      name: 'Upstream',
      nodeType: 'vault',
      category: 'v3',
      rawTvlUsd: 80,
      externalTvlUsd: 80,
      isRetired: false
    }
  ],
  edges: [
    {
      id: 'allocation',
      sourceNodeId: id,
      targetNodeId: '1:0xchild',
      holderAddress: '0xchild',
      kind: 'share',
      tvlUsd: 100,
      deductedTvlUsd: 100
    },
    {
      id: 'upstream',
      sourceNodeId: '1:0xupstream',
      targetNodeId: id,
      holderAddress: '0xupstream',
      kind: 'share',
      tvlUsd: 80,
      deductedTvlUsd: 80
    }
  ]
}
const balances = (shares: bigint | null = 5n): Map<string, DepositBalances> =>
  new Map([
    [
      id,
      {
        totalSupply: 100n,
        holders: [
          ...DIRECT_DEPOSIT_REGISTRY[0].depositors.map((holder) => ({ address: holder.address, shares })),
          { address: DIRECT_DEPOSIT_REGISTRY[1].depositors[2].address, shares: 10n }
        ]
      }
    ]
  ])
let currentAudit = audit
let currentGraph = graph
const clients: QueryClient[] = []
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  const element = (value = stack) => (
    <QueryClientProvider client={client}>
      <EffectiveFeesTable feeStack={value} vaults={[]} chainSelector={null} />
    </QueryClientProvider>
  )
  return { ...render(element()), element }
}
const vaultRow = () => screen.getByRole('button', { name: 'Fee breakdown for Treasury vault' }).closest('tr')!
beforeEach(() => {
  vi.resetAllMocks()
  currentAudit = audit
  currentGraph = graph
  findBlock.mockImplementation(async (_, timestamp) => BigInt(timestamp / 100))
  readBatch.mockResolvedValue(balances())
})
afterEach(() => {
  cleanup()
  for (const client of clients.splice(0)) client.clear()
})

it('adjusts collapsed rows and sorting, moves treasury into excluded capital, and preserves source aggregates', async () => {
  const original = JSON.stringify({ stack, audit, graph })
  show()
  await waitFor(() => expect(within(vaultRow()).getByText('$90')).toBeTruthy())
  const rows = screen.getByRole('table').querySelectorAll('tbody > tr')
  expect(rows[0].textContent).toContain('Other vault')
  expect(within(vaultRow()).getByText('19.0%')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Fee breakdown for Treasury vault' }))
  const direct = screen.getByRole('region', { name: 'Direct deposits' })
  const excluded = screen.getByRole('region', { name: 'Upstream excluded capital' })
  expect(within(direct).queryByText('Yearn treasury deposits')).toBeNull()
  expect(within(direct).getByText('$70')).toBeTruthy()
  const treasury = within(excluded).getByLabelText('Yearn treasury deposits')
  expect(treasury.classList.contains('fee-flow-muted')).toBe(true)
  expect(within(treasury.querySelector('summary')!).getByText('$30')).toBeTruthy()
  expect(within(excluded).getByText('$110')).toBeTruthy()
  expect(within(screen.getByRole('region', { name: 'Selected vault' })).getByText('$90')).toBeTruthy()
  const downstream = screen.getByRole('region', { name: 'Downstream included capital' })
  expect(within(downstream).getByText('$45')).toBeTruthy()
  expect(within(downstream).getByText('$36')).toBeTruthy()
  expect(within(downstream).getByText('$9')).toBeTruthy()
  expect(within(downstream).getByText('$90')).toBeTruthy()
  expect(JSON.stringify({ stack, audit, graph })).toBe(original)
  expect(readBatch).toHaveBeenCalledTimes(1)
})

it('leaves a confirmed-zero treasury contribution included and hides its exclusion card', async () => {
  readBatch.mockResolvedValue(balances(0n))
  show()
  await waitFor(() => expect(within(vaultRow()).getByText('$120')).toBeTruthy())
  fireEvent.click(screen.getByRole('button', { name: 'Fee breakdown for Treasury vault' }))
  expect(screen.queryByLabelText('Yearn treasury deposits')).toBeNull()
  expect(screen.getByRole('region', { name: 'Selected vault' }).textContent).toContain('$120')
})

it('keeps missing treasury values unavailable and retries instead of showing published capital as adjusted', async () => {
  readBatch.mockRejectedValueOnce(new Error('archive RPC unavailable'))
  show()
  const retry = await screen.findByRole('button', { name: 'Retry treasury exclusions' })
  expect(within(vaultRow()).queryByText('$120')).toBeNull()
  expect(within(vaultRow()).getByText('—')).toBeTruthy()
  fireEvent.click(retry)
  await waitFor(() => expect(within(vaultRow()).getByText('$90')).toBeTruthy())
  expect(findBlock).toHaveBeenCalledTimes(1)
})

it('preserves a known treasury adjustment when an included depositor is unavailable', async () => {
  const partial = balances()
  partial.get(id)!.holders[3].shares = null
  readBatch.mockResolvedValue(partial)
  show()
  await waitFor(() => expect(within(vaultRow()).getByText('$90')).toBeTruthy())
  expect(screen.queryByRole('button', { name: 'Retry treasury exclusions' })).toBeNull()
})

it('isolates delayed balances when the selected publication changes', async () => {
  let finish!: (value: Map<string, DepositBalances>) => void
  const pending = new Promise<Map<string, DepositBalances>>((resolve) => {
    finish = resolve
  })
  readBatch.mockImplementation(async (_, __, block) => (block === 10n ? pending : balances()))
  const rendered = show()
  await waitFor(() => expect(readBatch).toHaveBeenCalledTimes(1))
  currentAudit = { ...audit, datasetId: 'new' }
  currentGraph = { ...graph, datasetId: 'new', asOfTimestamp: 2000 }
  rendered.rerender(rendered.element({ ...stack, meta: { tvlDatasetId: 'new' } }))
  await waitFor(() => expect(within(vaultRow()).getByText('$90')).toBeTruthy())
  await act(async () => {
    finish(balances(10n))
    await pending
  })
  expect(within(vaultRow()).getByText('$90')).toBeTruthy()
  expect(readBatch).toHaveBeenCalledTimes(2)
})
