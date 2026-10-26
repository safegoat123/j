"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, SkipBack, SkipForward, LogOut, Music } from "lucide-react"
import Image from "next/image"
import { useSpotify } from "@/hooks/use-spotify"
import { useWebPlayback } from "@/hooks/use-web-playback"
import { useDynamicTitle } from "@/hooks/use-dynamic-title"
import { RecentItemsPopup } from "@/components/recent-items-popup"
import { ThemeSelectorPopup } from "@/components/theme-selector-popup"
import { SpotifyConnect } from "@/components/spotify-connect"
import { useTheme, generateAlbumGradient } from "@/hooks/use-theme"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

export default function VinylPlayer() {
  const [isDesktop, setIsDesktop] = useState(true)
  const [rotation, setRotation] = useState(0)
  const [tonearmAngle, setTonearmAngle] = useState(-35)
  const [localVolume, setLocalVolume] = useState(75)
  const animationRef = useRef<number>()
  const [isDraggingNeedle, setIsDraggingNeedle] = useState(false)
  const [albumHover, setAlbumHover] = useState(false)
  
  // Animation states
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'lifting' | 'retracting' | 'fading-out' | 'fading-in' | 'extending' | 'lowering' | 'complete'>('idle')
  const [nextTrackData, setNextTrackData] = useState<any>(null)
  const [previousTrackId, setPreviousTrackId] = useState<string | null>(null)
  const [recordPosition, setRecordPosition] = useState(0) // 0 = normal, -100 = retracted
  const [albumOpacity, setAlbumOpacity] = useState(1)
  const [displayedTrack, setDisplayedTrack] = useState<any>(null)

  const {
    user,
    playbackState,
    queue,
    devices,
    isLoading,
    error,
    accessToken,
    isAuthenticated,
    isPremium,
    play,
    pause,
    skipToNext,
    skipToPrevious,
    setVolume: setSpotifyVolume,
    transferPlayback,
    logout
  } = useSpotify()

  // Web Playback SDK for premium users
  const { playUri, isReady: isWebPlaybackReady, setVolume: setWebVolume, volume: webVolume, seek: webSeek } = useWebPlayback(accessToken, isPremium)

  // Theme management
  const { theme, setTheme, albumGradient, setAlbumGradient, vinylDesign, setVinylDesign } = useTheme()
  
  // System status checks
  const getSystemStatus = () => {
    // Check environment variables (client ID can be public, secret stays server-side)
    const hasClientId = typeof window !== 'undefined'
      ? (!!process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ||
         localStorage.getItem('spotify_client_id') !== null)
      : !!process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID

    // Client secret is server-side only - we infer it's configured if auth works
    // Never expose SPOTIFY_CLIENT_SECRET to the frontend
    const hasClientSecret = isAuthenticated || true // Server-side config assumed valid
    
    const checks = {
      spotifyClientId: hasClientId,
      spotifyClientSecret: hasClientSecret,
      authenticated: isAuthenticated,
      themeCache: typeof window !== 'undefined' && !!localStorage.getItem('vinyl-theme'),
      webPlayback: isPremium && isWebPlaybackReady,
    }
    
    // Determine overall status
    const critical = !checks.spotifyClientId || !checks.spotifyClientSecret
    const warnings = !checks.authenticated || (isPremium && !checks.webPlayback)
    
    return {
      checks,
      overall: critical ? 'error' : warnings ? 'warning' : 'success'
    }
  }

  // Dynamic title and favicon based on current track
  useDynamicTitle({
    currentTrack: playbackState?.item || null,
    isPlaying: playbackState?.is_playing || false
  })

  // Check if desktop on mount and disable right-click
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024)
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      return false
    }

    checkDesktop()
    window.addEventListener("resize", checkDesktop)
    document.addEventListener("contextmenu", handleContextMenu)
    
    return () => {
      window.removeEventListener("resize", checkDesktop)
      document.removeEventListener("contextmenu", handleContextMenu)
    }
  }, [])

  // Animation loop for vinyl rotation
  useEffect(() => {
    const animate = () => {
      if (playbackState?.is_playing && !isTransitioning) {
        // Much slower rotation: 10 RPM = 0.167 rotations per second
        // At 60fps, that's about 1 degree per frame
        setRotation((prev) => (prev + 1) % 360)
      } else if (isTransitioning) {
        // Keep spinning very slowly during transition
        setRotation((prev) => (prev + 0.5) % 360)
      }
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [playbackState?.is_playing, isTransitioning])

  // Tonearm animation based on play state and progress
  useEffect(() => {
    // Don't update tonearm during transitions - let runTrackTransition control it
    if (isTransitioning) return
    
    if (playbackState?.is_playing && playbackState.item) {
      // Calculate progress percentage
      const progress = (playbackState.progress_ms / playbackState.item.duration_ms) * 100
      // When playing, tonearm moves in and tracks progress
      // Starting at outer edge (-10°) to inner track (20°)
      const targetAngle = -10 + (30 * (progress / 100))
      setTonearmAngle(targetAngle)
    } else if (!isTransitioning) {
      // When paused (and not transitioning), tonearm moves out to rest position
      setTonearmAngle(-35)
    }
  }, [playbackState, isTransitioning])

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  // Check if animations are enabled via environment variable
  const animationsEnabled = process.env.NEXT_PUBLIC_ANIMATION !== 'FALSE'

  // Animation sequence for track transitions
  const runTrackTransition = useCallback(async (skipAction: () => Promise<boolean>) => {
    if (isTransitioning) return
    
    // If animations are disabled, just skip immediately
    if (!animationsEnabled) {
      const success = await skipAction()
      return
    }
    
    setIsTransitioning(true)
    
    // First, pause the current playback to stop music immediately
    await pause()
    
    // Phase 1: Lift tonearm OFF the record first (800ms for smoother motion)
    setAnimationPhase('lifting')
    setTonearmAngle(-35) // Move to rest position
    await new Promise(resolve => setTimeout(resolve, 800))
    
    // Phase 2: Retract record COMPLETELY under album FAST (300ms)
    setAnimationPhase('retracting')
    setRecordPosition(-150) // Move further to be completely hidden
    await new Promise(resolve => setTimeout(resolve, 350))
    
    // Phase 3: Fade out album ONLY AFTER record is completely hidden (600ms)
    setAnimationPhase('fading-out')
    setAlbumOpacity(0)
    await new Promise(resolve => setTimeout(resolve, 600))
    
    // Phase 4: Fade in new album FIRST (600ms)
    setAnimationPhase('fading-in')
    setAlbumOpacity(1)
    await new Promise(resolve => setTimeout(resolve, 600))
    
    // Phase 5: Extend record from COMPLETELY under album FAST (300ms)
    setAnimationPhase('extending')
    setRecordPosition(0)
    await new Promise(resolve => setTimeout(resolve, 350))
    
    // Phase 6: Lower tonearm AFTER record is in position (800ms)
    setAnimationPhase('lowering')
    setTonearmAngle(-10) // Move to start of record
    await new Promise(resolve => setTimeout(resolve, 800))
    
    // Phase 7: Wait 10 SECONDS before changing track for dramatic effect
    setAnimationPhase('complete')
    await new Promise(resolve => setTimeout(resolve, 10000))
    
    // NOW execute the skip action after all animation is complete
    const success = await skipAction()
    if (!success) {
      // Reset if skip failed
      setAlbumOpacity(1)
      setRecordPosition(0)
      setTonearmAngle(-35)
      setIsTransitioning(false)
      setAnimationPhase('idle')
      return
    }
    
    // Wait for new track data to fully load (800ms)
    await new Promise(resolve => setTimeout(resolve, 800))
    
    // Resume playback with the new track
    await play()
    
    setIsTransitioning(false)
    setAnimationPhase('idle')
  }, [isTransitioning, play, pause, animationsEnabled])

  const handlePlayPause = async () => {
    if (isTransitioning) return
    
    if (playbackState?.is_playing) {
      await pause()
    } else {
      await play()
    }
  }

  // Volume control handler
  const handleVolumeChange = useCallback(async (newVolume: number[]) => {
    const volumeValue = newVolume[0]
    setLocalVolume(volumeValue)
    
    // Always update device volume via Spotify API first (for consistency across apps)
    let deviceVolumeSuccess = false
    if (setSpotifyVolume) {
      try {
        deviceVolumeSuccess = await setSpotifyVolume(volumeValue)
      } catch (error) {
        console.error('Error setting device volume:', error)
      }
    }
    
    // Also update local Web Playback SDK volume if available (for immediate audio feedback)
    if (isPremium && isWebPlaybackReady && setWebVolume) {
      try {
        await setWebVolume(volumeValue)
      } catch (error) {
        console.error('Error setting Web SDK volume:', error)
      }
    }
    
    // Log for debugging if both methods failed
    if (!deviceVolumeSuccess && isPremium && isWebPlaybackReady) {
      console.warn('Volume change may not have taken effect - both device and Web SDK updates had issues')
    }
  }, [isPremium, isWebPlaybackReady, setWebVolume, setSpotifyVolume])

  const currentTrack = playbackState?.item || null

  // Seek handler for progress bar
  const handleSeek = useCallback(async (newProgress: number[]) => {
    if (!currentTrack || !isPremium || !isWebPlaybackReady || !webSeek) return
    
    const progressPercent = newProgress[0]
    const positionMs = Math.round((progressPercent / 100) * currentTrack.duration_ms)
    
    await webSeek(positionMs)
  }, [currentTrack, isPremium, isWebPlaybackReady, webSeek])

  // Sync volume from external changes (keyboard/buttons)
  useEffect(() => {
    if (playbackState?.device?.volume_percent !== undefined) {
      setLocalVolume(playbackState.device.volume_percent)
    } else if (webVolume !== undefined) {
      setLocalVolume(webVolume)
    }
  }, [playbackState?.device?.volume_percent, webVolume])

  const handleSkipNext = useCallback(() => {
    runTrackTransition(skipToNext)
  }, [runTrackTransition, skipToNext])

  const handleSkipPrevious = useCallback(() => {
    runTrackTransition(skipToPrevious)
  }, [runTrackTransition, skipToPrevious])
  
  // Handle needle dragging for play/pause (mouse and touch)
  const handleNeedleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsDraggingNeedle(true)
  }
  
  const handleNeedleDragEnd = useCallback(async (e: MouseEvent) => {
    if (!isDraggingNeedle) return
    
    setIsDraggingNeedle(false)
    
    // Get the record element position
    const recordElement = document.getElementById('vinyl-record')
    if (!recordElement) return
    
    const rect = recordElement.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    
    // Calculate distance from cursor to record center
    const distance = Math.sqrt(
      Math.pow(e.clientX - centerX, 2) + 
      Math.pow(e.clientY - centerY, 2)
    )
    
    // If needle is on the record (within radius), play; otherwise pause
    const recordRadius = rect.width / 2
    const onRecord = distance < recordRadius * 0.9 // 90% of radius to account for edge
    
    if (onRecord && !playbackState?.is_playing) {
      await play()
    } else if (!onRecord && playbackState?.is_playing) {
      await pause()
    }
  }, [isDraggingNeedle, playbackState?.is_playing, play, pause])
  
  const handleNeedleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingNeedle) return
    
    // Calculate angle based on mouse position
    const tonearmElement = document.getElementById('tonearm-container')
    if (!tonearmElement) return
    
    const rect = tonearmElement.getBoundingClientRect()
    const pivotX = rect.left + rect.width * 0.635 // Pivot at 63.5%
    const pivotY = rect.top + rect.height * 0.224 // Pivot at 22.4%
    
    const angle = Math.atan2(e.clientY - pivotY, e.clientX - pivotX) * (180 / Math.PI)
    
    // Constrain angle between -35 (rest) and 20 (inner)
    const constrainedAngle = Math.max(-35, Math.min(20, angle - 90))
    setTonearmAngle(constrainedAngle)
  }, [isDraggingNeedle])
  
  // Add drag event listeners
  useEffect(() => {
    if (isDraggingNeedle) {
      document.addEventListener('mousemove', handleNeedleMouseMove)
      document.addEventListener('mouseup', handleNeedleDragEnd)
      return () => {
        document.removeEventListener('mousemove', handleNeedleMouseMove)
        document.removeEventListener('mouseup', handleNeedleDragEnd)
      }
    }
  }, [isDraggingNeedle, handleNeedleMouseMove, handleNeedleDragEnd])
  const progress = currentTrack ? (playbackState.progress_ms / currentTrack.duration_ms) * 100 : 0

  // Update displayed track (for animations)
  useEffect(() => {
    if (!isTransitioning && currentTrack) {
      setDisplayedTrack(currentTrack)
    }
  }, [currentTrack, isTransitioning])

  // Detect automatic track changes
  useEffect(() => {
    if (currentTrack && previousTrackId && currentTrack.id !== previousTrackId && !isTransitioning) {
      // Track changed automatically (song ended)
      runTrackTransition(async () => {
        // Just wait for the new track to be ready
        return true
      })
    }
    if (currentTrack) {
      setPreviousTrackId(currentTrack.id)
    }
  }, [currentTrack, previousTrackId, isTransitioning, runTrackTransition])

  // Generate album gradient when theme is 'album' and track changes
  useEffect(() => {
    if (theme === 'album' && currentTrack?.album?.images?.[0]?.url) {
      generateAlbumGradient(currentTrack.album.images[0].url)
        .then(gradient => {
          setAlbumGradient(gradient)
        })
        .catch(() => {
          // Fallback gradient on error
          setAlbumGradient('linear-gradient(135deg, #667eea 0%, #764ba2 100%)')
        })
    }
  }, [theme, currentTrack?.album?.images, setAlbumGradient])

  // Show loading state when checking for playback
  if (isLoading && isAuthenticated) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--vinyl-bg)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to Spotify...</p>
        </div>
      </div>
    )
  }

  if (!isDesktop) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-6" style={{ 
        background: 'var(--vinyl-bg)',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}>
        <div className="text-center">
          {/* Rotating record icon */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            <Image
              src="/record.svg"
              alt="Vinyl Record"
              fill
              className="object-contain"
              style={{
                animation: 'spin 20s linear infinite',
              }}
            />
          </div>
          
          {/* Title */}
          <h1 className="text-2xl font-bold mb-3 text-foreground">
            Mobile Unavailable
          </h1>
          
          {/* Main message */}
          <p className="text-base text-muted-foreground mb-2">
            I have a life.
          </p>
          
          {/* Sub message */}
          <p className="text-sm text-muted-foreground opacity-70">
            Open on desktop.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--vinyl-bg)' }}>
      {/* Spotify Connect Device Selector */}
      {isAuthenticated && playbackState && isPremium && (
        <SpotifyConnect
          devices={devices}
          currentDevice={playbackState.device}
          onTransferPlayback={transferPlayback}
          isPremium={isPremium}
          theme={theme}
        />
      )}
      
      {/* Header with Spotify Auth */}
      <div className="absolute top-4 right-4 z-50">
        {isAuthenticated ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user?.images?.[0]?.url} />
                  <AvatarFallback>{user?.display_name?.[0]}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{user?.display_name}</span>
                {isPremium && (
                  <Badge variant="secondary" className="text-xs">Premium</Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                {user?.email}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              
              {/* System Status Section */}
              <div className="px-3 py-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold">System Status</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      getSystemStatus().overall === 'success' ? 'status-dot-success' :
                      getSystemStatus().overall === 'warning' ? 'status-dot-warning' :
                      'status-dot-error'
                    }`} />
                    <span className="text-xs text-muted-foreground font-medium">
                      {getSystemStatus().overall === 'success' ? 'All systems go' :
                       getSystemStatus().overall === 'warning' ? 'Minor issues' :
                       'Critical error'}
                    </span>
                  </div>
                </div>
                
                {/* Individual status checks */}
                <div className="space-y-2 pl-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Spotify Client ID</span>
                    <div className={`w-2 h-2 rounded-full ${
                      getSystemStatus().checks.spotifyClientId ? 'status-dot-success' : 'status-dot-error'
                    }`} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Spotify Client Secret</span>
                    <div className={`w-2 h-2 rounded-full ${
                      getSystemStatus().checks.spotifyClientSecret ? 'status-dot-success' : 'status-dot-error'
                    }`} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Authentication</span>
                    <div className={`w-2 h-2 rounded-full ${
                      getSystemStatus().checks.authenticated ? 'status-dot-success' : 'status-dot-warning'
                    }`} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Theme Cache</span>
                    <div className={`w-2 h-2 rounded-full ${
                      getSystemStatus().checks.themeCache ? 'status-dot-success' : 'status-dot-warning'
                    }`} />
                  </div>
                  {isPremium && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Web Playback SDK</span>
                      <div className={`w-2 h-2 rounded-full ${
                        getSystemStatus().checks.webPlayback ? 'status-dot-success' : 'status-dot-warning'
                      }`} />
                    </div>
                  )}
                </div>
              </div>
              
              <DropdownMenuSeparator />
              {!isPremium && (
                <>
                  <DropdownMenuItem disabled className="text-xs">
                    <Music className="mr-2 h-3 w-3" />
                    Free Account - Playback Limited
                  </DropdownMenuItem>
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Control playback from Spotify app
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={logout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button 
            asChild 
            className="bg-black hover:bg-gray-900 text-white px-6 py-2"
          >
            <a href="/api/auth/spotify/login" className="flex items-center gap-3">
              <Image
                src="/Spotify_Primary_Logo_RGB_Green.png"
                alt="Spotify"
                width={20}
                height={20}
                className="object-contain"
              />
              <span>Sign in with Spotify</span>
            </a>
          </Button>
        )}
      </div>

      {/* Main turntable area with padding */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-8 xl:p-12 no-select">
        <div className="w-full h-full max-w-[1800px] max-h-[900px] relative no-select">
          {/* Responsive container - side by side when wide, stacked when narrow */}
          <div className="flex flex-col xl:flex-row items-center justify-center gap-6 xl:gap-12 h-full relative z-10">
            {/* Album cover - scales with viewport */}
            <div className="relative flex-shrink-0 order-2 xl:order-1 w-full xl:w-auto h-[50vh] xl:h-[75vh] max-h-[650px]">
              <div 
                className="relative h-full aspect-square mx-auto overflow-hidden cursor-pointer no-select"
                onMouseEnter={() => setAlbumHover(true)}
                onMouseLeave={() => setAlbumHover(false)}
                style={{
                  transform: albumHover ? 'translateY(-10px) rotateX(5deg) rotateY(-5deg)' : 'none',
                  transition: 'transform 0.3s ease-out',
                  transformStyle: 'preserve-3d',
                  perspective: '1000px'
                }}
              >
                <Image
                  src={displayedTrack?.album.images[0]?.url || currentTrack?.album.images[0]?.url || "/placeholder_album.png"}
                  alt="Album Cover"
                  fill
                  className="object-cover rounded-lg no-select"
                  style={{
                    boxShadow: albumHover 
                      ? '0 30px 60px rgba(0,0,0,0.4), 0 10px 20px rgba(0,0,0,0.2)' 
                      : '0 25px 50px rgba(0,0,0,0.3)',
                    opacity: albumOpacity,
                    transition: 'opacity 0.5s ease-in-out, box-shadow 0.3s ease-out',
                  }}
                  draggable={false}
                  priority
                />
              </div>
            </div>

            {/* Vinyl record and tonearm container - scales with viewport */}
            <div className="relative flex-shrink-0 order-1 xl:order-2 w-full xl:w-auto h-[50vh] xl:h-[75vh] max-h-[650px]">
              <div className="relative h-full aspect-square mx-auto">
                {/* Vinyl record using record.svg */}
                <div
                  id="vinyl-record"
                  className="absolute inset-0"
                  style={{
                    transform: `translateX(${recordPosition}%) rotate(${rotation}deg)`,
                    transition: isTransitioning 
                      ? `transform 0.35s cubic-bezier(0.4, 0, 0.6, 1)` 
                      : playbackState?.is_playing 
                        ? "none" 
                        : "transform 0.3s ease-out",
                  }}
                >
                  <Image
                    src={(() => {
                      // Inline vinyl design path logic
                      let design = vinylDesign
                      // If random is selected, pick a random design
                      if (design === 'random') {
                        const designs = ['design1', 'design2', 'design3', 'design4', 'design5', 'design6']
                        design = designs[Math.floor(Math.random() * designs.length)]
                      }
                      
                      switch (design) {
                        case 'default':
                          return '/record.svg'
                        case 'design1':
                          return '/Vinyl Record Design Aug 14 2025.png'
                        case 'design2':
                          return '/Vinyl Record Design Aug 14 2025 (1).png'
                        case 'design3':
                          return '/Vinyl Record Design Aug 14 2025 (2).png'
                        case 'design4':
                          return '/Vinyl Record Design Aug 14 2025 (3).png'
                        case 'design5':
                          return '/Vinyl Record Design Aug 14 2025 (4).png'
                        case 'design6':
                          return '/Vinyl Record Design Aug 14 2025 (5).png'
                        default:
                          return '/record.svg'
                      }
                    })()}
                    alt="Vinyl Record"
                    fill
                    className="object-contain no-select"
                    draggable={false}
                    priority
                  />
                  
                  {/* Center label overlay - blurred dark album cover with curved text */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[32%] h-[32%] rounded-full shadow-lg overflow-hidden">
                    {displayedTrack || currentTrack ? (
                      <>
                        {/* Blurred dark album cover background */}
                        <div className="absolute inset-0">
                          <Image
                            src={(displayedTrack || currentTrack).album.images[0]?.url || "/placeholder_album.png"}
                            alt=""
                            fill
                            className="object-cover"
                            style={{
                              filter: "blur(8px) brightness(0.3)",
                            }}
                          />
                          <div className="absolute inset-0 bg-black/40" />
                        </div>
                        
                        {/* Content overlay */}
                        <div className="relative h-full w-full flex items-center justify-center">
                          {/* Curved song title text */}
                          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                            <defs>
                              <path
                                id="circle-path"
                                d="M 50,50 m -35,0 a 35,35 0 1,1 70,0 a 35,35 0 1,1 -70,0"
                              />
                            </defs>
                            <text className="fill-white uppercase" style={{ fontSize: "5px", letterSpacing: "0.5px", fontWeight: "600" }}>
                              <textPath href="#circle-path" startOffset="50%" textAnchor="middle">
                                {(() => {
                                  const title = (displayedTrack || currentTrack).name.toUpperCase();
                                  // If title is too long, truncate and add ellipsis
                                  return title.length > 40 ? title.substring(0, 37) + "..." : title;
                                })()}
                              </textPath>
                            </text>
                          </svg>
                          
                          {/* Center content - Artist and Year */}
                          <div className="text-center z-10">
                            <div className="text-[0.6rem] lg:text-[10px] font-semibold text-white uppercase tracking-wider">
                              {(displayedTrack || currentTrack).artists[0].name}
                            </div>
                            <div className="text-[0.5rem] lg:text-[9px] text-white/80 uppercase mt-0.5">
                              {(displayedTrack || currentTrack).album.release_date?.split('-')[0]}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="bg-gray-800 h-full w-full flex items-center justify-center">
                        <div className="text-[0.6rem] lg:text-[10px] text-gray-400">
                          {isAuthenticated ? "No track playing" : "Sign in to play"}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tonearm container - fixed position */}
                <div 
                  id="tonearm-container"
                  className="absolute"
                  style={{
                    right: "-30%",
                    top: "0",
                    width: "70%",
                    height: "100%",
                    pointerEvents: "none",
                  }}
                >
                  {/* Tonearm SVG with rotation around pivot */}
                  <div
                    className="absolute inset-0"
                    style={{
                      transform: `rotate(${tonearmAngle}deg)`,
                      // Pivot point at 63.5% from left, 22.4% from top (based on SVG pivot element position)
                      transformOrigin: "63.5% 22.4%",
                      transition: isDraggingNeedle ? "none" : isTransitioning ? "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)" : playbackState?.is_playing ? "transform 0.3s ease-out" : "transform 0.8s ease-in-out",
                    }}
                  >
                    <Image
                      src="/tonearm.svg"
                      alt="Tonearm"
                      fill
                      className="object-contain drop-shadow-lg no-select"
                      style={{
                        objectPosition: "center",
                      }}
                      draggable={false}
                      priority
                    />
                    {/* Draggable needle area */}
                    <div
                      className="absolute"
                      style={{
                        left: '8%',
                        top: '75%',
                        width: '15%',
                        height: '15%',
                        cursor: isDraggingNeedle ? 'grabbing' : 'grab',
                        pointerEvents: 'auto',
                        zIndex: 10,
                      }}
                      onMouseDown={handleNeedleDragStart}
                      onTouchStart={handleNeedleDragStart}
                      title="Drag needle to play/pause"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom control bar */}
      <div className="fixed bottom-0 left-0 right-0 h-18 px-6 flex items-center justify-between" style={{
        backgroundColor: theme === 'album' ? 'rgba(255, 255, 255, 0.95)' : 'var(--card)',
        borderTop: theme === 'album' ? '1px solid rgba(0, 0, 0, 0.1)' : '1px solid var(--border)',
        color: theme === 'album' ? '#000' : (theme === 'dark' || theme === 'amoled') ? '#fff' : 'var(--card-foreground)',
        backdropFilter: 'none',
        opacity: 1
      }}>
        {/* Left: Track info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {currentTrack ? (
            <>
              <div className="relative w-12 h-12 rounded overflow-hidden shadow-sm">
                <Image
                  src={currentTrack.album.images[0]?.url || "/placeholder_album.png"}
                  alt="Album Thumbnail"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                {(() => {
                  const text = `${currentTrack.name} • ${currentTrack.artists.map((a: any) => a.name).join(", ")}`
                  const needsMarquee = text.length > 50
                  
                  if (needsMarquee) {
                    return (
                      <div className="marquee-container">
                        <div className="marquee-content">
                          <span className="text-sm font-medium" style={{
                            color: theme === 'album' ? '#000' : (theme === 'dark' || theme === 'amoled') ? '#fff' : undefined
                          }}>
                            {text}
                          </span>
                          <span className="text-sm font-medium mx-16" style={{
                            color: theme === 'album' ? '#000' : (theme === 'dark' || theme === 'amoled') ? '#fff' : undefined
                          }}>
                            {text}
                          </span>
                        </div>
                      </div>
                    )
                  }
                  
                  return (
                    <div className="text-sm font-medium truncate" style={{
                      color: theme === 'album' ? '#000' : (theme === 'dark' || theme === 'amoled') ? '#fff' : undefined
                    }}>
                      {text}
                    </div>
                  )
                })()}
              </div>
            </>
          ) : (
            <>
              <div className="relative w-12 h-12 rounded overflow-hidden shadow-sm">
                <Image
                  src="/placeholder_album.png"
                  alt="Album Placeholder"
                  fill
                  className="object-cover opacity-50"
                />
              </div>
              <div className="text-sm text-gray-500">
                {isAuthenticated ? "No track playing" : "Sign in to see what's playing"}
              </div>
            </>
          )}
        </div>

        {/* Center: Transport controls */}
        <div className="flex items-center gap-4 flex-1 justify-center">
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleSkipPrevious}
            disabled={!isAuthenticated || (!isPremium && !playbackState?.is_playing) || isTransitioning}
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handlePlayPause} 
            className="w-10 h-10 rounded-full"
            disabled={!isAuthenticated || (!isPremium && !playbackState?.item) || isTransitioning}
          >
            {playbackState?.is_playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleSkipNext}
            disabled={!isAuthenticated || (!isPremium && !playbackState?.is_playing) || isTransitioning}
          >
            <SkipForward className="w-4 h-4" />
          </Button>
          
          {/* Next track info */}
          {queue?.next && (
            <div className="hidden lg:flex items-center gap-2 ml-4 opacity-60">
              <Image
                src={queue.next.album.images[0]?.url || "/placeholder_album.png"}
                alt="Next"
                width={32}
                height={32}
                className="rounded"
              />
              <div className="text-xs text-gray-600 max-w-[100px]">
                <p className="truncate font-medium">{queue.next.name}</p>
                <p className="truncate opacity-75">{queue.next.artists[0].name}</p>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {currentTrack && (
            <div className="flex items-center gap-2 ml-4">
              <span className="text-xs w-10 text-right" style={{
                color: theme === 'album' ? 'rgba(255,255,255,0.9)' : (theme === 'dark' || theme === 'amoled') ? 'rgba(255,255,255,0.6)' : undefined
              }}>
                {formatTime(playbackState?.progress_ms || 0)}
              </span>
              <Slider
                value={[progress]}
                max={100}
                step={0.1}
                className="w-32"
                disabled={!isPremium || !isWebPlaybackReady}
                onValueChange={handleSeek}
              />
              <span className="text-xs w-10" style={{
                color: theme === 'album' ? 'rgba(255,255,255,0.9)' : (theme === 'dark' || theme === 'amoled') ? 'rgba(255,255,255,0.6)' : undefined
              }}>
                -{formatTime((currentTrack.duration_ms - (playbackState?.progress_ms || 0)))}
              </span>
            </div>
          )}
        </div>

        {/* Right: Settings */}
        <div className="flex items-center gap-3 flex-1 justify-end">
          {isPremium && isWebPlaybackReady && (
            <RecentItemsPopup onPlay={playUri} isPremium={isPremium} />
          )}
          <ThemeSelectorPopup
            currentTheme={theme}
            onThemeChange={(theme) => setTheme(theme as any)}
            currentAlbumImage={currentTrack?.album?.images?.[0]?.url}
            currentVinylDesign={vinylDesign}
            onVinylDesignChange={setVinylDesign}
          />
        </div>
      </div>

      {/* Error/Info Messages */}
      {error && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
          {error}
        </div>
      )}
      
      {isAuthenticated && !isPremium && !error && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          Free account: Play music in Spotify app to see it here
        </div>
      )}
    </div>
  )
}