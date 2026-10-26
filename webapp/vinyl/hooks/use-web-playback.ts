import { useEffect, useState, useCallback, useRef } from 'react'

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void
    Spotify: typeof Spotify
  }
}

interface WebPlaybackPlayer {
  device_id: string
  addListener: (event: string, callback: (state: any) => void) => void
  connect: () => Promise<boolean>
  disconnect: () => void
  getCurrentState: () => Promise<any>
  setName: (name: string) => void
  getVolume: () => Promise<number>
  setVolume: (volume: number) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  togglePlay: () => Promise<void>
  seek: (position: number) => Promise<void>
  previousTrack: () => Promise<void>
  nextTrack: () => Promise<void>
}

export function useWebPlayback(token: string | null, isPremium: boolean) {
  const [player, setPlayer] = useState<WebPlaybackPlayer | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<any>(null)
  const [isPaused, setIsPaused] = useState(true)
  const [position, setPosition] = useState(0)
  const [volume, setVolumeState] = useState(50)
  const playerRef = useRef<WebPlaybackPlayer | null>(null)

  // Transfer playback to this device
  const transferPlayback = useCallback(async (deviceId: string) => {
    if (!token) return

    try {
      await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_ids: [deviceId],
          play: false
        })
      })
    } catch (error) {
      console.error('Error transferring playback:', error)
    }
  }, [token])

  // Play a specific URI (track, album, or playlist)
  const playUri = useCallback(async (uri: string, context_uri?: string) => {
    if (!token || !deviceId) return

    try {
      const body: any = {}
      
      if (context_uri) {
        // Playing from a context (album, playlist)
        body.context_uri = context_uri
        if (uri) {
          // Specific track in context
          body.offset = { uri }
        }
      } else if (uri) {
        // Playing a single track
        body.uris = [uri]
      }

      const playUrl = new URL('https://api.spotify.com/v1/me/player/play')
      playUrl.searchParams.set('device_id', deviceId)
      await fetch(playUrl.toString(), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })
    } catch (error) {
      console.error('Error playing URI:', error)
    }
  }, [token, deviceId])

  // Set volume for Web Playback SDK
  const setVolume = useCallback(async (volumePercent: number) => {
    if (playerRef.current && isReady) {
      try {
        await playerRef.current.setVolume(volumePercent / 100)
        setVolumeState(volumePercent)
        return true
      } catch (error) {
        console.error('Error setting volume:', error)
        return false
      }
    }
    return false
  }, [isReady])

  // Get current volume from Web Playback SDK
  const getVolume = useCallback(async () => {
    if (playerRef.current && isReady) {
      try {
        const currentVolume = await playerRef.current.getVolume()
        const volumePercent = Math.round(currentVolume * 100)
        setVolumeState(volumePercent)
        return volumePercent
      } catch (error) {
        console.error('Error getting volume:', error)
        return null
      }
    }
    return null
  }, [isReady])

  // Seek to position using Web Playback SDK
  const seek = useCallback(async (positionMs: number) => {
    if (playerRef.current && isReady) {
      try {
        await playerRef.current.seek(positionMs)
        return true
      } catch (error) {
        console.error('Error seeking:', error)
        return false
      }
    }
    return false
  }, [isReady])

  useEffect(() => {
    if (!isPremium || !token) return

    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    document.body.appendChild(script)

    window.onSpotifyWebPlaybackSDKReady = () => {
      const spotifyPlayer = new window.Spotify.Player({
        name: 'Vinyl Player',
        getOAuthToken: (cb: (token: string) => void) => {
          cb(token)
        },
        volume: 0.5
      })

      // Ready
      spotifyPlayer.addListener('ready', ({ device_id }) => {
        setDeviceId(device_id)
        setIsReady(true)
        // Auto-transfer playback to this device
        transferPlayback(device_id)
      })

      // Not Ready
      spotifyPlayer.addListener('not_ready', () => {
        setIsReady(false)
      })

      // Player state changed
      spotifyPlayer.addListener('player_state_changed', (state) => {
        if (!state) return

        setCurrentTrack(state.track_window.current_track)
        setIsPaused(state.paused)
        setPosition(state.position)
        
        // Check if this player is active
        if (!state.paused && state.position === 0 && state.track_window.current_track) {
          setIsActive(true)
        }
      })

      // Periodically sync volume to catch external changes
      const volumeSyncInterval = setInterval(async () => {
        if (spotifyPlayer && isReady) {
          try {
            const currentVolume = await spotifyPlayer.getVolume()
            const volumePercent = Math.round(currentVolume * 100)
            setVolumeState(volumePercent)
          } catch (error) {
            // Ignore errors, just in case the player is not ready
          }
        }
      }, 1000)

      // Store interval reference for cleanup
      ;(spotifyPlayer as any)._volumeSyncInterval = volumeSyncInterval

      // Connect to the player
      spotifyPlayer.connect().catch(error => console.error('Error connecting to Spotify player:', error))

      setPlayer(spotifyPlayer as any)
      playerRef.current = spotifyPlayer as any
    }

    return () => {
      if (playerRef.current) {
        // Clean up volume sync interval
        if ((playerRef.current as any)._volumeSyncInterval) {
          clearInterval((playerRef.current as any)._volumeSyncInterval)
        }
        playerRef.current.disconnect()
      }
      const script = document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')
      if (script) {
        document.body.removeChild(script)
      }
    }
  }, [isPremium, token, transferPlayback])

  return {
    player,
    isReady,
    deviceId,
    isActive,
    currentTrack,
    isPaused,
    position,
    volume,
    playUri,
    transferPlayback,
    setVolume,
    getVolume,
    seek
  }
}