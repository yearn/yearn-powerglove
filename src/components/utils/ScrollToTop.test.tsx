import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import ScrollToTop from './ScrollToTop'

const { subscribe } = vi.hoisted(() => ({ subscribe: vi.fn((_event: string, _listener: unknown) => vi.fn()) }))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => ({ subscribe }) }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  subscribe.mockClear()
})

it('preserves scroll for section navigation but resets on a different page', () => {
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  render(<ScrollToTop />)
  const onResolved = subscribe.mock.calls[0][1] as (event: {
    fromLocation?: { pathname: string; hash?: string }
    toLocation: { pathname: string; hash?: string }
  }) => void
  onResolved({
    fromLocation: { pathname: '/vaults/1/vault', hash: 'vault-performance' },
    toLocation: { pathname: '/vaults/1/vault', hash: 'vault-strategies' }
  })
  expect(scroll).not.toHaveBeenCalled()
  onResolved({ fromLocation: { pathname: '/vaults/1/vault' }, toLocation: { pathname: '/stats' } })
  expect(scroll).toHaveBeenCalledWith(0, 0)
})
