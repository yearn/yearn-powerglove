import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import ScrollToTop from '@/components/utils/ScrollToTop'
import { VaultsProvider } from '@/contexts/VaultsContext'

export const Route = createRootRoute({
  component: function RootComponent() {
    return (
      <VaultsProvider>
        <ScrollToTop />
        <div className="flex min-h-screen flex-col bg-[#f5f5f5]">
          <Header />
          <main className="mx-auto flex w-full max-w-[1400px] flex-1 px-0 py-0">
            <Outlet />
          </main>
          <Footer />
        </div>
        <TanStackRouterDevtools />
      </VaultsProvider>
    )
  }
})
