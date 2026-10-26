import { FaHeart } from 'react-icons/fa';
import { useLikedQuery } from '../../store/api';
import { PageHeader } from '../../components/PageHeader';
import { TrackList } from '../../components/TrackList';
import { Spin } from 'antd';

export default function LikedSongs() {
  const { data = [], isLoading, error } = useLikedQuery();
  if (isLoading) return <div className="page-loading"><Spin /></div>;
  if (error) return <div className="page">좋아요 목록을 불러오지 못했습니다.</div>;
  return <div className="page"><PageHeader kicker="보관함" title="좋아요 표시한 곡" coverTrackId={data[0]?.has_cover ? data[0].id : null} meta={`${data.length}곡`} />
    <TrackList tracks={data} emptyText="좋아요 표시한 곡이 없습니다." /></div>;
}
