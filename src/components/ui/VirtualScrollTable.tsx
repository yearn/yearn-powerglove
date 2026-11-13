import type React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

interface VirtualScrollTableProps<T> {
  data: T[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  getItemKey?: (item: T, index: number) => React.Key
  className?: string
  overscan?: number // Number of items to render outside visible area
}

export function VirtualScrollTable<T>({
  data,
  itemHeight,
  containerHeight,
  renderItem,
  getItemKey,
  className = '',
  overscan = 3
}: VirtualScrollTableProps<T>) {
  const [scrollTop, setScrollTop] = useState(0)
  const scrollElementRef = useRef<HTMLDivElement>(null)

  const { visibleItems, totalHeight, offsetY } = useMemo(() => {
    const totalHeight = data.length * itemHeight
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(data.length - 1, Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan)

    const visibleItems = data.slice(startIndex, endIndex + 1).map((item, index) => ({
      item,
      index: startIndex + index
    }))

    const offsetY = startIndex * itemHeight

    return { visibleItems, totalHeight, offsetY }
  }, [data, itemHeight, scrollTop, containerHeight, overscan])

  useEffect(() => {
    const scrollElement = scrollElementRef.current
    if (!scrollElement) return

    const handleScroll = () => {
      setScrollTop(scrollElement.scrollTop)
    }

    scrollElement.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollElement.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div
      data-virtual-scroll
      ref={scrollElementRef}
      className={`overflow-auto ${className} pb-[70px]`}
      style={{ height: containerHeight }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map(({ item, index }) => (
            <div key={getItemKey ? getItemKey(item, index) : index} style={{ height: itemHeight }}>
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
