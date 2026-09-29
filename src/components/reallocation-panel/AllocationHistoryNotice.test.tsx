import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AllocationHistoryNotice } from '@/components/reallocation-panel/AllocationHistoryNotice'

describe('AllocationHistoryNotice', () => {
  it('shows no warning for verified history or an unsupported vault', () => {
    render(<AllocationHistoryNotice />)
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('shows the query failure separately from the rest of the vault', () => {
    render(<AllocationHistoryNotice error="Allocation history API returned an invalid chart response" />)
    expect(screen.getByRole('alert').textContent).toContain('Allocation history unavailable')
    expect(screen.getByRole('alert').textContent).toContain('invalid chart response')
  })
  it('identifies omitted intervals and explains that verified history remains available', () => {
    render(<AllocationHistoryNotice issues={[{ entryId: 'entry-1', reason: 'Missing boundary state: opening' }]} />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Allocation history incomplete')
    expect(alert.textContent).toContain('entry-1')
    expect(alert.textContent).toContain('Missing boundary state: opening')
    expect(alert.textContent).toContain('Verified intervals remain available')
  })
})
