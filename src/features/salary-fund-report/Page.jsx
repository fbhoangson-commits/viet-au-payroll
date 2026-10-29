import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle, BarChart3, Building2, CalendarRange, CheckCircle2, Clock3,
  Download, FileCheck2, RefreshCw, Search, ShieldCheck, Users, Wallet,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../shared/supabase.js';
import './salary-fund-report.css';

const clean = value => String(value ?? '').trim();
const norm = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi');
const num = value => { if (value === null || value === undefined || value === '') return 0; const n = Number(value); return Number.isFinite(n) ? n : 0; };
const money = value => `${num(value).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ₫`;
const dateTime = value => value ? new Date(value).toLocaleString('vi-VN') : '—';
const periodName = p => clean(p?.name || p?.period_code || p?.code || `Kỳ ${p?.period_year || ''}-${String(p?.period_month || '').padStart(2, '0')}`);
const statusKey = value => clean(value).toUpperCase();
const statusName = value => ({ DRAFT: 'Bản nháp', PENDING: 'Chờ duyệt', SUBMITTED: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', LOCKED: 'Đã khóa', CANCELLED: 'Đã hủy' }[statusKey(value)] || clean(value) || 'Chưa xác định');
const statusTone = value => ({ DRAFT: 'draft', PENDING: 'pending', SUBMITTED: 'pending', APPROVED: 'approved', LOCKED: 'approved', REJECTED: 'rejected' }[statusKey(value)] || 'muted');
const errorText = error => error?.message || error?.details || String(error || 'Lỗi không xác định');
const rowList = snapshot => {
  if (Array.isArray(snapshot)) return snapshot;
  if (!snapshot || typeof snapshot !== 'object') return [];
  for (const key of ['results', 'rows', 'employees', 'payroll_results', 'employee_results', 'details']) if (Array.isArray(snapshot[key])) return snapshot[key];
  return [];
};
const totalsObject = snapshot => snapshot && typeof snapshot === 'object' && snapshot.totals && typeof snapshot.totals === 'object' ? snapshot.totals : null;
const codeOf = row => clean(row?.employee_code || row?.employee_code_snapshot || row?.code);
const nameOf = row => clean(row?.employee_name || row?.employee_name_snapshot || row?.full_name || row?.name || '');
const deptOf = row => clean(row?.department || row?.department_snapshot);
const classOf = row => clean(row?.classification || row?.employee_type || row?.employee_classification || row?.employment_type);
const moneyFields = [
  ['fixed', 'Lương cố định'], ['teaching', 'Tiết dạy & phụ đạo'], ['additions', 'Khoản cộng'], ['deductions', 'Khoản trừ'],
  ['insurance_employee', 'BHXH NLĐ'], ['union_employee', 'Phí Công đoàn NLĐ'], ['personal_income_tax', 'Thuế TNCN'],
  ['gross_income', 'Tổng thu nhập'], ['net_pay', 'Thực lĩnh'],
];
const orderedRuns = runs => [...runs].sort((a, b) => (num(b.run_number) - num(a.run_number)) || String(b.calculated_at || b.created_at || '').localeCompare(String(a.calculated_at || a.created_at || '')));

async function fetchAll(table, orderColumn = 'created_at') {
  const all = []; const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase.from(table).select('*').range(offset, offset + pageSize - 1);
    if (orderColumn) query = query.order(orderColumn, { ascending: false, nullsFirst: false });
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${errorText(error)}`);
    const batch = data || []; all.push(...batch);
    if (batch.length < pageSize) return all;
  }
}
function Metric({ title, value, subtitle, icon: Icon, primary = false }) {
  return <article className={`sf-metric${primary ? ' sf-metric-primary' : ''}`}><div className="sf-metric-head"><span>{title}</span><i><Icon size={17} /></i></div><strong>{value}</strong><small>{subtitle}</small></article>;
}
function Bars({ items, emptyText = 'Chưa có dữ liệu để phân tích.' }) {
  const max = Math.max(0, ...items.map(item => num(item.value)));
  if (!items.length || max <= 0) return <div className="sf-empty-inline">{emptyText}</div>;
  return <div className="sf-bars">{items.map((item, index) => <div className="sf-bar" key={`${item.label}-${index}`}><div className="sf-bar-label"><span>{item.label}</span><strong>{money(item.value)} <small>{item.share == null ? '' : `${item.share.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`}</small></strong></div><div className="sf-bar-track"><span style={{ width: `${Math.max(1, num(item.value) / max * 100)}%` }} /></div></div>)}</div>;
}

export default function Page() {
  const [periods, setPeriods] = useState([]); const [runs, setRuns] = useState([]); const [approvals, setApprovals] = useState([]); const [employees, setEmployees] = useState([]);
  const [periodId, setPeriodId] = useState(''); const [runId, setRunId] = useState(''); const [statusFilter, setStatusFilter] = useState('ALL');
  const [fromPeriodId, setFromPeriodId] = useState(''); const [toPeriodId, setToPeriodId] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('ALL'); const [departmentFilter, setDepartmentFilter] = useState('ALL'); const [search, setSearch] = useState(''); const [sortKey, setSortKey] = useState('gross_income'); const [sortDirection, setSortDirection] = useState('desc');
  const [pageNo, setPageNo] = useState(1); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState(''); const [warnings, setWarnings] = useState([]); const [updatedAt, setUpdatedAt] = useState('');
  const pageSize = 25;

  const load = useCallback(async (keepSelection = true) => {
    if (!isSupabaseConfigured || !supabase) { setError('Supabase chưa được cấu hình. Không thể tải báo cáo quỹ lương thực tế.'); setLoading(false); setRefreshing(false); return; }
    setRefreshing(true); setError(''); setWarnings([]); const nextWarnings = [];
    try {
      const [periodData, runData, approvalData, employeeData] = await Promise.all([
        fetchAll('payroll_periods'), fetchAll('payroll_runs'),
        fetchAll('payroll_approvals').catch(e => { nextWarnings.push(`Không đọc được lịch sử duyệt: ${errorText(e)}`); return []; }),
        fetchAll('employees').catch(e => { nextWarnings.push(`Không đọc được Employee Master để bổ sung thông tin còn thiếu: ${errorText(e)}`); return []; }),
      ]);
      const validPeriods = periodData || []; const validRuns = runData || [];
      setPeriods(validPeriods); setRuns(validRuns); setApprovals(approvalData || []); setEmployees(employeeData || []); setUpdatedAt(new Date().toISOString());
      const sortedPeriods = [...validPeriods].sort((a, b) => String(a.period_year || a.start_date || a.created_at || '').localeCompare(String(b.period_year || b.start_date || b.created_at || '')) || num(a.period_month) - num(b.period_month));
      if (keepSelection && periodId && validPeriods.some(p => p.id === periodId)) {
        const options = orderedRuns(validRuns.filter(r => r.payroll_period_id === periodId));
        setRunId(current => options.some(r => r.id === current) ? current : (options.find(r => ['APPROVED', 'LOCKED'].includes(statusKey(r.status)))?.id || options[0]?.id || ''));
      } else {
        const newestPeriodRun = [...validRuns].sort((a, b) => String(b.calculated_at || b.created_at || '').localeCompare(String(a.calculated_at || a.created_at || '')))[0];
        const initialPeriod = newestPeriodRun?.payroll_period_id || sortedPeriods[sortedPeriods.length - 1]?.id || '';
        const options = orderedRuns(validRuns.filter(r => r.payroll_period_id === initialPeriod));
        setPeriodId(initialPeriod); setRunId(options.find(r => ['APPROVED', 'LOCKED'].includes(statusKey(r.status)))?.id || options[0]?.id || '');
        setFromPeriodId(sortedPeriods[Math.max(0, sortedPeriods.length - 5)]?.id || initialPeriod); setToPeriodId(initialPeriod);
      }
      setWarnings(nextWarnings);
    } catch (e) { setError(errorText(e)); setWarnings(nextWarnings); setPeriods([]); setRuns([]); setApprovals([]); setEmployees([]); setRunId(''); }
    finally { setLoading(false); setRefreshing(false); }
  }, [periodId]);
  useEffect(() => { load(false); }, []);

  const periodRuns = useMemo(() => orderedRuns(runs.filter(run => run.payroll_period_id === periodId)), [runs, periodId]);
  const filteredRunOptions = useMemo(() => periodRuns.filter(run => statusFilter === 'ALL' || statusKey(run.status) === statusFilter || (statusFilter === 'PENDING' && statusKey(run.status) === 'SUBMITTED')), [periodRuns, statusFilter]);
  const selectedRun = runs.find(run => run.id === runId) || null;
  const selectedPeriod = periods.find(period => period.id === (selectedRun?.payroll_period_id || periodId)) || null;
  const rawRows = useMemo(() => rowList(selectedRun?.input_snapshot), [selectedRun]);
  const totalsFromSnapshot = useMemo(() => totalsObject(selectedRun?.input_snapshot) || (selectedRun?.saved_totals && typeof selectedRun.saved_totals === 'object' ? selectedRun.saved_totals : null), [selectedRun]);
  const employeeById = useMemo(() => new Map(employees.map(employee => [clean(employee.id), employee])), [employees]);
  const normalizedRows = useMemo(() => rawRows.map(row => {
    const master = employeeById.get(clean(row?.employee_id)) || {};
    const result = { ...row,
      employee_code: codeOf(row) || codeOf(master), employee_name: nameOf(row) || nameOf(master) || 'Chưa có tên',
      classification: classOf(row) || classOf(master), department: deptOf(row) || deptOf(master),
    };
    return result;
  }).sort((a, b) => codeOf(a).localeCompare(codeOf(b), 'vi', { numeric: true })), [rawRows, employeeById]);
  const classificationOptions = useMemo(() => [...new Set(normalizedRows.map(classOf).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')), [normalizedRows]);
  const departmentOptions = useMemo(() => [...new Set(normalizedRows.map(deptOf).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')), [normalizedRows]);
  const filteredRows = useMemo(() => {
    const q = norm(search);
    const rows = normalizedRows.filter(row => norm([codeOf(row), nameOf(row), classOf(row), deptOf(row)].join(' ')).includes(q)
      && (classificationFilter === 'ALL' || classOf(row) === classificationFilter) && (departmentFilter === 'ALL' || deptOf(row) === departmentFilter));
    return [...rows].sort((a,b) => (num(a[sortKey]) - num(b[sortKey])) * (sortDirection === 'asc' ? 1 : -1));
  }, [normalizedRows, search, classificationFilter, departmentFilter, sortKey, sortDirection]);
  useEffect(() => { setPageNo(1); }, [periodId, runId, classificationFilter, departmentFilter, search, sortKey, sortDirection]);
  useEffect(() => { if (filteredRunOptions.length && !filteredRunOptions.some(run => run.id === runId)) setRunId(filteredRunOptions[0].id); else if (!filteredRunOptions.length && runId) setRunId(''); }, [filteredRunOptions, runId]);
  const visibleRows = filteredRows.slice((pageNo - 1) * pageSize, pageNo * pageSize);
  const sums = useMemo(() => {
    const result = { employee_count: normalizedRows.length };
    [...moneyFields.map(([key]) => key), 'employer_insurance'].forEach(key => {
      const present = normalizedRows.some(row => row[key] !== undefined && row[key] !== null && row[key] !== '');
      result[`${key}_available`] = present;
      result[key] = normalizedRows.reduce((sum,row) => sum + num(row[key]), 0);
    });
    return result;
  }, [normalizedRows]);
  const hasSource = key => (totalsFromSnapshot && totalsFromSnapshot[key] !== undefined && totalsFromSnapshot[key] !== null) || normalizedRows.some(row => row[key] !== undefined && row[key] !== null && row[key] !== '');
  const totalFor = key => totalsFromSnapshot && totalsFromSnapshot[key] !== undefined && totalsFromSnapshot[key] !== null ? num(totalsFromSnapshot[key]) : (key === 'employee_count' ? normalizedRows.length : sums[key]);
  const valueFor = key => hasSource(key) ? money(totalFor(key)) : 'Chưa đủ dữ liệu';
  const hasSnapshot = Boolean(selectedRun && selectedRun.input_snapshot && typeof selectedRun.input_snapshot === 'object');
  const declaredCount = selectedRun?.snapshot_rows ?? totalsFromSnapshot?.employee_count ?? rawRows.length;
  const employerAvailable = hasSource('employer_insurance');
  const costAvailable = hasSource('gross_income') && employerAvailable;
  const totalCost = costAvailable ? totalFor('gross_income') + totalFor('employer_insurance') : null;
  const deductions = useMemo(() => [
    { label: 'Khoản trừ', key: 'deductions' }, { label: 'BHXH người lao động', key: 'insurance_employee' },
    { label: 'Phí Công đoàn', key: 'union_employee' }, { label: 'Thuế TNCN', key: 'personal_income_tax' },
  ].map(item => ({ ...item, value: hasSource(item.key) ? totalFor(item.key) : null })), [selectedRun, normalizedRows]);
  const incomes = useMemo(() => [
    { label: 'Lương cố định', key: 'fixed' }, { label: 'Tiết dạy & phụ đạo', key: 'teaching' }, { label: 'Khoản cộng', key: 'additions' },
  ].map(item => ({ ...item, value: hasSource(item.key) ? totalFor(item.key) : null })), [selectedRun, normalizedRows]);

  const periodsInRange = useMemo(() => {
    const sorted = [...periods].sort((a,b) => String(a.period_year || a.start_date || a.created_at || '').localeCompare(String(b.period_year || b.start_date || b.created_at || '')) || num(a.period_month)-num(b.period_month));
    const start = sorted.findIndex(p => p.id === fromPeriodId); const end = sorted.findIndex(p => p.id === toPeriodId);
    if (start < 0 || end < 0) return [];
    const lo = Math.min(start,end); const hi = Math.max(start,end);
    return sorted.slice(lo,hi+1);
  }, [periods, fromPeriodId, toPeriodId]);
  const comparisonData = useMemo(() => periodsInRange.map(period => {
    const candidates = orderedRuns(runs.filter(run => run.payroll_period_id === period.id));
    const approved = candidates.filter(run => ['APPROVED','LOCKED'].includes(statusKey(run.status)));
    const run = approved[0] || candidates[0];
    if (!run) return { period, run: null, valid: false, reason: 'Chưa có phiên bản lương được lưu' };
    const rows = rowList(run.input_snapshot); const totals = totalsObject(run.input_snapshot) || (run.saved_totals && typeof run.saved_totals === 'object' ? run.saved_totals : null);
    if (!run.input_snapshot || (!rows.length && !totals)) return { period, run, valid: false, reason: 'Thiếu snapshot hợp lệ' };
    const sum = key => totals && totals[key] != null ? num(totals[key]) : rows.reduce((s,r)=>s+num(r[key]),0);
    return { period, run, valid: true, draftFallback: !approved.length, employee_count: totals?.employee_count ?? run.snapshot_rows ?? rows.length, fixed: sum('fixed'), teaching: sum('teaching'), additions: sum('additions'), deductions: sum('deductions'), gross_income: sum('gross_income'), personal_income_tax: sum('personal_income_tax'), net_pay: sum('net_pay') };
  }), [periodsInRange, runs]);
  const latestComparison = [...comparisonData].reverse().find(item => item.valid);
  const previousComparison = latestComparison ? [...comparisonData].slice(0, comparisonData.indexOf(latestComparison)).reverse().find(item => item.valid) : null;
  const historyForSelected = useMemo(() => approvals.filter(item => item.payroll_run_id === selectedRun?.id || (!item.payroll_run_id && item.payroll_period_id === selectedRun?.payroll_period_id)).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))), [approvals, selectedRun]);
  const classificationData = useMemo(() => {
    const map = new Map(); normalizedRows.forEach(row => { const label = classOf(row) || 'Chưa phân loại'; const item = map.get(label) || { label, count: 0, gross_income: 0, net_pay: 0, fixed: 0, teaching: 0, additions: 0, deductions: 0 }; item.count++; ['gross_income','net_pay','fixed','teaching','additions','deductions'].forEach(key => item[key] += num(row[key])); map.set(label,item); });
    return [...map.values()].sort((a,b)=>b.gross_income-a.gross_income);
  }, [normalizedRows]);
  const departmentData = useMemo(() => {
    const map = new Map(); normalizedRows.forEach(row => { const label = deptOf(row); if (!label) return; const item = map.get(label) || { label, count: 0, gross_income: 0, net_pay: 0, fixed: 0, teaching: 0, additions: 0, deductions: 0 }; item.count++; ['gross_income','net_pay','fixed','teaching','additions','deductions'].forEach(key => item[key] += num(row[key])); map.set(label,item); });
    return [...map.values()].sort((a,b)=>b.gross_income-a.gross_income);
  }, [normalizedRows]);
  const alerts = useMemo(() => {
    const items = []; if (!selectedRun) return items;
    if (!hasSnapshot || (!rawRows.length && !totalsFromSnapshot)) items.push({ danger: true, title: 'Phiên bản thiếu snapshot', count: 1, detail: 'Không thể đối chiếu quỹ lương khi snapshot chưa có dữ liệu hợp lệ.' });
    const missingIdentity = normalizedRows.filter(row => !codeOf(row) || !nameOf(row) || nameOf(row) === 'Chưa có tên');
    if (missingIdentity.length) items.push({ title: 'Thiếu thông tin nhận diện nhân sự', count: missingIdentity.length, detail: 'Mã nhân viên hoặc họ tên chưa có trong snapshot và Employee Master.' });
    const missingClassification = normalizedRows.filter(row => !classOf(row)); if (missingClassification.length) items.push({ title: 'Thiếu phân loại nhân sự', count: missingClassification.length, detail: 'Không thể phân tích đầy đủ theo phân loại.' });
    const missingDepartment = normalizedRows.filter(row => !deptOf(row)); if (missingDepartment.length) items.push({ title: 'Thiếu phòng ban', count: missingDepartment.length, detail: 'Không thể phân bổ các nhân sự này vào báo cáo phòng ban.' });
    if (!employerAvailable) items.push({ title: 'Chưa đủ dữ liệu BHXH đơn vị', count: 1, detail: 'Snapshot không có trường employer_insurance; chưa thể xác định tổng chi phí nhân sự đầy đủ.' });
    if (statusKey(selectedRun.status) === 'REJECTED') items.push({ danger: true, title: 'Phiên bản bị từ chối', count: 1, detail: historyForSelected[0]?.note || historyForSelected[0]?.comments || 'Kiểm tra lịch sử duyệt.' });
    if (!['APPROVED','LOCKED'].includes(statusKey(selectedRun.status))) items.push({ title: 'Phiên bản chưa được duyệt', count: 1, detail: `Trạng thái hiện tại: ${statusName(selectedRun.status)}. Số liệu có thể là bản nháp hoặc chưa chính thức.` });
    if (declaredCount != null && Number(declaredCount) !== normalizedRows.length) items.push({ danger: true, title: 'Số lượng snapshot cần đối chiếu', count: Math.abs(Number(declaredCount)-normalizedRows.length), detail: `Phiên bản khai báo ${declaredCount} nhân sự, đọc được ${normalizedRows.length} dòng chi tiết.` });
    if (totalsFromSnapshot && normalizedRows.length) [['gross_income','Tổng thu nhập'],['net_pay','Thực lĩnh']].forEach(([key,label]) => { if (totalsFromSnapshot[key] != null) { const detailSum = normalizedRows.reduce((sum,row)=>sum+num(row[key]),0); if (Math.abs(num(totalsFromSnapshot[key])-detailSum)>1) items.push({ danger:true,title:`${label} không khớp`,count:1,detail:`Tổng đã lưu ${money(totalsFromSnapshot[key])}; tổng chi tiết ${money(detailSum)}.` }); } });
    if (!previousComparison) items.push({ title: 'Chưa đủ dữ liệu so sánh', count: 1, detail: 'Chọn khoảng kỳ có ít nhất hai kỳ với snapshot hợp lệ.' });
    return items;
  }, [selectedRun, hasSnapshot, rawRows, totalsFromSnapshot, normalizedRows, employerAvailable, historyForSelected, declaredCount, previousComparison]);
  const delta = (current, previous) => previous == null || num(previous) === 0 ? null : (num(current)-num(previous))/num(previous)*100;

  const exportExcel = () => {
    const detail = filteredRows.map(row => ({ 'Mã nhân viên': codeOf(row), 'Họ và tên': nameOf(row), 'Phân loại': classOf(row) || '', 'Phòng ban': deptOf(row) || '',
      'Lương cố định': row.fixed == null ? '' : num(row.fixed), 'Tiết dạy & phụ đạo': row.teaching == null ? '' : num(row.teaching), 'Khoản cộng': row.additions == null ? '' : num(row.additions), 'Khoản trừ': row.deductions == null ? '' : num(row.deductions),
      'BHXH NLĐ': row.insurance_employee == null ? '' : num(row.insurance_employee), 'Phí Công đoàn NLĐ': row.union_employee == null ? '' : num(row.union_employee), 'Thuế TNCN': row.personal_income_tax == null ? '' : num(row.personal_income_tax), 'Tổng thu nhập': row.gross_income == null ? '' : num(row.gross_income), 'Thực lĩnh': row.net_pay == null ? '' : num(row.net_pay), 'Trạng thái dữ liệu': row.status || '' }));
    const summary = [{ 'Chỉ tiêu':'Kỳ lương', 'Giá trị': periodName(selectedPeriod) }, { 'Chỉ tiêu':'Phiên bản', 'Giá trị': selectedRun ? `Run #${selectedRun.run_number ?? '—'}` : '' }, { 'Chỉ tiêu':'Trạng thái', 'Giá trị': statusName(selectedRun?.status) }, ...moneyFields.map(([key,label])=>({ 'Chỉ tiêu':label, 'Giá trị': hasSource(key) ? totalFor(key) : 'Chưa đủ dữ liệu' })), { 'Chỉ tiêu':'BHXH đơn vị', 'Giá trị': employerAvailable ? totalFor('employer_insurance') : 'Chưa đủ dữ liệu' }, { 'Chỉ tiêu':'Tổng chi phí nhân sự', 'Giá trị': costAvailable ? totalCost : 'Chưa đủ dữ liệu' }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Tong quan'); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail.length ? detail : [{ 'Thông báo':'Không có nhân sự phù hợp bộ lọc' }]), 'Chi tiet nhan su');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(comparisonData.map(item => ({ 'Kỳ lương':periodName(item.period),'Run':item.run?.run_number ?? '', 'Trạng thái':statusName(item.run?.status),'Số nhân sự':item.employee_count ?? '', 'Tổng thu nhập':item.valid?item.gross_income:'','Thực lĩnh':item.valid?item.net_pay:'','Thuế TNCN':item.valid?item.personal_income_tax:'','Ghi chú':item.reason || (item.draftFallback?'Chưa có bản duyệt; dùng phiên bản mới nhất':'') }))), 'So sanh ky');
    XLSX.writeFile(wb, `Bao-cao-quy-luong-${(periodName(selectedPeriod)||'ky-luong').replace(/[^\wÀ-ỹ-]+/g,'-')}.xlsx`);
  };
  const handlePeriodChange = value => { setPeriodId(value); const opts = orderedRuns(runs.filter(run=>run.payroll_period_id===value)); setRunId(opts.find(run=>['APPROVED','LOCKED'].includes(statusKey(run.status)))?.id || opts[0]?.id || ''); setStatusFilter('ALL'); };
  const handleStatusChange = value => { setStatusFilter(value); const opts = orderedRuns(runs.filter(run=>run.payroll_period_id===periodId && (value==='ALL' || statusKey(run.status)===value || (value==='PENDING'&&statusKey(run.status)==='SUBMITTED')))); setRunId(opts.find(run=>['APPROVED','LOCKED'].includes(statusKey(run.status)))?.id || opts[0]?.id || ''); };
  const toggleSort = key => { if (sortKey===key) setSortDirection(current=>current==='asc'?'desc':'asc'); else { setSortKey(key); setSortDirection('desc'); } };
  const statusOptions = ['DRAFT','PENDING','APPROVED','REJECTED','LOCKED'].filter(key=>runs.some(run=>statusKey(run.status)===key || (key==='PENDING'&&statusKey(run.status)==='SUBMITTED')));
  const runSnapshotTotals = selectedRun ? (totalsFromSnapshot || {}) : {};

  return <main className="sf-page">
    <header className="sf-heading"><div className="sf-heading-icon"><BarChart3 size={23}/></div><div className="sf-heading-copy"><div className="sf-eyebrow">WORKSPACE · PAYROLL</div><h1>Báo cáo quỹ lương</h1><p>Phân tích, so sánh và đối chiếu quỹ lương từ các phiên bản đã lưu trên hệ thống.</p></div><button className="sf-button" onClick={()=>load(true)} disabled={refreshing}><RefreshCw size={15} className={refreshing?'sf-spin':''}/> Làm mới</button></header>
    <section className="sf-filters">
      <label>Kỳ lương<select value={periodId} onChange={e=>handlePeriodChange(e.target.value)} disabled={loading}><option value="">-- Chọn kỳ lương --</option>{periods.map(p=><option key={p.id} value={p.id}>{periodName(p)}</option>)}</select></label>
      <label>Phiên bản lương<select value={runId} onChange={e=>setRunId(e.target.value)} disabled={!periodRuns.length}><option value="">-- Chọn phiên bản --</option>{filteredRunOptions.map(run=><option key={run.id} value={run.id}>Run #{run.run_number??'—'} · {statusName(run.status)} · {dateTime(run.calculated_at||run.created_at)}</option>)}</select></label>
      <label>Trạng thái duyệt<select value={statusFilter} onChange={e=>handleStatusChange(e.target.value)}><option value="ALL">Tất cả trạng thái</option>{statusOptions.map(s=><option key={s} value={s}>{statusName(s)}</option>)}</select></label>
      <label>Phân loại nhân sự<select value={classificationFilter} onChange={e=>setClassificationFilter(e.target.value)}><option value="ALL">Tất cả phân loại</option>{classificationOptions.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
      <label>Phòng ban<select value={departmentFilter} onChange={e=>setDepartmentFilter(e.target.value)}><option value="ALL">Tất cả phòng ban</option>{departmentOptions.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
    </section>
    <section className="sf-range"><div className="sf-range-title"><CalendarRange size={17}/><div><strong>Khoảng kỳ so sánh</strong><small>Mỗi kỳ chỉ dùng một phiên bản; ưu tiên bản Đã duyệt/Đã khóa, nếu chưa có sẽ cảnh báo khi dùng bản mới nhất.</small></div></div><label>Từ kỳ<select value={fromPeriodId} onChange={e=>setFromPeriodId(e.target.value)}><option value="">-- Chọn kỳ bắt đầu --</option>{periods.map(p=><option key={p.id} value={p.id}>{periodName(p)}</option>)}</select></label><label>Đến kỳ<select value={toPeriodId} onChange={e=>setToPeriodId(e.target.value)}><option value="">-- Chọn kỳ kết thúc --</option>{periods.map(p=><option key={p.id} value={p.id}>{periodName(p)}</option>)}</select></label></section>
    {error&&<div className="sf-alert sf-alert-danger"><AlertTriangle size={18}/><div><strong>Không tải được báo cáo</strong><p>{error}</p><button className="sf-link-button" onClick={()=>load(true)}>Thử tải lại</button></div></div>}
    {warnings.map((warning,i)=><div className="sf-alert" key={i}><AlertTriangle size={17}/><p>{warning}</p></div>)}
    {loading?<div className="sf-state"><RefreshCw size={24} className="sf-spin"/><strong>Đang tải dữ liệu quỹ lương từ Supabase…</strong></div>:!selectedRun?<div className="sf-state"><FileCheck2 size={28}/><strong>Chưa có phiên bản lương phù hợp</strong><p>Chọn kỳ có phiên bản được lưu trong payroll_runs. Báo cáo không tạo số liệu thay thế.</p></div>:!hasSnapshot||(!rawRows.length&&!totalsFromSnapshot)?<div className="sf-state"><AlertTriangle size={27}/><strong>Phiên bản chưa có snapshot hợp lệ</strong><p>Run #{selectedRun.run_number??'—'} · {statusName(selectedRun.status)}. Cần kiểm tra input_snapshot trước khi sử dụng báo cáo.</p></div>:<>
      <section className="sf-run-meta"><div><span>MÃ KỲ LƯƠNG</span><strong>{selectedPeriod?.period_code||selectedPeriod?.code||selectedPeriod?.id||'—'}</strong></div><div><span>PHIÊN BẢN</span><strong>Run #{selectedRun.run_number??'—'}</strong></div><div><span>TRẠNG THÁI</span><strong><em className={`sf-status ${statusTone(selectedRun.status)}`}>{statusName(selectedRun.status)}</em></strong></div><div><span>THỜI ĐIỂM TÍNH</span><strong>{dateTime(selectedRun.calculated_at||selectedRun.created_at)}</strong></div><div><span>NHÂN SỰ SNAPSHOT</span><strong>{num(totalsFromSnapshot?.employee_count??declaredCount??normalizedRows.length).toLocaleString('vi-VN')}</strong></div></section>
      {!['APPROVED','LOCKED'].includes(statusKey(selectedRun.status))&&<div className="sf-alert"><AlertTriangle size={17}/><p>Phiên bản đang chọn ở trạng thái <strong>{statusName(selectedRun.status)}</strong>, chưa phải bản đã duyệt/khóa. Hãy xác nhận trạng thái trước khi dùng làm báo cáo chính thức.</p></div>}
      <section className="sf-section"><div className="sf-section-title"><div><h2>Chỉ số quỹ lương</h2><p>Giá trị lấy từ snapshot phiên bản đang chọn; dữ liệu thiếu được đánh dấu thay vì tự giả định bằng 0.</p></div><span className="sf-updated">Cập nhật: {dateTime(updatedAt)}</span></div><div className="sf-metrics">
        <Metric title="Nhân sự" value={num(totalsFromSnapshot?.employee_count??declaredCount??normalizedRows.length).toLocaleString('vi-VN')} subtitle="Theo snapshot" icon={Users}/>
        <Metric title="Lương cố định" value={valueFor('fixed')} subtitle="Đã lưu" icon={Wallet}/><Metric title="Tiết dạy & phụ đạo" value={valueFor('teaching')} subtitle="Đã lưu" icon={BarChart3}/><Metric title="Khoản cộng" value={valueFor('additions')} subtitle="Đã lưu" icon={CheckCircle2}/><Metric title="Tổng thu nhập" value={valueFor('gross_income')} subtitle="Không bao gồm chi phí đơn vị" icon={Wallet} primary/>
        <Metric title="Khoản trừ" value={valueFor('deductions')} subtitle="Khoản trừ riêng" icon={ShieldCheck}/><Metric title="BHXH NLĐ" value={valueFor('insurance_employee')} subtitle="Phần người lao động đóng" icon={ShieldCheck}/><Metric title="Phí Công đoàn" value={valueFor('union_employee')} subtitle="Phần người lao động đóng" icon={Users}/><Metric title="Thuế TNCN" value={valueFor('personal_income_tax')} subtitle="Đã lưu" icon={ShieldCheck}/><Metric title="Thực lĩnh" value={valueFor('net_pay')} subtitle="Đã lưu" icon={Wallet} primary/>
        <Metric title="BHXH đơn vị" value={employerAvailable?money(totalFor('employer_insurance')):'Chưa đủ dữ liệu'} subtitle="Phần đơn vị đóng" icon={Building2}/><Metric title="Chi phí nhân sự" value={costAvailable?money(totalCost):'Chưa đủ dữ liệu'} subtitle="Tổng thu nhập + BHXH đơn vị; chỉ khi đủ dữ liệu" icon={Wallet}/>
      </div></section>
      <section className="sf-chart-grid"><article className="sf-card"><div className="sf-card-title"><div><h2>Cơ cấu thu nhập</h2><p>Thành phần đã lưu trong snapshot.</p></div></div><Bars items={incomes.map(i=>({...i,share:hasSource('gross_income')&&totalFor('gross_income')>0&&i.value!=null?i.value/totalFor('gross_income')*100:null}))}/></article><article className="sf-card"><div className="sf-card-title"><div><h2>Cơ cấu khấu trừ NLĐ</h2><p>Không bao gồm khoản do đơn vị đóng.</p></div></div><Bars items={deductions.map(i=>({...i,share:null}))}/></article><article className="sf-card sf-wide"><div className="sf-card-title"><div><h2>So sánh quỹ lương theo kỳ</h2><p>Mỗi kỳ chỉ dùng một phiên bản, ưu tiên bản đã duyệt/khóa.</p></div></div>{comparisonData.filter(i=>i.valid).length<2?<div className="sf-empty-inline">Chưa đủ ít nhất hai kỳ có snapshot hợp lệ để so sánh.</div>:<div className="sf-table-scroll"><table className="sf-table sf-compare"><thead><tr><th>Kỳ lương</th><th>Phiên bản</th><th>Trạng thái</th><th>Nhân sự</th><th>Lương cố định</th><th>Tiết dạy</th><th>Khoản cộng</th><th>Tổng thu nhập</th><th>Khoản trừ</th><th>Thuế TNCN</th><th>Thực lĩnh</th></tr></thead><tbody>{comparisonData.map(item=>item.valid?<tr key={item.run.id}><td>{periodName(item.period)}</td><td>#{item.run.run_number??'—'}</td><td><span className={`sf-status ${statusTone(item.run.status)}`}>{statusName(item.run.status)}</span>{item.draftFallback&&<small className="sf-fallback-note">Chưa có bản duyệt</small>}</td><td>{num(item.employee_count).toLocaleString('vi-VN')}</td>{['fixed','teaching','additions','gross_income','deductions','personal_income_tax','net_pay'].map(key=><td key={key}>{money(item[key])}</td>)}</tr>:<tr key={item.period.id}><td>{periodName(item.period)}</td><td colSpan="10" className="sf-muted">{item.reason}</td></tr>)}</tbody></table></div>}{latestComparison&&previousComparison&&<div className="sf-delta-grid">{[['Tổng thu nhập','gross_income'],['Thực lĩnh','net_pay'],['Thuế TNCN','personal_income_tax']].map(([label,key])=>{const change=delta(latestComparison[key],previousComparison[key]);return <div key={key}><small>{label} · {periodName(latestComparison.period)} so với {periodName(previousComparison.period)}</small><strong>{money(latestComparison[key]-previousComparison[key])}</strong><span>{change==null?'Không đủ cơ sở so sánh':`${change>0?'+':''}${change.toLocaleString('vi-VN',{maximumFractionDigits:1})}%`}</span></div>;})}<div><small>Thay đổi số nhân sự</small><strong>{num(latestComparison.employee_count)-num(previousComparison.employee_count)}</strong><span>{periodName(previousComparison.period)} → {periodName(latestComparison.period)}</span></div></div>}</article>
      <article className="sf-card"><div className="sf-card-title"><div><h2>Theo phân loại nhân sự</h2><p>Số lượng, thành phần thu nhập và thực lĩnh.</p></div></div>{classificationData.length?<div className="sf-table-scroll"><table className="sf-table"><thead><tr><th>Phân loại</th><th>Nhân sự</th><th>Tổng thu nhập</th><th>Thực lĩnh</th><th>Bình quân</th></tr></thead><tbody>{classificationData.map(item=><tr key={item.label}><td>{item.label}</td><td>{item.count}</td><td>{money(item.gross_income)}</td><td>{money(item.net_pay)}</td><td>{money(item.count?item.gross_income/item.count:0)}</td></tr>)}</tbody></table></div>:<div className="sf-empty-inline">Snapshot chưa có phân loại nhân sự.</div>}</article>
      <article className="sf-card"><div className="sf-card-title"><div><h2>Theo phòng ban</h2><p>Chỉ nhóm các phòng ban có trong dữ liệu thực tế.</p></div></div>{departmentData.length?<div className="sf-table-scroll"><table className="sf-table"><thead><tr><th>Phòng ban</th><th>Nhân sự</th><th>Tổng thu nhập</th><th>Thực lĩnh</th><th>Bình quân</th></tr></thead><tbody>{departmentData.map(item=><tr key={item.label}><td>{item.label}</td><td>{item.count}</td><td>{money(item.gross_income)}</td><td>{money(item.net_pay)}</td><td>{money(item.count?item.gross_income/item.count:0)}</td></tr>)}</tbody></table></div>:<div className="sf-empty-inline">Không có thông tin phòng ban để phân tích.</div>}</article></section>
      <section className="sf-card sf-detail"><div className="sf-card-title"><div><h2>Chi tiết nhân sự và biến động</h2><p>Chênh lệch được tính số học so với kỳ hợp lệ gần nhất trước đó; không tự suy đoán nguyên nhân.</p></div><button className="sf-button sf-button-primary" onClick={exportExcel}><Download size={15}/> Xuất Excel</button></div><div className="sf-table-filters"><label className="sf-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm mã nhân viên, họ tên, phòng ban..."/></label><label>Sắp xếp<select value={sortKey} onChange={e=>{setSortKey(e.target.value);setSortDirection('desc');}}><option value="gross_income">Tổng thu nhập</option><option value="net_pay">Thực lĩnh</option><option value="fixed">Lương cố định</option><option value="teaching">Tiết dạy</option><option value="additions">Khoản cộng</option><option value="deductions">Khoản trừ</option></select></label><button className="sf-button" onClick={()=>toggleSort(sortKey)}>{sortDirection==='desc'?'Giảm dần':'Tăng dần'}</button></div><div className="sf-table-scroll sf-detail-scroll"><table className="sf-table sf-employee-table"><thead><tr><th>Mã nhân viên</th><th>Họ và tên</th><th>Phân loại</th><th>Phòng ban</th><th>Lương cố định</th><th>Tiết dạy</th><th>Khoản cộng</th><th>Khoản trừ</th><th>BHXH NLĐ</th><th>Phí Công đoàn</th><th>Thuế TNCN</th><th>Tổng thu nhập</th><th>Thực lĩnh</th><th>Chênh lệch thu nhập</th><th>Trạng thái dữ liệu</th></tr></thead><tbody>{visibleRows.map(row=>{const prev=previousComparison?.valid?rowList(previousComparison.run.input_snapshot).find(p=>(clean(p.employee_id)&&clean(p.employee_id)===clean(row.employee_id))||(codeOf(p)&&codeOf(p)===codeOf(row))):null;const change=prev&&row.gross_income!=null&&prev.gross_income!=null?num(row.gross_income)-num(prev.gross_income):null;return <tr key={row.employee_id||codeOf(row)}><td>{codeOf(row)||'—'}</td><td>{nameOf(row)||'—'}</td><td>{classOf(row)||'—'}</td><td>{deptOf(row)||'—'}</td>{['fixed','teaching','additions','deductions','insurance_employee','union_employee','personal_income_tax','gross_income','net_pay'].map(key=><td key={key}>{row[key]==null||row[key]===''?'—':money(row[key])}</td>)}<td>{change==null?'Không đủ dữ liệu':money(change)}</td><td><span className={`sf-row-status ${row.status?'ok':'warn'}`}>{row.status||'Chưa có trạng thái'}</span></td></tr>;})}</tbody><tfoot><tr><th colSpan="4">TỔNG CỘNG · {filteredRows.length} nhân sự lọc</th>{['fixed','teaching','additions','deductions','insurance_employee','union_employee','personal_income_tax','gross_income','net_pay'].map(key=><th key={key}>{filteredRows.some(r=>r[key]!=null&&r[key]!=='')?money(filteredRows.reduce((sum,r)=>sum+num(r[key]),0)):'—'}</th>)}<th>—</th><th>—</th></tr></tfoot></table></div><div className="sf-pagination"><span>Hiển thị {filteredRows.length?((pageNo-1)*pageSize+1):0}–{Math.min(pageNo*pageSize,filteredRows.length)} / {filteredRows.length} nhân sự</span><div><button className="sf-button" disabled={pageNo<=1} onClick={()=>setPageNo(p=>p-1)}>Trước</button><span>Trang {pageNo} / {Math.max(1,Math.ceil(filteredRows.length/pageSize))}</span><button className="sf-button" disabled={pageNo>=Math.ceil(filteredRows.length/pageSize)} onClick={()=>setPageNo(p=>p+1)}>Sau</button></div></div></section>
      <section className="sf-card sf-reconcile"><div className="sf-card-title"><div><h2>Kiểm soát và đối chiếu</h2><p>Đối chiếu snapshot đã lưu; không cập nhật dữ liệu nguồn.</p></div><ShieldCheck size={20}/></div><div className="sf-reconcile-grid"><div><small>Số dòng snapshot</small><strong>{rawRows.length.toLocaleString('vi-VN')}</strong></div><div><small>Số nhân sự khai báo</small><strong>{declaredCount==null?'Chưa có':num(declaredCount).toLocaleString('vi-VN')}</strong></div><div><small>Tổng thu nhập theo dòng</small><strong>{money(sums.gross_income)}</strong></div><div><small>Tổng thực lĩnh theo dòng</small><strong>{money(sums.net_pay)}</strong></div><div><small>Tổng thu nhập lưu trong snapshot</small><strong>{totalsFromSnapshot?.gross_income==null?'Chưa có':money(totalsFromSnapshot.gross_income)}</strong></div><div><small>Thực lĩnh lưu trong snapshot</small><strong>{totalsFromSnapshot?.net_pay==null?'Chưa có':money(totalsFromSnapshot.net_pay)}</strong></div></div><div className="sf-alert-list">{alerts.length?alerts.map((item,i)=><div className={`sf-alert-item${item.danger?' danger':''}`} key={`${item.title}-${i}`}><strong className="sf-alert-count">{item.count}</strong><div><b>{item.title}</b><p>{item.detail}</p></div></div>):<div className="sf-success"><CheckCircle2 size={17}/> Không phát hiện cảnh báo theo các trường dữ liệu hiện có.</div>}</div></section>
      <div className="sf-footnote"><Clock3 size={15}/> Báo cáo chỉ đọc dữ liệu. Thời điểm tải gần nhất: {dateTime(updatedAt)}. Các số liệu chưa có nguồn được đánh dấu riêng và không tự động chuyển thành giá trị 0.</div>
    </>}
  </main>;
}
