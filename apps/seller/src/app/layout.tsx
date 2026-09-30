import * as React from 'react'
import './globals.css'
import { Providers } from './providers'
import { useBootstrapSession, SiteHeader, SiteFooter, initLocale } from '@nearbuy/ui'
import { cookies } from 'next/headers'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: { default: 'NearBuy Seller Hub', template: '%s · NearBuy Seller' },
  description: 'Run your local store on NearBuy — orders, reservations, inventory.',
}
export const viewport: Viewport = { themeColor: '#1E3A8A', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  initLocale(cookies().get('nb_locale')?.value)
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="nb-skip">Skip to content</a>
        <Providers>
          <SiteHeader variant="seller" />
          <main id="main" className="flex-1">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  )
}
