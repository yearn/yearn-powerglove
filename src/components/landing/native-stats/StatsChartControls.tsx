import { Menu, X } from 'lucide-react'
import { type ReactNode, useId, useLayoutEffect, useRef, useState } from 'react'

export function StatsChartControls({ children, leading }: { children: ReactNode; leading?: ReactNode }) {
  const [expanded, setExpanded] = useState(true)
  const controlsId = useId()
  const toolbarRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current
    const toggle = toggleRef.current
    if (!expanded || !toolbar || !toggle) return

    const keepTogglePosition = () => {
      const top = toggle.getBoundingClientRect().top - toolbar.getBoundingClientRect().top
      toolbar.style.setProperty('--stats-toggle-top', `${top}px`)
    }
    keepTogglePosition()
    const observer = new ResizeObserver(keepTogglePosition)
    observer.observe(toolbar)
    return () => observer.disconnect()
  }, [expanded])

  return (
    <div ref={toolbarRef} className={`fees-toolbar${expanded ? '' : ' fees-toolbar-collapsed'}`}>
      <div id={controlsId} className="fees-toolbar-controls" hidden={!expanded}>
        {leading}
        {children}
      </div>
      <button
        ref={toggleRef}
        type="button"
        className="fees-toolbar-collapse"
        aria-expanded={expanded}
        aria-controls={controlsId}
        aria-label={expanded ? 'Collapse chart controls' : 'Expand chart controls'}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button>
    </div>
  )
}
