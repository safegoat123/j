import { useParams } from 'react-router-dom';
import { Button, Spin } from 'antd';
import { useAlbumQuery } from '../../store/api';
import { PageHeader } from '../../components/PageHeader';
import { TrackList } from '../../components/TrackList';
import { useAppDispatch } from '../../store/store';
import { playTracks } from '../../store/slices/player';

export default function AlbumPage() {
  const { key = '' } = useParams();
  const decoded = decodeURIComponent(key);
  const { data, isLoading, error } = useAlbumQuery(decoded);
  const dispatch = useAppDispatch();
  if (isLoading) return <div className="page-loading"><Spin /></div>;
  if (error || !data) return <div className="page">앨범을 불러오지 못했습니다.</div>;
  return <div className="page"><PageHeader kicker="앨범" title={data.name ?? '알 수 없는 앨범'} coverTrackId={data.cover_track_id} meta={[data.artist,data.year,data.track_count ? `${data.track_count}곡` : ''].filter(Boolean).join(' · ')}
    actions={<Button type="primary" onClick={() => dispatch(playTracks(data.tracks, 0))}>앨범 재생</Button>} />
    <TrackList tracks={data.tracks} showAlbum={false} /></div>;
}
