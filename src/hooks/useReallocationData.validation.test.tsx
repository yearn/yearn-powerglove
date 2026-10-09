import { expect, it } from 'vitest'
import fixture from './allocation-checkpoints.fixture.json'
import { buildObservedReallocationPanels, isValidChartResponse } from './useReallocationData'

const response = () => structuredClone(fixture)
function panels(value: ReturnType<typeof response>) {
  if (!isValidChartResponse(value, value.vault.address, 1)) throw new Error('Invalid test fixture')
  return buildObservedReallocationPanels(
    value.entries,
    value.currentSnapshot!,
    new Map(Object.entries(value.boundaryStates)),
    new Map(Object.entries(value.strategies))
  )
}
it('accepts real schema 3 checkpoints and rejects older schemas', () => {
  const value = response()
  expect(isValidChartResponse(value, value.vault.address, 1)).toBe(true)
  value.schemaVersion = 2
  expect(isValidChartResponse(value, value.vault.address, 1)).toBe(false)
})
it('surfaces a one-unit net-change mismatch while keeping valid current data', () => {
  const value = response()
  value.entries[0].interval!.changes.totalIdle = (BigInt(value.entries[0].interval!.changes.totalIdle) + 1n).toString()
  const result = panels(value)
  expect(result.panels).toHaveLength(1)
  expect(result.issues[0].reason).toContain('Checkpoint changes')
})
it('rejects duplicate change addresses instead of silently overwriting', () => {
  const value = response()
  value.entries[0].interval!.changes.allocations.push(value.entries[0].interval!.changes.allocations[0])
  expect(panels(value).issues).toHaveLength(1)
})
it('rejects missing boundary evidence and preserves the remaining valid comparison', () => {
  const value = response()
  value.entries = value.entries.slice(0, 1)
  expect(panels(value).issues[0].reason).toContain('Missing boundary')
})
it('rejects mismatched endpoint balances even when each state independently balances', () => {
  const value = response()
  value.entries[0].interval!.startState.blockNumber--
  expect(panels(value).issues).toHaveLength(1)
})
it.each([undefined, {}, { status: 'available' }, { status: 'unavailable' }])(
  'rejects malformed APR metadata %j',
  (value) => {
    const payload = { ...response(), entries: [{ ...fixture.entries[0], expectedAprImpact: value }] }
    expect(isValidChartResponse(payload, fixture.vault.address, 1)).toBe(false)
  }
)
it('accepts an empty history with a current snapshot and no fictional opening comparison', () => {
  const value = response()
  value.entries = []
  value.currentSnapshot.interval = null as never
  expect(isValidChartResponse(value, value.vault.address, 1)).toBe(true)
  expect(panels(value).panels).toEqual([])
})
