import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TrancheAllocationHealth } from './TrancheAllocationHealth'

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isPending: false, isError: true }),
  useQueries: () =>
    Array.from({ length: 6 }, (_, index) => ({
      data: index === 0 ? { risk: { riskLevel: 2 }, blockTime: '1793750400' } : { risk: null },
      isPending: false,
      isError: false
    }))
}))

describe('tranche allocation health', () => {
  it('labels invented inputs and shows passing, warning and breached checks', () => {
    render(<TrancheAllocationHealth />)
    expect(screen.getByRole('region', { name: 'Allocation health' })).toBeTruthy()
    expect(screen.getByText('37.42%')).toBeTruthy()
    expect(
      screen.getByRole('img', { name: 'Junior and Senior capital split' }).getAttribute('aria-description')
    ).toContain('Junior and Equity 38.45%, Senior 61.55%')
    expect(screen.getByText(/Striped:.*in cooldown/)).toBeTruthy()
    expect(screen.getAllByText('Within limit').length).toBeGreaterThan(1)
    expect(screen.getAllByText('Breach').length).toBeGreaterThan(1)
    expect(screen.getAllByText('Near limit').length).toBeGreaterThan(1)
    expect(screen.getByText('Policy unresolved')).toBeTruthy()
    expect(screen.getByText('Provisional dependency loss inputs')).toBeTruthy()
    expect(screen.getByText(/These are stress assumptions/)).toBeTruthy()
    expect(screen.getByText('2/5 · provisional')).toBeTruthy()
    expect(screen.getAllByText('$1,771,339.41')[0]).toBeTruthy()
    expect(screen.getAllByText('Not calculated').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Morpho').length).toBeGreaterThan(0)
    expect(screen.getByText('Actual strategy exposure')).toBeTruthy()
    expect(screen.getByText('Dependency loss')).toBeTruthy()
    expect(screen.getByText(/Mock queue: \$150K in cooldown/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Guideline source/ }).getAttribute('href')).toContain('ab2cafcf')
  })
})
