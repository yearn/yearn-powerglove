import { Search, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

export function StatsTableSearch({
  mobile,
  value,
  onChange,
  label
}: {
  mobile: boolean
  value: string
  onChange: (value: string) => void
  label: string
}) {
  const [expanded, setExpanded] = useState(Boolean(value))
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const focusOnExpand = useRef(false)
  useEffect(() => {
    if (expanded && focusOnExpand.current) {
      inputRef.current?.focus({ preventScroll: true })
      focusOnExpand.current = false
    }
  }, [expanded])
  const input = (
    <input
      id={inputId}
      ref={inputRef}
      className="search-input"
      aria-label={label}
      placeholder="Search vaults or addresses…"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
  if (!mobile) return input
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`page-btn stats-table-search-trigger${expanded || value ? ' is-active' : ''}`}
        aria-expanded={expanded}
        aria-controls={inputId}
        onClick={() => {
          focusOnExpand.current = !expanded
          setExpanded(!expanded)
        }}
      >
        <Search size={14} aria-hidden="true" /> Search
      </button>
      {expanded && (
        <div className="stats-table-search-row">
          {input}
          <button
            type="button"
            className="page-btn stats-table-search-clear"
            aria-label="Close search"
            onClick={() => {
              onChange('')
              setExpanded(false)
              triggerRef.current?.focus({ preventScroll: true })
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  )
}
