import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { StatsFeesSkeleton, StatsPlotSkeleton, StatsTableSkeleton, StatsTvlSkeleton } from './StatsLoadingSkeletons'

afterEach(cleanup)

it('reserves every fee section in the final page order before data arrives', () => {
  const { container } = render(<StatsFeesSkeleton />)
  expect(
    [...container.querySelectorAll('section[aria-busy="true"]')].map((section) => section.getAttribute('aria-label'))
  ).toEqual([
    'Loading Adjusted TVL and Fees by Vault',
    'Loading Monthly Earnings & Fees',
    'Loading Monthly Fees per $1 of TVL (Annualized)',
    'Loading Earnings by Chain',
    'Loading Earnings by Vault Type',
    'Loading Earnings by Vault',
    'Loading Monthly Vault Earnings'
  ])
  expect(container.querySelectorAll('.fee-summary-stat')).toHaveLength(4)
  expect(container.querySelectorAll('.stats-skeleton-plot')).toHaveLength(5)
  expect(container.querySelectorAll('.stats-skeleton-spinner')).toHaveLength(7)
  expect(container.querySelectorAll('.stats-skeleton-spinner img[src="/logo.svg"]')).toHaveLength(7)
  expect(screen.queryByRole('button')).toBeNull()
  expect(container.textContent).not.toContain('$0')
})

it('reserves chain rows according to the selected chain scope', () => {
  const { container, rerender } = render(<StatsTvlSkeleton />)
  expect(container.querySelectorAll('.chain-stat-row')).toHaveLength(9)
  rerender(<StatsTvlSkeleton chainCount={1} />)
  expect(container.querySelectorAll('.chain-stat-row')).toHaveLength(1)
})

it('renders plot-only and table-only placeholders without nesting section cards', () => {
  const { container } = render(
    <>
      <StatsPlotSkeleton />
      <StatsTableSkeleton monthly bodyOnly />
    </>
  )
  expect(container.querySelector('.card')).toBeNull()
  expect(container.querySelectorAll('tbody tr')).toHaveLength(12)
  expect(container.querySelectorAll('thead th')).toHaveLength(14)
})
