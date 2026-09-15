import React, { useMemo } from 'react'
import type { TooltipProps } from 'recharts'
import { Bar, CartesianGrid, ComposedChart, Legend, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { type ChartTimeframe, filterChartTimeframe } from '@/components/charts/chart-utils'
import { ChartContainer, ChartLegendContent, ChartTooltip } from '@/components/ui/chart'
import { useIsMobile } from '@/components/ui/use-mobile'
import type { yvUsdChartData } from '@/types/dataTypes'

interface YvUsdTVLChartProps {
  chartData: yvUsdChartData
  timeframe: ChartTimeframe
}

const formatCurrency = (value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`

const getTooltipValue = (payload: TooltipProps<number, string>['payload'], dataKey: string): number => {
  const value = Number(payload?.find((item) => item.dataKey === dataKey)?.value)
  return Number.isFinite(value) ? value : 0
}

export const YvUsdTvlTooltipContent = ({ active, label, payload }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) {
    return null
  }

  const unlocked = getTooltipValue(payload, 'unlocked')
  const locked = getTooltipValue(payload, 'locked')
  const combined = unlocked + locked

  return (
    <div className="grid min-w-[10rem] gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-xs shadow-xl">
      <div className="font-medium">{label}</div>
      <div className="flex items-center justify-between gap-4 text-muted-foreground">
        <span>Unlocked yvUSD</span>
        <span className="font-mono font-medium tabular-nums text-foreground">{formatCurrency(unlocked)}</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-muted-foreground">
        <span>Locked yvUSD</span>
        <span className="font-mono font-medium tabular-nums text-foreground">{formatCurrency(locked)}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-4 border-t border-border pt-1.5 text-[#0a0a0a]">
        <span className="font-medium">Combined</span>
        <span className="font-mono font-semibold tabular-nums">{formatCurrency(combined)}</span>
      </div>
    </div>
  )
}

export const YvUsdTVLChart: React.FC<YvUsdTVLChartProps> = React.memo(({ chartData, timeframe }) => {
  const isMobile = useIsMobile()
  const filteredData = useMemo(() => filterChartTimeframe(chartData, timeframe), [chartData, timeframe])
  const chartBottomPadding = isMobile ? 12 : 16
  const yAxisMargin = isMobile ? 52 : 68

  return (
    <ChartContainer
      config={{
        unlocked: {
          label: 'Unlocked yvUSD',
          color: 'var(--chart-1)'
        },
        locked: {
          label: 'Locked yvUSD',
          color: '#ff6ba5'
        }
      }}
      style={{ height: '100%' }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={filteredData}
          margin={{
            top: 12,
            right: isMobile ? 8 : 20,
            left: isMobile ? -18 : 0,
            bottom: chartBottomPadding
          }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            minTickGap={isMobile ? 32 : 24}
            tick={{
              fill: 'hsl(var(--muted-foreground))',
              fontSize: isMobile ? 11 : 12
            }}
            axisLine={{ stroke: 'hsl(var(--muted-foreground))' }}
            tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            width={yAxisMargin}
            domain={[0, 'auto']}
            tickFormatter={(value) => `$${(Number(value) / 1_000_000).toFixed(1)}M`}
            label={
              isMobile
                ? undefined
                : {
                    value: 'TVL ($ millions)',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 10,
                    style: {
                      textAnchor: 'middle',
                      fill: 'hsl(var(--muted-foreground))'
                    }
                  }
            }
            tick={{
              fill: 'hsl(var(--muted-foreground))',
              fontSize: isMobile ? 11 : 12
            }}
            axisLine={{ stroke: 'hsl(var(--muted-foreground))' }}
            tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
          />
          <ChartTooltip content={<YvUsdTvlTooltipContent />} />
          <Legend content={<ChartLegendContent />} />
          <Bar
            dataKey="unlocked"
            name="unlocked"
            stackId="yvUSD-tvl"
            fill="var(--color-unlocked)"
            stroke="transparent"
            isAnimationActive={false}
          />
          <Bar
            dataKey="locked"
            name="locked"
            stackId="yvUSD-tvl"
            fill="var(--color-locked)"
            stroke="transparent"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
})

export default YvUsdTVLChart
