import { describe, expect, it } from 'vitest'
import { parseStatsSearch } from './stats-navigation'

describe('stats navigation', () => {
  it.each(['overview', 'fees', 'analysis'])('accepts the %s tab deep link', (tab) => {
    expect(parseStatsSearch({ tab })).toEqual({ tab })
  })

  it.each([
    ['vaults', 'overview'],
    ['curation', 'analysis'],
    ['comparison', 'analysis']
  ])('keeps the old %s link pointing to %s', (oldTab, tab) => {
    expect(parseStatsSearch({ tab: oldTab })).toEqual({ tab })
  })

  it('falls back to overview when the tab is missing or invalid', () => {
    expect(parseStatsSearch({})).toEqual({})
    expect(parseStatsSearch({ tab: 'unknown' })).toEqual({})
  })

  it('preserves the preview identifier used by shared QA links', () => {
    expect(parseStatsSearch({ tab: 'fees', preview: 'series-toggles' })).toEqual({
      tab: 'fees',
      preview: 'series-toggles'
    })
  })
})
