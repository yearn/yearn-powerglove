import React, { useMemo } from 'react'
import { Bar, CartesianGrid, ComposedChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { getTimeframeLimit } from '@/components/charts/chart-utils'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { useIsMobile } from '@/components/ui/use-mobile'
import type { ChartDataPoint } from '@/types/dataTypes'

interface TVLChartProps {
  chartData: ChartDataPoint[]
  timeframe: string
  hideAxes?: boolean
  hideTooltip?: boolean
  chartMargin?: Partial<{
    top: number
    right: number
    left: number
    bottom: number
  }>
  yAxisWidth?: number
}

const formatTooltipValue = (value: number) => {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export const TVLChart: React.FC<TVLChartProps> = React.memo(
  ({ chartData, timeframe, hideAxes, hideTooltip, chartMargin, yAxisWidth }) => {
    const isMobile = useIsMobile()
    const filteredData = useMemo(() => chartData.slice(-getTimeframeLimit(timeframe)), [chartData, timeframe])
    const chartBottomPadding = isMobile ? 12 : 16
    const yAxisMargin = yAxisWidth ?? (isMobile ? 52 : 68)

    return (
      <ChartContainer
        config={{
          value: { label: 'TVL (millions)', color: 'var(--chart-1)' }
        }}
        style={{ height: '100%' }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={filteredData}
            margin={{
              top: chartMargin?.top ?? 12,
              right: chartMargin?.right ?? (isMobile ? 8 : 20),
              left: chartMargin?.left ?? (isMobile ? -18 : 0),
              bottom: chartMargin?.bottom ?? (hideAxes ? 8 : chartBottomPadding)
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              minTickGap={isMobile ? 32 : 24}
              tick={
                hideAxes
                  ? false
                  : {
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: isMobile ? 11 : 12
                    }
              }
              axisLine={hideAxes ? false : { stroke: 'hsl(var(--muted-foreground))' }}
              tickLine={hideAxes ? false : { stroke: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              width={isMobile ? 52 : yAxisMargin}
              domain={[0, 'auto']}
              tickFormatter={(value) => `$${(value / 1_000_000).toFixed(1)}M`}
              label={
                hideAxes || isMobile
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
              tick={
                hideAxes
                  ? false
                  : {
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: isMobile ? 11 : 12
                    }
              }
              axisLine={hideAxes ? false : { stroke: 'hsl(var(--muted-foreground))' }}
              tickLine={hideAxes ? false : { stroke: 'hsl(var(--muted-foreground))' }}
            />
            {!hideTooltip && <ChartTooltip formatter={formatTooltipValue} />}
            <Bar
              dataKey="TVL"
              fill="var(--color-value)"
              stroke="transparent"
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartContainer>
    )
  }
)

export default TVLChart
