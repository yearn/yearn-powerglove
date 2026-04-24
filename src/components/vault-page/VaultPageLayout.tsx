import React, { type ReactNode } from 'react'
import YearnLoader from '@/components/utils/YearnLoader'

interface VaultPageLayoutProps {
  isLoading: boolean
  hasErrors: boolean
  children: ReactNode
}

/**
 * Layout wrapper for vault pages with loading and error state handling
 */
export const VaultPageLayout = React.memo<VaultPageLayoutProps>(({ isLoading, hasErrors, children }) => {
  // Handle loading states
  if (isLoading) {
    return (
      <div className="min-h-screen px-0 py-0 max-w-[1400px] mx-auto w-full">
        <YearnLoader loadingState="loading selected vault" />
      </div>
    )
  }

  // Handle error states
  if (hasErrors) {
    return (
      <div className="min-h-screen px-0 py-0 max-w-[1400px] mx-auto w-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error Loading Vault</h2>
          <p className="text-gray-600">Unable to fetch vault data. Please try refreshing the page.</p>
        </div>
      </div>
    )
  }

  // Render content
  return <main className="container flex flex-1 flex-col overflow-y-auto pt-0 pb-0">{children}</main>
})
