import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://vinyl.pranavkarra.me'),
  title: {
    default: 'Vinyl - Spotify Record Player',
    template: '%s | Vinyl',
  },
  description: 'A beautiful vinyl record player interface for Spotify. Control your music with an elegant, nostalgic vinyl experience featuring realistic animations and dynamic album-based theming.',
  keywords: ['Spotify', 'vinyl', 'record player', 'music', 'streaming', 'web player', 'Spotify player', 'music visualizer'],
  authors: [{ name: 'Pranav Karra' }],
  creator: 'Pranav Karra',
  publisher: 'Pranav Karra',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/record.svg',
    apple: '/record.svg',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'Vinyl - Spotify Record Player',
    description: 'A beautiful vinyl record player interface for Spotify with realistic animations and dynamic theming.',
    url: 'https://vinyl.pranavkarra.me',
    siteName: 'Vinyl',
    images: [
      {
        url: '/placeholder_album.png',
        width: 720,
        height: 720,
        alt: 'Vinyl Record Player - A nostalgic Spotify experience',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vinyl - Spotify Record Player',
    description: 'A beautiful vinyl record player interface for Spotify with realistic animations.',
    images: ['/placeholder_album.png'],
    site: '@pranavkarra',
    creator: '@pranavkarra',
  },
  alternates: {
    canonical: 'https://vinyl.pranavkarra.me',
  },
  category: 'music',
}

// Structured Data for SEO
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      name: 'Vinyl',
      description: 'A beautiful vinyl record player interface for Spotify',
      url: 'https://vinyl.pranavkarra.me',
      applicationCategory: 'MusicApplication',
      operatingSystem: 'Web Browser',
      browserRequirements: 'Requires JavaScript. Requires a Spotify account.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      author: { '@id': 'https://pranavkarra.me/#person' },
      creator: { '@id': 'https://pranavkarra.me/#person' },
      screenshot: 'https://vinyl.pranavkarra.me/placeholder_album.png',
    },
    {
      '@type': 'Person',
      '@id': 'https://pranavkarra.me/#person',
      name: 'Pranav Karra',
      url: 'https://pranavkarra.me',
      sameAs: [
        'https://github.com/Pranav-Karra-3301',
        'https://www.linkedin.com/in/pranavkarra001',
        'https://x.com/pranavkarra',
      ],
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="theme-white">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
body {
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: pan-x pan-y;
  overflow: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
body::-webkit-scrollbar {
  display: none;
}
* {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
*::-webkit-scrollbar {
  display: none;
}
        `}</style>
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
