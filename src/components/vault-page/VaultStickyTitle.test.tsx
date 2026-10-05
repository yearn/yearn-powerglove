import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VaultStickyTitle } from './VaultStickyTitle'

describe('VaultStickyTitle', () => {
  it('adds a zero-height, borderless title overlay beneath the sticky breadcrumb', () => {
    render(<VaultStickyTitle vaultName="USDC-1 yVault" />)

    const titleRow = screen.getByTestId('vault-sticky-title')

    expect(titleRow.className).toContain('sticky')
    expect(titleRow.className).toContain('top-[75px]')
    expect(titleRow.className).toContain('min-[500px]:top-[131px]')
    expect(titleRow.className).toContain('md:top-[80px]')
    expect(titleRow.className).toContain('h-0')
    expect(titleRow.className).not.toContain('border')
    expect(titleRow.getAttribute('data-stuck')).toBe('false')
    expect(screen.queryByRole('heading', { level: 1, name: 'USDC-1 yVault' })).toBeNull()
    expect(screen.getByText('USDC-1 yVault').className).toContain('text-xl')
    expect(screen.getByText('USDC-1 yVault').className).toContain('sm:text-2xl')
  })
})
