import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: 'SatSlinger - Bitcoin Rewards for NEAR Protocol',
  description: 'The wildest Bitcoin-tipping saloon on the digital frontier! Rewarding great NEAR Protocol content with Bitcoin sats.',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'SatSlinger - Bitcoin Rewards for NEAR Protocol',
    description: 'The wildest Bitcoin-tipping saloon on the digital frontier!',
    images: ['/banner.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SatSlinger',
    description: 'The wildest Bitcoin-tipping saloon on the digital frontier!',
    images: ['/banner.png'],
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script src="https://platform.twitter.com/widgets.js" strategy="lazyOnload" />
      </body>
    </html>
  )
}
