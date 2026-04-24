import React from 'react'
import { Cell, Label, Pie, PieChart, Tooltip } from 'recharts'
import type { NameType, Payload, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { useRootDarkMode } from '@/hooks/useRootDarkMode'
import { buildBlueShadePalette } from '@/lib/theme-blue-palette'
import type { StrategyAllocationChartDatum } from '@/types/dataTypes'

interface StrategyAllocationChartProps {
  allocationData: StrategyAllocationChartDatum[]
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
        {allocationData.map(({ id, color }, index) => (
          <Cell key={id} fill={color ?? colors[index % colors.length]} />
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
  const colors = React.useMemo(() => buildBlueShadePalette(isDark), [isDark])
  const strokeColor = colors[0] ?? (isDark ? 'hsl(220 74% 60%)' : 'hsl(220 72% 50%)')

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
