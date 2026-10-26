import { useParams } from 'react-router-dom';
import { Spin } from 'antd';
import { useArtistQuery } from '../../store/api';
import { PageHeader } from '../../components/PageHeader';
import { TrackList } from '../../components/TrackList';
import { AlbumCard, CardGrid } from '../../components/Cards';

export default function ArtistPage() {
  const { key = '' } = useParams();
  const { data, isLoading, error } = useArtistQuery(decodeURIComponent(key));
  if (isLoading) return <div className="page-loading"><Spin /></div>;
  if (error || !data) return <div className="page">아티스트를 불러오지 못했습니다.</div>;
  return <div className="page"><PageHeader kicker="아티스트" title={data.name ?? '알 수 없는 아티스트'} coverTrackId={data.cover_track_id} round meta={`곡 ${data.track_count}개 · 앨범 ${data.albums.length}개`} />
    <h2>앨범</h2><CardGrid>{data.albums.map((a) => <AlbumCard key={a.key} album={a} />)}</CardGrid>
    <h2 style={{ marginTop:28 }}>곡</h2><TrackList tracks={data.tracks} /></div>;
}
