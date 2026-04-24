import type React from 'react'
import { FixedHeightChartContainer } from '@/components/charts/chart-container'

const ChartSkeleton: React.FC = () => {
  // Define timeframe options to match the real component
  const timeframes = [
    { label: '30 Days', value: '30d' },
    { label: '90 Days', value: '90d' },
    { label: '1 Year', value: '1y' },
    { label: 'All Time', value: 'all' }
  ]

  return (
    <div className="border-x border-t border-border bg-white">
      <div className="border-b border-border p-4 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-6">
        <div>
          <div className="mb-2 h-4 w-20 animate-pulse rounded bg-gray-200"></div>
          <div className="h-3 w-64 animate-pulse rounded bg-gray-200"></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-0 sm:flex sm:flex-wrap">
          <div className="h-10 rounded-md bg-gray-200 animate-pulse sm:hidden"></div>
          <div className="h-10 rounded-md bg-gray-200 animate-pulse sm:hidden"></div>
          <div className="hidden sm:contents">
            {timeframes.map((tf) => (
              <div key={tf.value} className="h-9 w-20 rounded bg-gray-200 animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>

      {['performance', 'share-growth', 'tvl'].map((section) => (
        <section key={section} className="border-b border-border p-4 last:border-b-0 sm:p-6">
          <div className="mb-4">
            <div className="h-4 bg-gray-200 rounded w-64 mb-2 animate-pulse"></div>
            <div className="h-3 bg-gray-200 rounded w-80 max-w-full animate-pulse"></div>
          </div>

          <FixedHeightChartContainer>
            <SkeletonChart />
          </FixedHeightChartContainer>
        </section>
      ))}
    </div>
  )
}

// Individual skeleton chart component
const SkeletonChart: React.FC = () => {
  const yAxisTicks = Array.from({ length: 5 }, (_, index) => `y-axis-${index}`)
  const xAxisTicks = Array.from({ length: 6 }, (_, index) => `x-axis-${index}`)

  return (
    <div className="w-full h-full flex flex-col min-h-[400px]">
      {/* Y-axis labels skeleton */}
      <div className="flex flex-1">
        <div className="w-12 flex flex-col justify-between py-4 pl-4">
          {yAxisTicks.map((tick) => (
            <div key={tick} className="h-2 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>

        {/* Chart area skeleton */}
        <div className="flex-1 relative min-h-[300px]"></div>
      </div>

      {/* X-axis labels skeleton */}
      <div className="flex justify-around pl-4 mt-2 ml-12 flex-shrink-0">
        {xAxisTicks.map((tick) => (
          <div key={tick} className="h-2 bg-gray-200 rounded w-8 animate-pulse"></div>
        ))}
      </div>
    </div>
  )
}

export default ChartSkeleton
