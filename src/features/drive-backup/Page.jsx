import React, { useCallback, useEffect, useState } from 'react';
import { Archive, CheckCircle2, Clock3, CloudUpload, Database, RefreshCw, ShieldCheck, AlertCircle, HardDriveDownload } from 'lucide-react';
import { supabase } from '../../shared/supabase.js';
import './drive-backup.css';

const formatBytes = value => {
  const n = Number(value || 0);
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};
const formatDate = value => value ? new Date(value).toLocaleString('vi-VN') : '—';

export default function Page() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data, error: queryError } = await supabase.from('system_backup_runs')
        .select('id,created_at,finished_at,status,source,file_name,size_bytes,table_count,row_count,checksum_sha256,error_message')
        .order('created_at', { ascending: false }).limit(24);
      if (queryError) throw queryError;
      setRuns(data || []);
    } catch (e) { setError(e.message || 'Không tải được lịch sử sao lưu.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const backupNow = async () => {
    if (!window.confirm('Bắt đầu sao lưu dữ liệu hiện tại lên Google Drive? Quá trình có thể mất vài phút.')) return;
    setBusy(true); setError(''); setNotice('Đang tạo snapshot và chuyển bản sao lưu lên Google Drive…');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('system-drive-backup', { body: { source: 'MANUAL' } });
      if (invokeError) throw invokeError;
      if (!data?.success) throw new Error(data?.error || 'Sao lưu không thành công.');
      setNotice(`Sao lưu thành công: ${data.file_name} · ${formatBytes(data.size_bytes)} · ${data.table_count} bảng · ${data.row_count} dòng.`);
      await load();
    } catch (e) { setError(e.message || 'Không thể sao lưu.'); setNotice(''); await load(); }
    finally { setBusy(false); }
  };

  const latest = runs.find(x => x.status === 'SUCCESS');
  const failed = runs.filter(x => x.status === 'FAILED').length;
  return <section className="backup-page">
    <div className="backup-head"><div><div className="backup-eyebrow">BẢO VỆ DỮ LIỆU · GOOGLE DRIVE</div><h2>Sao lưu dữ liệu</h2><p>Sao lưu cơ sở dữ liệu mỗi tháng một lần vào Google Drive của Phòng Tài chính.</p></div><button className="backup-primary" onClick={backupNow} disabled={busy}><CloudUpload size={16}/>{busy ? 'Đang sao lưu…' : 'Sao lưu ngay'}</button></div>
    <div className="backup-plan"><div className="backup-plan-icon"><Clock3 size={22}/></div><div><b>Lịch tự động: ngày 16 hằng tháng · 23:00</b><span>Chạy bằng Google Apps Script dưới tài khoản tckt@thptvietau.edu.vn. Có thể sao lưu thủ công bất cứ lúc nào.</span></div><span className="backup-plan-tag">1 LẦN / THÁNG</span></div>
    {error && <div className="backup-alert error"><AlertCircle size={16}/>{error}</div>}{notice && <div className={`backup-alert ${busy ? 'info' : 'success'}`}>{busy ? <RefreshCw size={16} className="backup-spin"/> : <CheckCircle2 size={16}/ >}{notice}</div>}
    <div className="backup-kpis"><article><Database/><span>Bảng dữ liệu trong bản mới nhất</span><b>{latest?.table_count ?? '—'}</b></article><article><Archive/><span>Dòng dữ liệu trong bản mới nhất</span><b>{latest?.row_count?.toLocaleString('vi-VN') ?? '—'}</b></article><article><HardDriveDownload/><span>Dung lượng bản mới nhất</span><b>{formatBytes(latest?.size_bytes)}</b></article><article><ShieldCheck/><span>Lần sao lưu lỗi gần đây</span><b>{failed}</b></article></div>
    <div className="backup-section-head"><div><h3>Lịch sử sao lưu</h3><p>Tối đa 24 lần gần nhất được ghi nhận trong hệ thống.</p></div><button className="backup-secondary" onClick={load} disabled={loading}><RefreshCw size={15}/> Làm mới</button></div>
    <div className="backup-table-wrap"><table className="backup-table"><thead><tr><th>Thời gian</th><th>Loại</th><th>Tên tệp</th><th>Dung lượng</th><th>Bảng / Dòng</th><th>Trạng thái</th></tr></thead><tbody>{loading ? <tr><td colSpan="6" className="backup-empty">Đang tải lịch sử…</td></tr> : !runs.length ? <tr><td colSpan="6" className="backup-empty">Chưa có bản sao lưu. Sau khi cấu hình Apps Script và thực hiện lần đầu, lịch sử sẽ hiển thị tại đây.</td></tr> : runs.map(run => <tr key={run.id}><td>{formatDate(run.finished_at || run.created_at)}</td><td>{run.source === 'SCHEDULED' ? 'Tự động' : 'Thủ công'}</td><td><b>{run.file_name || '—'}</b>{run.error_message && <small className="backup-row-error">{run.error_message}</small>}</td><td>{formatBytes(run.size_bytes)}</td><td>{run.table_count ?? '—'} / {Number(run.row_count || 0).toLocaleString('vi-VN')}</td><td><span className={`backup-status ${run.status.toLowerCase()}`}>{run.status === 'SUCCESS' ? 'Thành công' : run.status === 'FAILED' ? 'Thất bại' : 'Đang chạy'}</span></td></tr>)}</tbody></table></div>
    <div className="backup-footnote"><ShieldCheck size={16}/><span>Bản sao lưu gồm dữ liệu các bảng thuộc schema public. Không bao gồm tài khoản đăng nhập Supabase Auth, tệp nhị phân trong Storage, cấu hình hệ thống hoặc bản sao vật lý PostgreSQL. Đây là snapshot dữ liệu để phục vụ quy trình khôi phục có kiểm soát.</span></div>
  </section>;
}
