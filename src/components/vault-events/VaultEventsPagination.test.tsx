import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VaultEventsPagination } from './VaultEventsPagination'

describe('VaultEventsPagination', () => {
  it('moves through event pages from the compact toolbar', () => {
    const onPageChange = vi.fn()

    render(<VaultEventsPagination currentPage={1} totalPages={24} onPageChange={onPageChange} />)

    expect(screen.getByText('Page 1 of 24')).not.toBeNull()
    expect((screen.getByRole('button', { name: 'First' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Prev' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Last' }))

    expect(onPageChange).toHaveBeenNthCalledWith(1, 2)
    expect(onPageChange).toHaveBeenNthCalledWith(2, 24)
  })
})
