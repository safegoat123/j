import { useState, useEffect, useCallback } from 'react'

interface SpotifyUser {
  display_name: string
  email: string
  product: 'free' | 'premium'
  images: Array<{ url: string }>
}

interface SpotifyTrack {
  id: string
  name: string
  artists: Array<{ name: string }>
  album: {
    name: string
    images: Array<{ url: string }>
    release_date: string
  }
  duration_ms: number
  explicit: boolean
}

interface SpotifyPlaybackState {
  is_playing: boolean
  progress_ms: number
  item: SpotifyTrack | null
  device: {
    id: string
    name: string
    type: string
    volume_percent: number
  } | null
}

interface SpotifyQueue {
  next: SpotifyTrack | null
  previous: SpotifyTrack | null
  fullQueue: SpotifyTrack[]
}

interface SpotifyDevice {
  id: string
  is_active: boolean
  is_private_session: boolean
  is_restricted: boolean
  name: string
  type: string
  volume_percent: number
}

export function useSpotify() {
  const [user, setUser] = useState<SpotifyUser | null>(null)
  const [playbackState, setPlaybackState] = useState<SpotifyPlaybackState | null>(null)
  const [queue, setQueue] = useState<SpotifyQueue>({ next: null, previous: null, fullQueue: [] })
  const [devices, setDevices] = useState<SpotifyDevice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  // Fetch queue data
  const fetchQueue = useCallback(async () => {
    try {
      const response = await fetch('/api/spotify/queue')
      if (response.ok) {
        const queueData = await response.json()
        setQueue(queueData)
        return queueData
      }
    } catch (err) {
      console.error('Error fetching queue:', err)
    }
    return null
  }, [])

  // Fetch user data and token
  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch('/api/spotify/me')
      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
        // Get the access token from cookies
        const tokenResponse = await fetch('/api/spotify/token')
        if (tokenResponse.ok) {
          const { token } = await tokenResponse.json()
          setAccessToken(token)
        }
        return userData
      } else if (response.status === 401) {
        setUser(null)
        setAccessToken(null)
      }
    } catch (err) {
      console.error('Error fetching user:', err)
      setError('Failed to fetch user data')
    }
    return null
  }, [])

  // Fetch playback state
  const fetchPlaybackState = useCallback(async () => {
    try {
      const response = await fetch('/api/spotify/player')
      if (response.ok) {
        const data = await response.json()
        setPlaybackState(data)
        // Fetch queue whenever playback state changes
        await fetchQueue()
        return data
      }
    } catch (err) {
      console.error('Error fetching playback state:', err)
    }
    return null
  }, [fetchQueue])

  // Control playback
  const play = useCallback(async () => {
    try {
      const response = await fetch('/api/spotify/player', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'play' })
      })
      
      if (response.status === 403) {
        const data = await response.json()
        setError(data.message)
        return false
      }
      
      if (response.ok) {
        await fetchPlaybackState()
        return true
      }
    } catch (err) {
      console.error('Error playing:', err)
      setError('Failed to play')
    }
    return false
  }, [fetchPlaybackState])

  const pause = useCallback(async () => {
    try {
      const response = await fetch('/api/spotify/player', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' })
      })
      
      if (response.status === 403) {
        const data = await response.json()
        setError(data.message)
        return false
      }
      
      if (response.ok) {
        await fetchPlaybackState()
        return true
      }
    } catch (err) {
      console.error('Error pausing:', err)
      setError('Failed to pause')
    }
    return false
  }, [fetchPlaybackState])

  const skipToNext = useCallback(async () => {
    try {
      const response = await fetch('/api/spotify/player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'next' })
      })
      
      if (response.status === 403) {
        const data = await response.json()
        setError(data.message)
        return false
      }
      
      if (response.ok) {
        // Wait a bit for the track to change
        setTimeout(() => fetchPlaybackState(), 500)
        return true
      }
    } catch (err) {
      console.error('Error skipping to next:', err)
      setError('Failed to skip')
    }
    return false
  }, [fetchPlaybackState])

  const skipToPrevious = useCallback(async () => {
    try {
      const response = await fetch('/api/spotify/player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'previous' })
      })
      
      if (response.status === 403) {
        const data = await response.json()
        setError(data.message)
        return false
      }
      
      if (response.ok) {
        // Wait a bit for the track to change
        setTimeout(() => fetchPlaybackState(), 500)
        return true
      }
    } catch (err) {
      console.error('Error skipping to previous:', err)
      setError('Failed to skip')
    }
    return false
  }, [fetchPlaybackState])

  const setVolume = useCallback(async (volumePercent: number) => {
    try {
      const response = await fetch('/api/spotify/player', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'volume', volume_percent: volumePercent })
      })
      
      if (response.status === 403) {
        const data = await response.json()
        setError(data.message)
        return false
      }
      
      if (response.ok) {
        // Refresh playback state to get updated volume
        setTimeout(() => fetchPlaybackState(), 100)
        return true
      }
    } catch (err) {
      console.error('Error setting volume:', err)
      setError('Failed to set volume')
    }
    return false
  }, [fetchPlaybackState])

  const fetchDevices = useCallback(async () => {
    try {
      const response = await fetch('/api/spotify/devices')
      if (response.ok) {
        const data = await response.json()
        setDevices(data.devices || [])
        return data.devices || []
      }
    } catch (err) {
      console.error('Error fetching devices:', err)
    }
    return []
  }, [])

  const transferPlayback = useCallback(async (deviceId: string, play: boolean = false) => {
    try {
      const response = await fetch('/api/spotify/player', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'transfer',
          device_id: deviceId,
          play
        })
      })
      
      if (response.status === 403) {
        const data = await response.json()
        setError(data.message || 'Premium required to transfer playback')
        return false
      }
      
      if (response.ok) {
        // Refresh playback state after transfer
        setTimeout(() => {
          fetchPlaybackState()
          fetchDevices()
        }, 500)
        return true
      }
    } catch (err) {
      console.error('Error transferring playback:', err)
      setError('Failed to transfer playback')
    }
    return false
  }, [fetchPlaybackState])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/spotify/logout', { method: 'POST' })
      setUser(null)
      setPlaybackState(null)
      window.location.reload()
    } catch (err) {
      console.error('Error logging out:', err)
    }
  }, [])

  // Initial load - immediately check if something is playing
  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      const userData = await fetchUser()
      if (userData) {
        // Immediately fetch playback state when user is authenticated
        const playback = await fetchPlaybackState()
        // If nothing is playing but user just signed in, give them a moment to start playing
        if (!playback?.is_playing) {
          // Check again after 2 seconds in case they just opened Spotify
          setTimeout(async () => {
            await fetchPlaybackState()
          }, 2000)
        }
      }
      setIsLoading(false)
    }
    init()
  }, [fetchUser, fetchPlaybackState])

  // Poll for playback state updates (every 1 second when playing, every 5 seconds when not)
  useEffect(() => {
    if (!user) return

    const interval = setInterval(
      fetchPlaybackState,
      playbackState?.is_playing ? 1000 : 5000
    )
    
    // Fetch devices periodically
    fetchDevices()
    const deviceInterval = setInterval(fetchDevices, 10000)

    return () => {
      clearInterval(interval)
      clearInterval(deviceInterval)
    }
  }, [user, playbackState?.is_playing, fetchPlaybackState, fetchDevices])

  return {
    user,
    playbackState,
    queue,
    devices,
    isLoading,
    error,
    accessToken,
    isAuthenticated: !!user,
    isPremium: user?.product === 'premium',
    play,
    pause,
    skipToNext,
    skipToPrevious,
    setVolume,
    transferPlayback,
    fetchDevices,
    logout,
    refreshPlayback: fetchPlaybackState
  }
}