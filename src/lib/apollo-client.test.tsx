import { ApolloProvider, useQuery } from '@apollo/client/react'
import { renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET_VAULT_TIMESERIES } from '@/graphql/queries/timeseries'
import { apolloClient } from '@/lib/apollo-client'

const variables = {
  chainId: 1,
  address: '0x0000000000000000000000000000000000000001',
  label: 'yvusd-estimated-apr',
  component: 'netAPY',
  limit: 10
}
const timeseries = [
  {
    chainId: 1,
    address: variables.address,
    label: variables.label,
    component: 'netAPY',
    period: '1 day',
    time: '1767225600',
    value: 0.05
  }
]
const wrapper = ({ children }: PropsWithChildren) => <ApolloProvider client={apolloClient}>{children}</ApolloProvider>

const response = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })

describe('Apollo GraphQL transport and React integration', () => {
  beforeEach(async () => {
    await apolloClient.clearStore()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads the application timeseries query over HTTP and reuses the cache', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ data: { timeseries } }))
    const { result } = renderHook(() => useQuery(GET_VAULT_TIMESERIES, { variables }), { wrapper })

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.data).toEqual({ timeseries }))
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeUndefined()
    expect(fetch).toHaveBeenCalledTimes(1)
    const [, request] = fetch.mock.calls[0]
    expect(JSON.parse(String(request?.body))).toMatchObject({ operationName: 'VaultTimeseries', variables })

    const cached = await apolloClient.query({ query: GET_VAULT_TIMESERIES, variables })
    expect(cached.data).toEqual({ timeseries })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('surfaces GraphQL errors without inventing data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ errors: [{ message: 'Timeseries unavailable' }] }))
    const { result } = renderHook(() => useQuery(GET_VAULT_TIMESERIES, { variables }), { wrapper })

    await waitFor(() => expect(result.current.error?.message).toContain('Timeseries unavailable'))
    expect(result.current.data).toBeUndefined()
  })

  it('does not request a skipped timeseries query', () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    const { result } = renderHook(() => useQuery(GET_VAULT_TIMESERIES, { variables, skip: true }), { wrapper })

    expect(result.current.loading).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
})
