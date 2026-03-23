import React from 'react'
import { Cell, Label, Pie, PieChart, Tooltip } from 'recharts'
import type { NameType, Payload, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import type { StrategyAllocationChartDatum } from '@/types/dataTypes'

const LIGHT_MODE_COLORS = ['#0657f9', '#3d7bfa', '#5c93fb', '#7aabfc', '#99c3fd', '#b8dbfe']
const DARK_MODE_COLORS = ['#ff6ba5', '#ffb3d1', '#ff8fbb', '#ffd6e7', '#d21162', '#ff4d94']

interface StrategyAllocationChartProps {
  allocationData: StrategyAllocationChartDatum[]
}

function isRootDarkMode(): boolean {
  if (typeof document === 'undefined') {
    return false
  }

  return document.documentElement.classList.contains('dark')
}

function useRootDarkMode(): boolean {
  const [isDark, setIsDark] = React.useState(() => isRootDarkMode())

  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined
    }

    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark'))
    sync()

    if (typeof MutationObserver === 'undefined') {
      return undefined
    }

    const observer = new MutationObserver(sync)
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  return isDark
}

function AllocationTooltip({
  active,
  payload
}: {
  active: boolean
  payload: Payload<ValueType, NameType>[] | undefined
}): React.ReactNode {
  if (!active || !payload?.length) {
    return null
  }

  const data = payload[0]?.payload as StrategyAllocationChartDatum | undefined
  if (!data) {
    return null
  }

  return (
    <div className="min-w-[180px] border border-border bg-card p-2 text-card-foreground shadow-lg">
      <p className="text-sm font-medium">{data.name}</p>
      <div className="mt-1 flex justify-between text-xs">
        <span>{data.name === 'Unallocated' ? 'Percentage:' : 'Allocation:'}</span>
        <span className="font-semibold">{data.value.toFixed(2)}%</span>
      </div>
      <div className="flex justify-between text-xs">
        <span>Amount:</span>
        <span className="font-semibold">{data.amount}</span>
      </div>
    </div>
  )
}

function AllocationPie({
  allocationData,
  colors,
  strokeColor,
  width,
  height,
  innerRadius,
  outerRadius
}: {
  allocationData: StrategyAllocationChartDatum[]
  colors: string[]
  strokeColor: string
  width: number
  height: number
  innerRadius: number
  outerRadius: number
}): React.ReactNode {
  return (
    <PieChart width={width} height={height}>
      <Pie
        data={allocationData}
        dataKey="value"
        nameKey="name"
        cx="50%"
        cy="50%"
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        paddingAngle={5}
        fill="white"
        stroke={strokeColor}
        startAngle={90}
        minAngle={3}
        endAngle={-270}
      >
        {allocationData.map(({ id }, index) => (
          <Cell key={id} fill={colors[index % colors.length]} />
        ))}
        <Label
          content={() => (
            <text
              x={width / 2}
              y={height / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-foreground text-sm font-medium"
            >
              allocation %
            </text>
          )}
        />
      </Pie>
      <Tooltip
        position={{ y: -80 }}
        content={({ active, payload }) => <AllocationTooltip active={active || false} payload={payload} />}
      />
    </PieChart>
  )
}

export const StrategyAllocationChart: React.FC<StrategyAllocationChartProps> = React.memo(({ allocationData }) => {
  const isDark = useRootDarkMode()
  const colors = isDark ? DARK_MODE_COLORS : LIGHT_MODE_COLORS
  const strokeColor = isDark ? '#ff6ba5' : '#0657f9'

  if (allocationData.length === 0) {
    return null
  }

  return (
    <div
      className="mt-4 flex w-full flex-col items-center pb-4 pt-3 lg:mt-0 lg:px-4 lg:pb-12"
      data-testid="strategy-allocation-chart"
    >
      <div className="flex w-full items-center justify-center">
        <div className="md:hidden">
          <AllocationPie
            allocationData={allocationData}
            colors={colors}
            strokeColor={strokeColor}
            width={192}
            height={192}
            innerRadius={64}
            outerRadius={96}
          />
        </div>
        <div className="hidden md:block">
          <AllocationPie
            allocationData={allocationData}
            colors={colors}
            strokeColor={strokeColor}
            width={220}
            height={220}
            innerRadius={74}
            outerRadius={108}
          />
        </div>
      </div>
    </div>
  )
})
