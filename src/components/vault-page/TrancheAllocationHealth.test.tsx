import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TrancheAllocationHealth } from './TrancheAllocationHealth'

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
    expect(screen.getByText('All assumed dependency losses · ranked largest first')).toBeTruthy()
    expect(screen.getByText(/Each dependency’s actual strategy debt/)).toBeTruthy()
    expect(screen.getAllByText('Morpho').length).toBeGreaterThan(0)
    expect(screen.getByText('Actual strategy exposure')).toBeTruthy()
    expect(screen.getByText('Loss (mock rate)')).toBeTruthy()
    expect(screen.getByText(/Mock queue: \$150K in cooldown/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Guideline source/ }).getAttribute('href')).toContain('ab2cafcf')
  })
})
