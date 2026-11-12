import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchStrategyDisplayNames } from '@/lib/kong-strategy-names'
import { fetchKongVaultSnapshotRaw } from '@/lib/kong-vault-client'
import type { DownstreamCapitalNode } from './downstream-capital'
import { useFeeFlowStrategyNames } from './useFeeFlowStrategyNames'

vi.mock('@/lib/kong-vault-client', () => ({ fetchKongVaultSnapshotRaw: vi.fn() }))
vi.mock('@/lib/kong-strategy-names', () => ({ fetchStrategyDisplayNames: vi.fn() }))
const rootAddress = `0x${'11'.repeat(20)}`
const strategyAddress = `0x${'ab'.repeat(20)}`
const knownAddress = `0x${'33'.repeat(20)}`
const clients: QueryClient[] = []
const node = (
  address: string,
  name: string,
  chainId = 1,
  children: DownstreamCapitalNode[] = []
): DownstreamCapitalNode => ({
  vault: { address, name, chainId },
  capitalUsd: 100,
  perfFee: 1000,
  mgmtFee: null,
  kind: 'vault',
  children
})
function renderNames(roots: DownstreamCapitalNode[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  const result = renderHook(() => useFeeFlowStrategyNames(roots), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
  })
  return { ...result, client }
}
beforeEach(() => {
  vi.mocked(fetchKongVaultSnapshotRaw).mockReset().mockResolvedValue(null)
  vi.mocked(fetchStrategyDisplayNames).mockReset().mockResolvedValue({})
})
afterEach(() => {
  cleanup()
  for (const client of clients) client.clear()
  clients.length = 0
})

describe('fee flow strategy display names', () => {
  it('uses the vault snapshot strategy derivation, keys names by chain, and preserves canonical names and amounts', async () => {
    vi.mocked(fetchKongVaultSnapshotRaw).mockImplementation(async (chainId) => ({
      address: rootAddress,
      chainId,
      composition: [
        { address: strategyAddress.toUpperCase().replace('0X', '0x'), name: `Strategy on chain ${chainId}` },
        { address: knownAddress, name: 'Current alias' }
      ]
    }))
    const roots = [1, 10].map((chainId) =>
      node(rootAddress, 'Root', chainId, [
        node(strategyAddress, strategyAddress, chainId),
        node(knownAddress, 'Published product', chainId)
      ])
    )
    const { result, client } = renderNames(roots)
    await waitFor(() =>
      expect(result.current).toEqual({
        [`1:${strategyAddress}`]: 'Strategy on chain 1',
        [`10:${strategyAddress}`]: 'Strategy on chain 10'
      })
    )
    expect(fetchStrategyDisplayNames).not.toHaveBeenCalled()
    expect(client.getQueryData(['kong', 'vault', 'snapshot', 1, rootAddress])).toBeTruthy()
    expect(roots[0].children[0]).toMatchObject({
      capitalUsd: 100,
      perfFee: 1000,
      mgmtFee: null,
      vault: { name: strategyAddress }
    })
    expect(result.current[`1:${knownAddress}`]).toBeUndefined()
  })
  it('falls back to the existing strategy-name lookup when a historical strategy is missing from the current snapshot', async () => {
    vi.mocked(fetchStrategyDisplayNames).mockResolvedValue({
      [strategyAddress]: { name: 'Historical strategy', fromVault: false }
    })
    const { result } = renderNames([node(rootAddress, 'Root', 1, [node(strategyAddress, 'Strategy 1')])])
    await waitFor(() => expect(result.current[`1:${strategyAddress}`]).toBe('Historical strategy'))
    expect(fetchStrategyDisplayNames).toHaveBeenCalledWith(1, [strategyAddress])
  })
  it('retains address fallbacks when name services fail', async () => {
    vi.mocked(fetchKongVaultSnapshotRaw).mockRejectedValue(new Error('Snapshot unavailable'))
    vi.mocked(fetchStrategyDisplayNames).mockRejectedValue(new Error('Names unavailable'))
    const root = node(rootAddress, 'Root', 1, [node(strategyAddress, strategyAddress)])
    const { result, client } = renderNames([root])
    await waitFor(() => expect(fetchStrategyDisplayNames).toHaveBeenCalled())
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(result.current).toEqual({})
    expect(root.children[0].vault.name).toBe(strategyAddress)
  })
})
