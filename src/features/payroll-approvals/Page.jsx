import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, FileCheck2, RefreshCw, Search, ShieldCheck, XCircle, Printer } from 'lucide-react';
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
const SNAPSHOT_LABELS = {
  employee_code: 'Mã nhân viên',
  employee_name: 'Họ và tên',
  employee_id: 'ID nhân sự',
  department: 'Phòng ban',
  position: 'Chức vụ',
  classification: 'Loại nhân sự',
  status: 'Trạng thái dữ liệu',
  fixed: 'Lương cố định',
  teaching: 'Tiền tiết dạy',
  additions: 'Khoản cộng',
  deductions: 'Khoản trừ',
  insurance_employee: 'BHXH NLĐ đóng',
  employer_insurance: 'BHXH doanh nghiệp đóng',
  union_employee: 'Kinh phí công đoàn NLĐ',
  taxable_income: 'Thu nhập tính thuế',
  personal_income_tax: 'Thuế TNCN',
  gross_income: 'Tổng thu nhập',
  net_pay: 'Thực lĩnh',
  lesson_count: 'Số tiết dạy',
};
const EXPORT_COMPONENTS = [
  { key: 'fixed', label: 'Lương cố định' },
  { key: 'teaching', label: 'Tiền tiết dạy / phụ đạo' },
  { key: 'additions', label: 'Khoản cộng' },
  { key: 'deductions', label: 'Khoản trừ' },
  { key: 'insurance_employee', label: 'BHXH người lao động' },
  { key: 'union_employee', label: 'Kinh phí công đoàn' },
  { key: 'taxable_income', label: 'Thu nhập tính thuế' },
  { key: 'personal_income_tax', label: 'Thuế TNCN' },
  { key: 'gross_income', label: 'Tổng thu nhập' },
  { key: 'net_pay', label: 'Thực lĩnh' },
];
const MONEY_KEYS = new Set([
  'fixed', 'teaching', 'additions', 'deductions', 'insurance_employee',
  'employer_insurance', 'union_employee', 'taxable_income',
  'personal_income_tax', 'gross_income', 'net_pay'
]);
function snapshotLabel(key) {
  return SNAPSHOT_LABELS[key] || key.replaceAll('_', ' ').replace(/^./, ch => ch.toLocaleUpperCase('vi'));
}
function displayValue(value, key) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  if (MONEY_KEYS.has(key) && Number.isFinite(Number(value))) {
    return Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  }
  if (key === 'lesson_count' && Number.isFinite(Number(value))) {
    return Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  }
  return String(value);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>\"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;'
  }[char]));
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
  const [exportComponents, setExportComponents] = useState(['fixed', 'teaching', 'additions', 'deductions', 'net_pay']);
  const [exportError, setExportError] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeDepartment, setEmployeeDepartment] = useState('ALL');
  const [employeeClassification, setEmployeeClassification] = useState('ALL');

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
    // Keep the same business order as Tổng Hợp Lương; only append any future
    // snapshot fields after the standard payroll columns.
    const preferred = [
      'employee_code', 'employee_name', 'classification',
      'fixed', 'teaching', 'additions', 'deductions',
      'insurance_employee', 'union_employee',
      'taxable_income', 'personal_income_tax',
      'gross_income', 'net_pay', 'status',
      'department', 'position', 'lesson_count',
      'employer_insurance', 'employee_id',
    ];
    const ordered = preferred.filter(key => keys.has(key));
    const extra = [...keys].filter(key => !preferred.includes(key)).sort((a, b) => a.localeCompare(b, 'vi'));
    return [...ordered, ...extra];
  }, [resultRows]);

  const departmentOptions = useMemo(() => [...new Set(resultRows.map(row => clean(row?.department)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')), [resultRows]);
  const classificationOptions = useMemo(() => [...new Set(resultRows.map(row => clean(row?.classification)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')), [resultRows]);
  const filteredResultRows = useMemo(() => {
    const q = employeeSearch.trim().toLocaleLowerCase('vi');
    return resultRows.filter(row => {
      const identity = [row?.employee_code, row?.employee_name, row?.department, row?.position].join(' ').toLocaleLowerCase('vi');
      return (!q || identity.includes(q))
        && (employeeDepartment === 'ALL' || clean(row?.department) === employeeDepartment)
        && (employeeClassification === 'ALL' || clean(row?.classification) === employeeClassification);
    });
  }, [resultRows, employeeSearch, employeeDepartment, employeeClassification]);

  const exportKeys = useMemo(() => {
    const identityKeys = ['employee_code', 'employee_name'].filter(key => snapshotKeys.includes(key));
    return [...identityKeys, ...exportComponents.filter(key => snapshotKeys.includes(key))];
  }, [snapshotKeys, exportComponents]);
  const printSnapshot = () => {
    setExportError('');
    if (!selectedRun || !filteredResultRows.length) {
      setExportError('Không có nhân sự phù hợp với bộ lọc để xuất.');
      return;
    }
    if (!exportComponents.length) {
      setExportError('Vui lòng chọn ít nhất một thành phần lương để xuất.');
      return;
    }
    if (!exportKeys.length) {
      setExportError('Các thành phần đã chọn không có trong snapshot. Không lấy dữ liệu thay thế từ màn hình tính lương.');
      return;
    }
    const headers = exportKeys.map(key => `<th>${escapeHtml(snapshotLabel(key))}</th>`).join('');
    const body = filteredResultRows.map(row => `<tr>${exportKeys.map(key => `<td class="${MONEY_KEYS.has(key) ? 'numeric ' : ''}${key === 'net_pay' ? 'net-pay' : ''}">${escapeHtml(displayValue(row?.[key], key))}</td>`).join('')}</tr>`).join('');
    const totalKeys = exportKeys.filter(key => !['employee_code','employee_name'].includes(key));
    const totalLabelCount = exportKeys.filter(key => ['employee_code','employee_name'].includes(key)).length;
    const totals = totalKeys.map(key => {
      if (!MONEY_KEYS.has(key)) return '<td></td>';
      const total = filteredResultRows.reduce((sum,row) => sum + (Number(row?.[key]) || 0), 0);
      return `<td class="numeric">${escapeHtml(displayValue(total,key))}</td>`;
    }).join('');
    const title = `${periodName(selectedPeriod)} - BẢNG LƯƠNG`;
    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,"Helvetica Neue",Helvetica,sans-serif;color:#172b3a;margin:0;font-size:9pt;font-synthesis:none;-webkit-font-smoothing:antialiased}
h1{font-family:Arial,"Helvetica Neue",Helvetica,sans-serif;font-size:15pt;margin:0 0 3mm}h2{font-family:Arial,"Helvetica Neue",Helvetica,sans-serif;font-size:11pt;margin:0 0 2mm}p{font-family:Arial,"Helvetica Neue",Helvetica,sans-serif;font-size:8pt;color:#52677a;margin:0 0 1mm}
.meta{display:flex;gap:7mm;flex-wrap:wrap;margin:3mm 0 6mm;font-size:8pt}
table{width:100%;border-collapse:collapse;table-layout:auto}thead{display:table-header-group}
th,td{border:1px solid #aab6c1;padding:5px 6px;text-align:left;vertical-align:top;overflow-wrap:anywhere}
th{background:#edf2f6;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}
td.numeric{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
td.net-pay{font-size:10pt;font-weight:800;color:#102d4a}
tr{break-inside:avoid}
.total td{font-weight:700;background:#f2f5f7;-webkit-print-color-adjust:exact;print-color-adjust:exact}
footer{display:flex;justify-content:space-between;gap:5mm;margin-top:5mm;font-size:8pt;color:#52677a}
.confirmation{width:34%;min-width:78mm;max-width:105mm;border:1.5px dashed #9aaabd;border-radius:4mm;background:#f8faff;padding:4mm 5mm;margin-top:6mm;font-family:Arial,"Helvetica Neue",Helvetica,sans-serif;font-size:8pt;line-height:1.35;color:#52677a;-webkit-print-color-adjust:exact;print-color-adjust:exact;break-inside:avoid}
.confirmation-heading{display:flex;align-items:center;gap:2mm;color:#3265a0;font-weight:700;font-size:10pt;letter-spacing:0;margin-bottom:2mm}
.confirmation-check{display:inline-flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;font-size:13pt;font-weight:700;line-height:1}
.confirmation-time{display:block;color:#172b3a;font-weight:700;font-size:8.5pt;margin-bottom:1mm;white-space:normal}
.signatures{display:grid;grid-template-columns:1fr 1fr;gap:25mm;margin-top:12mm;page-break-inside:avoid;text-align:center;font-family:Arial,"Helvetica Neue",Helvetica,sans-serif}
.signature-title{font-weight:600;font-size:9pt;text-transform:none}.signature-name{font-weight:700;margin-top:20mm;font-size:9pt}
@media screen{.confirmation{width:34%;min-width:360px;max-width:520px}}
@media screen{body{padding:12mm}table{min-width:900px}.wrap{overflow:auto}}
</style></head><body>
<header><h1>TRƯỜNG THPT VIỆT ÂU</h1><h2>${escapeHtml(periodName(selectedPeriod))}</h2>
<p>Mã kỳ lương: ${escapeHtml(selectedPeriod?.period_code || selectedPeriod?.code || '—')}</p>
<div class="meta"><span>Thời điểm tính: ${escapeHtml(dateTime(selectedRun.calculated_at || selectedRun.created_at))}</span><span>Số nhân sự: ${filteredResultRows.length}</span><span>Phạm vi lọc: ${escapeHtml(employeeDepartment === 'ALL' ? 'Tất cả phòng ban' : employeeDepartment)} · ${escapeHtml(employeeClassification === 'ALL' ? 'Tất cả loại nhân sự' : employeeClassification)}${employeeSearch ? ` · Tìm: ${escapeHtml(employeeSearch)}` : ''}</span></div></header>
<div class="wrap"><table><thead><tr>${headers}</tr></thead><tbody>${body}<tr class="total"><td colspan="${Math.max(1,totalLabelCount)}">TỔNG CỘNG</td>${totals}</tr></tbody></table></div>
<section class="confirmation"><div class="confirmation-heading"><span class="confirmation-check">✓</span><span>XÁC NHẬN HỆ THỐNG</span></div><span class="confirmation-time">Thời gian in: ${escapeHtml(new Date().toLocaleTimeString('vi-VN'))} ${escapeHtml(new Date().toLocaleDateString('vi-VN'))}</span>Tài liệu được tổng hợp chi tiết trực tiếp từ hệ thống VIỆT ÂU PAYROLL.<br>Thông tin thể hiện theo dữ liệu ghi nhận tại thời điểm in.</section>
<section class="signatures"><div><div class="signature-title">Người lập</div><div class="signature-name">PHẠM MINH TÂM</div></div><div><div class="signature-title">Duyệt Bảng Lương</div><div class="signature-name">NGUYỄN CƯỜNG</div></div></section>
</body></html>`;
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      setExportError('Trình duyệt đã chặn cửa sổ in. Hãy cho phép cửa sổ bật lên cho trang này rồi thử lại.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  };

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
      <section className="pa-export-panel">
         <div className="pa-export-heading"><div><h4>Xuất PDF / Bản in</h4><p>Xuất từ snapshot của phiên bản đang chọn; không tính lại lương. Chọn thành phần cần đưa vào bảng.</p></div>
           <button className="pa-button secondary" onClick={printSnapshot} disabled={!resultRows.length}><Printer size={15}/> Xuất PDF / In</button>
         </div>
         <div className="pa-export-meta"><span><strong>Kỳ lương:</strong> {periodName(selectedPeriod)}</span><span><strong>Phiên bản:</strong> Run #{selectedRun.run_number ?? '—'}</span><span><strong>Phạm vi:</strong> {filteredResultRows.length}/{resultRows.length} nhân sự sau lọc</span><span><strong>Trạng thái dữ liệu:</strong> Không hiển thị</span></div>
         <div className="pa-employee-filters">
           <label>Tìm nhân sự<input value={employeeSearch} onChange={event=>setEmployeeSearch(event.target.value)} placeholder="Mã nhân viên, họ tên, chức vụ..." /></label>
           <label>Phòng ban<select value={employeeDepartment} onChange={event=>setEmployeeDepartment(event.target.value)}><option value="ALL">Tất cả phòng ban</option>{departmentOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
           <label>Loại nhân sự<select value={employeeClassification} onChange={event=>setEmployeeClassification(event.target.value)}><option value="ALL">Tất cả loại nhân sự</option>{classificationOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
           <button type="button" className="pa-button small secondary" onClick={()=>{setEmployeeSearch('');setEmployeeDepartment('ALL');setEmployeeClassification('ALL')}}>Xóa lọc</button>
         </div>
         <div className="pa-export-components">{EXPORT_COMPONENTS.map(item => <label key={item.key}><input type="checkbox" checked={exportComponents.includes(item.key)} onChange={event => setExportComponents(current => event.target.checked ? [...current, item.key] : current.filter(key => key !== item.key))}/><span>{item.label}</span></label>)}</div>
         {exportError && <div className="pa-alert error"><AlertTriangle size={16}/><div><strong>Chưa thể xuất</strong><p>{exportError}</p></div></div>}
       </section>
       <div className="pa-subheading"><h4>Kết quả được lưu trong snapshot</h4><span>{filteredResultRows.length ? `${filteredResultRows.length}/${resultRows.length} nhân sự sau lọc` : 'Không có nhân sự phù hợp'}</span></div>
      {filteredResultRows.length && snapshotKeys.length ? <div className="pa-table-wrap"><table className="pa-table pa-result-table"><thead><tr>{snapshotKeys.map(key => <th key={key} className={`pa-col-${key}`}>{snapshotLabel(key)}</th>)}</tr></thead><tbody>{filteredResultRows.map((row, index) => <tr key={row?.employee_id || row?.employee_code || row?.id || index}>{snapshotKeys.map(key => <td key={key} className={`pa-col-${key}`} title={displayValue(row?.[key], key)}>{displayValue(row?.[key], key)}</td>)}</tr>)}</tbody></table></div>
      : <div className="pa-empty compact"><AlertTriangle size={19} /><p>Snapshot của phiên bản này chưa có cấu trúc kết quả nhân sự mà màn hình có thể nhận diện. Không lấy dữ liệu từ màn hình tính lương để tự điền thay thế.</p></div>}
      <div className="pa-subheading"><h4>Lịch sử trình duyệt</h4><span>{selectedApprovals.length} bản ghi</span></div>
      {!selectedApprovals.length ? <div className="pa-empty compact"><Clock3 size={19} /><p>Chưa có bản ghi lịch sử duyệt gắn với phiên bản/kỳ lương này.</p></div> : <div className="pa-approval-list">{selectedApprovals.map(item => <article className="pa-approval-item" key={item.id}><div className="pa-approval-icon">{String(item.status).toUpperCase() === 'APPROVED' ? <CheckCircle2 size={17} /> : String(item.status).toUpperCase() === 'REJECTED' ? <XCircle size={17} /> : <Clock3 size={17} />}</div><div className="pa-approval-main"><strong>{item.step_name || 'Bước duyệt'}</strong><p>{item.note || 'Không có ghi chú'}</p><small>{dateTime(item.created_at)} · Người xử lý: {item.actor_id || 'Chưa ghi nhận'}</small></div><span className={`pa-status ${statusClass(item.status)}`}>{runStatus(item.status)}</span></article>)}</div>}
       <div className="pa-print-sheet">
         <header><h1>VIỆT ÂU · BẢNG TỔNG HỢP LƯƠNG</h1><h2>{periodName(selectedPeriod)} · Run #{selectedRun.run_number ?? '—'}</h2><p>Mã kỳ: {selectedPeriod?.period_code || selectedPeriod?.code || '—'} · Thời điểm tính: {dateTime(selectedRun.calculated_at || selectedRun.created_at)}</p></header>
         <table><thead><tr>{exportKeys.map(key => <th key={key}>{snapshotLabel(key)}</th>)}</tr></thead>
           <tbody>{resultRows.map((row,index)=><tr key={row?.employee_id || row?.employee_code || index}>{exportKeys.map(key=><td key={key}>{displayValue(row?.[key],key)}</td>)}</tr>)}</tbody>
         </table>
         <footer><span>Tổng số nhân sự: {resultRows.length}</span><span>Phiên bản công thức: {selectedRun.formula_version || '—'}</span><span>Xuất từ snapshot đã lưu · Không tính lại lương</span></footer>
       </div>
    </section>}
    <p className="pa-footnote"><AlertTriangle size={14} /> Chưa bật nút trình duyệt/duyệt/từ chối ở giao diện vì cần xác nhận cơ chế phân quyền theo vai trò và chuyển trạng thái ở backend. RLS hiện tại chỉ kiểm tra quyền vận hành chung ở một số thao tác, chưa đủ bằng chứng để bảo đảm đúng vai trò Kế toán và Sếp.</p>
  </main>;
}
