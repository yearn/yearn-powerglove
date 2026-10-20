import { Filter, X } from 'lucide-react'
import type React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { VAULT_TYPE_LIST } from '@/constants/vaultTypes'

// --- Constants object for better maintainability ---
const CONSTANTS = {
  TYPE_WIDTH_EXPANDED: 100, // px spacing between types when expanded
  TYPE_WIDTH_COLLAPSED: 100, // px spacing between types when collapsed
  TYPE_BUTTON_WIDTH: 100, // Width of the type button itself
  BUTTON_PADDING_X: 16, // px-3
  FILTER_ICON_WIDTH: 8, // w-4
  FILTER_ICON_MARGIN_RIGHT: 10 // mr-2
}

interface TypeSelectorProps {
  selectedTypes: string[]
  onTypeToggle: (type: string) => void
  onSetSelectedTypes?: (types: string[]) => void
  isCollapsed?: boolean
  onToggleCollapsed?: () => void
}

interface TypeData {
  type: string
  targetX: number
  isSelected: boolean
}

// --- Type position calculation hook similar to useIconPositions ---
const useTypePositions = (types: string[], selectedTypes: string[], isExpanded: boolean): TypeData[] => {
  const TYPE_WIDTH = isExpanded ? CONSTANTS.TYPE_WIDTH_EXPANDED : CONSTANTS.TYPE_WIDTH_COLLAPSED

  return useMemo(() => {
    const findNearestSelected = (unselectedIndex: number): number => {
      if (selectedTypes.length === 0) return 0
      let minDistance = Infinity
      let nearestIndex = 0
      selectedTypes.forEach((selectedType) => {
        const selectedIndex = types.indexOf(selectedType)
        if (selectedIndex !== -1) {
          const distance = Math.abs(selectedIndex - unselectedIndex)
          if (distance < minDistance) {
            minDistance = distance
            nearestIndex = selectedIndex
          }
        }
      })
      return nearestIndex
    }

    if (isExpanded) {
      return types.map((type, index) => ({
        type,
        targetX: index * TYPE_WIDTH,
        isSelected: selectedTypes.includes(type)
      }))
    }

    const selectedTypeObjects = types.filter((type) => selectedTypes.includes(type))
    return types.map((type, index) => {
      const isSelected = selectedTypes.includes(type)
      if (isSelected) {
        const selectedIndex = selectedTypeObjects.indexOf(type)
        return {
          type,
          targetX: selectedIndex * TYPE_WIDTH,
          isSelected: true
        }
      }
      const nearestSelectedIndex = findNearestSelected(index)
      const nearestSelectedType = types[nearestSelectedIndex]
      const packedIndex = selectedTypeObjects.indexOf(nearestSelectedType)
      return {
        type,
        targetX: Math.max(0, packedIndex) * TYPE_WIDTH,
        isSelected: false
      }
    })
  }, [types, selectedTypes, isExpanded, TYPE_WIDTH])
}

// --- Component width calculation hook ---
const useComponentWidth = (
  buttonText: string,
  isExpanded: boolean,
  hasSelectedTypes: boolean,
  typeCount: number,
  selectedTypeCount: number
) => {
  const textRef = useRef<HTMLSpanElement>(null)
  const [textWidth, setTextWidth] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: recalc width when button label changes
  useEffect(() => {
    if (textRef.current) {
      setTextWidth(textRef.current.offsetWidth)
    }
  }, [buttonText])

  const containerWidth = useMemo(() => {
    const baseWidth =
      textWidth + CONSTANTS.BUTTON_PADDING_X * 2 + CONSTANTS.FILTER_ICON_WIDTH + CONSTANTS.FILTER_ICON_MARGIN_RIGHT

    if (isExpanded) {
      const typesWidth = (typeCount - 1) * CONSTANTS.TYPE_WIDTH_EXPANDED + CONSTANTS.TYPE_BUTTON_WIDTH + 10
      return baseWidth + typesWidth
    }
    if (hasSelectedTypes) {
      const typesWidth = (selectedTypeCount - 1) * CONSTANTS.TYPE_WIDTH_COLLAPSED + CONSTANTS.TYPE_BUTTON_WIDTH + 10
      return baseWidth + typesWidth
    }
    return baseWidth
  }, [textWidth, isExpanded, hasSelectedTypes, typeCount, selectedTypeCount])

  return { textRef, containerWidth }
}

export const TypeSelector: React.FC<TypeSelectorProps> = ({
  selectedTypes,
  onTypeToggle,
  onSetSelectedTypes,
  isCollapsed = false,
  onToggleCollapsed
}) => {
  // --- Component state ---
  const [isHovered, setIsHovered] = useState(false)
  const [filterButtonText, setFilterButtonText] = useState('Filter Types')
  const isExpanded = isHovered

  // --- Derived data and constants ---
  const types = VAULT_TYPE_LIST
  // If no types are selected or all types are selected, treat as "all types selected"
  const isAllTypesSelected = selectedTypes.length === 0 || selectedTypes.length === types.length
  const hasSelectedTypes = selectedTypes.length > 0 && !isAllTypesSelected

  // --- Custom hooks for complex logic ---
  const typePositions = useTypePositions(types, selectedTypes, isExpanded)
  const { textRef, containerWidth } = useComponentWidth(
    filterButtonText,
    isExpanded,
    hasSelectedTypes,
    types.length,
    selectedTypes.length
  )

  // --- Effect for managing button text and selection reset ---
  useEffect(() => {
    if (!isExpanded) {
      if (onSetSelectedTypes && selectedTypes.length === types.length) {
        onSetSelectedTypes([])
        return
      }
      setFilterButtonText(hasSelectedTypes ? 'Selected Types' : 'Filter Types')
    }
  }, [isExpanded, hasSelectedTypes, onSetSelectedTypes, selectedTypes.length])

  // --- Event handlers ---
  const handleClearSelection = () => {
    if (onSetSelectedTypes) {
      onSetSelectedTypes([])
    } else {
      // Fallback: if onSetSelectedTypes is not provided, clear by toggling all selected types
      selectedTypes.forEach((type) => {
        onTypeToggle(type)
      })
    }
  }

  const handleTypeClick = (type: string) => {
    if (isExpanded && isAllTypesSelected && onSetSelectedTypes) {
      onSetSelectedTypes([type])
      return
    }
    onTypeToggle(type)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Toggle collapse button - keeping original functionality */}
      {onToggleCollapsed ? (
        <button
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          onClick={() => onToggleCollapsed()}
          aria-label="Toggle types collapse"
        >
          {isCollapsed ? '▾' : '▴'}
        </button>
      ) : null}

      {/* Main selector container - matching ChainSelector style */}
      <div
        className={`relative flex h-10 items-center border rounded-md transition-all duration-200 ${
          isHovered ? 'border-gray-400 shadow-sm' : 'border-gray-300'
        } bg-white`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ width: containerWidth }}
      >
        {/* Button content */}
        <div className="flex items-center px-3 py-2">
          {isExpanded && hasSelectedTypes ? (
            <button
              onClick={handleClearSelection}
              className="mr-2 p-0 border-none bg-transparent cursor-pointer hover:text-gray-800"
              title="Clear selection"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          ) : (
            <Filter className="w-4 h-4 text-gray-500 mr-2" />
          )}
          <span ref={textRef} className="text-sm font-medium text-gray-700 whitespace-nowrap">
            {filterButtonText}
          </span>
        </div>

        {/* Type container */}
        {(isExpanded || hasSelectedTypes) && (
          <div className="relative h-10 flex-1 pl-4">
            {typePositions.map((typeData) => (
              <button
                key={typeData.type}
                className={`absolute flex items-center justify-center rounded-md transition-all duration-300 ease-in-out focus:outline-none ${
                  typeData.isSelected ? `z-10` : `z-5`
                }`}
                style={{
                  transform: `translateX(${typeData.targetX}px)`,
                  top: typeData.isSelected || isExpanded ? '4px' : '6px',
                  width: typeData.isSelected || isExpanded ? '76px' : '60px',
                  height: typeData.isSelected || isExpanded ? '32px' : '28px',
                  opacity: typeData.isSelected || isExpanded ? 1 : 0
                }}
                onClick={() => handleTypeClick(typeData.type)}
                title={typeData.type}
              >
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-all duration-200 text-xs whitespace-nowrap ${
                    typeData.isSelected
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}
                >
                  <span className="hidden sm:inline text-xs">{typeData.type}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
