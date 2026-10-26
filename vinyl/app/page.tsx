"use client"

import dynamic from 'next/dynamic'

// Dynamically import the VinylPlayer component with no SSR
// This prevents issues with browser-only APIs during build
const VinylPlayer = dynamic(() => import('./vinyl-player'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading Vinyl Player...</p>
      </div>
    </div>
  )
})

export default function Page() {
  return <VinylPlayer />
}