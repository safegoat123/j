import { memo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { AlbumSummary, ArtistAlbumRef, ArtistSummary, Playlist } from '../api/types';
import { Cover } from './Cover';

export const CardGrid = ({ children }: { children: ReactNode }) => <div className="card-grid">{children}</div>;
interface CardProps { to: string; coverTrackId: number | null; title: string; subtitle?: string; round?: boolean }

export const MediaCard = memo(({ to, coverTrackId, title, subtitle, round }: CardProps) => (
  <Link to={to} className="media-card">
    <Cover trackId={coverTrackId} size="100%" round={round} className="media-card__cover" alt="" />
    <div className="media-card__title" title={title}>{title}</div>
    {subtitle && <div className="media-card__sub">{subtitle}</div>}
  </Link>
));
MediaCard.displayName = 'MediaCard';

export const AlbumCard = ({ album }: { album: AlbumSummary | ArtistAlbumRef }) => (
  <MediaCard to={`/album/${encodeURIComponent(album.key)}`} coverTrackId={album.cover_track_id}
    title={album.name ?? '알 수 없는 앨범'}
    subtitle={'artist' in album ? [album.year, album.artist].filter(Boolean).join(' · ') : `${album.year ?? ''} · ${album.track_count}곡`} />
);
export const ArtistCard = ({ artist }: { artist: ArtistSummary }) => (
  <MediaCard to={`/artist/${encodeURIComponent(artist.key)}`} coverTrackId={artist.cover_track_id} round
    title={artist.name} subtitle={`앨범 ${artist.album_count} · ${artist.track_count}곡`} />
);
export const PlaylistCard = ({ playlist }: { playlist: Playlist }) => (
  <MediaCard to={`/playlist/${playlist.id}`} coverTrackId={playlist.cover_track_id} title={playlist.name} subtitle={`${playlist.track_count}곡`} />
);
