import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { getVaultListType } from '@/utils/vaultDataUtils'
import { RetiredVaultWarning } from './VaultRow'

afterEach(cleanup)

it('uses product types independently of V2 and V3 API generation', () => {
  expect(getVaultListType({ name: 'USDC yVault', apiVersion: '0.3.0' })).toBe('Single Asset')
  expect(getVaultListType({ name: 'USDC-1', apiVersion: '3.0.4', vaultType: '1' })).toBe('Single Asset')
  expect(getVaultListType({ name: 'Lender', apiVersion: '3.0.4', vaultType: '2' })).toBe('Tokenized Strategy')
  expect(getVaultListType({ name: 'Curve Factory', apiVersion: '0.4.6' })).toBe('Factory Vault')
  expect(getVaultListType({ name: 'External', apiVersion: 'unknown' })).toBe('External Vault')
})

it('exposes the retired warning tooltip and accessible label', async () => {
  render(<RetiredVaultWarning />)
  fireEvent.focus(screen.getByLabelText('retired'))
  expect((await screen.findByRole('tooltip')).textContent).toBe('retired')
})
