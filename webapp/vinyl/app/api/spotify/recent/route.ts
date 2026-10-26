import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('spotify_access_token')?.value
  
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  
  try {
    // Fetch recently played tracks
    const tracksResponse = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=10', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })
    
    // Fetch user's top playlists
    const playlistsResponse = await fetch('https://api.spotify.com/v1/me/playlists?limit=5', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })
    
    // Fetch user's saved albums (recent)
    const albumsResponse = await fetch('https://api.spotify.com/v1/me/albums?limit=5', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })
    
    if (tracksResponse.status === 401 || playlistsResponse.status === 401 || albumsResponse.status === 401) {
      return NextResponse.json({ error: 'Token expired' }, { status: 401 })
    }
    
    const tracks = await tracksResponse.json()
    const playlists = await playlistsResponse.json()
    const albums = await albumsResponse.json()
    
    // Remove duplicate tracks
    const uniqueTracks = tracks.items?.reduce((acc: any[], item: any) => {
      if (!acc.find(t => t.track.id === item.track.id)) {
        acc.push(item)
      }
      return acc
    }, []) || []
    
    return NextResponse.json({
      tracks: uniqueTracks.slice(0, 5).map((item: any) => ({
        ...item.track,
        played_at: item.played_at
      })),
      playlists: playlists.items || [],
      albums: albums.items?.map((item: any) => item.album) || []
    })
  } catch (error) {
    console.error('Error fetching recent items:', error)
    return NextResponse.json({ error: 'Failed to fetch recent items' }, { status: 500 })
  }
}