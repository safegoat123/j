import { useParams } from 'react-router-dom';
import { Button, Spin } from 'antd';
import { usePlaylistQuery, useDeletePlaylistMutation } from '../../store/api';
import { PageHeader } from '../../components/PageHeader';
import { TrackList } from '../../components/TrackList';
import { useAppDispatch } from '../../store/store';
import { playTracks } from '../../store/slices/player';
import { App as AntApp } from 'antd';
import { useNavigate } from 'react-router-dom';

export default function PlaylistPage() {
  const { id = '' } = useParams();
  const playlistId = Number(id);
  const { data, isLoading, error } = usePlaylistQuery(playlistId, { skip: !Number.isFinite(playlistId) });
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { message, modal } = AntApp.useApp();
  const [remove] = useDeletePlaylistMutation();
  if (isLoading) return <div className="page-loading"><Spin /></div>;
  if (error || !data) return <div className="page">재생목록을 불러오지 못했습니다.</div>;
  const deletePlaylist = () => modal.confirm({ title:'재생목록 삭제', content:`'${data.name}' 재생목록을 삭제할까요?`, okText:'삭제', okButtonProps:{danger:true}, onOk:async()=>{ try { await remove(data.id).unwrap(); message.success('재생목록을 삭제했습니다.'); navigate('/'); } catch { message.error('삭제하지 못했습니다.'); } } });
  return <div className="page"><PageHeader kicker="재생목록" title={data.name} coverTrackId={data.cover_track_id} meta={`${data.track_count}곡`}
    actions={<><Button type="primary" onClick={() => dispatch(playTracks(data.tracks, 0))}>재생</Button> <Button danger onClick={deletePlaylist}>삭제</Button></>} />
    <TrackList tracks={data.tracks} /></div>;
}
