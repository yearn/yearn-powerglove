import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ComparisonPanel } from './ComparisonPanel'

vi.mock('./CategoryDiscrepancies', () => ({
  CategoryDiscrepancies: ({ category }: { category: string }) => <div>{category} details</div>
}))
vi.mock('./hooks', async (original) => ({
  ...(await original<typeof import('./hooks')>()),
  useFetch: () => ({
    data: {
      ourTotal: 2,
      defillamaTotal: 2,
      difference: 0,
      differencePercent: 0,
      retiredTvl: 0,
      overlapDeducted: 0,
      crossChainOverlap: 0,
      grossTvl: 2,
      gapComponents: [],
      retiredTvlByChain: {},
      notes: [],
      byChain: [],
      byCategory: ['v1', 'v2'].map((category) => ({
        category,
        defillamaProtocol: 'yearn-finance',
        ours: 1,
        defillama: 1,
        difference: 0
      }))
    },
    loading: false,
    error: null
  })
}))
afterEach(cleanup)

it('connects each expanded category toggle to its own details even when protocols match', () => {
  render(<ComparisonPanel />)
  const toggles = ['v1', 'v2'].map((name) => screen.getByRole('button', { name }))
  for (const toggle of toggles) fireEvent.click(toggle)
  const ids = toggles.map((toggle) => toggle.getAttribute('aria-controls'))
  expect(new Set(ids).size).toBe(2)
  ids.forEach((id, index) => {
    expect(document.getElementById(id!)?.textContent).toContain(`v${index + 1} details`)
  })
})
