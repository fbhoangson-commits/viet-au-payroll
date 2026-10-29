import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle, BarChart3, Building2, CalendarClock, CheckCircle2, Clock3,
  Download, FileCheck2, RefreshCw, Search, ShieldCheck, Users, Wallet,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../shared/supabase.js';
import './reports-dashboard.css';

const clean = value => String(value ?? '').trim();
const norm = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi');
const num = value => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const money = value => `${num(value).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ₫`;
const dateTime = value => value ? new Date(value).toLocaleString('vi-VN') : '—';
const periodName = period => clean(period?.name || period?.period_code || period?.code || `Kỳ ${period?.period_year || ''}-${String(period?.period_month || '').padStart(2, '0')}`);
const statusKey = value => clean(value).toUpperCase();
const statusName = value => ({ DRAFT: 'Bản nháp', PENDING: 'Chờ duyệt', SUBMITTED: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', LOCKED: 'Đã khóa', CANCELLED: 'Đã hủy' }[statusKey(value)] || clean(value) || 'Chưa xác định');
const statusTone = value => ({ DRAFT: 'draft', PENDING: 'pending', SUBMITTED: 'pending', APPROVED: 'approved', LOCKED: 'approved', REJECTED: 'rejected', CANCELLED: 'muted' }[statusKey(value)] || 'muted');
const errorText = error => error?.message || error?.details || String(error || 'Lỗi không xác định');
const snapshotRows = snapshot => {
  if (Array.isArray(snapshot)) return snapshot;
  if (!snapshot || typeof snapshot !== 'object') return [];
  if (Array.isArray(snapshot.results)) return snapshot.results;
  for (const key of ['rows', 'employees', 'payroll_results', 'employee_results', 'details']) if (Array.isArray(snapshot[key])) return snapshot[key];
  return [];
};
const snapshotTotals = snapshot => snapshot && typeof snapshot === 'object' && snapshot.totals && typeof snapshot.totals === 'object' ? snapshot.totals : null;
const fields = [
  ['fixed', 'Lương cố định'], ['teaching', 'Tiền tiết dạy'], ['additions', 'Khoản cộng'], ['deductions', 'Khoản trừ'],
  ['insurance_employee', 'BHXH NLĐ'], ['union_employee', 'Phí Công đoàn NLĐ'], ['personal_income_tax', 'Thuế TNCN'],
  ['gross_income', 'Tổng thu nhập'], ['net_pay', 'Thực lĩnh'],
];
const readEmployeeCode = row => clean(row?.employee_code || row?.employee_code_snapshot || row?.code);
const readEmployeeName = row => clean(row?.employee_name || row?.employee_name_snapshot || row?.full_name || row?.name || 'Chưa có tên');
const readDepartment = row => clean(row?.department || row?.department_snapshot);
const readClassification = row => clean(row?.classification || row?.employee_type || row?.employee_classification);

async function fetchAll(table, select = '*', orderColumn = 'created_at') {
  const all = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase.from(table).select(select).range(offset, offset + pageSize - 1);
    if (orderColumn) query = query.order(orderColumn, { ascending: false, nullsFirst: false });
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${errorText(error)}`);
    const batch = data || [];
    all.push(...batch);
    if (batch.length < pageSize) return all;
  }
}

function Metric({ title, value, subtitle, icon: Icon, tone = '' }) {
  return <article className={`rd-metric ${tone}`}><div className="rd-metric-top"><span>{title}</span><span className="rd-metric-icon"><Icon size={18} /></span></div><strong>{value}</strong>{subtitle && <small>{subtitle}</small>}</article>;
}
function BarRows({ items, valueKey, labelKey = 'label', format = money, empty = 'Chưa có đủ dữ liệu để hiển thị.' }) {
  const max = Math.max(0, ...items.map(item => num(item[valueKey])));
  if (!items.length || max <= 0) return <div className="rd-empty-inline">{empty}</div>;
  return <div className="rd-bars">{items.map((item, index) => <div className="rd-bar-row" key={`${item[labelKey]}-${index}`}><div className="rd-bar-label"><span>{item[labelKey]}</span><strong>{format(item[valueKey])}</strong></div><div className="rd-bar-track"><span style={{ width: `${Math.max(1, num(item[valueKey]) / max * 100)}%` }} /></div></div>)}</div>;
}

export default function Page() {
  const [periods, setPeriods] = useState([]);
  const [runs, setRuns] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [periodId, setPeriodId] = useState('');
  const [runId, setRunId] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [classificationFilter, setClassificationFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [rowStatusFilter, setRowStatusFilter] = useState('ALL');
  const [pageNo, setPageNo] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [updatedAt, setUpdatedAt] = useState('');
  const pageSize = 25;

  const load = useCallback(async (keepSelection = true) => {
    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase chưa được cấu hình. Dashboard không thể hiển thị dữ liệu thực.');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setRefreshing(true); setError(''); setWarnings([]);
    const nextWarnings = [];
    try {
      const [periodData, runData, approvalResult, employeeResult] = await Promise.all([
        fetchAll('payroll_periods', '*', 'created_at'),
        fetchAll('payroll_runs', '*', 'created_at'),
        fetchAll('payroll_approvals', '*', 'created_at').catch(error => { nextWarnings.push(`Không đọc được lịch sử duyệt: ${errorText(error)}`); return []; }),
        fetchAll('employees', '*', 'created_at').catch(error => { nextWarnings.push(`Không đọc được Employee Master để bổ sung thông tin còn thiếu: ${errorText(error)}`); return []; }),
      ]);
      setPeriods(periodData || []);
      setRuns(runData || []);
      setApprovals(approvalResult || []);
      setEmployees(employeeResult || []);
      setUpdatedAt(new Date().toISOString());
      const validPeriods = periodData || [];
      const validRuns = runData || [];
      if (keepSelection && periodId && validPeriods.some(period => period.id === periodId)) {
        const periodRuns = validRuns.filter(run => run.payroll_period_id === periodId).sort((a, b) => (num(b.run_number) - num(a.run_number)) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
        setRunId(current => periodRuns.some(run => run.id === current) ? current : (periodRuns[0]?.id || ''));
      } else {
        const newestRun = [...validRuns].sort((a, b) => String(b.created_at || b.calculated_at || '').localeCompare(String(a.created_at || a.calculated_at || '')))[0];
        setPeriodId(newestRun?.payroll_period_id || validPeriods[0]?.id || '');
        setRunId(newestRun?.id || '');
      }
      setWarnings(nextWarnings);
    } catch (e) {
      setError(errorText(e));
      setWarnings(nextWarnings);
      // Do not keep presenting stale data as a fresh result after a failed refresh.
      setPeriods([]); setRuns([]); setApprovals([]); setEmployees([]); setRunId('');
    } finally { setLoading(false); setRefreshing(false); }
  }, [periodId]);

  useEffect(() => { load(false); }, []); // initial load only; explicit refresh uses the current selection

  const periodRuns = useMemo(() => runs.filter(run => run.payroll_period_id === periodId).sort((a, b) => (num(b.run_number) - num(a.run_number)) || String(b.created_at || '').localeCompare(String(a.created_at || ''))), [runs, periodId]);
  const filteredRunOptions = useMemo(() => periodRuns.filter(run => statusFilter === 'ALL' || statusKey(run.status) === statusFilter || (statusFilter === 'PENDING' && statusKey(run.status) === 'SUBMITTED')), [periodRuns, statusFilter]);
  const selectedRun = runs.find(run => run.id === runId) || null;
  const selectedPeriod = periods.find(period => period.id === selectedRun?.payroll_period_id) || periods.find(period => period.id === periodId) || null;
  const rawRows = useMemo(() => snapshotRows(selectedRun?.input_snapshot), [selectedRun]);
  const totalsFromSnapshot = useMemo(() => snapshotTotals(selectedRun?.input_snapshot), [selectedRun]);
  const employeeById = useMemo(() => new Map(employees.map(employee => [clean(employee.id), employee])), [employees]);
  const normalizedRows = useMemo(() => rawRows.map(row => {
    const master = employeeById.get(clean(row?.employee_id)) || {};
    return {
      ...row,
      employee_code: readEmployeeCode(row) || readEmployeeCode(master),
      employee_name: readEmployeeName(row) !== 'Chưa có tên' ? readEmployeeName(row) : readEmployeeName(master),
      classification: readClassification(row) || readClassification(master),
      department: readDepartment(row) || readDepartment(master),
      _status: clean(row?.status),
    };
  }).sort((a, b) => readEmployeeCode(a).localeCompare(readEmployeeCode(b), 'vi', { numeric: true })), [rawRows, employeeById]);
  const departmentOptions = useMemo(() => [...new Set(normalizedRows.map(readDepartment).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')), [normalizedRows]);
  const classificationOptions = useMemo(() => [...new Set(normalizedRows.map(readClassification).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')), [normalizedRows]);
  const filteredRows = useMemo(() => {
    const query = norm(search);
    return normalizedRows.filter(row => {
      const identity = norm([readEmployeeCode(row), readEmployeeName(row), readDepartment(row), readClassification(row)].join(' '));
      const rowStatus = norm(row._status);
      return (!query || identity.includes(query))
        && (classificationFilter === 'ALL' || readClassification(row) === classificationFilter)
        && (departmentFilter === 'ALL' || readDepartment(row) === departmentFilter)
        && (rowStatusFilter === 'ALL' || (rowStatusFilter === 'ISSUES' ? Boolean(row._status && !['đủ dữ liệu nguồn', 'đã ghi nhận tiết dạy'].some(s => norm(row._status).includes(norm(s)))) : rowStatus.includes(norm(rowStatusFilter))));
    });
  }, [normalizedRows, search, classificationFilter, departmentFilter, rowStatusFilter]);
  useEffect(() => { setPageNo(1); }, [periodId, runId, classificationFilter, departmentFilter, rowStatusFilter, search]);
  useEffect(() => {
    if (filteredRunOptions.length && !filteredRunOptions.some(run => run.id === runId)) setRunId(filteredRunOptions[0].id);
    else if (!filteredRunOptions.length && runId) setRunId('');
  }, [filteredRunOptions, runId]);
  const visibleRows = filteredRows.slice((pageNo - 1) * pageSize, pageNo * pageSize);

  const sums = useMemo(() => {
    const result = { employee_count: normalizedRows.length };
    fields.forEach(([key]) => { result[key] = normalizedRows.reduce((sum, row) => sum + num(row[key]), 0); });
    result.employer_insurance = normalizedRows.reduce((sum, row) => sum + num(row.employer_insurance), 0);
    return result;
  }, [normalizedRows]);
  const getTotal = key => totalsFromSnapshot && totalsFromSnapshot[key] !== undefined && totalsFromSnapshot[key] !== null ? num(totalsFromSnapshot[key]) : (key === 'employee_count' ? normalizedRows.length : sums[key]);
  const hasMetricSource = key => (totalsFromSnapshot && totalsFromSnapshot[key] !== undefined && totalsFromSnapshot[key] !== null) || normalizedRows.some(row => row[key] !== undefined && row[key] !== null && row[key] !== '');
  const metricValue = key => hasMetricSource(key) ? money(getTotal(key)) : 'Chưa có dữ liệu';
  const hasSnapshot = Boolean(selectedRun && selectedRun.input_snapshot && typeof selectedRun.input_snapshot === 'object');
  const snapshotCount = selectedRun?.snapshot_rows ?? totalsFromSnapshot?.employee_count ?? rawRows.length;
  const allStatusCounts = useMemo(() => {
    const counts = { DRAFT: 0, PENDING: 0, APPROVED: 0, REJECTED: 0, LOCKED: 0 };
    runs.forEach(run => {
      const key = statusKey(run.status);
      if (key === 'SUBMITTED' || key === 'PENDING') counts.PENDING += 1;
      else if (Object.prototype.hasOwnProperty.call(counts, key)) counts[key] += 1;
    });
    return counts;
  }, [runs]);
  const selectedHistory = useMemo(() => approvals.filter(item => item.payroll_run_id === selectedRun?.id || (!item.payroll_run_id && item.payroll_period_id === selectedRun?.payroll_period_id)).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))), [approvals, selectedRun]);
  const latestHistory = selectedHistory[0];
  const pendingRuns = useMemo(() => runs.filter(run => ['PENDING', 'SUBMITTED'].includes(statusKey(run.status))).sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || ''))), [runs]);
  const statusFilteredRuns = runs.filter(run => statusFilter === 'ALL' || statusKey(run.status) === statusFilter || (statusFilter === 'PENDING' && statusKey(run.status) === 'SUBMITTED'));

  const incomeBreakdown = useMemo(() => [
    { label: 'Lương cố định', value: hasMetricSource('fixed') ? getTotal('fixed') : null },
    { label: 'Tiết dạy & phụ đạo', value: hasMetricSource('teaching') ? getTotal('teaching') : null },
    { label: 'Khoản cộng', value: hasMetricSource('additions') ? getTotal('additions') : null },
  ], [selectedRun, normalizedRows]);
  const deductionBreakdown = useMemo(() => [
    { label: 'Khoản trừ', value: hasMetricSource('deductions') ? getTotal('deductions') : null },
    { label: 'BHXH người lao động', value: hasMetricSource('insurance_employee') ? getTotal('insurance_employee') : null },
    { label: 'Phí Công đoàn', value: hasMetricSource('union_employee') ? getTotal('union_employee') : null },
    { label: 'Thuế TNCN', value: hasMetricSource('personal_income_tax') ? getTotal('personal_income_tax') : null },
  ], [selectedRun, normalizedRows]);
  const classificationData = useMemo(() => {
    const map = new Map();
    normalizedRows.forEach(row => {
      const label = readClassification(row) || 'Chưa phân loại';
      const current = map.get(label) || { label, count: 0, gross_income: 0, net_pay: 0 };
      current.count += 1; current.gross_income += num(row.gross_income); current.net_pay += num(row.net_pay); map.set(label, current);
    });
    return [...map.values()].sort((a, b) => b.gross_income - a.gross_income);
  }, [normalizedRows]);
  const departmentData = useMemo(() => {
    const map = new Map();
    normalizedRows.forEach(row => {
      const label = readDepartment(row);
      if (!label) return;
      const current = map.get(label) || { label, count: 0, gross_income: 0, net_pay: 0 };
      current.count += 1; current.gross_income += num(row.gross_income); current.net_pay += num(row.net_pay); map.set(label, current);
    });
    return [...map.values()].sort((a, b) => b.gross_income - a.gross_income);
  }, [normalizedRows]);
  const comparisonData = useMemo(() => {
    const latestByPeriod = new Map();
    runs.forEach(run => {
      const key = run.payroll_period_id;
      const current = latestByPeriod.get(key);
      if (!current || num(run.run_number) > num(current.run_number) || (num(run.run_number) === num(current.run_number) && String(run.created_at || '').localeCompare(String(current.created_at || '')) > 0)) latestByPeriod.set(key, run);
    });
    return [...latestByPeriod.values()].map(run => {
      const period = periods.find(item => item.id === run.payroll_period_id);
      const snapshot = run.input_snapshot;
      const totals = snapshotTotals(snapshot);
      const rows = snapshotRows(snapshot);
      const totalFor = key => totals && totals[key] != null ? num(totals[key]) : rows.reduce((sum, row) => sum + num(row[key]), 0);
      return { label: periodName(period), run, employee_count: totals?.employee_count ?? run.snapshot_rows ?? rows.length, gross_income: totalFor('gross_income'), net_pay: totalFor('net_pay'), personal_income_tax: totalFor('personal_income_tax') };
    }).filter(item => item.run.input_snapshot && (snapshotRows(item.run.input_snapshot).length || snapshotTotals(item.run.input_snapshot))).sort((a, b) => String(a.run.calculated_at || a.run.created_at || '').localeCompare(String(b.run.calculated_at || b.run.created_at || ''))).slice(-6);
  }, [runs, periods]);
  const alerts = useMemo(() => {
    const items = [];
    if (!selectedRun) return items;
    const missingStatus = normalizedRows.filter(row => !clean(row.status));
    const issueRows = normalizedRows.filter(row => clean(row.status) && !['đủ dữ liệu nguồn', 'đã ghi nhận tiết dạy'].some(value => norm(row.status).includes(norm(value))));
    const missingIdentity = normalizedRows.filter(row => !readEmployeeCode(row) || !readEmployeeName(row) || readEmployeeName(row) === 'Chưa có tên');
    if (missingStatus.length) items.push({ tone: 'warning', title: 'Thiếu trạng thái dữ liệu nhân sự', count: missingStatus.length, detail: 'Một số dòng snapshot không có trường status; cần kiểm tra dữ liệu nguồn.' });
    if (issueRows.length) items.push({ tone: 'warning', title: 'Nhân sự có cảnh báo dữ liệu', count: issueRows.length, detail: 'Nội dung cảnh báo được lấy từ trường status đã lưu trong snapshot.' });
    if (missingIdentity.length) items.push({ tone: 'warning', title: 'Thiếu thông tin nhận diện', count: missingIdentity.length, detail: 'Thiếu mã nhân viên hoặc họ tên trong snapshot và Employee Master.' });
    if (statusKey(selectedRun.status) === 'REJECTED') items.push({ tone: 'danger', title: 'Phiên bản lương bị từ chối', count: 1, detail: latestHistory?.note || 'Kiểm tra lý do từ chối trong lịch sử duyệt.' });
    if (['DRAFT', 'SUBMITTED', 'PENDING'].includes(statusKey(selectedRun.status))) items.push({ tone: 'warning', title: 'Phiên bản chưa được duyệt', count: 1, detail: `Trạng thái hiện tại: ${statusName(selectedRun.status)}.` });
    if (hasSnapshot && snapshotCount != null && Number(snapshotCount) !== normalizedRows.length) items.push({ tone: 'danger', title: 'Số dòng snapshot cần đối chiếu', count: Math.abs(Number(snapshotCount) - normalizedRows.length), detail: `Bản lưu khai báo ${snapshotCount} nhân sự, đọc được ${normalizedRows.length} dòng chi tiết.` });
    if (totalsFromSnapshot && normalizedRows.length) {
      [['gross_income', 'Tổng thu nhập'], ['net_pay', 'Thực lĩnh']].forEach(([key, label]) => {
        if (totalsFromSnapshot[key] != null && Math.abs(num(totalsFromSnapshot[key]) - sums[key]) > 1) items.push({ tone: 'danger', title: `${label} lệch so với tổng dòng`, count: 1, detail: `Tổng snapshot: ${money(totalsFromSnapshot[key])}; tổng chi tiết: ${money(sums[key])}.` });
      });
    }
    return items;
  }, [selectedRun, normalizedRows, latestHistory, hasSnapshot, snapshotCount, totalsFromSnapshot, sums]);

  const exportExcel = () => {
    const data = filteredRows.map(row => ({
      'Mã nhân viên': readEmployeeCode(row), 'Họ và tên': readEmployeeName(row), 'Phân loại': readClassification(row) || 'Chưa phân loại', 'Phòng ban': readDepartment(row) || '—',
      'Lương cố định': row.fixed == null ? '' : num(row.fixed), 'Tiền tiết dạy': row.teaching == null ? '' : num(row.teaching), 'Khoản cộng': row.additions == null ? '' : num(row.additions), 'Khoản trừ': row.deductions == null ? '' : num(row.deductions),
      'BHXH NLĐ': row.insurance_employee == null ? '' : num(row.insurance_employee), 'Phí Công đoàn NLĐ': row.union_employee == null ? '' : num(row.union_employee), 'Thuế TNCN': row.personal_income_tax == null ? '' : num(row.personal_income_tax),
      'Tổng thu nhập': row.gross_income == null ? '' : num(row.gross_income), 'Thực lĩnh': row.net_pay == null ? '' : num(row.net_pay), 'Trạng thái dữ liệu': clean(row.status) || '—',
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.length ? data : [{ 'Thông báo': 'Không có dữ liệu phù hợp bộ lọc' }]), 'Dashboard');
    XLSX.writeFile(workbook, `Bao-cao-Dashboard-${(periodName(selectedPeriod) || 'ky-luong').replace(/[^\wÀ-ỹ-]+/g, '-')}.xlsx`);
  };

  const handlePeriodChange = value => {
    setPeriodId(value);
    const nextRuns = runs.filter(run => run.payroll_period_id === value).sort((a, b) => (num(b.run_number) - num(a.run_number)) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
    setRunId(nextRuns[0]?.id || '');
    setStatusFilter('ALL');
  };
  const handleStatusChange = value => {
    setStatusFilter(value);
    const options = periodRuns.filter(run => value === 'ALL' || statusKey(run.status) === value || (value === 'PENDING' && statusKey(run.status) === 'SUBMITTED'));
    setRunId(options[0]?.id || '');
  };

  return <main className="rd-page">
    <header className="rd-heading"><div className="rd-heading-icon"><BarChart3 size={23} /></div><div><div className="rd-eyebrow">DUYỆT LƯƠNG · BÁO CÁO</div><h1>Báo cáo Dashboard</h1><p>Tổng quan quỹ lương, dữ liệu nhân sự và tiến độ duyệt từ các phiên bản lương đã lưu.</p></div><button className="rd-button" onClick={() => load(true)} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'rd-spin' : ''} /> Làm mới</button></header>

    <section className="rd-filters">
      <label>Kỳ lương<select value={periodId} onChange={event => handlePeriodChange(event.target.value)} disabled={loading}><option value="">-- Chọn kỳ lương --</option>{periods.map(period => <option key={period.id} value={period.id}>{periodName(period)}</option>)}</select></label>
      <label>Phiên bản lương<select value={runId} onChange={event => setRunId(event.target.value)} disabled={!periodRuns.length}><option value="">-- Chọn phiên bản --</option>{filteredRunOptions.map(run => <option key={run.id} value={run.id}>Run #{run.run_number ?? '—'} · {statusName(run.status)} · {dateTime(run.calculated_at || run.created_at)}</option>)}</select></label>
      <label>Trạng thái duyệt<select value={statusFilter} onChange={event => handleStatusChange(event.target.value)}><option value="ALL">Tất cả trạng thái</option>{['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'LOCKED'].filter(key => runs.some(run => statusKey(run.status) === key || (key === 'PENDING' && statusKey(run.status) === 'SUBMITTED'))).map(key => <option key={key} value={key}>{statusName(key)}</option>)}</select></label>
      <label>Phân loại nhân sự<select value={classificationFilter} onChange={event => setClassificationFilter(event.target.value)}><option value="ALL">Tất cả phân loại</option>{classificationOptions.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Phòng ban<select value={departmentFilter} onChange={event => setDepartmentFilter(event.target.value)}><option value="ALL">Tất cả phòng ban</option>{departmentOptions.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    </section>

    {error && <div className="rd-alert rd-alert-danger"><AlertTriangle size={18} /><div><strong>Không tải được Dashboard</strong><p>{error}</p><button className="rd-text-button" onClick={() => load(true)}>Thử tải lại</button></div></div>}
    {warnings.map((warning, index) => <div className="rd-alert" key={index}><AlertTriangle size={17} /><p>{warning}</p></div>)}
    {loading ? <div className="rd-state"><RefreshCw className="rd-spin" size={24} /><strong>Đang tải dữ liệu từ Supabase…</strong></div>
      : !selectedRun ? <div className="rd-state"><FileCheck2 size={28} /><strong>Chưa có phiên bản lương phù hợp</strong><p>Dashboard chỉ hiển thị phiên bản đã lưu trong payroll_runs, không tạo số liệu thay thế.</p></div>
      : !hasSnapshot || !rawRows.length ? <div className="rd-state"><AlertTriangle size={27} /><strong>Phiên bản chưa có snapshot chi tiết hợp lệ</strong><p>Run #{selectedRun.run_number ?? '—'} · {statusName(selectedRun.status)}. Kiểm tra input_snapshot trước khi sử dụng báo cáo.</p></div>
      : <>
        <div className="rd-run-meta"><div><span>MÃ KỲ LƯƠNG</span><strong>{selectedPeriod?.period_code || selectedPeriod?.code || selectedPeriod?.id || '—'}</strong></div><div><span>PHIÊN BẢN</span><strong>Run #{selectedRun.run_number ?? '—'}</strong></div><div><span>TRẠNG THÁI</span><strong><em className={`rd-status ${statusTone(selectedRun.status)}`}>{statusName(selectedRun.status)}</em></strong></div><div><span>THỜI ĐIỂM TÍNH</span><strong>{dateTime(selectedRun.calculated_at || selectedRun.created_at)}</strong></div><div><span>SỐ NHÂN SỰ</span><strong>{num(totalsFromSnapshot?.employee_count ?? snapshotCount ?? normalizedRows.length).toLocaleString('vi-VN')}</strong></div></div>

        <section className="rd-section"><div className="rd-section-title"><div><h2>Chỉ số tổng quan</h2><p>Các tổng số lấy từ snapshot của phiên bản đang chọn.</p></div><span className="rd-updated">Cập nhật: {dateTime(updatedAt)}</span></div>
          <div className="rd-metrics">
            <Metric title="Nhân sự trong kỳ" value={num(totalsFromSnapshot?.employee_count ?? snapshotCount ?? normalizedRows.length).toLocaleString('vi-VN')} subtitle="Theo phiên bản đã lưu" icon={Users} />
            <Metric title="Lương cố định" value={metricValue('fixed')} subtitle="Từ snapshot lương" icon={Wallet} />
            <Metric title="Tiết dạy & phụ đạo" value={metricValue('teaching')} subtitle="Từ snapshot lương" icon={BarChart3} />
            <Metric title="Khoản cộng" value={metricValue('additions')} subtitle="Từ snapshot lương" icon={CheckCircle2} />
            <Metric title="Khoản trừ" value={metricValue('deductions')} subtitle="Chưa gồm BHXH, Công đoàn, thuế" icon={ShieldCheck} />
            <Metric title="Tổng thu nhập" value={metricValue('gross_income')} subtitle="Giá trị đã lưu" icon={Wallet} tone="rd-metric-primary" />
            <Metric title="Thuế TNCN" value={metricValue('personal_income_tax')} subtitle="Theo snapshot lương" icon={ShieldCheck} />
            <Metric title="BHXH người lao động" value={metricValue('insurance_employee')} subtitle="Không phải phần đơn vị đóng" icon={ShieldCheck} />
            <Metric title="Phí Công đoàn NLĐ" value={metricValue('union_employee')} subtitle="Theo snapshot lương" icon={Users} />
            <Metric title="Thực lĩnh" value={metricValue('net_pay')} subtitle="Giá trị đã lưu" icon={Wallet} tone="rd-metric-primary" />
          </div>
        </section>

        <section className="rd-chart-grid">
          <article className="rd-card"><div className="rd-card-heading"><div><h2>Cơ cấu thu nhập</h2><p>So sánh thành phần theo giá trị snapshot.</p></div></div><BarRows items={incomeBreakdown} valueKey="value" /></article>
          <article className="rd-card"><div className="rd-card-heading"><div><h2>Cơ cấu khấu trừ</h2><p>Hiển thị riêng từng khoản, không gộp trùng.</p></div></div><BarRows items={deductionBreakdown} valueKey="value" /></article>
          <article className="rd-card rd-card-wide"><div className="rd-card-heading"><div><h2>So sánh quỹ lương theo kỳ</h2><p>Mỗi kỳ chỉ dùng phiên bản mới nhất theo số run và thời điểm lưu; tối đa 6 kỳ gần nhất.</p></div></div>
            {comparisonData.length < 2 ? <div className="rd-empty-inline">Chưa đủ ít nhất 2 kỳ có snapshot hợp lệ để so sánh.</div> : <div className="rd-compare-table"><table><thead><tr><th>Kỳ lương</th><th>Phiên bản</th><th>Nhân sự</th><th>Tổng thu nhập</th><th>Thực lĩnh</th><th>Thuế TNCN</th></tr></thead><tbody>{comparisonData.map(item => <tr key={item.run.id}><td>{item.label}</td><td>#{item.run.run_number} · {statusName(item.run.status)}</td><td>{num(item.employee_count).toLocaleString('vi-VN')}</td><td>{money(item.gross_income)}</td><td>{money(item.net_pay)}</td><td>{money(item.personal_income_tax)}</td></tr>)}</tbody></table></div>}
          </article>
          <article className="rd-card"><div className="rd-card-heading"><div><h2>Theo phân loại nhân sự</h2><p>Số lượng, thu nhập và thực lĩnh từ các dòng snapshot.</p></div></div>{classificationData.length ? <div className="rd-mini-table"><table><thead><tr><th>Phân loại</th><th>Nhân sự</th><th>Tổng thu nhập</th><th>Thực lĩnh</th></tr></thead><tbody>{classificationData.map(item => <tr key={item.label}><td>{item.label}</td><td>{item.count}</td><td>{money(item.gross_income)}</td><td>{money(item.net_pay)}</td></tr>)}</tbody></table></div> : <div className="rd-empty-inline">Snapshot chưa có thông tin phân loại nhân sự.</div>}</article>
          <article className="rd-card"><div className="rd-card-heading"><div><h2>Theo phòng ban</h2><p>Chỉ tổng hợp phòng ban có trong dữ liệu thực tế.</p></div></div>{departmentData.length ? <div className="rd-mini-table"><table><thead><tr><th>Phòng ban</th><th>Nhân sự</th><th>Tổng thu nhập</th><th>Bình quân</th></tr></thead><tbody>{departmentData.map(item => <tr key={item.label}><td>{item.label}</td><td>{item.count}</td><td>{money(item.gross_income)}</td><td>{money(item.count ? item.gross_income / item.count : 0)}</td></tr>)}</tbody></table></div> : <div className="rd-empty-inline">Không có thông tin phòng ban trong snapshot/Employee Master để phân tích.</div>}</article>
        </section>

        <section className="rd-card rd-workflow"><div className="rd-section-title"><div><h2>Tiến độ duyệt lương</h2><p>Thống kê số phiên bản hiện có trong payroll_runs; không thay đổi trạng thái hồ sơ.</p></div><CalendarClock size={20} /></div><div className="rd-status-grid">{Object.entries(allStatusCounts).filter(([key, count]) => count > 0 || runs.some(run => statusKey(run.status) === key || (key === 'PENDING' && statusKey(run.status) === 'SUBMITTED'))).map(([key, count]) => <div className="rd-status-box" key={key}><span className={`rd-status ${statusTone(key)}`}>{statusName(key)}</span><strong>{count.toLocaleString('vi-VN')}</strong><small>phiên bản</small></div>)}</div>
          <div className="rd-pending-list"><h3>Hồ sơ đang chờ duyệt</h3>{pendingRuns.length ? <div className="rd-mini-table"><table><thead><tr><th>Kỳ lương</th><th>Phiên bản</th><th>Thời điểm trình/tạo</th><th>Người thao tác gần nhất</th><th>Ghi chú gần nhất</th></tr></thead><tbody>{pendingRuns.map(run => { const history = approvals.filter(item => item.payroll_run_id === run.id).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0]; const period = periods.find(item => item.id === run.payroll_period_id); return <tr key={run.id}><td>{periodName(period)}</td><td>#{run.run_number}</td><td>{dateTime(history?.created_at || run.created_at)}</td><td>{history?.actor_name || history?.actor_email || history?.actor_id || '—'}</td><td>{history?.note || '—'}</td></tr>; })}</tbody></table></div> : <div className="rd-empty-inline">Hiện không có phiên bản ở trạng thái Chờ duyệt.</div>}</div>
          <div className="rd-latest-history"><h3>Lịch sử của phiên bản đang chọn</h3>{selectedHistory.length ? <div className="rd-mini-table"><table><thead><tr><th>Thời điểm</th><th>Bước xử lý</th><th>Trạng thái ghi nhận</th><th>Người thao tác</th><th>Ghi chú</th></tr></thead><tbody>{selectedHistory.map((item, index) => <tr key={item.id || `${item.created_at}-${index}`}><td>{dateTime(item.created_at)}</td><td>{item.step_name || '—'}</td><td><span className={`rd-status ${statusTone(item.status)}`}>{statusName(item.status)}</span></td><td>{item.actor_name || item.actor_email || item.actor_id || '—'}</td><td>{item.note || '—'}</td></tr>)}</tbody></table></div> : <div className="rd-empty-inline">Chưa có lịch sử duyệt đọc được cho phiên bản này.</div>}</div>
        </section>

        <section className="rd-card rd-alert-section"><div className="rd-section-title"><div><h2>Cảnh báo dữ liệu</h2><p>Cảnh báo chỉ phục vụ kiểm tra, không tự sửa nguồn dữ liệu.</p></div><AlertTriangle size={20} /></div>{alerts.length ? <div className="rd-alert-list">{alerts.map((item, index) => <div className={`rd-alert-item ${item.tone}`} key={`${item.title}-${index}`}><span className="rd-alert-count">{item.count}</span><div><strong>{item.title}</strong><p>{item.detail}</p></div></div>)}</div> : <div className="rd-success-empty"><CheckCircle2 size={18} /> Không phát hiện cảnh báo theo những trường dữ liệu có thể đối chiếu trong snapshot.</div>}</section>

        <section className="rd-card rd-detail-card"><div className="rd-section-title"><div><h2>Chi tiết nhân sự</h2><p>{periodName(selectedPeriod)} · Run #{selectedRun.run_number} · {filteredRows.length.toLocaleString('vi-VN')} dòng sau lọc</p></div><button className="rd-button rd-button-primary" onClick={exportExcel} disabled={!filteredRows.length}><Download size={15} /> Xuất Excel</button></div>
          <div className="rd-table-filters"><label className="rd-search"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm mã nhân viên, họ tên…" /></label><label>Trạng thái dữ liệu<select value={rowStatusFilter} onChange={event => setRowStatusFilter(event.target.value)}><option value="ALL">Tất cả</option><option value="ISSUES">Có cảnh báo</option>{[...new Set(normalizedRows.map(row => clean(row.status)).filter(Boolean))].slice(0, 30).map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>
          <div className="rd-table-wrap"><table className="rd-data-table"><thead><tr><th>Mã nhân viên</th><th>Họ và tên</th><th>Phân loại</th><th>Phòng ban</th><th>Lương cố định</th><th>Tiền tiết dạy</th><th>Khoản cộng</th><th>Khoản trừ</th><th>BHXH NLĐ</th><th>Phí Công đoàn</th><th>Thuế TNCN</th><th>Tổng thu nhập</th><th>Thực lĩnh</th><th>Trạng thái dữ liệu</th></tr></thead><tbody>{visibleRows.map((row, index) => <tr key={row.employee_id || readEmployeeCode(row) || index}><td>{readEmployeeCode(row) || '—'}</td><td>{readEmployeeName(row)}</td><td>{readClassification(row) || '—'}</td><td>{readDepartment(row) || '—'}</td><td>{row.fixed == null ? '—' : money(row.fixed)}</td><td>{row.teaching == null ? '—' : money(row.teaching)}</td><td>{row.additions == null ? '—' : money(row.additions)}</td><td>{row.deductions == null ? '—' : money(row.deductions)}</td><td>{row.insurance_employee == null ? '—' : money(row.insurance_employee)}</td><td>{row.union_employee == null ? '—' : money(row.union_employee)}</td><td>{row.personal_income_tax == null ? '—' : money(row.personal_income_tax)}</td><td>{row.gross_income == null ? '—' : money(row.gross_income)}</td><td className="rd-net-cell">{row.net_pay == null ? '—' : money(row.net_pay)}</td><td><span className={`rd-row-status ${clean(row.status) && ['đủ dữ liệu nguồn', 'đã ghi nhận tiết dạy'].some(value => norm(row.status).includes(norm(value))) ? 'ok' : 'warn'}`}>{clean(row.status) || 'Chưa có trạng thái'}</span></td></tr>)}</tbody><tfoot><tr><th colSpan="4">TỔNG CỘNG (toàn bộ dòng sau bộ lọc)</th>{['fixed', 'teaching', 'additions', 'deductions', 'insurance_employee', 'union_employee', 'personal_income_tax', 'gross_income', 'net_pay'].map(key => <th key={key}>{filteredRows.some(row => row[key] != null && row[key] !== '') ? money(filteredRows.reduce((sum, row) => sum + num(row[key]), 0)) : '—'}</th>)}<th>{filteredRows.length} nhân sự</th></tr></tfoot></table></div>
          <div className="rd-pagination"><span>Hiển thị {filteredRows.length ? ((pageNo - 1) * pageSize + 1).toLocaleString('vi-VN') : 0}–{Math.min(pageNo * pageSize, filteredRows.length).toLocaleString('vi-VN')} / {filteredRows.length.toLocaleString('vi-VN')} dòng</span><div><button className="rd-button" onClick={() => setPageNo(value => Math.max(1, value - 1))} disabled={pageNo <= 1}>Trước</button><span>Trang {pageNo} / {Math.max(1, Math.ceil(filteredRows.length / pageSize))}</span><button className="rd-button" onClick={() => setPageNo(value => Math.min(Math.max(1, Math.ceil(filteredRows.length / pageSize)), value + 1))} disabled={pageNo >= Math.ceil(filteredRows.length / pageSize)}>Sau</button></div></div>
        </section>
      </>}
    <footer className="rd-footnote"><ShieldCheck size={15} /><span>Dashboard chỉ đọc phiên bản lương đã lưu trong Supabase. Không tính lại lương, không chỉnh sửa snapshot và không thay đổi trạng thái duyệt. Thông tin nào không có trong nguồn dữ liệu sẽ được để trống hoặc thông báo rõ.</span></footer>
  </main>;
}
