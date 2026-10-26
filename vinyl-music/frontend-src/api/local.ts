import Axios from 'axios';
export const API_BASE: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
export const api = Axios.create({ baseURL: `${API_BASE}/api` });
export interface Track {
  id: number; title: string; artist?: string; album?: string; album_artist?: string;
  duration?: number; year?: number; genre?: string; format: string; playable: number;
  has_cover: number; missing: number; liked?: number; track_number?: number; error?: string | null;
}
export const streamUrl = (id: number) => `${API_BASE}/api/stream/${id}`;
export const coverUrl = (id: number) => `${API_BASE}/api/covers/${id}`;
