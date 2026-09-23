import { Link } from '@tanstack/react-router'
import React from 'react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb'

interface VaultPageBreadcrumbProps {
  vaultName: string
}

/**
 * Breadcrumb navigation component for vault pages
 */
export const VaultPageBreadcrumb = React.memo<VaultPageBreadcrumbProps>(({ vaultName }) => {
  return (
    <div
      className="sticky top-[55px] z-20 bg-white px-4 min-[500px]:top-[111px] sm:border sm:border-border sm:border-b-0 sm:border-t-0 sm:px-6 md:top-[60px]"
      data-testid="vault-page-breadcrumb"
    >
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Vaults</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{vaultName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
})
