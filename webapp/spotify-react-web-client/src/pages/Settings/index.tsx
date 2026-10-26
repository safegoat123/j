import { useEffect, useState } from 'react';
import { Alert, Button, Input, List, Progress, Spin, Tag, App as AntApp } from 'antd';
import { errorMessage, useAddFolderMutation, useDuplicatesQuery, useFoldersQuery, useRemoveFolderMutation, useRestoreQuarantineMutation, useStartScanMutation, useScanStatusQuery, useQuarantineBatchesQuery } from '../../store/api';

export default function Settings() {
  const { message, modal } = AntApp.useApp();
  const [path, setPath] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const { data: folders = [], isLoading: foldersLoading, refetch: reloadFolders } = useFoldersQuery();
  const { data: duplicates } = useDuplicatesQuery();
  const { data: batches = [], refetch: reloadBatches } = useQuarantineBatchesQuery();
  const [addFolder, { isLoading: adding }] = useAddFolderMutation();
  const [removeFolder] = useRemoveFolderMutation();
  const [startScan, { isLoading: starting }] = useStartScanMutation();
  const [restore] = useRestoreQuarantineMutation();
  const { data: job } = useScanStatusQuery(jobId ?? '', { skip: !jobId, pollingInterval: jobId ? 800 : 0 });

  useEffect(() => {
    if (job && job.status !== 'running' && job.status !== 'pending') {
      setJobId(null);
      void reloadFolders();
      message[job.status === 'finished' ? 'success' : 'error'](job.status === 'finished' ? '라이브러리 스캔이 완료되었습니다.' : (job.message ?? '스캔에 실패했습니다.'));
    }
  }, [job?.status, job?.message, message, reloadFolders]);

  const submitFolder = async () => {
    const value = path.trim();
    if (!value) return;
    try { await addFolder(value).unwrap(); setPath(''); message.success('음악 폴더를 추가했습니다.'); }
    catch (e) { message.error(errorMessage(e)); }
  };
  const scan = async () => {
    try { const result = await startScan().unwrap(); setJobId(result.id); message.info('라이브러리 스캔을 시작했습니다.'); }
    catch (e) { message.error(errorMessage(e)); }
  };
  const remove = (id: number, folderPath: string) => modal.confirm({
    title: '음악 폴더 제거', content: `등록된 폴더만 목록에서 제거합니다. 실제 파일은 삭제하지 않습니다.\n${folderPath}`,
    okText: '제거', cancelText: '취소', okButtonProps: { danger: true },
    onOk: async () => { try { await removeFolder(id).unwrap(); message.success('폴더를 제거했습니다.'); } catch (e) { message.error(errorMessage(e)); } },
  });
  const restoreBatch = async (id: string) => {
    try { const result = await restore(id).unwrap(); message.success(`${result.restored.length}개 파일을 복원했습니다.`); void reloadBatches(); }
    catch (e) { message.error(errorMessage(e)); }
  };
  return <div className="page">
    <h1>라이브러리 관리</h1>
    <p className="muted">음악 폴더를 등록하고 스캔하세요. 중복 파일은 기본적으로 삭제하지 않습니다.</p>
    <section style={{ marginTop:24 }}><h2>음악 폴더</h2>
      <Input.Search value={path} onChange={(e) => setPath(e.target.value)} onSearch={submitFolder} enterButton="폴더 추가" placeholder="예: C:\\Music 또는 /home/me/Music" loading={adding} />
      {foldersLoading ? <Spin /> : <List style={{ marginTop:12 }} dataSource={folders} locale={{ emptyText:'등록된 폴더가 없습니다.' }} renderItem={(folder) =>
        <List.Item actions={[<Button key="remove" danger size="small" onClick={() => remove(folder.id, folder.path)}>제거</Button>]}>
          <span>{folder.path}</span>{!folder.exists && <Tag color="red">경로 없음</Tag>}
        </List.Item>} />}
      <Button type="primary" style={{ marginTop:12 }} onClick={scan} disabled={!folders.length || starting || !!jobId}>라이브러리 스캔</Button>
      {job && <div style={{ marginTop:12 }}><Progress percent={job.total ? Math.round(job.done / job.total * 100) : job.status === 'finished' ? 100 : 0} status={job.status === 'failed' ? 'exception' : job.status === 'finished' ? 'success' : 'active'} />
        <p className="muted">{job.current ?? job.message ?? '스캔 준비 중'} · {job.done}/{job.total}</p></div>}
    </section>
    <section style={{ marginTop:32 }}><h2>중복 후보</h2>
      {duplicates ? <><p>파일 해시 기준 {duplicates.by_hash.length}그룹 · 제목과 아티스트 기준 {duplicates.by_metadata.length}그룹</p>
        <Alert type="info" showIcon message="중복 파일은 자동으로 삭제하지 않습니다." description="중복 후보 확인과 격리 작업은 백엔드 API의 미리보기/확인 절차를 통해 진행하세요." /></> : <p className="muted">중복 정보를 불러오는 중이거나 아직 데이터가 없습니다.</p>}
    </section>
    <section style={{ marginTop:32 }}><h2>격리된 파일 복원</h2>
      <List dataSource={batches} locale={{ emptyText:'격리된 파일이 없습니다.' }} renderItem={(batch) =>
        <List.Item actions={[<Button key="restore" onClick={() => restoreBatch(batch.id)}>복원</Button>]}>
          <div><strong>{batch.id}</strong><div className="muted small">{batch.items.length}개 항목 · 복원 {batch.restored}개</div></div>
        </List.Item>} />
    </section>
  </div>;
}
