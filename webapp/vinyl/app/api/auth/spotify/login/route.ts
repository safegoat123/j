import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize'
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const REDIRECT_URI =
  process.env.NODE_ENV === 'production'
    ? 'https://music.pranavkarra.me/api/auth/spotify/callback'
    : 'http://localhost:3000/api/auth/spotify/callback'

// Scopes needed for playback control and reading user data
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-read-recently-played',
  'user-read-playback-position',
  'user-read-email',
  'user-read-private',
  'streaming',
  'app-remote-control'
].join(' ')

export async function GET() {
  // Generate cryptographically secure random state for CSRF protection
  const state = randomBytes(32).toString('hex')
  
  // Build authorization URL
  const params = new URLSearchParams({
    client_id: CLIENT_ID!,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state: state,
    show_dialog: 'true'
  })

  const authUrl = `${SPOTIFY_AUTH_URL}?${params.toString()}`
  
  // Set state in cookie for verification
  const response = NextResponse.redirect(authUrl)
  response.cookies.set('spotify_auth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10 // 10 minutes
  })
  
  return response
}