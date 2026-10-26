// Address of the local Vinyl Music server. Override with VITE_API_URL (see .env.example).
// The server binds to 127.0.0.1 by default, so the library is never exposed to the LAN.
export const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://127.0.0.1:8000';

export const streamUrl = (trackId: number): string => `${API_BASE}/api/stream/${trackId}`;

export const coverUrl = (trackId: number): string => `${API_BASE}/api/covers/${trackId}`;
