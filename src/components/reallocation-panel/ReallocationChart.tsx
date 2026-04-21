import React from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ReallocationStrategy } from '@/types/reallocationTypes'

interface ReallocationChartProps {
  strategies: ReallocationStrategy[]
}

interface ChartRow {
  name: string
  [key: string]: string | number
}

interface LabelProps {
  x?: number
  y?: number
  width?: number
  height?: number
  value?: number
}

function renderBarLabel(props: LabelProps) {
  const { x = 0, y = 0, width = 0, height = 0, value } = props
  if (!value || value <= 0 || value < 5) return <g />
  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={11}
      fontWeight="bold"
    >
      {`${value.toFixed(1)}%`}
    </text>
  )
}

function CustomTooltip({
  active,
  payload,
  label
}: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null

  const filtered = payload.filter((item) => item.value > 0)
  if (filtered.length === 0) return null

  return (
    <div className="border border-border bg-card p-3 text-card-foreground shadow-lg">
      <p className="mb-2 text-sm font-semibold">{label}</p>
      {filtered.map((item) => (
        <div key={item.dataKey} className="flex items-center gap-2 text-xs">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="flex-1">{item.dataKey}</span>
          <span className="font-semibold">{item.value.toFixed(2)}%</span>
        </div>
      ))}
    </div>
  )
}

function ColorLegend({
  strategies,
  hoveredKey,
  onHover
}: {
  strategies: ReallocationStrategy[]
  hoveredKey: string | null
  onHover: (key: string | null) => void
}) {
  const visibleStrategies = strategies.filter((s) => s.currentRatioPct > 0 || s.targetRatioPct > 0)
  if (visibleStrategies.length === 0) return null

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2">
      {visibleStrategies.map((strategy) => {
        const isDimmed = hoveredKey !== null && hoveredKey !== strategy.strategyKey
        return (
          <div
            key={strategy.strategyKey}
            className="flex items-center gap-1.5 text-xs text-[#4f4f4f] transition-opacity"
            style={{ opacity: isDimmed ? 0.35 : 1 }}
            onMouseEnter={() => onHover(strategy.strategyKey)}
            onMouseLeave={() => onHover(null)}
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: strategy.color }}
            />
            <span>{strategy.name}</span>
          </div>
        )
      })}
    </div>
  )
}

export const ReallocationChart: React.FC<ReallocationChartProps> = React.memo(({ strategies }) => {
  const [hoveredKey, setHoveredKey] = React.useState<string | null>(null)

  if (strategies.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-[#808080]">
        No strategy allocation data available
      </div>
    )
  }

  const chartData: ChartRow[] = [{ name: 'Before' }, { name: 'After' }]

  for (const strategy of strategies) {
    chartData[0][strategy.name] = strategy.currentRatioPct
    chartData[1][strategy.name] = strategy.targetRatioPct
  }

  const visibleStrategies = strategies.filter((s) => s.currentRatioPct > 0 || s.targetRatioPct > 0)

  return (
    <div>
      <div className="h-[280px] w-full sm:h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontSize: 12, fill: '#4f4f4f' }}
              axisLine={{ stroke: '#e5e5e5' }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 13, fill: '#1a1a1a', fontWeight: 'bold' }}
              axisLine={{ stroke: '#e5e5e5' }}
              tickLine={false}
              width={55}
            />
            <Tooltip content={<CustomTooltip />} />
            {visibleStrategies.map((strategy) => {
              const isDimmed = hoveredKey !== null && hoveredKey !== strategy.strategyKey
              return (
                <Bar
                  key={strategy.strategyKey}
                  dataKey={strategy.name}
                  stackId="total"
                  fill={strategy.color}
                  fillOpacity={isDimmed ? 0.3 : 1}
                  isAnimationActive={false}
                  label={renderBarLabel}
                  onMouseEnter={() => setHoveredKey(strategy.strategyKey)}
                  onMouseLeave={() => setHoveredKey(null)}
                />
              )
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ColorLegend strategies={strategies} hoveredKey={hoveredKey} onHover={setHoveredKey} />
    </div>
  )
})
