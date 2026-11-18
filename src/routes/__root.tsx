import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import ScrollToTop from '@/components/utils/ScrollToTop'
import { VaultsProvider } from '@/contexts/VaultsContext'

export const Route = createRootRoute({
  component: function RootComponent() {
    const pathname = useRouterState({ select: (state) => state.location.pathname })
    const isVaultList = pathname === '/' || pathname === '/vaults' || pathname === '/vaults/'
    return (
      <VaultsProvider>
        <ScrollToTop />
        <div
          className={`flex flex-col bg-[#f5f5f5] [&>header]:shrink-0 [&>footer]:shrink-0 ${isVaultList ? 'h-dvh overflow-hidden' : 'min-h-screen'}`}
        >
          <Header />
          <main className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 px-0 py-0">
            <Outlet />
          </main>
          <Footer />
        </div>
        <TanStackRouterDevtools />
      </VaultsProvider>
    )
  }
})
