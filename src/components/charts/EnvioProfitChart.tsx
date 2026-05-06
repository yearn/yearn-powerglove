import React, { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { getTimeframeLimit } from '@/components/charts/chart-utils'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { useIsMobile } from '@/components/ui/use-mobile'
import { formatTokenDisplay } from '@/lib/formatters'
import type { vaultEventProfitChartData } from '@/types/dataTypes'

interface EnvioProfitChartProps {
  chartData: vaultEventProfitChartData
  timeframe: string
  assetSymbol?: string
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

const profitColor = 'var(--chart-1)'
const feesColor = 'var(--chart-4)'

const EnvioProfitChart: React.FC<EnvioProfitChartProps> = React.memo(
  ({ chartData, timeframe, assetSymbol, hideAxes, hideTooltip, chartMargin, yAxisWidth }) => {
    const isMobile = useIsMobile()
    const filteredData = useMemo(() => {
      if (timeframe === 'all') {
        return chartData
      }
      return chartData.slice(-getTimeframeLimit(timeframe))
    }, [chartData, timeframe])

    const hasProfitSeries = filteredData.some((point) => point.cumulativeProfit !== null)
    const hasFeesSeries = filteredData.some((point) => point.cumulativeFees !== null)
    const chartBottomPadding = isMobile ? 12 : 16
    const yAxisMargin = yAxisWidth ?? (isMobile ? 56 : 72)
    const unitLabel = assetSymbol || 'asset units'

    if (filteredData.length === 0 || (!hasProfitSeries && !hasFeesSeries)) {
      return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No StrategyReported events yet.</div>
    }

    return (
      <ChartContainer
        config={{
          cumulativeProfit: {
            label: `Cumulative vault profit (${unitLabel})`,
            color: profitColor
          },
          cumulativeFees: {
            label: `Cumulative fees (${unitLabel})`,
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
              tick={hideAxes ? false : { fill: 'hsl(var(--muted-foreground))', fontSize: isMobile ? 11 : 12 }}
              axisLine={hideAxes ? false : { stroke: 'hsl(var(--muted-foreground))' }}
              tickLine={hideAxes ? false : { stroke: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              width={isMobile ? 56 : yAxisMargin}
              domain={['auto', 'auto']}
              tickFormatter={(value) => formatTokenDisplay(Number(value))}
              label={
                hideAxes || isMobile
                  ? undefined
                  : {
                      value: `Cumulative ${unitLabel}`,
                      angle: -90,
                      position: 'insideLeft',
                      offset: 10,
                      style: {
                        textAnchor: 'middle',
                        fill: 'hsl(var(--muted-foreground))'
                      }
                    }
              }
              tick={hideAxes ? false : { fill: 'hsl(var(--muted-foreground))', fontSize: isMobile ? 11 : 12 }}
              axisLine={hideAxes ? false : { stroke: 'hsl(var(--muted-foreground))' }}
              tickLine={hideAxes ? false : { stroke: 'hsl(var(--muted-foreground))' }}
            />
            {!hideTooltip && (
              <ChartTooltip
                labelFormatter={(value) => String(value)}
                formatter={(value: number, name: string) => {
                  if (name === 'cumulativeFees') {
                    return [`${formatTokenDisplay(value)} ${unitLabel}`, `Cumulative fees (${unitLabel})`]
                  }
                  return [`${formatTokenDisplay(value)} ${unitLabel}`, `Cumulative vault profit (${unitLabel})`]
                }}
              />
            )}
            {hasProfitSeries ? (
              <Line
                type="monotone"
                dataKey="cumulativeProfit"
                name="cumulativeProfit"
                stroke="var(--color-cumulativeProfit)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ) : null}
            {hasFeesSeries ? (
              <Line
                type="monotone"
                dataKey="cumulativeFees"
                name="cumulativeFees"
                stroke="var(--color-cumulativeFees)"
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

export default EnvioProfitChart
