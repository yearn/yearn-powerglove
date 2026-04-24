import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChainId } from '@/constants/chains'
import { dedupVaultUserEvents, fetchVaultUserEventsPageByType, sortEventsChronologically } from '@/lib/vault-events'
import type { VaultUserEvent, VaultUserEventType } from '@/types/vaultEventTypes'

const PAGE_SIZE = 50
const USER_EVENT_TYPES: readonly VaultUserEventType[] = ['deposit', 'withdraw', 'transfer']

interface UserEventSourceState {
  events: VaultUserEvent[]
  nextOffset: number
  hasMore: boolean
  isLoading: boolean
  isLoadingMore: boolean
  error: Error | null
}

type UserEventSourceStates = Record<VaultUserEventType, UserEventSourceState>

function getInitialSourceState(): UserEventSourceState {
  return {
    events: [],
    nextOffset: 0,
    hasMore: false,
    isLoading: false,
    isLoadingMore: false,
    error: null
  }
}

function getInitialSourceStates(): UserEventSourceStates {
  return {
    deposit: getInitialSourceState(),
    withdraw: getInitialSourceState(),
    transfer: getInitialSourceState()
  }
}

function mergeUserEvents(existingEvents: VaultUserEvent[], incomingEvents: VaultUserEvent[]): VaultUserEvent[] {
  if (incomingEvents.length === 0) {
    return existingEvents
  }

  const eventsById = new Map<string, VaultUserEvent>()

  for (const event of existingEvents) {
    eventsById.set(event.id, event)
  }

  for (const event of incomingEvents) {
    eventsById.set(event.id, event)
  }

  return sortEventsChronologically([...eventsById.values()])
}

function getVaultEventsError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function getSelectedEventTypes(eventType: 'all' | VaultUserEventType): readonly VaultUserEventType[] {
  return eventType === 'all' ? USER_EVENT_TYPES : [eventType]
}

export function useVaultEvents(vaultAddress: string | undefined, chainId: ChainId | undefined) {
  const [eventType, setEventType] = useState<'all' | VaultUserEventType>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [sources, setSources] = useState<UserEventSourceStates>(() => getInitialSourceStates())
  const vaultKey = vaultAddress && chainId !== undefined ? `${chainId}:${vaultAddress.toLowerCase()}` : null
  const activeVaultKeyRef = useRef<string | null>(vaultKey)
  const sourcesRef = useRef(sources)

  activeVaultKeyRef.current = vaultKey
  sourcesRef.current = sources

  useEffect(() => {
    setSources(getInitialSourceStates())
    setCurrentPage(1)

    if (!vaultAddress || chainId === undefined || !vaultKey) {
      return
    }

    let cancelled = false

    for (const sourceEventType of USER_EVENT_TYPES) {
      setSources((currentSources) => ({
        ...currentSources,
        [sourceEventType]: {
          ...currentSources[sourceEventType],
          isLoading: true,
          error: null
        }
      }))

      fetchVaultUserEventsPageByType(vaultAddress, chainId, sourceEventType)
        .then((page) => {
          if (cancelled || activeVaultKeyRef.current !== vaultKey) {
            return
          }

          setSources((currentSources) => ({
            ...currentSources,
            [sourceEventType]: {
              events: page.events,
              nextOffset: page.nextOffset,
              hasMore: page.hasMore,
              isLoading: false,
              isLoadingMore: false,
              error: null
            }
          }))
        })
        .catch((err) => {
          if (cancelled || activeVaultKeyRef.current !== vaultKey) {
            return
          }

          setSources((currentSources) => ({
            ...currentSources,
            [sourceEventType]: {
              ...currentSources[sourceEventType],
              isLoading: false,
              isLoadingMore: false,
              error: getVaultEventsError(err)
            }
          }))
        })
    }

    return () => {
      cancelled = true
    }
  }, [chainId, vaultAddress, vaultKey])

  const loadMoreSourceEvents = useCallback(
    async (sourceEventType: VaultUserEventType): Promise<number> => {
      if (!vaultAddress || chainId === undefined || !vaultKey) {
        return 0
      }

      const source = sourcesRef.current[sourceEventType]
      if (!source.hasMore || source.isLoading || source.isLoadingMore) {
        return 0
      }

      const requestVaultKey = vaultKey

      setSources((currentSources) => ({
        ...currentSources,
        [sourceEventType]: {
          ...currentSources[sourceEventType],
          isLoadingMore: true,
          error: null
        }
      }))

      try {
        const page = await fetchVaultUserEventsPageByType(vaultAddress, chainId, sourceEventType, source.nextOffset)

        if (activeVaultKeyRef.current !== requestVaultKey) {
          return 0
        }

        setSources((currentSources) => ({
          ...currentSources,
          [sourceEventType]: {
            events: mergeUserEvents(currentSources[sourceEventType].events, page.events),
            nextOffset: page.nextOffset,
            hasMore: page.hasMore,
            isLoading: false,
            isLoadingMore: false,
            error: null
          }
        }))

        return page.events.length
      } catch (err) {
        if (activeVaultKeyRef.current === requestVaultKey) {
          setSources((currentSources) => ({
            ...currentSources,
            [sourceEventType]: {
              ...currentSources[sourceEventType],
              isLoadingMore: false,
              error: getVaultEventsError(err)
            }
          }))
        }

        return 0
      }
    },
    [chainId, vaultAddress, vaultKey]
  )

  const loadMoreEvents = useCallback(async (): Promise<number> => {
    const selectedEventTypes = getSelectedEventTypes(eventType)
    const loadedCounts = await Promise.all(selectedEventTypes.map((type) => loadMoreSourceEvents(type)))
    return loadedCounts.reduce((total, count) => total + count, 0)
  }, [eventType, loadMoreSourceEvents])

  const selectedEventTypes = getSelectedEventTypes(eventType)
  const selectedSources = selectedEventTypes.map((type) => sources[type])

  const allEvents = useMemo(
    () => dedupVaultUserEvents(sortEventsChronologically(selectedEventTypes.flatMap((type) => sources[type].events))),
    [selectedEventTypes, sources]
  )

  const totalPages = Math.max(1, Math.ceil(allEvents.length / PAGE_SIZE))

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  const paginatedEvents = allEvents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const pendingEventTypes = selectedEventTypes.filter((type) => sources[type].isLoading)
  const isLoading = allEvents.length === 0 && pendingEventTypes.length > 0
  const isLoadingMore = selectedSources.some((source) => source.isLoadingMore)
  const hasMoreEvents = selectedSources.some((source) => source.hasMore)
  const sourceErrors = selectedSources
    .map((source) => source.error)
    .filter((sourceError): sourceError is Error => Boolean(sourceError))
  const error = allEvents.length === 0 && pendingEventTypes.length === 0 ? (sourceErrors[0] ?? null) : null

  return {
    events: paginatedEvents,
    totalCount: allEvents.length,
    depositCount: sources.deposit.events.length,
    withdrawCount: sources.withdraw.events.length,
    transferCount: sources.transfer.events.length,
    pendingEventTypes,
    isLoading,
    isLoadingMore,
    hasMoreEvents,
    error,
    loadMoreEvents,
    eventType,
    setEventType,
    currentPage,
    setCurrentPage,
    totalPages
  }
}
