import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VaultEventsLoadingState } from './VaultEventsLoadingState'

describe('VaultEventsLoadingState', () => {
  it('matches a constrained activity viewport height', () => {
    const { container } = render(<VaultEventsLoadingState loadingState="loading events" minHeight={600} />)

    expect((container.firstElementChild as HTMLElement).style.minHeight).toBe('600px')
  })
})
