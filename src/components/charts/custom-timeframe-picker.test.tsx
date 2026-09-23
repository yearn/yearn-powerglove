import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CustomTimeframePicker } from '@/components/charts/custom-timeframe-picker'

describe('CustomTimeframePicker', () => {
  it('selects a range across months and applies only after both dates are picked', () => {
    const onApply = vi.fn()
    const view = render(
      <CustomTimeframePicker value={{ start: '2025-01-01', end: '2025-01-31' }} active onApply={onApply} />
    )
    fireEvent.click(view.getByRole('button', { name: 'Custom' }))
    fireEvent.click(view.getByRole('button', { name: 'January 15, 2025' }))
    expect(view.getByRole('button', { name: 'Apply range' }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(view.getByRole('button', { name: 'Next month' }))
    fireEvent.click(view.getByRole('button', { name: 'February 10, 2025' }))
    expect(onApply).not.toHaveBeenCalled()
    fireEvent.click(view.getByRole('button', { name: 'Apply range' }))
    expect(onApply).toHaveBeenCalledWith({ start: '2025-01-15', end: '2025-02-10' })
  })

  it('rejects reversed dates and discards cancelled edits when reopened', () => {
    const onApply = vi.fn()
    const view = render(
      <CustomTimeframePicker value={{ start: '2025-01-01', end: '2025-01-31' }} active onApply={onApply} />
    )
    fireEvent.click(view.getByRole('button', { name: 'Custom' }))
    fireEvent.change(view.getByLabelText('Start date'), { target: { value: '2025-02-01' } })
    expect(view.getByRole('alert').textContent).toBe('End date must be on or after start date.')
    expect(view.getByRole('button', { name: 'Apply range' }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(view.getByRole('button', { name: 'Cancel' }))
    expect(onApply).not.toHaveBeenCalled()
    fireEvent.click(view.getByRole('button', { name: 'Custom' }))
    expect((view.getByLabelText('Start date') as HTMLInputElement).value).toBe('2025-01-01')
    expect((view.getByLabelText('End date') as HTMLInputElement).value).toBe('2025-01-31')
  })
})
