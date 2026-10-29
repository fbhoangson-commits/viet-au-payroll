import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, FileCheck2, RefreshCw, Search, ShieldCheck, XCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../shared/supabase.js';
import './payroll-approvals.css';

const clean = value => String(value ?? '').trim();
const money = value => Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' ₫';
const dateTime = value => value ? new Date(value).toLocaleString('vi-VN') : '—';
const periodName = period => clean(period?.name || period?.period_code || period?.code || `Kỳ ${period?.period_year || ''}-${String(period?.period_month || '').padStart(2, '0')}`);
const runStatus = value => ({ DRAFT: 'Bản nháp', PENDING: 'Chờ duyệt', SUBMITTED: 'Đã trình duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', LOCKED: 'Đã khóa', CANCELLED: 'Đã hủy' }[String(value || '').toUpperCase()] || value || 'Chưa xác định');
const statusClass = value => ({ APPROVED: 'approved', LOCKED: 'approved', PENDING: 'pending', SUBMITTED: 'pending', REJECTED: 'rejected', CANCELLED: 'muted', DRAFT: 'draft' }[String(value || '').toUpperCase()] || 'muted');
const errorText = error => error?.message || error?.details || String(error || 'Lỗi không xác định');

function snapshotRows(snapshot) {
  if (Array.isArray(snapshot)) return snapshot;
  if (!snapshot || typeof snapshot !== 'object') return [];
  for (const key of ['results', 'rows', 'employees', 'payroll_results', 'employee_results', 'details']) {
    if (Array.isArray(snapshot[key])) return snapshot[key];
  }
  return [];
}
function displayValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function Page() {
  const [periods, setPeriods] = useState([]);
  const [runs, setRuns] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [periodId, setPeriodId] = useState('ALL');
  const [selectedRunId, setSelectedRunId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [approvalWarning, setApprovalWarning] = useState('');

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase chưa được cấu hình. Không thể tải hồ sơ lương chính thức.');
      setLoading(false);
      return;
    }
    setRefreshing(true);
    setError('');
    setApprovalWarning('');
    try {
      const [periodResult, runResult, approvalResult] = await Promise.all([
        supabase.from('payroll_periods').select('*').order('created_at', { ascending: false }),
        supabase.from('payroll_runs').select('*').order('created_at', { ascending: false }),
        supabase.from('payroll_approvals').select('*').order('created_at', { ascending: false }),
      ]);
      if (periodResult.error) throw new Error(`Không tải được Kỳ Lương: ${errorText(periodResult.error)}`);
      if (runResult.error) throw new Error(`Không tải được phiên bản lương (payroll_runs): ${errorText(runResult.error)}`);
      setPeriods(periodResult.data || []);
      setRuns(runResult.data || []);
      if (approvalResult.error) {
        setApprovals([]);
        setApprovalWarning(`Chưa đọc được lịch sử trình duyệt: ${errorText(approvalResult.error)}. Quyền đọc do Supabase RLS kiểm soát.`);
      } else setApprovals(approvalResult.data || []);
      const nextRuns = runResult.data || [];
      setSelectedRunId(current => nextRuns.some(run => run.id === current) ? current : (nextRuns[0]?.id || ''));
    } catch (e) {
      setError(errorText(e));
      setPeriods([]); setRuns([]); setApprovals([]); setSelectedRunId('');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredRuns = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('vi');
    return runs.filter(run => {
      const period = periods.find(item => item.id === run.payroll_period_id);
      const periodMatches = periodId === 'ALL' || run.payroll_period_id === periodId;
      const text = [periodName(period), run.run_number, run.status, run.formula_version, run.id].join(' ').toLocaleLowerCase('vi');
      return periodMatches && (!q || text.includes(q));
    });
  }, [runs, periods, periodId, search]);

  const selectedRun = runs.find(run => run.id === selectedRunId) || null;
  const selectedPeriod = periods.find(period => period.id === selectedRun?.payroll_period_id) || null;
  const selectedApprovals = approvals.filter(item => item.payroll_run_id === selectedRunId || (!item.payroll_run_id && item.payroll_period_id === selectedRun?.payroll_period_id));
  const snapshot = selectedRun?.input_snapshot;
  const resultRows = snapshotRows(snapshot);
  const snapshotKeys = useMemo(() => {
    const keys = new Set();
    resultRows.forEach(row => Object.keys(row || {}).forEach(key => keys.add(key)));
    return [...keys];
  }, [resultRows]);

  return <main className="pa-page">
    <header className="pa-heading">
      <div className="pa-heading-icon"><FileCheck2 size={22} /></div>
      <div><div className="pa-eyebrow">DUYỆT LƯƠNG & BÁO CÁO</div><h2>Hồ sơ trình duyệt</h2><p>Theo dõi phiên bản lương đã lưu và lịch sử xử lý từ dữ liệu Supabase.</p></div>
      <button className="pa-button secondary" onClick={load} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'pa-spin' : ''} /> Làm mới</button>
    </header>

    {error && <div className="pa-alert error"><AlertTriangle size={17} /><div><strong>Không tải được hồ sơ</strong><p>{error}</p></div></div>}
    {approvalWarning && <div className="pa-alert warning"><AlertTriangle size={17} /><div><strong>Lịch sử trình duyệt chưa đầy đủ</strong><p>{approvalWarning}</p></div></div>}
    <div className="pa-note"><ShieldCheck size={18} /><div><strong>Chế độ an toàn — chỉ đọc</strong><p>Màn hình này không tự tính lại lương, không tạo phiên bản lương và không thay đổi trạng thái duyệt. Các thao tác phê duyệt chỉ được bổ sung khi quyền và chuyển trạng thái được bảo đảm ở phía Supabase/backend.</p></div></div>

    <section className="pa-toolbar">
      <label>Kỳ Lương<select value={periodId} onChange={event => setPeriodId(event.target.value)}><option value="ALL">Tất cả kỳ lương</option>{periods.map(period => <option key={period.id} value={period.id}>{periodName(period)}</option>)}</select></label>
      <label className="pa-search"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm kỳ lương, mã phiên bản..." /></label>
      <span className="pa-count">{filteredRuns.length} phiên bản lương</span>
    </section>

    <section className="pa-card">
      <div className="pa-card-heading"><div><h3>Phiên bản lương chính thức</h3><p>Dữ liệu lấy trực tiếp từ bảng <code>payroll_runs</code>; không lấy bảng kết quả tính tạm trên giao diện.</p></div></div>
      {loading ? <div className="pa-empty"><RefreshCw size={22} className="pa-spin" /><strong>Đang tải dữ liệu...</strong></div>
      : !filteredRuns.length ? <div className="pa-empty"><FileCheck2 size={28} /><strong>Chưa có phiên bản lương được lưu</strong><p>Không tìm thấy bản ghi trong <code>payroll_runs</code> theo bộ lọc hiện tại. Bảng kết quả đang hiển thị ở menu Tính Lương chưa được coi là hồ sơ trình duyệt chính thức.</p><p>Không tạo hồ sơ giả hoặc tự chụp lại kết quả tính tạm để thay thế dữ liệu chính thức.</p></div>
      : <div className="pa-table-wrap"><table className="pa-table"><thead><tr><th>Kỳ Lương</th><th>Phiên bản</th><th>Trạng thái</th><th>Phiên bản công thức</th><th>Thời điểm tính</th><th>Thao tác</th></tr></thead><tbody>{filteredRuns.map(run => {
        const period = periods.find(item => item.id === run.payroll_period_id);
        return <tr key={run.id} className={selectedRunId === run.id ? 'selected' : ''}>
          <td><strong>{periodName(period)}</strong><small>{period?.status || 'Chưa xác định trạng thái kỳ'}</small></td>
          <td><strong>Run #{run.run_number ?? '—'}</strong><small>{clean(run.id).slice(0, 8) || '—'}</small></td>
          <td><span className={`pa-status ${statusClass(run.status)}`}>{runStatus(run.status)}</span></td>
          <td>{run.formula_version || '—'}</td><td>{dateTime(run.calculated_at || run.created_at)}</td>
          <td><button className="pa-button small secondary" onClick={() => setSelectedRunId(run.id)}>Xem hồ sơ</button></td>
        </tr>;
      })}</tbody></table></div>}
    </section>

    {selectedRun && <section className="pa-card pa-detail">
      <div className="pa-card-heading"><div><div className="pa-eyebrow">CHI TIẾT HỒ SƠ</div><h3>{periodName(selectedPeriod)} · Run #{selectedRun.run_number ?? '—'}</h3><p>Trạng thái phiên bản: <strong>{runStatus(selectedRun.status)}</strong></p></div><span className={`pa-status ${statusClass(selectedRun.status)}`}>{runStatus(selectedRun.status)}</span></div>
      <div className="pa-info-grid"><div><span>Mã kỳ lương</span><strong>{selectedPeriod?.period_code || selectedPeriod?.code || '—'}</strong></div><div><span>Thời điểm tính</span><strong>{dateTime(selectedRun.calculated_at)}</strong></div><div><span>Phiên bản công thức</span><strong>{selectedRun.formula_version || '—'}</strong></div><div><span>Số dòng kết quả trong snapshot</span><strong>{resultRows.length || 'Chưa xác định'}</strong></div></div>
      <div className="pa-subheading"><h4>Kết quả được lưu trong snapshot</h4><span>{resultRows.length ? `${resultRows.length} nhân sự/dòng` : 'Chưa nhận diện được cấu trúc dòng kết quả'}</span></div>
      {resultRows.length && snapshotKeys.length ? <div className="pa-table-wrap"><table className="pa-table pa-result-table"><thead><tr>{snapshotKeys.map(key => <th key={key}>{key.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{resultRows.map((row, index) => <tr key={row?.employee_id || row?.employee_code || row?.id || index}>{snapshotKeys.map(key => <td key={key}>{displayValue(row?.[key])}</td>)}</tr>)}</tbody></table></div>
      : <div className="pa-empty compact"><AlertTriangle size={19} /><p>Snapshot của phiên bản này chưa có cấu trúc kết quả nhân sự mà màn hình có thể nhận diện. Không lấy dữ liệu từ màn hình tính lương để tự điền thay thế.</p></div>}
      <div className="pa-subheading"><h4>Lịch sử trình duyệt</h4><span>{selectedApprovals.length} bản ghi</span></div>
      {!selectedApprovals.length ? <div className="pa-empty compact"><Clock3 size={19} /><p>Chưa có bản ghi lịch sử duyệt gắn với phiên bản/kỳ lương này.</p></div> : <div className="pa-approval-list">{selectedApprovals.map(item => <article className="pa-approval-item" key={item.id}><div className="pa-approval-icon">{String(item.status).toUpperCase() === 'APPROVED' ? <CheckCircle2 size={17} /> : String(item.status).toUpperCase() === 'REJECTED' ? <XCircle size={17} /> : <Clock3 size={17} />}</div><div className="pa-approval-main"><strong>{item.step_name || 'Bước duyệt'}</strong><p>{item.note || 'Không có ghi chú'}</p><small>{dateTime(item.created_at)} · Người xử lý: {item.actor_id || 'Chưa ghi nhận'}</small></div><span className={`pa-status ${statusClass(item.status)}`}>{runStatus(item.status)}</span></article>)}</div>}
    </section>}
    <p className="pa-footnote"><AlertTriangle size={14} /> Chưa bật nút trình duyệt/duyệt/từ chối ở giao diện vì cần xác nhận cơ chế phân quyền theo vai trò và chuyển trạng thái ở backend. RLS hiện tại chỉ kiểm tra quyền vận hành chung ở một số thao tác, chưa đủ bằng chứng để bảo đảm đúng vai trò Kế toán và Sếp.</p>
  </main>;
}
