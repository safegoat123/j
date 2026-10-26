import { NextRequest, NextResponse } from 'next/server'

const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
const REDIRECT_URI =
  process.env.NODE_ENV === 'production'
    ? 'https://music.pranavkarra.me/api/auth/spotify/callback'
    : 'http://localhost:3000/api/auth/spotify/callback'

// Allowed error codes from Spotify OAuth
const ALLOWED_ERRORS = ['access_denied', 'state_mismatch', 'no_code', 'token_exchange_failed']

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Check for errors - sanitize to prevent open redirect
  if (error) {
    const safeError = ALLOWED_ERRORS.includes(error) ? error : 'auth_error'
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(safeError)}`, request.url))
  }
  
  // Verify state
  const storedState = request.cookies.get('spotify_auth_state')?.value
  if (!state || state !== storedState) {
    return NextResponse.redirect(new URL('/?error=state_mismatch', request.url))
  }
  
  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', request.url))
  }
  
  // Exchange code for tokens
  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
      })
    })
    
    if (!response.ok) {
      throw new Error('Failed to exchange code for tokens')
    }
    
    const data = await response.json()
    
    // Create response with redirect to home
    const redirectResponse = NextResponse.redirect(new URL('/', request.url))
    
    // Set tokens in httpOnly cookies
    redirectResponse.cookies.set('spotify_access_token', data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: data.expires_in // Usually 3600 seconds (1 hour)
    })
    
    redirectResponse.cookies.set('spotify_refresh_token', data.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })
    
    // Clear state cookie
    redirectResponse.cookies.delete('spotify_auth_state')
    
    return redirectResponse
  } catch (error) {
    console.error('Error exchanging code for tokens:', error)
    return NextResponse.redirect(new URL('/?error=token_exchange_failed', request.url))
  }
}