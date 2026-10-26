import { useEffect } from 'react'

interface SpotifyTrack {
  name: string
  artists: Array<{ name: string }>
  album: {
    images: Array<{ url: string }>
  }
}

interface UseDynamicTitleProps {
  currentTrack: SpotifyTrack | null
  isPlaying: boolean
}

export function useDynamicTitle({ currentTrack, isPlaying }: UseDynamicTitleProps) {
  useEffect(() => {
    const defaultTitle = 'Vinyl'
    const defaultFavicon = '/record.svg'

    // Update favicon
    const updateFavicon = (url: string) => {
      // Remove existing favicon links
      const existingLinks = document.querySelectorAll('link[rel*="icon"]')
      existingLinks.forEach(link => link.remove())

      // Create new favicon link
      const link = document.createElement('link')
      link.rel = 'icon'
      link.href = url
      link.type = url.endsWith('.svg') ? 'image/svg+xml' : 'image/x-icon'
      document.head.appendChild(link)
    }

    // Update page title
    const updateTitle = (title: string) => {
      document.title = title
    }

    if (currentTrack && isPlaying) {
      // When playing, use album cover as favicon and song info as title
      const artistNames = currentTrack.artists?.map(artist => artist.name).join(', ') || 'Unknown Artist'
      const trackName = currentTrack.name || 'Unknown Track'
      const songTitle = `♪ ${trackName} • ${artistNames}`
      
      updateTitle(songTitle)
      
      // Use album cover as favicon if available, with fallback to default
      const albumCoverUrl = currentTrack.album?.images?.[0]?.url
      if (albumCoverUrl) {
        // Test if the image can be loaded before setting as favicon
        const img = new Image()
        img.onload = () => updateFavicon(albumCoverUrl)
        img.onerror = () => updateFavicon(defaultFavicon)
        img.src = albumCoverUrl
      } else {
        updateFavicon(defaultFavicon)
      }
    } else {
      // When not playing, use default favicon and title
      updateTitle(defaultTitle)
      updateFavicon(defaultFavicon)
    }
  }, [currentTrack, isPlaying])
}
