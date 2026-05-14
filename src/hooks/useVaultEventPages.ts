import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChainId } from '@/constants/chains'
import {
  dedupVaultUserEvents,
  fetchVaultManagementEventsPage,
  fetchVaultUserEventsPage,
  sortEventsChronologically,
  type VaultEventsPage
} from '@/lib/vault-events'
import type { VaultActivityEvent, VaultManagementEvent, VaultUserEvent } from '@/types/vaultEventTypes'

type EventPageFetcher<T extends VaultActivityEvent> = (
  vaultAddress: string,
  chainId: number,
  offset?: number
) => Promise<VaultEventsPage<T>>

interface UseVaultEventPagesResult<T extends VaultActivityEvent> {
  allEvents: T[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMoreEvents: boolean
  error: Error | null
  loadMoreEvents: () => Promise<number>
}

function mergeUniqueSortedEvents<T extends VaultActivityEvent>(existingEvents: T[], incomingEvents: T[]): T[] {
  if (incomingEvents.length === 0) {
    return existingEvents
  }

  const eventsById = new Map<string, T>()

  for (const event of existingEvents) {
    eventsById.set(event.id, event)
  }

  for (const event of incomingEvents) {
    eventsById.set(event.id, event)
  }

  return sortEventsChronologically([...eventsById.values()])
}

function mergeUserEvents(existingEvents: VaultUserEvent[], incomingEvents: VaultUserEvent[]): VaultUserEvent[] {
  return dedupVaultUserEvents(mergeUniqueSortedEvents(existingEvents, incomingEvents))
}

function mergeManagementEvents(
  existingEvents: VaultManagementEvent[],
  incomingEvents: VaultManagementEvent[]
): VaultManagementEvent[] {
  return mergeUniqueSortedEvents(existingEvents, incomingEvents)
}

function getEventPagesError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function useVaultEventPages<T extends VaultActivityEvent>(
  vaultAddress: string | undefined,
  chainId: ChainId | undefined,
  fetchPage: EventPageFetcher<T>,
  mergeEvents: (existingEvents: T[], incomingEvents: T[]) => T[]
): UseVaultEventPagesResult<T> {
  const [allEvents, setAllEvents] = useState<T[]>([])
  const [nextOffset, setNextOffset] = useState(0)
  const [hasMoreEvents, setHasMoreEvents] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const queryKey = useMemo(() => {
    if (!vaultAddress || chainId === undefined) {
      return null
    }

    return `${chainId}:${vaultAddress.toLowerCase()}`
  }, [chainId, vaultAddress])

  const activeQueryKeyRef = useRef<string | null>(queryKey)
  activeQueryKeyRef.current = queryKey

  useEffect(() => {
    setAllEvents([])
    setNextOffset(0)
    setHasMoreEvents(false)
    setIsLoadingMore(false)
    setError(null)

    if (!vaultAddress || chainId === undefined || !queryKey) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    setIsLoading(true)

    fetchPage(vaultAddress, chainId, 0)
      .then((page) => {
        if (cancelled || activeQueryKeyRef.current !== queryKey) {
          return
        }

        setAllEvents(page.events)
        setNextOffset(page.nextOffset)
        setHasMoreEvents(page.hasMore)
        setIsLoading(false)
      })
      .catch((err) => {
        if (cancelled || activeQueryKeyRef.current !== queryKey) {
          return
        }

        setError(getEventPagesError(err))
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [chainId, fetchPage, queryKey, vaultAddress])

  const loadMoreEvents = useCallback(async (): Promise<number> => {
    if (!vaultAddress || chainId === undefined || !queryKey || !hasMoreEvents || isLoading || isLoadingMore) {
      return 0
    }

    const requestQueryKey = queryKey
    setIsLoadingMore(true)
    setError(null)

    try {
      const page = await fetchPage(vaultAddress, chainId, nextOffset)

      if (activeQueryKeyRef.current !== requestQueryKey) {
        return 0
      }

      setAllEvents((currentEvents) => mergeEvents(currentEvents, page.events))
      setNextOffset(page.nextOffset)
      setHasMoreEvents(page.hasMore)

      return page.events.length
    } catch (err) {
      if (activeQueryKeyRef.current === requestQueryKey) {
        setError(getEventPagesError(err))
      }

      return 0
    } finally {
      if (activeQueryKeyRef.current === requestQueryKey) {
        setIsLoadingMore(false)
      }
    }
  }, [chainId, fetchPage, hasMoreEvents, isLoading, isLoadingMore, mergeEvents, nextOffset, queryKey, vaultAddress])

  return {
    allEvents,
    isLoading,
    isLoadingMore,
    hasMoreEvents,
    error,
    loadMoreEvents
  }
}

export function useVaultUserEventPages(
  vaultAddress: string | undefined,
  chainId: ChainId | undefined
): UseVaultEventPagesResult<VaultUserEvent> {
  return useVaultEventPages(vaultAddress, chainId, fetchVaultUserEventsPage, mergeUserEvents)
}

export function useVaultManagementEventPages(
  vaultAddress: string | undefined,
  chainId: ChainId | undefined
): UseVaultEventPagesResult<VaultManagementEvent> {
  return useVaultEventPages(vaultAddress, chainId, fetchVaultManagementEventsPage, mergeManagementEvents)
}
