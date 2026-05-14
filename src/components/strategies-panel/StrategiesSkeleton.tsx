import { ChevronRight } from 'lucide-react'
import type React from 'react'

const StrategiesSkeleton: React.FC = () => {
  const skeletonRows = ['row-1', 'row-2', 'row-3']

  return (
    <div className="w-full">
      <div className="w-full mx-auto border-y border-border bg-white sm:border-x">
        {/* Tab Navigation Skeleton */}
        <div className="flex items-center border-b border-border">
          <div className="px-6 py-3">
            <div className="h-5 bg-gray-200 rounded w-20 animate-pulse"></div>
          </div>
        </div>

        {/* Main Content Skeleton */}
        <div className="pb-4 lg:flex lg:flex-row flex-col">
          {/* Table Section Skeleton */}
          <div className="lg:flex-1">
            <div className="border border-[#f5f5f5]">
              {/* Table Header Skeleton */}
              <div className="flex items-center p-3 text-sm">
                <div className="w-1/2 flex items-center">
                  <div className="ml-8 h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                </div>
                <div className="w-1/6 text-right">
                  <div className="h-4 bg-gray-200 rounded w-20 ml-auto animate-pulse"></div>
                </div>
                <div className="w-1/6 text-right">
                  <div className="h-4 bg-gray-200 rounded w-20 ml-auto animate-pulse"></div>
                </div>
                <div className="w-1/6 text-right">
                  <div className="h-4 bg-gray-200 rounded w-16 ml-auto animate-pulse"></div>
                </div>
              </div>

              {/* Strategy Rows Skeleton */}
              {skeletonRows.map((rowKey) => (
                <div key={rowKey} className="border-t border-[#f5f5f5]">
                  <div className="flex items-center p-3">
                    <div className="w-8 flex justify-center">
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                    <div className="w-[calc(50%-2rem)] flex items-center gap-2">
                      <div className="w-6 h-6 bg-gray-200 rounded-full animate-pulse"></div>
                      <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                    </div>
                    <div className="w-1/6 text-right">
                      <div className="h-4 bg-gray-200 rounded w-12 ml-auto animate-pulse"></div>
                    </div>
                    <div className="w-1/6 text-right">
                      <div className="h-4 bg-gray-200 rounded w-16 ml-auto animate-pulse"></div>
                    </div>
                    <div className="w-1/6 text-right">
                      <div className="h-4 bg-gray-200 rounded w-12 ml-auto animate-pulse"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Charts Section Skeleton */}
          <div className="lg:ml-6 lg:w-64 mt-6 lg:mt-0 flex lg:flex-col flex-row justify-around pt-3">
            {/* Allocation Chart Skeleton */}
            <div className="lg:w-full w-1/2 pr-2 lg:pr-0 flex flex-col items-center">
              <div className="w-40 h-40 relative">
                {/* Pie chart skeleton - outer ring */}
                <div className="absolute inset-0 rounded-full border-8 border-gray-200 animate-pulse"></div>
                {/* Pie chart skeleton - segments */}
                <div
                  className="absolute inset-2 rounded-full border-4 border-gray-300 animate-pulse"
                  style={{ animationDelay: '0.2s' }}
                ></div>
                <div
                  className="absolute inset-4 rounded-full border-2 border-gray-400 animate-pulse"
                  style={{ animationDelay: '0.4s' }}
                ></div>
                {/* Center label */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-3 bg-gray-200 rounded w-16 animate-pulse"></div>
                </div>
              </div>
              {/* Chart title skeleton */}
              <div className="mt-2 h-3 bg-gray-200 rounded w-20 animate-pulse"></div>
            </div>

            {/* APY Contribution Chart Skeleton */}
            <div className="lg:w-full w-1/2 pl-2 lg:pl-0 lg:mt-6 flex flex-col items-center">
              <div className="w-40 h-40 relative">
                {/* Pie chart skeleton - outer ring */}
                <div
                  className="absolute inset-0 rounded-full border-8 border-gray-200 animate-pulse"
                  style={{ animationDelay: '0.1s' }}
                ></div>
                {/* Pie chart skeleton - segments */}
                <div
                  className="absolute inset-2 rounded-full border-4 border-gray-300 animate-pulse"
                  style={{ animationDelay: '0.3s' }}
                ></div>
                <div
                  className="absolute inset-4 rounded-full border-2 border-gray-400 animate-pulse"
                  style={{ animationDelay: '0.5s' }}
                ></div>
                {/* Center label */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-3 bg-gray-200 rounded w-16 animate-pulse"></div>
                </div>
              </div>
              {/* Chart title skeleton */}
              <div className="mt-2 h-3 bg-gray-200 rounded w-24 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StrategiesSkeleton
