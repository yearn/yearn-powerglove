import React, { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { getTimeframeLimit } from '@/components/charts/chart-utils'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { useIsMobile } from '@/components/ui/use-mobile'
import { formatTvlDisplay } from '@/lib/formatters'
import type { vaultEarningsChartData } from '@/types/dataTypes'

interface LifetimeEarningsChartProps {
  chartData: vaultEarningsChartData
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

const gainsColor = 'var(--chart-1)'
const feesColor = 'var(--chart-4)'

const LifetimeEarningsChart: React.FC<LifetimeEarningsChartProps> = React.memo(
  ({ chartData, timeframe, hideAxes, hideTooltip, chartMargin, yAxisWidth }) => {
    const isMobile = useIsMobile()
    const filteredData = useMemo(() => {
      if (timeframe === 'all') {
        return chartData
      }
      return chartData.slice(-getTimeframeLimit(timeframe))
    }, [chartData, timeframe])
    const chartBottomPadding = isMobile ? 12 : 16
    const yAxisMargin = yAxisWidth ?? (isMobile ? 56 : 72)
    const hasGainSeries = filteredData.some((point) => point.cumulativeGainUsd !== null)
    const hasFeesSeries = filteredData.some((point) => point.cumulativeFeesUsd !== null)
    const primaryKey = hasGainSeries ? 'cumulativeGainUsd' : 'lifetimeEarningsUsd'
    const primaryLabel = hasGainSeries ? 'Cumulative vault profits' : 'Cumulative protocol fees'

    if (filteredData.length === 0 || (!hasGainSeries && !hasFeesSeries)) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          No report history yet.
        </div>
      )
    }

    return (
      <ChartContainer
        config={{
          lifetimeEarnings: {
            label: primaryLabel,
            color: gainsColor
          },
          lifetimeFees: {
            label: 'Cumulative protocol fees',
            color: feesColor
          }
        }}
        style={{ height: '100%' }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={filteredData}
            margin={{
              top: chartMargin?.top ?? 12,
              right: chartMargin?.right ?? (isMobile ? 8 : 20),
              left: chartMargin?.left ?? (isMobile ? -8 : 0),
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
              width={isMobile ? 56 : yAxisMargin}
              domain={[0, 'auto']}
              tickFormatter={(value) => formatTvlDisplay(Number(value))}
              label={
                hideAxes || isMobile
                  ? undefined
                  : {
                      value: 'Cumulative USD',
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
            {!hideTooltip && (
              <ChartTooltip
                labelFormatter={(value) => String(value)}
                formatter={(value: number, name: string) => {
                  if (name === 'cumulativeFeesUsd') {
                    return [formatTvlDisplay(value), 'Cumulative protocol fees']
                  }
                  return [formatTvlDisplay(value), primaryLabel]
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey={primaryKey}
              name="lifetimeEarnings"
              stroke="var(--color-lifetimeEarnings)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            {hasGainSeries && hasFeesSeries ? (
              <Line
                type="monotone"
                dataKey="cumulativeFeesUsd"
                name="lifetimeFees"
                stroke="var(--color-lifetimeFees)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    )
  }
)

export default LifetimeEarningsChart
