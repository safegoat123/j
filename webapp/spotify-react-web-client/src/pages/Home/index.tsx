import { Link } from 'react-router-dom';
import { Alert, Button, Empty, Spin } from 'antd';
import { errorMessage, useAlbumsQuery, useHealthQuery, useHistoryQuery, usePlaylistsQuery, useTracksQuery } from '../../store/api';
import { TrackList } from '../../components/TrackList';
import { AlbumCard, CardGrid, PlaylistCard } from '../../components/Cards';

export default function Home() {
  const { data: health, error, isLoading } = useHealthQuery();
  const has = !!health?.tracks;
  const { data: history = [] } = useHistoryQuery(12, { skip: !has });
  const { data: recent = [] } = useTracksQuery({ sort: 'added_at', order: 'desc', limit: 10 }, { skip: !has });
  const { data: albums = [] } = useAlbumsQuery(undefined, { skip: !has });
  const { data: playlists = [] } = usePlaylistsQuery();
  if (isLoading) return <div className="page-loading"><Spin /></div>;
  if (error) return <div className="page"><Alert type="error" showIcon message="서버 연결 실패" description={errorMessage(error)} /></div>;
  if (!has) return <div className="page page--center"><Empty description="라이브러리가 비어 있습니다. 음악 폴더를 등록하고 스캔해 주세요."><Link to="/settings"><Button type="primary">음악 폴더 추가</Button></Link></Empty></div>;
  return <div className="page">
    <h1>좋은 음악, 편하게 듣기</h1>
    <p className="muted">내 컴퓨터의 음악을 모아 듣는 Vinyl Music</p>
    <section><h2>최근 재생</h2><TrackList tracks={history} emptyText="아직 재생 기록이 없습니다." /></section>
    <section style={{ marginTop: 32 }}><h2>최근 추가된 곡</h2><TrackList tracks={recent} emptyText="음악 폴더를 스캔해 곡을 추가하세요." /></section>
    <section style={{ marginTop: 32 }}><h2>앨범</h2><CardGrid>{albums.slice(0,8).map((album) => <AlbumCard key={album.key} album={album} />)}</CardGrid></section>
    <section style={{ marginTop: 32 }}><h2>재생목록</h2><CardGrid>{playlists.map((p) => <PlaylistCard key={p.id} playlist={p} />)}</CardGrid></section>
  </div>;
}
