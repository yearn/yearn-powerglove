import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TrancheStrategyResearch } from './TrancheStrategyResearch'

vi.mock('@/lib/kong-vault-client', () => ({
  fetchKongVaultSnapshotRaw: async (_chain: number, address: string) => ({
    risk: address.toLowerCase().startsWith('0x0e297') ? { riskLevel: 2 } : null,
    blockTime: 1793800000
  })
}))
vi.mock('@/lib/yvusd-reporting-client', () => ({
  YVUSD_MORPHO_VAULT_ADDRESS: '0xf9bdd',
  fetchMorphoVaultLookthrough: async () => {
    throw new Error('Unavailable')
  },
  fetchPawnLooperRates: async () => ({
    leverage: 7.95,
    ltv: 0.8743,
    lltv: 0.915,
    borrowApr: 0.04,
    blockNumber: '77',
    observedAt: '2026-11-04T12:00:00Z'
  }),
  fetchPendlePositionSnapshot: async () => ({
    ptBalanceRaw: '0',
    ptDecimals: 18,
    maturity: '2026-11-26T00:00:00Z',
    blockNumber: '77',
    observedAt: '2026-11-04T12:00:00Z'
  })
}))

describe('strategy research in allocation health', () => {
  it('shows measured leverage and supplied ratings while preserving unavailable look-through and missing ratings', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })}>
        <TrancheStrategyResearch />
      </QueryClientProvider>
    )
    expect(await screen.findByText('Kong risk level 2/5')).toBeTruthy()
    expect(await screen.findByText(/Leverage 7.95×/)).toBeTruthy()
    expect((await screen.findAllByText('Kong rating not provided')).length).toBe(5)
    expect(await screen.findByText(/Morpho look-through unavailable/)).toBeTruthy()
    expect(screen.getByText(/Grove withdrawal path/)).toBeTruthy()
  })
})
