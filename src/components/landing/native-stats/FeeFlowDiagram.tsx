import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'

/** Connect HTML cards without turning financial values into layout or fee calculations. */
export function FeeFlowDiagram({ children, label }: { children: ReactNode; label: string }) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [paths, setPaths] = useState<Array<{ id: string; path: string; muted: boolean }>>([])
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const update = () => {
      const bounds = canvas.getBoundingClientRect()
      const cards = [...canvas.querySelectorAll<HTMLElement>('[data-flow-id]')]
      const byId = new Map(cards.map((card) => [card.dataset.flowId, card]))
      const connections = cards.flatMap((card) => [
        ...(card.dataset.flowParent ? [{ source: byId.get(card.dataset.flowParent), target: card, muted: false }] : []),
        ...(card.dataset.flowNext
          ? [
              {
                source: card,
                target: byId.get(card.dataset.flowNext),
                muted: card.classList.contains('fee-flow-muted')
              }
            ]
          : [])
      ])
      setPaths(
        connections.flatMap(({ source, target, muted }) => {
          if (!source || !target) return []
          const a = source.getBoundingClientRect(),
            b = target.getBoundingClientRect()
          const targetY = b.top + b.height / 2 - bounds.top
          let path: string
          if (target.dataset.flowId === 'selected') {
            const spine = b.left + b.width / 2 - bounds.left
            path = `M ${a.right - bounds.left} ${a.top + a.height / 2 - bounds.top} H ${spine} V ${b.top - bounds.top}`
          } else {
            const spine =
              source.dataset.flowId === 'selected' ? a.left + a.width / 2 - bounds.left : a.left + 12 - bounds.left
            path = `M ${spine} ${a.bottom - bounds.top} V ${targetY} H ${b.left - bounds.left}`
          }
          return [
            {
              id: `${source.dataset.flowId}:${target.dataset.flowId}`,
              path,
              muted
            }
          ]
        })
      )
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(canvas)
    for (const card of canvas.querySelectorAll('[data-flow-id]')) observer.observe(card)
    // Watch the HTML stages only; observing the SVG would react to our own paths.
    const mutations = new MutationObserver(update)
    for (const stage of canvas.querySelectorAll('.fee-flow-stage')) {
      observer.observe(stage)
      mutations.observe(stage, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-flow-id', 'data-flow-parent', 'data-flow-next', 'open']
      })
    }
    return () => {
      observer.disconnect()
      mutations.disconnect()
    }
  }, [])
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll the connected flow diagram.
    <figure className="fee-flow-scroll" aria-label={label} tabIndex={0}>
      <div className="fee-flow-canvas" ref={canvasRef}>
        <svg className="fee-flow-connectors" aria-hidden="true">
          {paths.map((path) => (
            <path
              key={path.id}
              d={path.path}
              fill="none"
              stroke={path.muted ? 'var(--text-3)' : 'var(--text-2)'}
              strokeWidth="1.25"
            />
          ))}
        </svg>
        {children}
      </div>
    </figure>
  )
}
