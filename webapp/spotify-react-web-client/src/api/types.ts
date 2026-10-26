// Response shapes of the local FastAPI server (see webapp/server/vinyl_server/app.py).

export interface Track {
  id: number;
  path: string;
  title: string;
  artist: string | null;
  album: string | null;
  album_artist: string | null;
  album_key: string | null;
  artist_key: string | null;
  duration: number | null;
  track_number: number | null;
  disc_number: number | null;
  year: number | null;
  genre: string | null;
  format: string | null;
  mime: string | null;
  bitrate: number | null;
  sample_rate: number | null;
  bit_depth: number | null;
  channels: number | null;
  file_size: number | null;
  file_hash: string | null;
  has_cover: boolean;
  added_at: number | null;
  modified_at: number | null;
  missing: boolean;
  error: string | null;
  liked: boolean;
  /** true when the browser can decode the format and the file is present. */
  playable: boolean;
  // Only on some endpoints
  position?: number;
  played_at?: number;
  history_id?: number;
  liked_at?: number;
}

export interface TrackQuery {
  q?: string;
  sort?: 'title' | 'artist' | 'album' | 'year' | 'added_at' | 'duration' | 'genre';
  order?: 'asc' | 'desc';
  artist?: string;
  album?: string;
  album_key?: string;
  artist_key?: string;
  genre?: string;
  format?: string;
  liked?: boolean;
  include_missing?: boolean;
  limit?: number;
  offset?: number;
}

export interface AlbumSummary {
  key: string;
  name: string;
  artist: string | null;
  artist_key: string | null;
  year: number | null;
  track_count: number;
  duration: number;
  cover_track_id: number | null;
}

export interface AlbumDetail {
  key: string;
  name: string | null;
  artist: string | null;
  artist_key: string | null;
  year: number | null;
  genre: string | null;
  track_count: number;
  duration: number;
  cover_track_id: number | null;
  tracks: Track[];
}

export interface ArtistSummary {
  key: string;
  name: string;
  track_count: number;
  album_count: number;
  cover_track_id: number | null;
}

export interface ArtistAlbumRef {
  key: string;
  name: string | null;
  year: number | null;
  track_count: number;
  cover_track_id: number | null;
}

export interface ArtistDetail {
  key: string;
  name: string | null;
  track_count: number;
  cover_track_id: number | null;
  albums: ArtistAlbumRef[];
  tracks: Track[];
}

export interface Folder {
  id: number;
  path: string;
  added_at: number | null;
  exists: boolean;
}

export interface Health {
  status: string;
  tracks: number;
  missing: number;
}

export interface Playlist {
  id: number;
  name: string;
  description: string | null;
  created_at: number | null;
  updated_at: number | null;
  track_count: number;
  cover_track_id: number | null;
}

export interface PlaylistDetail extends Playlist {
  tracks: Track[];
}

export interface ScanJob {
  id: string;
  status: 'pending' | 'running' | 'finished' | 'failed';
  total: number;
  done: number;
  added: number;
  updated: number;
  unchanged: number;
  missing: number;
  errors: number;
  current: string | null;
  message: string | null;
  started_at: number;
  finished_at: number | null;
}

export interface DuplicateGroup {
  reason: string;
  tracks: Track[];
}

export interface Duplicates {
  dry_run: boolean;
  by_hash: DuplicateGroup[];
  by_metadata: DuplicateGroup[];
}

export interface QuarantineItem {
  track_id: number;
  source: string;
  destination?: string;
  status: 'planned' | 'skipped' | 'moved' | 'restored';
  reason?: string;
}

export interface QuarantineBatch {
  id: string;
  created_at: number;
  manifest_path: string;
  restored: number;
  items: QuarantineItem[];
}
