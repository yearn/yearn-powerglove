import { expect, it } from 'vitest'
import { fmt } from './hooks'

it('places negative signs before currency symbols and avoids negative rounded zero', () => {
  expect(fmt(-2)).toBe('-$2')
  expect(fmt(-2000000)).toBe('-$2.0M')
  expect(fmt(2000000)).toBe('$2.0M')
  expect(fmt(-0.4)).toBe('$0')
  expect(fmt(null)).toBe('—')
})
