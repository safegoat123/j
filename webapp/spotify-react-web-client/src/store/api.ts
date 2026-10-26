import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { API_BASE } from '../api/base';
import type {
  AlbumDetail,
  AlbumSummary,
  ArtistDetail,
  ArtistSummary,
  Duplicates,
  Folder,
  Health,
  Playlist,
  PlaylistDetail,
  QuarantineBatch,
  QuarantineItem,
  ScanJob,
  Track,
  TrackQuery,
} from '../api/types';

// RTK Query data layer for the local Vinyl Music API (FastAPI, see /server).
// Tags drive cache invalidation: liking a song refreshes every track list, a scan
// refreshes the whole library, editing a playlist refreshes that playlist, etc.

export type ApiError = { status?: number | string; data?: unknown };

export const errorMessage = (e: unknown): string => {
  const err = e as { status?: unknown; data?: { detail?: unknown } | unknown; error?: string };
  if (!err) return '알 수 없는 오류';
  if (err.status === 'FETCH_ERROR') return '로컬 Vinyl Music 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해 주세요 (기본 포트 8000).';
  const detail = (err.data as { detail?: unknown })?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg).join(', ');
  return err.error || `요청이 실패했습니다 (${String(err.status)})`;
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: `${API_BASE}/api` }),
  tagTypes: ['Tracks', 'Albums', 'Artists', 'Playlists', 'Liked', 'History', 'Folders', 'Library', 'Quarantine'],
  keepUnusedDataFor: 60,
  endpoints: (b) => ({
    health: b.query<Health, void>({ query: () => '/health', providesTags: ['Library'] }),

    // ---- library
    tracks: b.query<Track[], TrackQuery | void>({
      query: (params) => ({ url: '/tracks', params: params || undefined }),
      providesTags: ['Tracks', 'Library'],
    }),
    track: b.query<Track, number>({ query: (id) => `/tracks/${id}`, providesTags: ['Tracks'] }),
    missingTracks: b.query<Track[], void>({ query: () => '/tracks/missing', providesTags: ['Library'] }),
    errorTracks: b.query<Track[], void>({ query: () => '/tracks/errors', providesTags: ['Library'] }),
    albums: b.query<AlbumSummary[], string | void>({
      query: (q) => ({ url: '/albums', params: q ? { q } : undefined }),
      providesTags: ['Albums', 'Library'],
    }),
    album: b.query<AlbumDetail, string>({
      query: (key) => `/albums/${encodeURIComponent(key)}`,
      providesTags: ['Albums', 'Tracks', 'Library'],
    }),
    artists: b.query<ArtistSummary[], string | void>({
      query: (q) => ({ url: '/artists', params: q ? { q } : undefined }),
      providesTags: ['Artists', 'Library'],
    }),
    artist: b.query<ArtistDetail, string>({
      query: (key) => `/artists/${encodeURIComponent(key)}`,
      providesTags: ['Artists', 'Tracks', 'Library'],
    }),
    genres: b.query<{ name: string; track_count: number }[], void>({
      query: () => '/genres',
      providesTags: ['Library'],
    }),
    search: b.query<{ tracks: Track[]; albums: AlbumSummary[]; artists: ArtistSummary[] }, string>({
      query: (q) => ({ url: '/search', params: { q, limit: 50 } }),
      providesTags: ['Tracks', 'Library'],
    }),

    // ---- folders + scan + import
    folders: b.query<Folder[], void>({ query: () => '/folders', providesTags: ['Folders'] }),
    addFolder: b.mutation<Folder, string>({
      query: (path) => ({ url: '/folders', method: 'POST', body: { path } }),
      invalidatesTags: ['Folders'],
    }),
    removeFolder: b.mutation<{ ok: boolean }, number>({
      query: (id) => ({ url: `/folders/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Folders'],
    }),
    startScan: b.mutation<ScanJob, void>({ query: () => ({ url: '/scan', method: 'POST' }) }),
    scanStatus: b.query<ScanJob, string>({ query: (id) => `/scan/${id}`, keepUnusedDataFor: 0 }),
    importFiles: b.mutation<{ results: { file: string; status: string; reason?: string; track_id?: number }[] }, File[]>({
      query: (files) => {
        const body = new FormData();
        files.forEach((f) => body.append('files', f, f.name));
        return { url: '/import', method: 'POST', body };
      },
      invalidatesTags: ['Library', 'Tracks', 'Albums', 'Artists'],
    }),

    // ---- playlists
    playlists: b.query<Playlist[], void>({ query: () => '/playlists', providesTags: ['Playlists'] }),
    playlist: b.query<PlaylistDetail, number>({
      query: (id) => `/playlists/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Playlists', id }, 'Tracks', 'Library'],
    }),
    createPlaylist: b.mutation<Playlist, { name: string; description?: string }>({
      query: (body) => ({ url: '/playlists', method: 'POST', body }),
      invalidatesTags: ['Playlists'],
    }),
    updatePlaylist: b.mutation<Playlist, { id: number; name?: string; description?: string }>({
      query: ({ id, ...body }) => ({ url: `/playlists/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => ['Playlists', { type: 'Playlists', id }],
    }),
    deletePlaylist: b.mutation<{ ok: boolean }, number>({
      query: (id) => ({ url: `/playlists/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Playlists'],
    }),
    setPlaylistTracks: b.mutation<Track[], { id: number; track_ids: number[] }>({
      query: ({ id, track_ids }) => ({ url: `/playlists/${id}/tracks`, method: 'PUT', body: { track_ids } }),
      invalidatesTags: (_r, _e, { id }) => ['Playlists', { type: 'Playlists', id }],
    }),
    addToPlaylist: b.mutation<Track[], { id: number; track_ids: number[] }>({
      query: ({ id, track_ids }) => ({ url: `/playlists/${id}/tracks`, method: 'POST', body: { track_ids } }),
      invalidatesTags: (_r, _e, { id }) => ['Playlists', { type: 'Playlists', id }],
    }),

    // ---- likes + history
    liked: b.query<Track[], void>({ query: () => '/liked', providesTags: ['Liked', 'Tracks'] }),
    setLiked: b.mutation<{ liked: boolean }, { id: number; liked: boolean }>({
      query: ({ id, liked }) => ({ url: `/liked/${id}`, method: liked ? 'PUT' : 'DELETE' }),
      invalidatesTags: ['Liked', 'Tracks'],
    }),
    history: b.query<Track[], number | void>({
      query: (limit) => ({ url: '/history', params: { limit: limit || 50 } }),
      providesTags: ['History'],
    }),
    clearHistory: b.mutation<{ ok: boolean }, void>({
      query: () => ({ url: '/history', method: 'DELETE' }),
      invalidatesTags: ['History'],
    }),

    // ---- maintenance
    duplicates: b.query<Duplicates, void>({ query: () => '/duplicates', providesTags: ['Library'] }),
    quarantine: b.mutation<
      { dry_run: boolean; batch: string | null; manifest?: string; items: QuarantineItem[] },
      { track_ids: number[]; confirm: boolean }
    >({
      query: (body) => ({ url: '/duplicates/quarantine', method: 'POST', body }),
      invalidatesTags: (r) => (r && !r.dry_run ? ['Library', 'Quarantine'] : []),
    }),
    quarantineBatches: b.query<QuarantineBatch[], void>({ query: () => '/quarantine', providesTags: ['Quarantine'] }),
    restoreQuarantine: b.mutation<{ restored: number[] }, string>({
      query: (batch) => ({ url: `/quarantine/${batch}/restore`, method: 'POST' }),
      invalidatesTags: ['Library', 'Quarantine'],
    }),
  }),
});

export const {
  useHealthQuery,
  useTracksQuery,
  useTrackQuery,
  useMissingTracksQuery,
  useErrorTracksQuery,
  useAlbumsQuery,
  useAlbumQuery,
  useArtistsQuery,
  useArtistQuery,
  useGenresQuery,
  useSearchQuery,
  useFoldersQuery,
  useAddFolderMutation,
  useRemoveFolderMutation,
  useStartScanMutation,
  useScanStatusQuery,
  useImportFilesMutation,
  usePlaylistsQuery,
  usePlaylistQuery,
  useCreatePlaylistMutation,
  useUpdatePlaylistMutation,
  useDeletePlaylistMutation,
  useSetPlaylistTracksMutation,
  useAddToPlaylistMutation,
  useLikedQuery,
  useSetLikedMutation,
  useHistoryQuery,
  useClearHistoryMutation,
  useDuplicatesQuery,
  useQuarantineMutation,
  useQuarantineBatchesQuery,
  useRestoreQuarantineMutation,
} = api;
