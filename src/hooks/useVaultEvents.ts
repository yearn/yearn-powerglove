import { useEffect, useState } from 'react'
import type { ChainId } from '@/constants/chains'
import { fetchVaultUserEvents } from '@/lib/vault-events'
import type { VaultUserEvent, VaultUserEventType } from '@/types/vaultEventTypes'

const PAGE_SIZE = 50

export function useVaultEvents(vaultAddress: string | undefined, chainId: ChainId | undefined) {
  const [allEvents, setAllEvents] = useState<VaultUserEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [eventType, setEventType] = useState<'all' | VaultUserEventType>('all')
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

    fetchVaultUserEvents(vaultAddress, chainId)
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

  const filteredEvents = eventType === 'all' ? allEvents : allEvents.filter((e) => e.type === eventType)

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE))
  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  const paginatedEvents = filteredEvents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const depositCount = allEvents.filter((e) => e.type === 'deposit').length
  const withdrawCount = allEvents.filter((e) => e.type === 'withdraw').length
  const transferCount = allEvents.filter((e) => e.type === 'transfer').length

  return {
    events: paginatedEvents,
    totalCount: filteredEvents.length,
    depositCount,
    withdrawCount,
    transferCount,
    isLoading,
    error,
    eventType,
    setEventType,
    currentPage,
    setCurrentPage,
    totalPages
  }
}
