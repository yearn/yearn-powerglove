import { Menu, X } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'

export function StatsChartControls({ children, leading }: { children: ReactNode; leading?: ReactNode }) {
  const [expanded, setExpanded] = useState(true)
  const controlsId = useId()
  return (
    <div className={`fees-toolbar${expanded ? '' : ' fees-toolbar-collapsed'}`}>
      <div id={controlsId} className="fees-toolbar-controls" hidden={!expanded}>
        {leading}
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
        {expanded ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button>
    </div>
  )
}
