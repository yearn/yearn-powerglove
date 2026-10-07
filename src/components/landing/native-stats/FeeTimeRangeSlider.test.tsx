import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeeDateSlider } from './FeeTimeRangeSlider'
import { feeRangeDay } from './fee-range-slider'

afterEach(cleanup)

describe('fee date slider', () => {
  it('commits keyboard edits and keeps the same focused thumb when the selected range changes', () => {
    const bounds = { start: '2020-12-01', end: '2026-10-04' }
    const selected = { start: '2025-01-15', end: '2025-02-10' }
    const onApply = vi.fn()
    const view = render(<FeeDateSlider bounds={bounds} selected={selected} onApply={onApply} />)
    const start = screen.getByRole('slider', { name: 'Range start' })
    start.focus()
    fireEvent.keyDown(start, { key: 'ArrowRight' })
    expect(onApply).toHaveBeenLastCalledWith({ start: '2025-01-16', end: '2025-02-10' })

    view.rerender(<FeeDateSlider bounds={bounds} selected={{ ...selected, start: '2025-01-16' }} onApply={onApply} />)
    expect(screen.getByRole('slider', { name: 'Range start' })).toBe(start)
    expect(document.activeElement).toBe(start)
    expect(start.getAttribute('aria-valuenow')).toBe(String(feeRangeDay('2025-01-16')))
    expect(start.getAttribute('aria-valuetext')).toBe('Jan 16, 2025')
    fireEvent.keyDown(start, { key: 'ArrowRight' })
    expect(onApply).toHaveBeenLastCalledWith({ start: '2025-01-17', end: '2025-02-10' })
  })

  it('updates the handles from a preset while keeping the full axis available', () => {
    const bounds = { start: '2020-12-01', end: '2026-10-04' }
    const onApply = vi.fn()
    const view = render(<FeeDateSlider bounds={bounds} selected={null} onApply={onApply} />)
    const start = screen.getByRole('slider', { name: 'Range start' })
    const end = screen.getByRole('slider', { name: 'Range end' })
    expect(start.getAttribute('aria-valuenow')).toBe(String(feeRangeDay(bounds.start)))
    expect(end.getAttribute('aria-valuenow')).toBe(String(feeRangeDay(bounds.end)))
    view.rerender(
      <FeeDateSlider bounds={bounds} selected={{ start: '2025-10-01', end: '2026-09-30' }} onApply={onApply} />
    )
    expect(start.getAttribute('aria-valuenow')).toBe(String(feeRangeDay('2025-10-01')))
    expect(start.getAttribute('aria-valuemin')).toBe(String(feeRangeDay(bounds.start)))
    expect(end.getAttribute('aria-valuemax')).toBe(String(feeRangeDay(bounds.end)))
    expect(onApply).not.toHaveBeenCalled()
  })
})
