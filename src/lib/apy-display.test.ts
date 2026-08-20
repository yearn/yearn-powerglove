import { describe, expect, it } from 'vitest'
import { buildPairedApyDisplay, formatApyValue, getEstimatedApySourceLabel } from '@/lib/apy-display'

describe('APY display helpers', () => {
  it('formats paired values locked first and preserves missing positions', () => {
    expect(buildPairedApyDisplay({ locked: null, unlocked: 0.051 })).toEqual({
      display: '- | 5.10%',
      tooltipItems: [
        { label: 'Locked yvUSD', value: '-', detail: undefined },
        { label: 'Unlocked yvUSD', value: '5.10%', detail: undefined }
      ]
    })
  })

  it('formats zero as a value', () => {
    expect(formatApyValue(0)).toBe('0.00%')
  })

  it('uses the approved source labels', () => {
    expect(getEstimatedApySourceLabel('oracle')).toBe('Oracle')
    expect(getEstimatedApySourceLabel('7day-hist')).toBe('max(7day, oracle)')
    expect(getEstimatedApySourceLabel('est-crv')).toBe('est-crv')
    expect(getEstimatedApySourceLabel('unknown')).toBe('Unknown')
  })
})
