import { useEffect, useMemo, useState } from 'react'
import type { ChainId } from '@/constants/chains'
import { fetchVaultManagementEvents, MANAGEMENT_EVENT_TYPE_OPTIONS } from '@/lib/vault-events'
import type { VaultManagementEvent, VaultManagementEventType } from '@/types/vaultEventTypes'

const PAGE_SIZE = 50

export function useVaultManagementEvents(vaultAddress: string | undefined, chainId: ChainId | undefined) {
  const [allEvents, setAllEvents] = useState<VaultManagementEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [eventType, setEventType] = useState<'all' | VaultManagementEventType>('all')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    if (!vaultAddress || !chainId) {
      setAllEvents([])
      setIsLoading(false)
      setCurrentPage(1)
      return
    }

    let cancelled = false
    setCurrentPage(1)
    setIsLoading(true)
    setError(null)

    fetchVaultManagementEvents(vaultAddress, chainId)
      .then((events) => {
        if (!cancelled) {
          setAllEvents(events)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [vaultAddress, chainId])

  const filteredEvents = eventType === 'all' ? allEvents : allEvents.filter((event) => event.type === eventType)
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE))

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  const paginatedEvents = filteredEvents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const countsByType = useMemo(() => {
    const counts = new Map<VaultManagementEventType, number>()

    for (const event of allEvents) {
      counts.set(event.type, (counts.get(event.type) ?? 0) + 1)
    }

    return counts
  }, [allEvents])

  const availableEventTypeOptions = useMemo(
    () =>
      MANAGEMENT_EVENT_TYPE_OPTIONS.filter(
        (option) => option.value === 'all' || (countsByType.get(option.value) ?? 0) > 0
      ),
    [countsByType]
  )

  useEffect(() => {
    if (eventType !== 'all' && !availableEventTypeOptions.some((option) => option.value === eventType)) {
      setEventType('all')
    }
  }, [availableEventTypeOptions, eventType])

  return {
    allEvents,
    events: paginatedEvents,
    totalCount: filteredEvents.length,
    allEventCount: allEvents.length,
    countsByType,
    availableEventTypeOptions,
    isLoading,
    error,
    eventType,
    setEventType,
    currentPage,
    setCurrentPage,
    totalPages
  }
}
