<p align="center">
  <img src="public/record.svg" alt="vinyl" width="200"/>
</p>

<h1 align="center">Vinyl</h1>

<p align="center">
  A vinyl record player for Spotify. It turns your current track into a spinning record with an animated tonearm, dynamic theming pulled from the album art, and full playback control right in the browser.
</p>

<p align="center">
  <a href="https://vinyl.pranavkarra.me"><strong>Live app &rarr; vinyl.pranavkarra.me</strong></a>
</p>

## What it does

Vinyl is a web player that connects to your Spotify account and reimagines the now playing screen as a real record player. Sign in with Spotify, hit play, and watch the album spin.

- Realistic spinning vinyl with an animated tonearm
- Dynamic gradient backgrounds and color themes extracted from the album artwork
- Full playback control: play, pause, skip, seek, and volume (Spotify Premium required)
- Transfer playback between your Spotify Connect devices
- Quick access to recently played tracks, playlists, and albums

## Tech

- Next.js 15 with React 19 and TypeScript
- Tailwind CSS with shadcn/ui components
- Spotify Web API and Web Playback SDK (OAuth2 Authorization Code flow)
- Deployed on Vercel

## Running locally

```bash
npm install
npm run dev
```

You will need a Spotify developer app with a redirect URI configured for the OAuth callback, plus the matching client credentials in your environment. The Web Playback SDK features require a Spotify Premium account.

## Credits

Built by [Pranav Karra](https://pranavkarra.me).
