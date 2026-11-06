import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { VaultsHeadline } from './VaultHeadlineStats'

const retry = vi.fn()
const state = vi.hoisted(() => ({
  data: { totalTvl: 1500000, vaultCount: { active: 123, total: 150 } } as {
    totalTvl: number
    vaultCount: { active: number; total: number }
  } | null,
  loading: false,
  error: null as string | null
}))
vi.mock('./hooks', async (original) => ({
  ...(await original<typeof import('./hooks')>()),
  useFetch: () => ({ ...state, retry })
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  )
}))
afterEach(() => {
  cleanup()
  state.data = { totalTvl: 1500000, vaultCount: { active: 123, total: 150 } }
  state.loading = false
  state.error = null
  retry.mockClear()
})

it('shows the API headlines and links to stats without inventing a harvest count', () => {
  render(<VaultsHeadline />)
  expect(within(screen.getByRole('article', { name: 'Total TVL' })).getByText('$1.5M')).toBeTruthy()
  expect(within(screen.getByRole('article', { name: 'Active Vaults' })).getByText('123')).toBeTruthy()
  expect(within(screen.getByRole('article', { name: 'Weekly Harvests' })).getByText('—')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'See more stats' }).getAttribute('href')).toBe('/stats')
})

it('keeps loading and failed values unavailable and offers a retry', () => {
  state.data = null
  state.loading = true
  const { rerender } = render(<VaultsHeadline />)
  expect(screen.getAllByText('—')).toHaveLength(3)
  state.loading = false
  state.error = 'Unavailable'
  rerender(<VaultsHeadline />)
  expect(screen.getAllByText('—')).toHaveLength(3)
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(retry).toHaveBeenCalledOnce()
})
