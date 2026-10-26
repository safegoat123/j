import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('spotify_access_token')?.value
  
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  
  try {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })
    
    if (response.status === 401) {
      // Token expired, need to refresh
      return NextResponse.json({ error: 'Token expired' }, { status: 401 })
    }
    
    if (!response.ok) {
      throw new Error('Failed to fetch user data')
    }
    
    const userData = await response.json()
    return NextResponse.json(userData)
  } catch (error) {
    console.error('Error fetching user data:', error)
    return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 })
  }
}