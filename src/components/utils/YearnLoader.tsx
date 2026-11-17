import type React from 'react'

interface LoadingState {
  isInitialLoading: boolean
  isPartialLoading: boolean
  isDataReady: boolean
  vaultsReady: boolean
  strategiesReady: boolean
  assetsReady: boolean
}

interface YearnLoaderProps {
  loadingState?: string // Accept loading state as a prop
  enhancedLoadingState?: LoadingState // Enhanced loading state
  showProgress?: boolean // Show loading progress
}

export function YearnSpinner({ size = 64 }: { size?: number }) {
  return (
    <div
      aria-hidden="true"
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 rounded-full border-2 border-t-transparent border-[#0657F9] animate-spin" />
      <img
        src="/logo.svg"
        alt=""
        width={Math.round(size * 0.78)}
        height={Math.round(size * 0.78)}
        className="relative z-10"
      />
    </div>
  )
}

const YearnLoader: React.FC<YearnLoaderProps> = ({ loadingState, enhancedLoadingState, showProgress = false }) => {
  // Calculate loading progress
  const getLoadingProgress = () => {
    if (!enhancedLoadingState) return 0
    const { vaultsReady, strategiesReady, assetsReady } = enhancedLoadingState
    const completedTasks = [vaultsReady, strategiesReady, assetsReady].filter(Boolean).length
    return (completedTasks / 3) * 100
  }

  const getLoadingMessage = () => {
    if (loadingState) return loadingState
    if (!enhancedLoadingState) return 'Loading...'

    const { isInitialLoading, vaultsReady, strategiesReady, assetsReady } = enhancedLoadingState

    if (isInitialLoading) return 'Initializing...'
    if (!vaultsReady) return 'Loading vault data...'
    if (!strategiesReady) return 'Loading strategies...'
    if (!assetsReady) return 'Loading token assets...'
    return 'Finalizing...'
  }

  const progress = getLoadingProgress()

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center">
      <YearnSpinner />
      <div className="mt-4 text-base text-[#0657F9] font-medium text-center">{getLoadingMessage()}</div>
      {showProgress && enhancedLoadingState && (
        <div className="mt-2 w-48">
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-[#0657F9] h-1.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-500 mt-1 text-center">{Math.round(progress)}% complete</div>
        </div>
      )}
    </div>
  )
}

export default YearnLoader
