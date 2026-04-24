import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChainId } from '@/constants/chains'
import { MANAGEMENT_EVENT_TYPE_OPTIONS } from '@/lib/vault-events'
import type { VaultManagementEventType } from '@/types/vaultEventTypes'
import { useVaultManagementEventPages } from './useVaultEventPages'

const PAGE_SIZE = 50

export function useVaultManagementEvents(vaultAddress: string | undefined, chainId: ChainId | undefined) {
  const [eventType, setEventType] = useState<'all' | VaultManagementEventType>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const { allEvents, isLoading, isLoadingMore, hasMoreEvents, error, loadMoreEvents } = useVaultManagementEventPages(
    vaultAddress,
    chainId
  )
  const vaultKey = vaultAddress && chainId !== undefined ? `${chainId}:${vaultAddress.toLowerCase()}` : null
  const previousVaultKeyRef = useRef(vaultKey)

  useEffect(() => {
    if (previousVaultKeyRef.current === vaultKey) {
      return
    }

    previousVaultKeyRef.current = vaultKey
    setCurrentPage(1)
  })

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
