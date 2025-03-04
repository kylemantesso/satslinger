import { Analytics } from "@vercel/analytics/react"
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Rye } from "next/font/google";
import "./globals.css";
import Script from 'next/script';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Add Rye font
const rye = Rye({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-rye',
});

export const metadata: Metadata = {
  title: '🌵SatSlinger - Bitcoin Rewards for NEAR Protocol',
  description: 'The wildest Bitcoin-tipping saloon on the digital frontier! Rewarding great NEAR Protocol content with Bitcoin sats.',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/apple-touch-icon.png', type: 'image/png', sizes: '180x180' },
    ],
  },
  openGraph: {
    title: 'SatSlinger - Bitcoin Rewards for NEAR Protocol',
    description: 'The wildest Bitcoin-tipping saloon on the digital frontier!',
    images: ['/satslinger.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SatSlinger',
    description: 'The wildest Bitcoin-tipping saloon on the digital frontier!',
    images: ['/twitter_image.png'],
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${rye.variable}`}>
      <body className={geistSans.className}>
        {children}
        <Script src="https://platform.twitter.com/widgets.js" strategy="lazyOnload" />
        <Analytics />
      </body>
    </html>
  )
}
