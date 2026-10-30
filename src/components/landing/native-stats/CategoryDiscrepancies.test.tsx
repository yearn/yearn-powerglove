import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CategoryDiscrepancies } from './CategoryDiscrepancies'

const { useFetch, retry } = vi.hoisted(() => ({ useFetch: vi.fn(), retry: vi.fn() }))
vi.mock('./hooks', () => ({
  useFetch,
  fmt: (value: number | null) => (value === null ? '—' : `$${value}`),
  CHAIN_NAMES: { 1: 'Ethereum', 8453: 'Base' },
  powergloveVaultPath: (chain: number, address: string) => `/vault/${chain}/${address}`
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>
}))
const props = { category: 'Curation', protocol: 'yearn-curating', publicationId: 'saved-id' }
const overlap = {
  parentChainId: 1,
  parentAddress: '0x123',
  parentName: 'OUSD V2',
  childChainId: 1,
  childAddress: '0x456',
  childName: 'OUSD V1',
  strategyAddress: '0x789',
  ourDeductionUsd: 100,
  reason: 'Already deducted'
}
const category = {
  protocol: 'yearn-curating',
  oursOnly: [
    { chainId: 1, vaultAddress: '0x123', name: 'Yearn USDC', oursUsd: 50, defillamaUsd: 0, reason: 'Outside scope' }
  ],
  theirsOnly: [
    {
      chainId: 8453,
      vaultAddress: '0x456',
      name: 'External vault',
      oursUsd: null,
      defillamaUsd: 30,
      reason: 'Missing local price'
    }
  ],
  missedOverlaps: [],
  handledOverlaps: [overlap],
  unresolvedVaults: [],
  unverifiedOverlaps: []
}
const response = {
  publicationId: 'saved-id',
  reconciliation: {
    state: 'partial',
    asOfTimestamp: 1791503999,
    sources: { sha: 'source-sha' },
    coverage: { curation: 'Partial inventory', finance: 'Checked inventory' },
    categories: [category]
  }
}
afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  useFetch.mockReturnValue({ data: response, loading: false, error: null, retry })
})

describe('bidirectional category discrepancies', () => {
  it('pins evidence and shows both directions without changing unpriced into zero', () => {
    render(<CategoryDiscrepancies {...props} />)
    expect(useFetch).toHaveBeenCalledWith('/api/comparison/defillama-comparable?publicationId=saved-id', {
      enabled: true
    })
    expect(screen.getByRole('table', { name: 'Curation: only in ours' })).toBeTruthy()
    expect(screen.getByRole('table', { name: 'Curation: only in DefiLlama' })).toBeTruthy()
    expect(screen.getByText('Unpriced')).toBeTruthy()
    expect(screen.getByText('Missing local price')).toBeTruthy()
    expect(screen.getByText(/No missed overlap deductions/)).toBeTruthy()
    expect(screen.queryByText(/Already handled by both/)).toBeNull()
    expect(screen.queryByText(/Both directions at/)).toBeNull()
    expect(screen.queryByText(/Adapter source/)).toBeNull()
  })
  it('shows missed routes separately from handled ones', () => {
    useFetch.mockReturnValue({
      data: {
        ...response,
        reconciliation: {
          ...response.reconciliation,
          categories: [
            { ...category, missedOverlaps: [{ ...overlap, reason: 'Missing router mapping' }], handledOverlaps: [] }
          ]
        }
      }
    })
    render(<CategoryDiscrepancies {...props} />)
    expect(screen.getByRole('table', { name: 'Curation: missed overlaps' })).toBeTruthy()
    expect(screen.getByText('Missing router mapping')).toBeTruthy()
    expect(screen.getAllByText('$100')).toHaveLength(1)
    expect(screen.queryByText(/Already handled by both/)).toBeNull()
  })
  it('keeps a positive dust contribution distinct from zero', () => {
    useFetch.mockReturnValue({
      data: {
        ...response,
        reconciliation: {
          ...response.reconciliation,
          categories: [{ ...category, theirsOnly: [{ ...category.theirsOnly[0], defillamaUsd: 0.0001 }] }]
        }
      }
    })
    render(<CategoryDiscrepancies {...props} />)
    expect(screen.getByText('<$0.01')).toBeTruthy()
  })

  it('offers retry without claiming empty results on failure', () => {
    useFetch.mockReturnValue({ data: null, loading: false, error: 'failed', retry })
    render(<CategoryDiscrepancies {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Retry vault comparison' }))
    expect(retry).toHaveBeenCalledOnce()
    expect(screen.queryByText(/No confirmed/)).toBeNull()
  })
  it('does not fall back to a one-sided or mismatched publication', () => {
    useFetch.mockReturnValue({ data: { publicationId: 'saved-id' } })
    const { rerender } = render(<CategoryDiscrepancies {...props} />)
    expect(screen.getByText(/Bidirectional vault evidence is not available/)).toBeTruthy()
    useFetch.mockReturnValue({ data: { ...response, publicationId: 'other-id' } })
    rerender(<CategoryDiscrepancies {...props} />)
    expect(screen.getByText(/does not match/)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })
})
