import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { usePagination } from './hooks'

function TableControls() {
  const [search, setSearch] = useState('')
  const { pagination } = usePagination(40, 10)
  return (
    <>
      <input aria-label="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
      {pagination}
    </>
  )
}

describe('table pagination', () => {
  it('retains the controls and focus while paging and updating search', () => {
    render(<TableControls />)
    const next = screen.getByRole('button', { name: 'Next' })
    const previous = screen.getByRole('button', { name: 'Prev' })
    next.focus()
    fireEvent.click(next)
    expect(screen.getByText('11–20 of 40')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Next' })).toBe(next)
    expect(document.activeElement).toBe(next)
    fireEvent.click(next)
    expect(screen.getByText('21–30 of 40')).toBeTruthy()
    expect(document.activeElement).toBe(next)
    fireEvent.click(next)
    expect(screen.getByText('31–40 of 40')).toBeTruthy()
    expect(document.activeElement).toBe(next)
    expect(next.getAttribute('aria-disabled')).toBe('true')
    expect((next as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(next)
    expect(screen.getByText('31–40 of 40')).toBeTruthy()
    previous.focus()
    fireEvent.click(previous)
    expect(document.activeElement).toBe(previous)
    fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), { target: { value: 'vault' } })
    expect(screen.getByRole('button', { name: 'Next' })).toBe(next)
    expect(screen.getByRole('button', { name: 'Prev' })).toBe(previous)
  })
})
