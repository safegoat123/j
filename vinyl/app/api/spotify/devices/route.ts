import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('spotify_access_token')?.value
  
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  
  try {
    const response = await fetch('https://api.spotify.com/v1/me/player/devices', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })
    
    if (response.status === 401) {
      return NextResponse.json({ error: 'Token expired' }, { status: 401 })
    }
    
    if (!response.ok) {
      return NextResponse.json({ devices: [] })
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching devices:', error)
    return NextResponse.json({ devices: [] })
  }
}