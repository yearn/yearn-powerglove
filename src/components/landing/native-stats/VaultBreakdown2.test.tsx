import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { VaultBreakdown2 } from './VaultBreakdown2'
import type { OriginAudit, OriginGraph } from './vault-origin'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>
}))
vi.mock('./hooks', async (original) => ({
  ...(await original<typeof import('./hooks')>()),
  useFetch: (url: string) => {
    urls.push(url)
    return {
      data: loading
        ? null
        : url.startsWith('/api/audit')
          ? audit
          : { ...graph, datasetId: mismatch ? 'other' : 'selected' },
      loading,
      error: null,
      retry
    }
  }
}))
const audit: OriginAudit = {
  datasetId: 'selected',
  vaults: [
    {
      address: '0xolder',
      chainId: 1,
      name: 'Older USDC',
      category: 'v2',
      vaultType: null,
      tvlUsd: 1494186.79,
      isRetired: true,
      strategies: []
    },
    {
      address: '0xmiddle',
      chainId: 1,
      name: 'USDC V2',
      category: 'v2',
      vaultType: null,
      tvlUsd: 4711427.15,
      isRetired: true,
      strategies: []
    },
    {
      address: '0xchild',
      chainId: 1,
      name: 'USDC-1',
      category: 'v3',
      vaultType: 1,
      tvlUsd: 19470602.78,
      isRetired: false,
      strategies: []
    }
  ]
}
const graph: OriginGraph = {
  datasetId: 'selected',
  asOfTimestamp: 1792022399,
  nodes: audit.vaults.map((v) => ({
    id: `1:${v.address}`,
    address: v.address,
    chainId: 1,
    name: v.name!,
    nodeType: 'vault',
    category: v.category,
    rawTvlUsd: v.tvlUsd!,
    externalTvlUsd: 0,
    isRetired: v.isRetired
  })),
  edges: [
    {
      id: 'incoming',
      sourceNodeId: '1:0xolder',
      targetNodeId: '1:0xmiddle',
      holderAddress: '0xmiddle',
      kind: 'auto',
      tvlUsd: 1482512.39
    },
    {
      id: 'outgoing',
      sourceNodeId: '1:0xmiddle',
      targetNodeId: '1:0xchild',
      holderAddress: '0xchild',
      kind: 'auto',
      tvlUsd: 4711427.15
    }
  ],
  diagnostics: { status: 'complete', mappingScope: 'known candidates' }
}
let urls: string[] = []
let mismatch = false
let loading = false
const retry = vi.fn()
afterEach(() => {
  cleanup()
  mismatch = false
  loading = false
  urls = []
  retry.mockClear()
})

it('pins the publication and keeps incoming and outgoing counterparties visible after searching', () => {
  render(<VaultBreakdown2 />)
  expect(urls).toContain('/api/tvl/graph?includeRetired=true&datasetId=selected')
  fireEvent.change(screen.getByRole('textbox', { name: 'Search vault origins' }), { target: { value: '0xmiddle' } })
  const row = screen.getByRole('rowheader', { name: /USDC V2/ }).closest('tr')!
  expect(
    within(row)
      .getAllByRole('cell')
      .map((cell) => cell.textContent)
  ).toEqual(['$4.71M', '$1.48M', '$3.23M', '$4.71M', '31.5%'])
  fireEvent.click(within(row).getByRole('button'))
  expect(screen.getByRole('link', { name: /Older USDC/ })).toBeTruthy()
  expect(screen.getByRole('link', { name: /USDC-1/ })).toBeTruthy()
  fireEvent.change(screen.getByRole('combobox', { name: 'Vault origin type' }), { target: { value: 'v3' } })
  expect(screen.getByText('No vaults match these filters.')).toBeTruthy()
})

it('does not show a table from mixed publications and provides a retry', () => {
  mismatch = true
  render(<VaultBreakdown2 />)
  expect(screen.queryByRole('table')).toBeNull()
  expect(screen.getByRole('alert').textContent).toContain('publications do not match')
  fireEvent.click(screen.getByRole('button', { name: 'Retry vault origins' }))
  expect(retry).toHaveBeenCalledTimes(2)
})

it('keeps unavailable loading data out of the table', () => {
  loading = true
  render(<VaultBreakdown2 />)
  expect(screen.getByRole('region', { name: 'Vault Breakdown 2 data' }).getAttribute('aria-busy')).toBe('true')
  expect(screen.queryByRole('table')).toBeNull()
})
