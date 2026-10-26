import { useState } from 'react';
import { Select, Spin } from 'antd';
import { useTracksQuery } from '../../store/api';
import { TrackList } from '../../components/TrackList';

export default function Library() {
  const [sort, setSort] = useState<'title'|'artist'|'album'|'added_at'>('title');
  const [order, setOrder] = useState<'asc'|'desc'>('asc');
  const { data = [], isLoading } = useTracksQuery({ sort, order, limit: 1000 });
  return <div className="page"><h1>보관함</h1><div style={{ display:'flex', gap:8, marginBottom:18 }}>
    <Select value={sort} onChange={setSort} options={[{value:'title',label:'제목순'},{value:'artist',label:'아티스트순'},{value:'album',label:'앨범순'},{value:'added_at',label:'추가한 순'}]} />
    <Select value={order} onChange={setOrder} options={[{value:'asc',label:'오름차순'},{value:'desc',label:'내림차순'}]} />
  </div>{isLoading ? <div className="page-loading"><Spin /></div> : <TrackList tracks={data} />}</div>;
}
