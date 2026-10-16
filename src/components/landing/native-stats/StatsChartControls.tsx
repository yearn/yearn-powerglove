import { ChevronDown, ChevronUp } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'

export function StatsChartControls({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(true)
  const controlsId = useId()
  return (
    <div className={`fees-toolbar${expanded ? '' : ' fees-toolbar-collapsed'}`}>
      {!expanded && <span className="fees-controls-label text-dim">Chart controls</span>}
      <div id={controlsId} className="fees-toolbar-controls" hidden={!expanded}>
        {children}
      </div>
      <button
        type="button"
        className="fees-toolbar-collapse"
        aria-expanded={expanded}
        aria-controls={controlsId}
        aria-label={expanded ? 'Collapse chart controls' : 'Expand chart controls'}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
      </button>
    </div>
  )
}
