import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { FeeYieldAnalysis } from './FeeYieldAnalysis'

vi.mock('./hooks', async (original) => ({
  ...(await original<typeof import('./hooks')>()),
  useFetch: () => ({
    data: {
      vaults: [
        { chainId: 1, tvlUsd: 200000000, feeYield: 1, quadrant: 'high_tvl_high_yield' },
        { chainId: 1, tvlUsd: 100000, feeYield: 1, quadrant: 'high_tvl_high_yield' }
      ],
      quadrants: { high_tvl_high_yield: [] }
    },
    loading: false,
    error: null
  })
}))
afterEach(cleanup)
it('visibly discloses excluded points and the broader quadrant counts', () => {
  render(<FeeYieldAnalysis />)
  const disclosure = screen.getByText(/1 excluded by/)
  expect(disclosure.textContent).toContain('Showing 1 vaults')
  expect(disclosure.className).not.toContain('sr-only')
  expect(disclosure.textContent).toContain('Quadrant counts include excluded vaults')
})
