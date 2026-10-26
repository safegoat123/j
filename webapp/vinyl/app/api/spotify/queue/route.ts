import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('spotify_access_token')?.value
  
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  
  try {
    // Fetch the user's queue
    const queueResponse = await fetch('https://api.spotify.com/v1/me/player/queue', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })
    
    // Fetch recently played tracks
    const recentResponse = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })
    
    if (queueResponse.status === 401 || recentResponse.status === 401) {
      return NextResponse.json({ error: 'Token expired' }, { status: 401 })
    }
    
    let queue = null
    let recentTracks = null
    
    // Handle queue response
    if (queueResponse.status === 204) {
      queue = { queue: [] }
    } else if (queueResponse.ok) {
      queue = await queueResponse.json()
    }
    
    // Handle recent tracks response
    if (recentResponse.ok) {
      const recentData = await recentResponse.json()
      recentTracks = recentData.items || []
    }
    
    // Get the next track from queue (first item in queue array)
    const nextTrack = queue?.queue?.[0] || null
    
    // Get the previous track from recently played
    const previousTrack = recentTracks?.[0]?.track || null
    
    return NextResponse.json({
      next: nextTrack,
      previous: previousTrack,
      fullQueue: queue?.queue || []
    })
  } catch (error) {
    console.error('Error fetching queue:', error)
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 })
  }
}