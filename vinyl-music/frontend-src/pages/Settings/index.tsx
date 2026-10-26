import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Empty, Input, List, Progress, message } from 'antd';
import { api, Track } from '../../api/local';

interface Folder { id: number; path: string }
interface Job { id: string; status: 'running' | 'finished' | 'failed'; done: number; total: number; error?: string }
interface Dups { by_hash: number[][]; by_metadata: number[][] }

export default function Settings() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [path, setPath] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [missing, setMissing] = useState<Track[]>([]);
  const [dups, setDups] = useState<Dups | null>(null);
  const timer = useRef<number>();

  const load = useCallback(async () => {
    try {
      const [f, m, d] = await Promise.all([api.get('/folders'), api.get('/tracks/missing'), api.get('/duplicates')]);
      setFolders(f.data); setMissing(m.data); setDups(d.data);
    } catch { message.error('서버에 연결할 수 없습니다. 백엔드(python app.py)가 실행 중인지 확인하세요.'); }
  }, []);
  useEffect(() => { void load(); return () => window.clearInterval(timer.current); }, [load]);

  const addFolder = async () => {
    try { await api.post('/folders', { path }); setPath(''); await load(); }
    catch (e: any) { message.error(e?.response?.status === 400 ? '존재하지 않는 폴더입니다.' : '폴더를 추가하지 못했습니다.'); }
  };
  const scan = async () => {
    try {
      const { data } = await api.post<Job>('/scan');
      setJob(data);
      window.clearInterval(timer.current);
      timer.current = window.setInterval(async () => {
        const r = await api.get<Job>(`/scan/${data.id}`).catch(() => null);
        if (!r) return;
        setJob(r.data);
        if (r.data.status !== 'running') { window.clearInterval(timer.current); void load(); }
      }, 700);
    } catch { message.error('스캔을 시작하지 못했습니다.'); }
  };

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h2>음악 폴더</h2>
      <Input.Search value={path} onChange={(e) => setPath(e.target.value)} onSearch={addFolder}
        enterButton="추가" placeholder="예: C:\\Music 또는 /home/me/Music" />
      {folders.length === 0 ? <Empty description="음악 폴더를 추가하세요" style={{ margin: 24 }} /> : (
        <List dataSource={folders} renderItem={(f) => (
          <List.Item actions={[<Button danger size="small" onClick={async () => { await api.delete(`/folders/${f.id}`); void load(); }}>제거</Button>]}>
            {f.path}
          </List.Item>)} />)}
      <Button type="primary" onClick={scan} disabled={!folders.length || job?.status === 'running'}>라이브러리 스캔</Button>
      {job && <Progress percent={job.total ? Math.round((job.done / job.total) * 100) : job.status === 'finished' ? 100 : 0}
        status={job.status === 'failed' ? 'exception' : job.status === 'finished' ? 'success' : 'active'} />}
      {job?.error && <p style={{ color: '#ff4d4f' }}>스캔 실패: {job.error}</p>}
      <h3 style={{ marginTop: 24 }}>누락된 파일 ({missing.length})</h3>
      <List size="small" dataSource={missing} locale={{ emptyText: '없음' }} renderItem={(t) => <List.Item>{t.title}</List.Item>} />
      <h3>중복 후보 (조회만 · 자동 삭제 없음)</h3>
      <p>파일 내용 기준 {dups?.by_hash.length ?? 0}그룹, 제목·아티스트 기준 {dups?.by_metadata.length ?? 0}그룹</p>
    </div>
  );
}
