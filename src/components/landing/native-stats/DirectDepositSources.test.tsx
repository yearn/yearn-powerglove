import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DIRECT_DEPOSIT_REGISTRY } from '@/constants/direct-deposit-registry'
import { DirectDepositSources } from './DirectDepositSources'
import type { DirectDepositFeeRow } from './direct-deposit-fees'
import { RegisteredDepositCard } from './RegisteredDepositCard'
import { useDirectDepositSources } from './useDirectDepositSources'
import type { OriginGraph, OriginVault } from './vault-origin'
import { originVaultId } from './vault-origin'

const { findBlock, readBalances } = vi.hoisted(() => ({ findBlock: vi.fn(), readBalances: vi.fn() }))
vi.mock('@/lib/direct-deposit-balances', () => ({
  findDepositSnapshotBlock: findBlock,
  readDepositBalances: readBalances
}))
const vault = { chainId: 1, address: DIRECT_DEPOSIT_REGISTRY[1].depositors[2].vaultAddress, name: 'WETH-1' }
const root = { vault, capitalUsd: 100, perfFee: 1000, mgmtFee: 0, children: [] }
const row: DirectDepositFeeRow = {
  vault,
  root,
  roots: [root],
  performanceFee: 1000,
  managementFee: 0,
  feeRateBasis: 'stack'
}
const vaults = new Map<string, OriginVault>([
  [
    originVaultId(vault.chainId, vault.address),
    { ...vault, category: 'v3', vaultType: 1, tvlUsd: 100, isRetired: false, strategies: [] }
  ]
])
const graph: OriginGraph = { datasetId: 'published', asOfTimestamp: 1792627199, nodes: [], edges: [] }
const balances = {
  totalSupply: 100n,
  holders: [
    ...DIRECT_DEPOSIT_REGISTRY[0].depositors.map((depositor) => ({ address: depositor.address, shares: 5n })),
    { address: DIRECT_DEPOSIT_REGISTRY[1].depositors[2].address, shares: 20n }
  ]
}
const clients: QueryClient[] = []
function Sources({ row: sourceRow, graph: sourceGraph }: { row: DirectDepositFeeRow; graph: OriginGraph }) {
  const sources = useDirectDepositSources(sourceRow, vaults, sourceGraph, 'published', 100)
  const treasury = sources.groups.find((group) => group.id === 'treasury')
  const direct = treasury ? (treasury.amount === null ? null : 100 - treasury.amount) : 100
  return (
    <>
      <DirectDepositSources sources={sources} direct={direct} />
      <section aria-label="Upstream excluded capital">
        {treasury && treasury.amount !== 0 && <RegisteredDepositCard group={treasury} excluded />}
      </section>
    </>
  )
}
function show(overrides: { graph?: OriginGraph; row?: DirectDepositFeeRow } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  return render(
    <QueryClientProvider client={client}>
      <Sources row={row} graph={graph} {...overrides} />
    </QueryClientProvider>
  )
}
beforeEach(() => {
  vi.resetAllMocks()
  findBlock.mockResolvedValue(200n)
  readBalances.mockResolvedValue(balances)
})
afterEach(() => {
  cleanup()
  for (const client of clients.splice(0)) client.clear()
})

it('renders a reconciled breakdown with collapsed, independently linked wallets', async () => {
  show()
  const treasury = screen.getByLabelText('Yearn treasury deposits')
  const alchemix = screen.getByLabelText('Alchemix deposits')
  await waitFor(() => expect(within(treasury).getByText('$15')).toBeTruthy())
  expect(within(alchemix.querySelector('summary')!).getByText('$20')).toBeTruthy()
  expect(screen.getByText('$65')).toBeTruthy()
  expect(screen.getByText('$85')).toBeTruthy()
  expect(treasury.classList.contains('fee-flow-muted')).toBe(true)
  expect(treasury.closest('section')?.getAttribute('aria-label')).toBe('Upstream excluded capital')
  expect(treasury.hasAttribute('open')).toBe(false)
  fireEvent.click(treasury.querySelector('summary')!)
  const link = within(treasury).getByRole('link', { name: 'ychad.eth' })
  expect(link.getAttribute('target')).toBe('_blank')
  fireEvent.click(link)
  expect(treasury.hasAttribute('open')).toBe(true)
  expect(within(treasury).queryByText(/Snapshot:/)).toBeNull()
  expect(within(treasury).queryByText(/Included in total direct deposits/)).toBeNull()
  expect(findBlock).toHaveBeenCalledWith(1, graph.asOfTimestamp)
  expect(readBalances).toHaveBeenCalledWith(1, vault.address, expect.any(Array), 200n)
  expect(treasury.getAttribute('data-flow-next')).toBe('selected')
  expect(alchemix.getAttribute('data-flow-next')).toBe('selected')
  expect(screen.getByText('Other direct deposits').closest('article')?.getAttribute('data-flow-next')).toBe('selected')
  expect(screen.getByText('Total direct deposits').closest('[data-flow-id]')).toBeNull()
})

it('hides confirmed zero treasury deposits while preserving the total and other sources', async () => {
  const treasuryAddresses = new Set<string>(DIRECT_DEPOSIT_REGISTRY[0].depositors.map((depositor) => depositor.address))
  readBalances.mockResolvedValue({
    ...balances,
    holders: balances.holders.map((holder) => ({
      ...holder,
      shares: treasuryAddresses.has(holder.address) ? 0n : holder.shares
    }))
  })
  show()
  await waitFor(() => expect(screen.getByText('$80')).toBeTruthy())
  expect(screen.queryByLabelText('Yearn treasury deposits')).toBeNull()
  expect(screen.getByLabelText('Alchemix deposits')).toBeTruthy()
  expect(screen.getByText('$100')).toBeTruthy()
})

it('removes only zero treasury positions from the expanded list', async () => {
  readBalances.mockResolvedValue({
    ...balances,
    holders: balances.holders.map((holder, index) => ({
      ...holder,
      shares: index === 0 || index === 2 ? 0n : holder.shares
    }))
  })
  show()
  const treasury = screen.getByLabelText('Yearn treasury deposits')
  await waitFor(() => expect(within(treasury.querySelector('summary')!).getByText('$5')).toBeTruthy())
  fireEvent.click(treasury.querySelector('summary')!)
  expect(within(treasury).queryByRole('link', { name: 'ychad.eth' })).toBeNull()
  expect(within(treasury).queryByRole('link', { name: 'Robo Treasury' })).toBeNull()
  expect(within(treasury).getByRole('link', { name: 'treasury.ychad.eth' })).toBeTruthy()
})

it('keeps unknown treasury positions visible while omitting known zeros', async () => {
  readBalances.mockResolvedValue({
    ...balances,
    holders: balances.holders.map((holder, index) => ({
      ...holder,
      shares: index === 0 ? null : index === 2 ? 0n : holder.shares
    }))
  })
  show()
  await screen.findByRole('button', { name: 'Retry depositor balances' })
  const treasury = screen.getByLabelText('Yearn treasury deposits')
  fireEvent.click(treasury.querySelector('summary')!)
  expect(within(treasury).getByRole('link', { name: 'ychad.eth' })).toBeTruthy()
  expect(within(treasury).getByRole('link', { name: 'treasury.ychad.eth' })).toBeTruthy()
  expect(within(treasury).queryByRole('link', { name: 'Robo Treasury' })).toBeNull()
  expect(within(treasury.querySelector('summary')!).getByText('—')).toBeTruthy()
})

it('shows loading without fabricating a balance or an adjusted total', () => {
  findBlock.mockReturnValue(new Promise(() => {}))
  show()
  expect(screen.getByText(/Loading depositor balances/)).toBeTruthy()
  expect(screen.queryByText('$0')).toBeNull()
  expect(screen.getByText('Total direct deposits').parentElement?.querySelector('strong')?.textContent).toBe('—')
})

it('keeps errors unavailable and retries the treasury exclusion', async () => {
  readBalances.mockRejectedValueOnce(new Error('RPC unavailable'))
  show()
  const retry = await screen.findByRole('button', { name: 'Retry depositor balances' })
  expect(screen.queryByText('$0')).toBeNull()
  expect(screen.getByText('Total direct deposits').parentElement?.querySelector('strong')?.textContent).toBe('—')
  fireEvent.click(retry)
  await waitFor(() => expect(screen.getByText('$65')).toBeTruthy())
  expect(findBlock).toHaveBeenCalledTimes(1)
})

it('does not fetch or reuse balances for a mismatched publication', () => {
  show({ graph: { ...graph, datasetId: 'other' } })
  expect(findBlock).not.toHaveBeenCalled()
  expect(readBalances).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Retry depositor balances' })).toBeNull()
  expect(screen.queryByText('$0')).toBeNull()
})

it('does not fetch when no registered holder applies to the chain', () => {
  show({ row: { ...row, roots: [{ ...root, vault: { ...vault, chainId: 10 } }] } })
  expect(findBlock).not.toHaveBeenCalled()
  expect(screen.getByText('Direct (non-Yearn) deposits')).toBeTruthy()
  expect(screen.queryByText('Yearn treasury deposits')).toBeNull()
})
