import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { KongVaultListItem } from '@/types/kong'
import { EffectiveFeeCapitalDetails } from './EffectiveFeeCapitalDetails'
import { EffectiveFeesTable } from './EffectiveFeesTable'
import { feeCapitalVaults } from './effective-fee-capital'
import type { FeeStackSummary } from './types'
import type { OriginAudit, OriginGraph } from './vault-origin'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>
}))
vi.mock('@/lib/kong-vault-client', () => ({
  fetchKongVaultListRaw: async () => [],
  fetchKongVaultSnapshotRaw: async () => null
}))
vi.mock('@/lib/kong-strategy-names', () => ({ fetchStrategyDisplayNames: async () => ({}) }))
vi.mock('./hooks', async (original) => ({
  ...(await original<typeof import('./hooks')>()),
  useFetch: (url: string) => {
    urls.push(url)
    return {
      data: url.startsWith('/api/audit') ? audit : { ...graph, datasetId: mismatch ? 'other' : 'selected' },
      error: null,
      retry: vi.fn()
    }
  }
}))
const root = {
  vault: { address: '0xroot', chainId: 1, name: 'Example vault' },
  capitalUsd: 200,
  perfFee: 1000,
  mgmtFee: 0,
  children: [
    {
      vault: { address: '0xchild', chainId: 1, name: 'Downstream vault' },
      capitalUsd: 100,
      perfFee: 1000,
      mgmtFee: 0,
      children: []
    }
  ]
}
const stack: FeeStackSummary = {
  meta: { tvlDatasetId: 'selected' },
  chains: [
    {
      root: {
        vault: { address: '0xupstream', chainId: 1, name: 'Upstream vault' },
        capitalUsd: 80,
        perfFee: 500,
        mgmtFee: 15,
        children: []
      },
      maxDepth: 1,
      effectivePerfFee: 500,
      effectiveMgmtFee: 15
    }
  ],
  entries: [
    {
      vault: root.vault,
      roots: [root],
      memberAddresses: ['0xroot'],
      performanceFee: 1900,
      managementFee: 0,
      feeRateBasis: 'stack',
      adjustedTvlUsd: 120
    }
  ],
  maxDepth: 2,
  maxEffectivePerfFee: 1900,
  avgEffectivePerfFee: 1900,
  totalStackedCapital: 120
}
const audit: OriginAudit = {
  datasetId: 'selected',
  vaults: [
    {
      address: '0xroot',
      chainId: 1,
      name: 'Example vault',
      category: 'v3',
      vaultType: 1,
      tvlUsd: 200,
      countedTvlUsd: 120,
      isRetired: false,
      strategies: [
        { address: '0xchild', debtUsd: 100, targetVaultAddress: '0xchild', targetVaultChainId: 1 },
        { address: '0xordinary', debtUsd: 80, targetVaultAddress: null, targetVaultChainId: null }
      ]
    }
  ]
}
const graph: OriginGraph = {
  datasetId: 'selected',
  asOfTimestamp: 1,
  nodes: [
    {
      id: '1:0xchild',
      address: '0xchild',
      chainId: 1,
      name: 'Downstream vault',
      category: 'v3',
      nodeType: 'vault',
      rawTvlUsd: 100,
      externalTvlUsd: 100,
      isRetired: false
    },
    {
      id: '1:0xupstream',
      address: '0xupstream',
      chainId: 1,
      name: 'Upstream vault',
      category: 'v3',
      nodeType: 'vault',
      rawTvlUsd: 80,
      externalTvlUsd: 80,
      isRetired: false
    }
  ],
  edges: [
    {
      id: 'downstream',
      sourceNodeId: '1:0xroot',
      targetNodeId: '1:0xchild',
      holderAddress: '0xchild',
      kind: 'auto',
      tvlUsd: 100
    },
    {
      id: 'incoming',
      sourceNodeId: '1:0xupstream',
      targetNodeId: '1:0xroot',
      holderAddress: '0xroot',
      kind: 'auto',
      tvlUsd: 90,
      deductedTvlUsd: 80
    }
  ]
}
let urls: string[] = []
let mismatch = false
const clients: QueryClient[] = []
function Table({ metadata }: { metadata?: KongVaultListItem[] }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  if (metadata) client.setQueryData(['fee-vault-type-catalog'], metadata)
  return (
    <QueryClientProvider client={client}>
      <EffectiveFeesTable feeStack={stack} vaults={[]} chainSelector={null} />
    </QueryClientProvider>
  )
}
afterEach(() => {
  cleanup()
  for (const client of clients) client.clear()
  clients.length = 0
  urls = []
  mismatch = false
})
it('preserves the canonical vault list and rates while showing reported, upstream, and adjusted downstream capital', () => {
  render(<Table />)
  expect(screen.getByRole('heading', { name: 'Adjusted TVL and Fees by Vault' })).toBeTruthy()
  expect(urls).toContain('/api/audit/tree?datasetId=selected')
  expect(urls).toContain('/api/tvl/graph?includeRetired=true&datasetId=selected')
  const table = screen.getByRole('table', { name: 'Current effective fees for direct vault deposits' })
  expect(within(table).getByRole('columnheader', { name: 'Reported TVL' })).toBeTruthy()
  expect(within(table).getAllByRole('row')).toHaveLength(2)
  const row = within(table)
    .getByRole('rowheader', { name: /Example vault/ })
    .closest('tr')!
  expect(
    within(row)
      .getAllByRole('cell')
      .map((cell) => cell.textContent)
  ).toEqual(['$120', '$200', '19.0%', '0.00%'])
  fireEvent.click(screen.getByRole('button', { name: 'Fee breakdown for Example vault' }))
  const diagram = screen.getByRole('figure', { name: 'Capital and fee flows for Example vault' })
  const upstream = within(diagram).getByRole('region', { name: 'Upstream excluded capital' })
  const upstreamLink = within(upstream).getByRole('link', { name: /Open Upstream vault Powerglove page/ })
  expect(upstreamLink.getAttribute('target')).toBe('_blank')
  expect(within(upstream).getAllByText('$80')).toHaveLength(2)
  const upstreamCard = upstreamLink.closest('details')!
  expect(upstreamCard.hasAttribute('open')).toBe(false)
  fireEvent.click(upstreamLink)
  expect(upstreamCard.hasAttribute('open')).toBe(false)
  fireEvent.click(upstreamCard.querySelector('summary')!)
  expect(upstreamCard.hasAttribute('open')).toBe(true)
  expect(within(upstream).getByText('5.0% | 0.15%')).toBeTruthy()
  const selected = within(diagram).getByRole('region', { name: 'Selected vault' })
  const downstream = within(diagram).getByRole('region', { name: 'Downstream included capital' })
  expect(within(selected).getByText('$120')).toBeTruthy()
  expect(within(selected).getByText('$200')).toBeTruthy()
  const direct = within(diagram).getByRole('region', { name: 'Direct deposits' })
  expect(within(direct).getByText('Direct (non-Yearn) deposits')).toBeTruthy()
  expect(within(direct).getByText('$120')).toBeTruthy()
  expect(within(downstream).getByText('$120')).toBeTruthy()
  const downstreamLink = within(downstream).getByRole('link', { name: 'Open Downstream vault Powerglove page' })
  expect(downstreamLink.getAttribute('href')).toBe('/vaults/1/0xchild')
  const downstreamCard = downstreamLink.closest('details')!
  expect(downstreamCard.hasAttribute('open')).toBe(false)
  fireEvent.click(downstreamCard.querySelector('summary')!)
  expect(within(downstream).getByText('10.0% | 0.00%')).toBeTruthy()
  expect(upstreamCard.hasAttribute('open')).toBe(true)
  fireEvent.click(downstreamCard.querySelector('summary')!)
  expect(downstreamCard.hasAttribute('open')).toBe(false)
  expect(within(downstream).queryByRole('link', { name: /ordinary/ })).toBeNull()
  expect(within(downstream).getByText('Idle funds')).toBeTruthy()
  expect(within(downstream).getByText('$12')).toBeTruthy()
  expect(within(downstream).getByText('$48')).toBeTruthy()
  expect(screen.queryByText('Methodology')).toBeNull()
  expect(screen.queryByText(/Effective fees for a direct deposit/)).toBeNull()
  expect(screen.getByText('19.0%')).toBeTruthy()
  fireEvent.change(screen.getByRole('textbox', { name: 'Search effective fees' }), {
    target: { value: 'no matching vault' }
  })
  expect(screen.getByText('No vaults match these filters.')).toBeTruthy()
})
it('does not show upstream details from a mismatched publication', () => {
  mismatch = true
  render(<Table />)
  expect(screen.getByRole('button', { name: 'Retry TVL details' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Fee breakdown for Example vault' }))
  expect(screen.queryByRole('link', { name: 'Upstream vault' })).toBeNull()
  expect(screen.getByText('Upstream TVL is unavailable for this publication.')).toBeTruthy()
})

it('omits a known-zero upstream section while keeping downstream allocations', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  render(
    <QueryClientProvider client={client}>
      <EffectiveFeeCapitalDetails
        row={{ ...stack.entries![0], root, adjustedTvlUsd: 200 }}
        vaults={feeCapitalVaults({ ...audit, vaults: [{ ...audit.vaults[0], countedTvlUsd: 200 }] }, 'selected')}
        graph={graph}
        datasetId="selected"
        feeNodes={new Map()}
        navigable={new Set()}
      />
    </QueryClientProvider>
  )
  expect(screen.queryByRole('region', { name: 'Upstream excluded capital' })).toBeNull()
  expect(screen.getByRole('region', { name: 'Direct deposits' })).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Downstream included capital' })).toBeTruthy()
  expect(screen.getByText('Idle funds')).toBeTruthy()
})

it.each([
  { name: 'explicitly hidden', metadata: [{ ...root.vault, address: '0xROOT', isHidden: true }], visible: false },
  { name: 'explicitly visible', metadata: [{ ...root.vault, isHidden: false }], visible: true },
  { name: 'flag unavailable', metadata: [root.vault], visible: true },
  { name: 'metadata unavailable', metadata: [], visible: true },
  { name: 'hidden only on another chain', metadata: [{ ...root.vault, chainId: 10, isHidden: true }], visible: true }
])('keeps the correct Effective Fees rows when $name', ({ metadata, visible }) => {
  render(<Table metadata={metadata} />)
  const row = screen.queryByRole('button', { name: 'Fee breakdown for Example vault' })
  expect(row !== null).toBe(visible)
  if (!visible) expect(screen.getByText('No vaults match these filters.')).toBeTruthy()
})
