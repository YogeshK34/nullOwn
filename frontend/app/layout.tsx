import React from "react"
import type { Metadata } from 'next'
import { Host_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { headers } from 'next/headers'
import { cookieToInitialState } from 'wagmi'

import { Providers } from './providers'
// Server-safe config — must not be the RainbowKit one, which is client-only.
import { getServerConfig } from '@/lib/wagmi-config'
import './globals.css'

const hostGrotesk = Host_Grotesk({ subsets: ["latin"], variable: "--font-host-grotesk" });

export const metadata: Metadata = {
  title: 'NullOwn | Own Without Being Seen',
  description: 'A privacy layer for tokenized real-world assets. Receive RWA tokens at stealth addresses, prove ownership with zero-knowledge proofs, and stay auditable by regulators.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Replays the wallet connection stored in the request cookie so the server
  // renders the same connected state the client will hydrate into.
  const initialState = cookieToInitialState(getServerConfig(), (await headers()).get('cookie'))

  return (
    <html lang="en">
      <body className={`${hostGrotesk.variable} font-sans antialiased`}>
        <Providers initialState={initialState}>{children}</Providers>
        <Analytics />
      </body>
    </html>
  )
}
