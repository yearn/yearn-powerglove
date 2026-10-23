import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuditPanel, computeCountedTvl } from './AuditPanel'

const address = `0x${'11'.repeat(20)}`
const vault = {
  address,
  chainId: 1,
  name: 'Example vault',
  category: 'v3',
  vaultType: null,
  tvlUsd: 100,
  countedTvlUsd: 0,
  isRetired: false,
  isHidden: false,
  strategies: []
}
let membership: unknown = null
let auditError: string | null = null
const retry = vi.fn()
vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: { children: ReactNode }) => <span>{children}</span> }))
vi.mock('./hooks', async (original) => ({
  ...(await original<typeof import('./hooks')>()),
  useFetch: (url: string) => ({
    data: url.startsWith('/api/audit/tree')
      ? { summedTvl: 100, overlapTvl: 100, crossChainOverlap: 0, vaultCount: 1, vaults: [vault], crossChainVaults: [] }
      : membership,
    loading: false,
    error: url.startsWith('/api/audit/tree') ? auditError : null,
    retry,
    fetchedAt: null
  })
}))
afterEach(() => {
  cleanup()
  membership = null
  auditError = null
  retry.mockClear()
})
describe('native audit accounting and verified membership', () => {
  it('uses native counted zero and preserves unknown amounts', () => {
    expect(computeCountedTvl(vault)).toBe(0)
    expect(computeCountedTvl({ ...vault, countedTvlUsd: null })).toBeNull()
  })
  it('does not infer inclusion from a missing response or an empty missing list', () => {
    membership = { diff: { missingFromDefillama: [] }, includedVaults: [] }
    render(<AuditPanel />)
    expect(screen.getByText('Example vault').textContent).toBe('Example vault')
    expect(document.querySelector('.audit-dl-counted-tag')).toBeNull()
  })
  it('shows inclusion only with positive membership evidence', () => {
    membership = { diff: { missingFromDefillama: [] }, includedVaults: [{ chainId: 1, vaultAddress: address }] }
    render(<AuditPanel />)
    expect(document.querySelector('.audit-dl-counted-tag')?.textContent).toBe('DL')
  })
})

it('keeps the audit tree visible when the optional comparison diff is omitted', () => {
  membership = { includedVaults: [] }
  render(<AuditPanel />)
  expect(screen.getByText('Example vault')).toBeTruthy()
  expect(document.querySelector('.audit-dl-counted-tag')).toBeNull()
})
it('shows and retries audit-tree failures', () => {
  auditError = 'Request failed'
  render(<AuditPanel />)
  expect(screen.getByRole('alert').textContent).toContain('Request failed')
  fireEvent.click(screen.getByRole('button', { name: 'Retry vault breakdown' }))
  expect(retry).toHaveBeenCalledOnce()
})
