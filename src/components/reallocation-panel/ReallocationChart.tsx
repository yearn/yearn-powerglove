import { ChevronLeft, ChevronRight } from 'lucide-react'
import React from 'react'
import { useRootDarkMode } from '@/hooks/useRootDarkMode'
import { formatPercent } from '@/lib/formatters'
import {
  buildStateTransitionSankeyGraph,
  clampPanelIndex,
  formatReallocationTimestamp,
  getReallocationPanelLabels
} from '@/lib/reallocation-panels'
import { cn } from '@/lib/utils'
import type { ReallocationPanel, ReallocationState } from '@/types/reallocationTypes'

interface ReallocationChartProps {
  panels: ReallocationPanel[]
  activePanelIndex: number
  onActivePanelIndexChange: (nextIndex: number) => void
  colorByStrategyKey: Record<string, string>
}

type Ribbon = {
  id: string
  path: string
  sourceColor: string
  sourceId: string
  sourceName: string
  targetColor: string
  targetId: string
  targetName: string
  value: number
}

type HoverTarget =
  | {
      type: 'node'
      id: string
    }
  | {
      type: 'ribbon'
      id: string
    }
  | null

type ReallocationSceneData = {
  graph: ReturnType<typeof buildStateTransitionSankeyGraph>
  ribbons: Ribbon[]
}

type PanelAnimation = {
  from: number
}

const VIEWBOX_WIDTH = 1500
const VIEWBOX_HEIGHT = 900
const NODE_WIDTH = 22
const BEFORE_NODE_X = 28
const AFTER_NODE_X = VIEWBOX_WIDTH - BEFORE_NODE_X - NODE_WIDTH
const CHART_TOP = 48
const CHART_BOTTOM = 48
const NODE_LABEL_PADDING = 20
const SCENE_TRANSITION_MS = 380
const SIDE_SCENE_SHIFT_PX = 980
const FAR_SCENE_SHIFT_PX =1960
const SIDE_SCENE_OPACITY = 0.4

function toSvgSafeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
}

function withAlpha(color: string, alpha: number): string {
  if (!color.startsWith('#')) {
    return color
  }

  const normalized = color.slice(1)
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((value) => `${value}${value}`)
          .join('')
      : normalized
  const [red, green, blue] = expanded.match(/.{1,2}/g)?.map((value) => Number.parseInt(value, 16)) ?? [156, 163, 175]

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function formatSignedPercent(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) {
    return null
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function buildRibbonPath({
  sourceLeft,
  sourceTop,
  sourceBottom,
  targetLeft,
  targetTop,
  targetBottom
}: {
  sourceLeft: number
  sourceTop: number
  sourceBottom: number
  targetLeft: number
  targetTop: number
  targetBottom: number
}): string {
  const sourceRight = sourceLeft + NODE_WIDTH
  const curveDelta = (targetLeft - sourceRight) * 0.42
  const sourceControlX = sourceRight + curveDelta
  const targetControlX = targetLeft - curveDelta

  return [
    `M ${sourceRight} ${sourceTop}`,
    `C ${sourceControlX} ${sourceTop}, ${targetControlX} ${targetTop}, ${targetLeft} ${targetTop}`,
    `L ${targetLeft} ${targetBottom}`,
    `C ${targetControlX} ${targetBottom}, ${sourceControlX} ${sourceBottom}, ${sourceRight} ${sourceBottom}`,
    'Z'
  ].join(' ')
}

function SankeyNodeLabel({
  node,
  textColor,
  mutedTextColor,
  backgroundStrokeColor,
  fontSize = 18,
  lineHeight = 22,
  strokeWidth = 5
}: {
  node: ReturnType<typeof buildStateTransitionSankeyGraph>['nodes'][number]
  textColor: string
  mutedTextColor: string
  backgroundStrokeColor: string
  fontSize?: number
  lineHeight?: number
  strokeWidth?: number
}): React.ReactNode {
  const chartHeight = VIEWBOX_HEIGHT - CHART_TOP - CHART_BOTTOM
  const centerY = CHART_TOP + (node.localY + node.heightRatio / 2) * chartHeight
  const labelLines = [...node.labelText.split('\n'), formatPercent(node.value, { decimals: 1 })]
  const x = node.side === 'before' ? BEFORE_NODE_X + NODE_WIDTH + NODE_LABEL_PADDING : AFTER_NODE_X - NODE_LABEL_PADDING
  const textAnchor = node.side === 'before' ? 'start' : 'end'
  const startY = centerY - ((labelLines.length - 1) * lineHeight) / 2

  return (
    <text
      x={x}
      y={startY}
      textAnchor={textAnchor}
      fontSize={fontSize}
      fill={textColor}
      stroke={backgroundStrokeColor}
      strokeWidth={strokeWidth}
      paintOrder="stroke"
    >
      {labelLines.map((line, index) => (
        <tspan
          key={`${node.id}-${line}`}
          x={x}
          dy={index === 0 ? 0 : lineHeight}
          fill={index === labelLines.length - 1 ? mutedTextColor : textColor}
          fontWeight={index === labelLines.length - 1 ? 500 : 600}
        >
          {line}
        </tspan>
      ))}
      <title>{`${node.displayName} • ${formatPercent(node.value)}`}</title>
    </text>
  )
}

function ReallocationSummary({
  label,
  timestampUtc,
  vaultAprPct,
  vaultAprDeltaPct,
  deltaColor,
  align = 'left',
  className
}: {
  label: string
  timestampUtc: string | null
  vaultAprPct: number | null
  vaultAprDeltaPct: number | null
  deltaColor: string
  align?: 'left' | 'right'
  className?: string
}): React.ReactNode {
  return (
    <div className={cn('min-w-0 space-y-1', align === 'right' && 'sm:text-right', className)}>
      <div className="text-sm text-foreground">{label}</div>
      <div className="text-xs text-muted-foreground">{formatReallocationTimestamp(timestampUtc)}</div>
      <div className="text-xs text-muted-foreground">
        <span>{'Vault APR/APY '}</span>
        <span className="font-semibold text-foreground">{formatPercent(vaultAprPct)}</span>
        {vaultAprDeltaPct !== null ? (
          <span className="font-semibold" style={{ color: deltaColor }}>
            {` (${formatSignedPercent(vaultAprDeltaPct)})`}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function buildRibbons(
  beforeState: ReallocationState,
  afterState: ReallocationState,
  colorByStrategyKey: Record<string, string>
): {
  graph: ReturnType<typeof buildStateTransitionSankeyGraph>
  ribbons: Ribbon[]
} {
  const graph = buildStateTransitionSankeyGraph(beforeState.strategies, afterState.strategies)
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const chartHeight = VIEWBOX_HEIGHT - CHART_TOP - CHART_BOTTOM

  const ribbons = graph.links.reduce(
    (state, link) => {
      const sourceNode = nodeById.get(link.source)
      const targetNode = nodeById.get(link.target)
      if (!sourceNode || !targetNode || sourceNode.value <= 0 || targetNode.value <= 0) {
        return state
      }

      const sourceOffsetRatio = state.sourceOffsets.get(link.source) ?? 0
      const targetOffsetRatio = state.targetOffsets.get(link.target) ?? 0
      const sourceScale = sourceNode.heightRatio / sourceNode.value
      const targetScale = targetNode.heightRatio / targetNode.value
      const sourceHeightRatio = link.value * sourceScale
      const targetHeightRatio = link.value * targetScale
      const nextSourceOffsets = new Map(state.sourceOffsets)
      nextSourceOffsets.set(link.source, sourceOffsetRatio + sourceHeightRatio)
      const nextTargetOffsets = new Map(state.targetOffsets)
      nextTargetOffsets.set(link.target, targetOffsetRatio + targetHeightRatio)

      const sourceColor = colorByStrategyKey[sourceNode.id.replace('before:', '')] ?? '#9ca3af'
      const targetColor = colorByStrategyKey[targetNode.id.replace('after:', '')] ?? '#9ca3af'

      return {
        sourceOffsets: nextSourceOffsets,
        targetOffsets: nextTargetOffsets,
        ribbons: [
          ...state.ribbons,
          {
            path: buildRibbonPath({
              sourceLeft: BEFORE_NODE_X,
              sourceTop: CHART_TOP + (sourceNode.localY + sourceOffsetRatio) * chartHeight,
              sourceBottom: CHART_TOP + (sourceNode.localY + sourceOffsetRatio + sourceHeightRatio) * chartHeight,
              targetLeft: AFTER_NODE_X,
              targetTop: CHART_TOP + (targetNode.localY + targetOffsetRatio) * chartHeight,
              targetBottom: CHART_TOP + (targetNode.localY + targetOffsetRatio + targetHeightRatio) * chartHeight
            }),
            id: `${link.source}->${link.target}`,
            sourceColor,
            sourceName: sourceNode.displayName,
            sourceId: sourceNode.id,
            targetColor,
            targetId: targetNode.id,
            targetName: targetNode.displayName,
            value: link.value
          }
        ]
      }
    },
    {
      sourceOffsets: new Map<string, number>(),
      targetOffsets: new Map<string, number>(),
      ribbons: [] as Ribbon[]
    }
  ).ribbons

  return {
    graph,
    ribbons
  }
}

function getSceneOffset(slot: number): string {
  if (slot <= -2) return `-${FAR_SCENE_SHIFT_PX}px`
  if (slot === -1) return `-${SIDE_SCENE_SHIFT_PX}px`
  if (slot === 1) return `${SIDE_SCENE_SHIFT_PX}px`
  if (slot >= 2) return `${FAR_SCENE_SHIFT_PX}px`
  return '0px'
}

function getSceneScale(_slot: number): number {
  return 1
}

function getSceneOpacity(slot: number): number {
  const distance = Math.abs(slot)
  if (distance === 0) return 1
  if (distance === 1) return SIDE_SCENE_OPACITY
  return 0
}

const ReallocationFlowScene: React.FC<{
  panel: ReallocationPanel
  sceneData: ReallocationSceneData
  colorByStrategyKey: Record<string, string>
  isDark: boolean
  hoverTarget: HoverTarget
  showLabels?: boolean
  setHoverTarget?: React.Dispatch<React.SetStateAction<HoverTarget>>
}> = React.memo(({ panel, sceneData, colorByStrategyKey, isDark, hoverTarget, showLabels = true, setHoverTarget }) => {
  const { graph, ribbons } = sceneData
  const interactive = Boolean(setHoverTarget)
  const gradientPrefix = React.useId().replace(/:/g, '-')

  const hoverState = React.useMemo(() => {
    if (!interactive || !hoverTarget) {
      return null
    }

    const focusedRibbonIds = new Set<string>()
    const focusedNodeIds = new Set<string>()

    if (hoverTarget.type === 'node') {
      focusedNodeIds.add(hoverTarget.id)

      ribbons.forEach((ribbon) => {
        if (ribbon.sourceId === hoverTarget.id || ribbon.targetId === hoverTarget.id) {
          focusedRibbonIds.add(ribbon.id)
          focusedNodeIds.add(ribbon.sourceId)
          focusedNodeIds.add(ribbon.targetId)
        }
      })
    } else {
      const focusedRibbon = ribbons.find((ribbon) => ribbon.id === hoverTarget.id)
      if (focusedRibbon) {
        focusedRibbonIds.add(focusedRibbon.id)
        focusedNodeIds.add(focusedRibbon.sourceId)
        focusedNodeIds.add(focusedRibbon.targetId)
      }
    }

    return {
      focusedRibbonIds,
      focusedNodeIds
    }
  }, [hoverTarget, interactive, ribbons])

  const visibleRibbons = React.useMemo(() => {
    if (!hoverState) {
      return ribbons
    }

    return [...ribbons].sort((firstRibbon, secondRibbon) => {
      const firstIsFocused = hoverState.focusedRibbonIds.has(firstRibbon.id)
      const secondIsFocused = hoverState.focusedRibbonIds.has(secondRibbon.id)
      return Number(firstIsFocused) - Number(secondIsFocused)
    })
  }, [hoverState, ribbons])

  const gradientIdByRibbonId = React.useMemo(() => {
    return new Map(ribbons.map((ribbon) => [ribbon.id, `${gradientPrefix}-${toSvgSafeId(ribbon.id)}`]))
  }, [gradientPrefix, ribbons])

  const chartHeight = VIEWBOX_HEIGHT - CHART_TOP - CHART_BOTTOM
  const textColor = isDark ? '#f9fafb' : '#111827'
  const mutedTextColor = isDark ? '#9ca3af' : '#6b7280'
  const borderColor = isDark ? '#111827' : '#e5e7eb'
  const backgroundStrokeColor = isDark ? 'rgba(17, 24, 39, 0.78)' : 'rgba(248, 250, 252, 0.9)'

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className="block h-full w-auto max-w-none"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Reallocation flow for panel ${panel.id}`}
      onMouseLeave={() => {
        if (setHoverTarget) {
          setHoverTarget(null)
        }
      }}
    >
      <defs>
        {ribbons.map((ribbon) => {
          const gradientId = gradientIdByRibbonId.get(ribbon.id)
          if (!gradientId) {
            return null
          }

          return (
            <linearGradient
              key={gradientId}
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1={BEFORE_NODE_X + NODE_WIDTH}
              y1={0}
              x2={AFTER_NODE_X}
              y2={0}
            >
              <stop offset="0%" stopColor={ribbon.sourceColor} />
              <stop offset="100%" stopColor={ribbon.targetColor} />
            </linearGradient>
          )
        })}
      </defs>

      {visibleRibbons.map((ribbon) => {
        const isRibbonFocused = hoverState?.focusedRibbonIds.has(ribbon.id) ?? false
        const hasHover = Boolean(hoverState)
        const fillOpacity = isDark ? 0.34 : 0.22
        const strokeOpacity = isDark ? 0.5 : 0.34
        const isHoveredRibbon = hoverTarget?.type === 'ribbon' && hoverTarget.id === ribbon.id
        const gradientId = gradientIdByRibbonId.get(ribbon.id)

        return (
          <path
            key={ribbon.id}
            d={ribbon.path}
            onMouseEnter={() => {
              if (setHoverTarget) {
                setHoverTarget({ type: 'ribbon', id: ribbon.id })
              }
            }}
            onMouseLeave={() => {
              if (setHoverTarget) {
                setHoverTarget((currentHoverTarget) =>
                  currentHoverTarget?.type === 'ribbon' && currentHoverTarget.id === ribbon.id
                    ? null
                    : currentHoverTarget
                )
              }
            }}
            fill={gradientId ? `url(#${gradientId})` : ribbon.sourceColor}
            stroke={gradientId ? `url(#${gradientId})` : ribbon.sourceColor}
            strokeWidth={1}
            style={{
              cursor: interactive ? 'pointer' : 'default',
              fillOpacity: hasHover
                ? isRibbonFocused
                  ? fillOpacity + (isHoveredRibbon ? 0.16 : 0.1)
                  : fillOpacity * 0.3
                : fillOpacity,
              strokeOpacity: hasHover
                ? isRibbonFocused
                  ? strokeOpacity + (isHoveredRibbon ? 0.2 : 0.12)
                  : strokeOpacity * 0.3
                : strokeOpacity,
              opacity: hasHover ? (isRibbonFocused ? (isHoveredRibbon ? 1 : 0.92) : 0.16) : 1,
              transition: 'opacity 180ms ease, fill-opacity 180ms ease, stroke-opacity 180ms ease'
            }}
          >
            <title>{`${ribbon.sourceName} → ${ribbon.targetName} • ${formatPercent(ribbon.value)}`}</title>
          </path>
        )
      })}

      {graph.nodes.map((node) => {
        const color = colorByStrategyKey[node.id.replace(`${node.side}:`, '')] ?? '#9ca3af'
        const x = node.side === 'before' ? BEFORE_NODE_X : AFTER_NODE_X
        const y = CHART_TOP + node.localY * chartHeight
        const height = node.heightRatio * chartHeight
        const hasHover = Boolean(hoverState)
        const isHoveredNode = hoverTarget?.type === 'node' && hoverTarget.id === node.id
        const isFocusedNode = hoverState?.focusedNodeIds.has(node.id) ?? false
        const nodeOpacity = hasHover ? (isFocusedNode ? (isHoveredNode ? 1 : 0.94) : 0.16) : 1
        const labelOpacity = hasHover ? (isFocusedNode ? (isHoveredNode ? 1 : 0.9) : 0.14) : 1
        const labelScale = hasHover ? (isHoveredNode ? 1.18 : isFocusedNode ? 1.08 : 1) : 1
        const labelFontSize = 18 * labelScale
        const labelLineHeight = 22 * labelScale
        const labelStrokeWidth = 5 * (1 + (labelScale - 1) * 0.85)
        const nodeStrokeColor = isHoveredNode ? withAlpha(textColor, isDark ? 0.92 : 0.72) : borderColor
        const nodeStrokeWidth = isHoveredNode ? 2 : 1

        return (
          <g
            key={node.id}
            onMouseEnter={() => {
              if (setHoverTarget) {
                setHoverTarget({ type: 'node', id: node.id })
              }
            }}
            onMouseLeave={() => {
              if (setHoverTarget) {
                setHoverTarget((currentHoverTarget) =>
                  currentHoverTarget?.type === 'node' && currentHoverTarget.id === node.id ? null : currentHoverTarget
                )
              }
            }}
            style={{
              cursor: interactive ? 'pointer' : 'default',
              opacity: nodeOpacity,
              transition: 'opacity 180ms ease'
            }}
          >
            <rect
              x={x}
              y={y}
              width={NODE_WIDTH}
              height={height}
              fill={color}
              stroke={nodeStrokeColor}
              strokeWidth={nodeStrokeWidth}
              style={{
                transition: 'stroke 180ms ease, stroke-width 180ms ease'
              }}
            >
              <title>{`${node.displayName} • ${formatPercent(node.value)}`}</title>
            </rect>
            {showLabels ? (
              <g
                style={{
                  opacity: labelOpacity,
                  transition: 'opacity 180ms ease'
                }}
              >
                <SankeyNodeLabel
                  node={node}
                  textColor={textColor}
                  mutedTextColor={mutedTextColor}
                  backgroundStrokeColor={backgroundStrokeColor}
                  fontSize={labelFontSize}
                  lineHeight={labelLineHeight}
                  strokeWidth={labelStrokeWidth}
                />
              </g>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
})

export const ReallocationChart: React.FC<ReallocationChartProps> = React.memo(
  ({ panels, activePanelIndex, onActivePanelIndexChange, colorByStrategyKey }) => {
    const isDark = useRootDarkMode()
    const [hoverTarget, setHoverTarget] = React.useState<HoverTarget>(null)
    const [stablePanelIndex, setStablePanelIndex] = React.useState(() => clampPanelIndex(activePanelIndex, panels))
    const [transitionShift, setTransitionShift] = React.useState(0)
    const [animation, setAnimation] = React.useState<PanelAnimation | null>(null)
    const animationFrameRef = React.useRef<number | null>(null)
    const animationTimeoutRef = React.useRef<number | null>(null)
    const resolvedPanelIndex = clampPanelIndex(activePanelIndex, panels)
    const activePanel = panels[resolvedPanelIndex] ?? null
    const activePanelId = activePanel?.id ?? null
    const sceneDataByPanelId = React.useMemo(
      () =>
        new Map(
          panels.map((panel) => [panel.id, buildRibbons(panel.beforeState, panel.afterState, colorByStrategyKey)])
        ),
      [colorByStrategyKey, panels]
    )
    const activeSceneData = activePanel ? (sceneDataByPanelId.get(activePanel.id) ?? null) : null
    const isAnimating = animation !== null
    const animationBaseIndex = animation?.from ?? stablePanelIndex
    const visibleSceneIndices = React.useMemo(() => {
      const indices: number[] = []

      for (let offset = -2; offset <= 2; offset += 1) {
        const nextIndex = animationBaseIndex + offset
        if (nextIndex >= 0 && nextIndex < panels.length) {
          indices.push(nextIndex)
        }
      }

      return indices
    }, [animationBaseIndex, panels.length])

    React.useEffect(() => {
      return () => {
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current)
        }
        if (animationTimeoutRef.current !== null) {
          window.clearTimeout(animationTimeoutRef.current)
        }
      }
    }, [])

    React.useEffect(() => {
      if (animation !== null) {
        return
      }

      if (resolvedPanelIndex === stablePanelIndex) {
        return
      }

      const distance = resolvedPanelIndex - stablePanelIndex
      if (Math.abs(distance) !== 1) {
        setStablePanelIndex(resolvedPanelIndex)
        setTransitionShift(0)
        return
      }

      const direction = distance > 0 ? 1 : -1

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (animationTimeoutRef.current !== null) {
        window.clearTimeout(animationTimeoutRef.current)
      }

      setTransitionShift(0)
      setAnimation({
        from: stablePanelIndex
      })

      animationFrameRef.current = requestAnimationFrame(() => {
        setTransitionShift(direction)
        animationFrameRef.current = null
      })

      animationTimeoutRef.current = window.setTimeout(() => {
        setStablePanelIndex(resolvedPanelIndex)
        setTransitionShift(0)
        setAnimation(null)
        animationTimeoutRef.current = null
      }, SCENE_TRANSITION_MS)
    }, [animation, resolvedPanelIndex, stablePanelIndex])

    React.useEffect(() => {
      if (activePanelId !== null) {
        setHoverTarget(null)
      }
    }, [activePanelId])

    if (!activePanel) {
      return (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          No reallocation flow data available
        </div>
      )
    }

    const { beforeLabel, afterLabel } = getReallocationPanelLabels(activePanel)

    if (!activeSceneData || activeSceneData.graph.nodes.length === 0 || activeSceneData.ribbons.length === 0) {
      return (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          No allocation flow data available
        </div>
      )
    }

    const mutedTextColor = isDark ? '#9ca3af' : '#6b7280'
    const beforeVaultAprPct = activePanel.beforeState.vaultAprPct
    const afterVaultAprPct = activePanel.afterState.vaultAprPct
    const vaultAprDeltaPct =
      beforeVaultAprPct !== null && afterVaultAprPct !== null ? afterVaultAprPct - beforeVaultAprPct : null
    const positiveDeltaColor = isDark ? '#86efac' : '#16a34a'
    const negativeDeltaColor = isDark ? '#fca5a5' : '#dc2626'
    const deltaColor =
      vaultAprDeltaPct === null ? mutedTextColor : vaultAprDeltaPct >= 0 ? positiveDeltaColor : negativeDeltaColor

    return (
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(150px,auto)_minmax(180px,1fr)_minmax(180px,1fr)_auto] lg:items-start lg:gap-6">
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Reallocation Flow
              </div>
              <div className="text-xs text-muted-foreground">
                Panel {resolvedPanelIndex + 1} of {panels.length}
              </div>
            </div>

            <ReallocationSummary
              label={beforeLabel}
              timestampUtc={activePanel.beforeTimestampUtc}
              vaultAprPct={beforeVaultAprPct}
              vaultAprDeltaPct={null}
              deltaColor={deltaColor}
              className="sm:col-start-1 sm:row-start-2 lg:col-start-2 lg:row-start-1"
            />
            <ReallocationSummary
              label={afterLabel}
              timestampUtc={activePanel.afterTimestampUtc}
              vaultAprPct={afterVaultAprPct}
              vaultAprDeltaPct={vaultAprDeltaPct}
              deltaColor={deltaColor}
              align="right"
              className="sm:col-start-2 sm:row-start-2 lg:col-start-3 lg:row-start-1"
            />

            {panels.length > 1 && (
              <div className="flex items-center gap-2 sm:justify-self-end lg:col-start-4 lg:row-start-1">
                <button
                  type="button"
                  onClick={() => onActivePanelIndexChange(clampPanelIndex(resolvedPanelIndex - 1, panels))}
                  disabled={isAnimating || resolvedPanelIndex === 0}
                  className="inline-flex items-center gap-1 rounded border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Older
                </button>
                <button
                  type="button"
                  onClick={() => onActivePanelIndexChange(clampPanelIndex(resolvedPanelIndex + 1, panels))}
                  disabled={isAnimating || resolvedPanelIndex >= panels.length - 1}
                  className="inline-flex items-center gap-1 rounded border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Newer
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="relative h-[460px] w-full overflow-hidden sm:h-[560px] lg:h-[620px]">
          {visibleSceneIndices.map((sceneIndex) => {
            const panel = panels[sceneIndex]
            if (!panel) {
              return null
            }

            const sceneData = sceneDataByPanelId.get(panel.id)
            if (!sceneData || sceneData.graph.nodes.length === 0 || sceneData.ribbons.length === 0) {
              return null
            }

            const slot = sceneIndex - animationBaseIndex - transitionShift
            const distance = Math.abs(slot)

            return (
              <div
                key={panel.id}
                className={cn(
                  'absolute inset-y-0 left-1/2 flex items-stretch justify-center',
                  distance > 0 && 'pointer-events-none select-none'
                )}
                style={{
                  transform: `translateX(-50%) translateX(${getSceneOffset(slot)}) scale(${getSceneScale(slot)})`,
                  opacity: getSceneOpacity(slot),
                  zIndex: distance === 0 ? 30 : distance === 1 ? 20 : 10,
                  filter: distance === 0 ? 'none' : 'saturate(0.9)',
                  transition: `transform ${SCENE_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${SCENE_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), filter ${SCENE_TRANSITION_MS}ms ease`
                }}
              >
                <ReallocationFlowScene
                  panel={panel}
                  sceneData={sceneData}
                  colorByStrategyKey={colorByStrategyKey}
                  isDark={isDark}
                  hoverTarget={distance === 0 ? hoverTarget : null}
                  showLabels={distance === 0}
                  setHoverTarget={distance === 0 && !isAnimating ? setHoverTarget : undefined}
                />
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
