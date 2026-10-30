import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, CalendarDays, Check, CheckCircle2, Circle, ClipboardList,
  Clock3, Edit3, ListTodo, Loader2, Plus, RefreshCw, ShieldCheck, Trash2, X,
  Users, UserCheck, UserX, Landmark, Wallet, TrendingUp, BarChart3,
  ClipboardCheck, FileCheck2, AlertTriangle, ArrowUpRight, CalendarRange,
} from 'lucide-react';
import { supabase } from '../../shared/supabase.js';
import './dashboard.css';

const PRIORITIES = [
  { value: 'low', label: 'Thấp' },
  { value: 'normal', label: 'Bình thường' },
  { value: 'high', label: 'Cao' },
];
const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'open', label: 'Chưa hoàn thành' },
  { value: 'done', label: 'Đã hoàn thành' },
  { value: 'overdue', label: 'Quá hạn' },
];
const EMPTY_FORM = { title: '', description: '', due_date: '', priority: 'normal' };
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const isOverdue = task => task.status !== 'completed' && Boolean(task.due_date) && task.due_date < todayLocal();
const formatDate = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN') : '';
const priorityLabel = value => PRIORITIES.find(item => item.value === value)?.label || 'Bình thường';
const asRows = value => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  for (const key of ['results', 'rows', 'employees', 'payroll_results', 'employee_results', 'details']) if (Array.isArray(value[key])) return value[key];
  return [];
};
const numberOf = value => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? '').trim().replace(/[₫đ\s]/gi, '');
  if (!raw) return 0;
  const normalized = raw.includes(',') && raw.includes('.')
    ? (raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, ''))
    : raw.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};
const money = value => `${numberOf(value).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ₫`;
const employeeKey = row => String(row?.employee_id || row?.id || '').trim();
const periodLabel = period => period?.name || period?.period_code || period?.code || 'Kỳ lương';
const periodSortValue = period => String(period?.month || (period?.period_year && period?.period_month ? `${period.period_year}-${String(period.period_month).padStart(2, '0')}` : '') || period?.start_date || period?.created_at || '');
const isInactiveEmployee = row => /nghỉ|inactive|terminated|resigned|đã nghỉ/i.test(String(row?.status || row?.employment_status || ''));
const masterInsuranceValue = employee => {
  const all = { ...(employee || {}), ...(employee?.custom_fields && typeof employee.custom_fields === 'object' ? employee.custom_fields : {}) };
  const key = Object.keys(all).find(k => ['social_insurance', 'tham gia bhxh', 'bhxh', 'có tham gia bhxh'].includes(String(k).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().trim()));
  if (!key) return null;
  const value = all[key];
  if (value === true || ['co', 'yes', 'true', '1', 'tham gia', 'x'].includes(String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim())) return true;
  if (value === false || ['khong', 'no', 'false', '0', 'khong tham gia'].includes(String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim())) return false;
  return null;
};
const statusText = value => ({ DRAFT: 'Bản nháp', OPEN: 'Đang mở', CLOSED: 'Đã đóng', SUBMITTED: 'Chờ duyệt', PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', LOCKED: 'Đã chốt', CANCELLED: 'Đã hủy' }[String(value || '').toUpperCase()] || value || 'Chưa xác định');

export default function Page() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('open');
  const [sort, setSort] = useState('priority');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showTaskManager, setShowTaskManager] = useState(false);
  const [overview, setOverview] = useState({ loading: true, error: '', warnings: [], employees: [], periods: [], periodEmployees: [], snapshots: [], daily: [], teaching: [], runs: [], insurance: [], updatedAt: null });
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [overviewRefreshing, setOverviewRefreshing] = useState(false);
  const [periodDataNonce, setPeriodDataNonce] = useState(0);

  const loadOverview = useCallback(async () => {
    if (!supabase) { setOverview(v => ({ ...v, loading: false, error: 'Supabase chưa được cấu hình.' })); return; }
    setOverviewRefreshing(true);
    setOverview(v => ({ ...v, loading: true, error: '', warnings: [] }));
    const optional = async (table, select = '*', order = null, limit = 1000) => {
      let query = supabase.from(table).select(select);
      if (order) query = query.order(order, { ascending: false });
      if (limit) query = query.limit(limit);
      const { data, error: queryError } = await query;
      if (queryError) return { data: [], warning: `${table}: ${queryError.message}` };
      return { data: data || [], warning: '' };
    };
    try {
      const [employees, periods, runs, insurance] = await Promise.all([
        optional('employees', '*'),
        optional('payroll_periods', '*', 'created_at'),
        optional('payroll_runs', 'id,payroll_period_id,status,input_snapshot,created_at,run_number', 'created_at', 200),
        optional('employee_insurance_profiles', 'employee_id,participates_insurance'),
      ]);
      const warnings = [employees, periods, runs, insurance].map(x => x.warning).filter(Boolean);
      const fatal = [employees, periods, runs].find(x => x.warning);
      setOverview({ loading: false, error: fatal?.warning || '', warnings, employees: employees.data, periods: periods.data, periodEmployees: [], snapshots: [], daily: [], teaching: [], runs: runs.data, insurance: insurance.data, updatedAt: new Date().toISOString() });
      const fixed = periods.data.filter(p => String(p.type || 'FIXED').toUpperCase() === 'FIXED').sort((a,b) => periodSortValue(b).localeCompare(periodSortValue(a)));
      setSelectedPeriodId(current => fixed.some(p => p.id === current) ? current : (fixed[0]?.id || ''));
      setPeriodDataNonce(v => v + 1);
    } catch (e) {
      setOverview(v => ({ ...v, loading: false, error: e?.message || String(e), updatedAt: new Date().toISOString() }));
    } finally { setOverviewRefreshing(false); }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  useEffect(() => {
    if (!supabase || !selectedPeriodId) {
      setOverview(v => ({ ...v, periodEmployees: [], snapshots: [], daily: [], teaching: [] }));
      return undefined;
    }
    let alive = true;
    const loadPeriodData = async () => {
      const queries = await Promise.all([
        supabase.from('payroll_period_employees').select('period_id,employee_id,employee_code,employee_name').eq('period_id', selectedPeriodId),
        supabase.from('payroll_period_employee_snapshots').select('period_id,employee_id,employee_code_snapshot,employee_name_snapshot').eq('period_id', selectedPeriodId),
        supabase.from('daily_attendance_records').select('period_id,employee_id').eq('period_id', selectedPeriodId),
        supabase.from('teaching_attendance_records').select('period_id,employee_id').eq('period_id', selectedPeriodId),
      ]);
      if (!alive) return;
      const warnings = queries.map((item, index) => item.error ? `${['payroll_period_employees','payroll_period_employee_snapshots','daily_attendance_records','teaching_attendance_records'][index]}: ${item.error.message}` : '').filter(Boolean);
      setOverview(v => ({ ...v, warnings: [...v.warnings.filter(w => !/payroll_period_employees|payroll_period_employee_snapshots|daily_attendance_records|teaching_attendance_records/.test(w)), ...warnings], periodEmployees: queries[0].data || [], snapshots: queries[1].data || [], daily: queries[2].data || [], teaching: queries[3].data || [] }));
    };
    loadPeriodData();
    return () => { alive = false; };
  }, [selectedPeriodId, periodDataNonce]);

  const loadTasks = useCallback(async () => {
    if (!supabase) { setError('Supabase chưa được cấu hình. Không thể tải công việc.'); setLoading(false); return; }
    setLoading(true); setError('');
    const { data, error: queryError } = await supabase
      .from('payroll_user_tasks')
      .select('id,user_id,title,description,due_date,priority,status,created_at,updated_at,completed_at')
      .order('created_at', { ascending: false });
    if (queryError) setError(queryError.message.includes('payroll_user_tasks')
      ? 'Chưa tạo bảng payroll_user_tasks trên Supabase. Vui lòng chạy file SQL migration đi kèm bản vá.'
      : `Không tải được danh sách công việc: ${queryError.message}`);
    else setTasks(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const counts = useMemo(() => ({
    all: tasks.length,
    open: tasks.filter(t => t.status !== 'completed').length,
    done: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(isOverdue).length,
  }), [tasks]);

  const visibleTasks = useMemo(() => {
    let rows = tasks.filter(task => {
      if (filter === 'open') return task.status !== 'completed';
      if (filter === 'done') return task.status === 'completed';
      if (filter === 'overdue') return isOverdue(task);
      return true;
    });
    const priorityRank = { high: 0, normal: 1, low: 2 };
    rows = [...rows].sort((a, b) => {
      if (sort === 'priority') return (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1) || String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'));
      if (sort === 'due_date') return String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'));
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
    return rows;
  }, [tasks, filter, sort]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setError(''); setModalOpen(true); };
  const openEdit = task => {
    setEditing(task);
    setForm({ title: task.title || '', description: task.description || '', due_date: task.due_date || '', priority: task.priority || 'normal' });
    setError(''); setModalOpen(true);
  };

  const saveTask = async event => {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) { setError('Vui lòng nhập nội dung công việc.'); return; }
    setSaving(true); setError(''); setNotice('');
    const payload = {
      title,
      description: form.description.trim() || null,
      due_date: form.due_date || null,
      priority: form.priority,
      updated_at: new Date().toISOString(),
    };
    const result = editing
      ? await supabase.from('payroll_user_tasks').update(payload).eq('id', editing.id).select().single()
      : await supabase.from('payroll_user_tasks').insert({ ...payload, status: 'pending' }).select().single();
    if (result.error) setError(`Không lưu được công việc: ${result.error.message}`);
    else {
      setTasks(old => editing ? old.map(t => t.id === editing.id ? result.data : t) : [result.data, ...old]);
      setModalOpen(false); setNotice(editing ? 'Đã cập nhật công việc.' : 'Đã thêm công việc.');
    }
    setSaving(false);
  };

  const toggleTask = async task => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    const completedAt = nextStatus === 'completed' ? new Date().toISOString() : null;
    setError(''); setNotice('');
    const { data, error: updateError } = await supabase.from('payroll_user_tasks')
      .update({ status: nextStatus, completed_at: completedAt, updated_at: new Date().toISOString() })
      .eq('id', task.id).select().single();
    if (updateError) setError(`Không cập nhật được trạng thái: ${updateError.message}`);
    else setTasks(old => old.map(t => t.id === task.id ? data : t));
  };

  const deleteTask = async task => {
    if (!window.confirm(`Xóa công việc “${task.title}”? Thao tác này không thể hoàn tác.`)) return;
    setError(''); setNotice('');
    const { error: deleteError } = await supabase.from('payroll_user_tasks').delete().eq('id', task.id);
    if (deleteError) setError(`Không xóa được công việc: ${deleteError.message}`);
    else { setTasks(old => old.filter(t => t.id !== task.id)); setNotice('Đã xóa công việc.'); }
  };

  const previewTasks = tasks.filter(task => task.status !== 'completed').slice(0, 3);
  const selectedPeriod = overview.periods.find(p => p.id === selectedPeriodId) || null;
  const periodMembership = selectedPeriod ? overview.periodEmployees.filter(r => r.period_id === selectedPeriod.id) : [];
  const snapshotMembership = selectedPeriod ? overview.snapshots.filter(r => r.period_id === selectedPeriod.id) : [];
  const memberRows = periodMembership.length ? periodMembership : snapshotMembership;
  const memberIds = new Set(memberRows.map(employeeKey).filter(Boolean));
  const periodDaily = selectedPeriod ? overview.daily.filter(r => r.period_id === selectedPeriod.id) : [];
  const periodTeaching = selectedPeriod ? overview.teaching.filter(r => r.period_id === selectedPeriod.id) : [];
  const latestRunsByPeriod = useMemo(() => {
    const map = new Map();
    [...overview.runs].sort((a,b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).forEach(run => { if (!map.has(run.payroll_period_id)) map.set(run.payroll_period_id, run); });
    return map;
  }, [overview.runs]);
  const selectedRun = selectedPeriod ? latestRunsByPeriod.get(selectedPeriod.id) : null;
  const runRows = asRows(selectedRun?.input_snapshot);
  const runTotals = runRows.reduce((acc, row) => {
    acc.fixed += numberOf(row.fixed); acc.teaching += numberOf(row.teaching); acc.additions += numberOf(row.additions);
    acc.deductions += numberOf(row.deductions) + numberOf(row.insurance_employee) + numberOf(row.union_employee) + numberOf(row.personal_income_tax);
    acc.gross += numberOf(row.gross_income ?? row.gross); acc.net += numberOf(row.net_pay ?? row.net); acc.employerInsurance += numberOf(row.employer_insurance);
    return acc;
  }, { fixed: 0, teaching: 0, additions: 0, deductions: 0, gross: 0, net: 0, employerInsurance: 0 });
  const recordedDailyCount = new Set(periodDaily.map(employeeKey).filter(Boolean)).size;
  const recordedTeachingCount = new Set(periodTeaching.map(employeeKey).filter(Boolean)).size;
  const runEmployeeCount = runRows.length;
  const hasEmployerInsurance = runRows.some(row => Object.prototype.hasOwnProperty.call(row || {}, 'employer_insurance'));
  const periodEmployeeCount = memberRows.length;
  const missingInputs = Math.max(0, periodEmployeeCount - Math.min(periodEmployeeCount, recordedDailyCount));
  const activeEmployees = overview.employees.filter(e => !isInactiveEmployee(e));
  const inactiveEmployees = overview.employees.filter(isInactiveEmployee);
  const insuranceById = new Map(overview.insurance.map(r => [String(r.employee_id), r]));
  const insuranceCount = overview.employees.filter(e => (masterInsuranceValue(e) ?? insuranceById.get(String(e.id))?.participates_insurance) === true).length;
  const approvedRun = ['APPROVED', 'LOCKED'].includes(String(selectedRun?.status || '').toUpperCase());
  const lockedRun = String(selectedRun?.status || '').toUpperCase() === 'LOCKED';
  const approvalCount = selectedRun ? (approvedRun ? runEmployeeCount : 0) : 0;
  const pendingApprovalCount = selectedRun ? (approvedRun ? 0 : runEmployeeCount) : 0;
  const latestPeriods = [...overview.periods].filter(p => String(p.type || 'FIXED').toUpperCase() === 'FIXED').sort((a,b) => periodSortValue(b).localeCompare(periodSortValue(a))).slice(0,6).reverse();
  const historyValues = latestPeriods.map(period => {
    const run = latestRunsByPeriod.get(period.id); const rows = asRows(run?.input_snapshot);
    return { label: periodLabel(period), total: rows.reduce((sum,row) => sum + numberOf(row.net_pay ?? row.net), 0), hasData: rows.length > 0 };
  });
  const maxHistory = Math.max(1, ...historyValues.map(v => v.total));
  const stages = [
    { label: 'Thiết lập kỳ lương', status: selectedPeriod ? statusText(selectedPeriod.status) : 'Chưa có kỳ', done: Boolean(selectedPeriod && ['OPEN', 'CLOSED'].includes(String(selectedPeriod.status || '').toUpperCase())), detail: selectedPeriod ? periodLabel(selectedPeriod) : 'Chưa tạo kỳ lương', slug: 'payroll-periods' },
    { label: 'Danh sách nhân sự kỳ', status: periodEmployeeCount ? `${periodEmployeeCount} nhân sự` : 'Chưa có dữ liệu', done: periodEmployeeCount > 0, detail: 'Danh sách chốt theo kỳ', slug: 'period-employees' },
    { label: 'Chấm công ngày', status: periodEmployeeCount ? `${recordedDailyCount}/${periodEmployeeCount} có ghi nhận` : 'Chưa có danh sách kỳ', done: false, detail: 'Số nhân sự có ít nhất một bản ghi; chưa kết luận đã hoàn tất', slug: 'daily-attendance' },
    { label: 'Chấm tiết dạy', status: periodEmployeeCount ? `${recordedTeachingCount}/${periodEmployeeCount} có ghi nhận` : 'Chưa có danh sách kỳ', done: false, detail: 'Số nhân sự có bản ghi; chưa kết luận đã hoàn tất', slug: 'teaching-attendance' },
    { label: 'Tính lương', status: selectedRun ? `Phiên bản #${selectedRun.run_number ?? '—'}` : 'Chưa tính lương', done: runEmployeeCount > 0, detail: selectedRun ? statusText(selectedRun.status) : 'Chưa có kết quả lưu', slug: 'payroll-summary' },
    { label: 'Duyệt bảng lương', status: selectedRun ? statusText(selectedRun.status) : 'Chưa có hồ sơ', done: approvedRun, detail: selectedRun ? (approvedRun ? 'Đã được duyệt' : 'Còn chờ xử lý') : 'Chưa có phiên bản lương', slug: 'payroll-approvals' },
    { label: 'Chốt kỳ lương', status: lockedRun ? 'Đã chốt' : 'Chưa chốt', done: lockedRun, detail: 'Theo trạng thái phiên bản lương', slug: 'payroll-approvals' },
  ];
  const alerts = [
    ...(selectedPeriod && periodEmployeeCount === 0 ? [{ label: 'Kỳ lương chưa có danh sách nhân sự', slug: 'period-employees', tone: 'warning' }] : []),
    ...(selectedPeriod && periodEmployeeCount > 0 && missingInputs > 0 ? [{ label: `${missingInputs} nhân sự chưa có ghi nhận chấm công`, slug: 'daily-attendance', tone: 'warning' }] : []),
    ...(selectedPeriod && periodEmployeeCount > 0 && recordedTeachingCount === 0 ? [{ label: 'Chưa có dữ liệu chấm tiết dạy', slug: 'teaching-attendance', tone: 'warning' }] : []),
    ...(selectedPeriod && !selectedRun ? [{ label: 'Chưa có phiên bản tính lương được lưu', slug: 'payroll-summary', tone: 'warning' }] : []),
    ...(selectedRun && !approvedRun ? [{ label: 'Bảng lương đang chờ duyệt', slug: 'payroll-approvals', tone: 'warning' }] : []),
  ];
  const goTo = slug => { window.history.pushState({ slug }, '', `/${slug}`); window.dispatchEvent(new PopStateEvent('popstate')); };

  return <section className="feature-page dashboard-page">
    <div className="dashboard-top-row">
      <div className="feature-heading dashboard-overview-heading">
        <div className="feature-heading-icon"><ClipboardList size={21}/></div>
        <div><div className="eyebrow">TRUNG TÂM ĐIỀU HÀNH · PAYROLL</div><h2>Tổng quan</h2><p>Theo dõi nhân sự, tiến độ xử lý và chi phí tiền lương Việt Âu.</p></div>
      </div>

      <aside className="todo-widget">
        <div className="todo-widget-header">
          <div className="todo-widget-heading"><div className="todo-widget-icon"><ListTodo size={16}/></div><div><h3>GHI CHÚ CỦA TÔI</h3><p>{counts.open} việc cần thực hiện{counts.overdue ? ` · ${counts.overdue} quá hạn` : ''}</p></div></div>
          <button className="todo-widget-add" onClick={openCreate} title="Thêm ghi chú" aria-label="Thêm ghi chú"><Plus size={16}/></button>
        </div>
        {error && <div className="todo-widget-error"><AlertCircle size={13}/><span>{error}</span><button onClick={loadTasks} title="Thử tải lại"><RefreshCw size={12}/></button></div>}
        {notice && <div className="todo-widget-notice">{notice}</div>}
        {loading ? <div className="todo-widget-empty"><Loader2 size={14} className="dashboard-spin"/> Đang tải ghi chú…</div>
          : previewTasks.length === 0 ? <div className="todo-widget-empty">{tasks.length ? 'Không còn việc nào cần thực hiện.' : 'Chưa có ghi chú. Thêm việc cần nhớ tại đây.'}</div>
          : <div className="todo-widget-list">{previewTasks.map(task => <div className={`todo-widget-item ${isOverdue(task) ? 'is-overdue' : ''}`} key={task.id}>
            <button className="todo-widget-check" onClick={() => toggleTask(task)} title="Đánh dấu hoàn thành"><Circle size={15}/></button>
            <button className="todo-widget-task" onClick={() => openEdit(task)} title="Mở ghi chú"><strong>{task.title}</strong><span>{task.due_date ? `Hạn ${formatDate(task.due_date)}` : priorityLabel(task.priority)}{isOverdue(task) ? ' · Quá hạn' : ''}</span></button>
            <button className="todo-widget-edit" onClick={() => openEdit(task)} title="Chỉnh sửa"><Edit3 size={13}/></button>
          </div>)}</div>}
        <div className="todo-widget-footer"><button onClick={() => { setFilter('open'); setShowTaskManager(v => !v); }}>{showTaskManager ? 'Thu gọn' : 'Xem tất cả ghi chú'}</button><span>{counts.done} hoàn thành</span></div>
        {showTaskManager && <div className="todo-manager">
          <div className="todo-manager-summary"><span>{counts.all} tổng</span><span>{counts.open} đang làm</span><span>{counts.overdue} quá hạn</span></div>
          <div className="todo-manager-toolbar"><div className="todo-manager-filters">{FILTERS.map(item => <button key={item.value} className={filter === item.value ? 'active' : ''} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div><select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sắp xếp ghi chú"><option value="priority">Ưu tiên</option><option value="due_date">Ngày hết hạn</option><option value="created_at">Mới nhất</option></select></div>
          <div className="todo-manager-list">{visibleTasks.length ? visibleTasks.map(task => <div className={`todo-manager-item ${task.status === 'completed' ? 'is-completed' : ''}`} key={task.id}>
            <button onClick={() => toggleTask(task)} title={task.status === 'completed' ? 'Khôi phục' : 'Hoàn thành'}>{task.status === 'completed' ? <CheckCircle2 size={15}/> : <Circle size={15}/>}</button>
            <div><strong>{task.title}</strong><span>{task.due_date ? `Hạn ${formatDate(task.due_date)}` : priorityLabel(task.priority)}{isOverdue(task) ? ' · Quá hạn' : ''}</span></div>
            <button onClick={() => openEdit(task)} title="Sửa"><Edit3 size={13}/></button><button onClick={() => deleteTask(task)} title="Xóa"><Trash2 size={13}/></button>
          </div>) : <p className="todo-manager-empty">Không có ghi chú phù hợp.</p>}</div>
          {counts.done > 0 && <button className="todo-manager-completed" onClick={() => setShowCompleted(v => !v)}>{showCompleted ? 'Ẩn' : 'Hiện'} việc đã hoàn thành ({counts.done})</button>}
          {showCompleted && <div className="todo-manager-completed-list">{tasks.filter(t => t.status === 'completed').map(task => <div key={task.id}><span>{task.title}</span><button onClick={() => toggleTask(task)} title="Khôi phục"><RefreshCw size={12}/></button></div>)}</div>}
        </div>}
      </aside>
    </div>

    <div className="overview-toolbar">
      <div><span>CẬP NHẬT DỮ LIỆU</span><strong>{overview.updatedAt ? new Date(overview.updatedAt).toLocaleString('vi-VN') : 'Chưa cập nhật'}</strong></div>
      <label>Kỳ lương đang xem<select value={selectedPeriodId} onChange={e => setSelectedPeriodId(e.target.value)} disabled={overview.loading}><option value="">Chọn kỳ lương</option>{[...overview.periods].filter(p => String(p.type || 'FIXED').toUpperCase() === 'FIXED').sort((a,b) => periodSortValue(b).localeCompare(periodSortValue(a))).map(p => <option key={p.id} value={p.id}>{periodLabel(p)} · {p.code || p.period_code || ''}</option>)}</select></label>
      <button className="dashboard-refresh" onClick={loadOverview} disabled={overviewRefreshing}><RefreshCw size={14} className={overviewRefreshing ? 'dashboard-spin' : ''}/> Làm mới</button>
    </div>
    {overview.error && <div className="overview-error"><AlertCircle size={16}/><span>Không tải được Dashboard: {overview.error}</span><button onClick={loadOverview}>Thử lại</button></div>}
    {overview.warnings.length > 0 && !overview.error && <div className="overview-warning"><AlertTriangle size={15}/><span>Một số nguồn dữ liệu chưa đọc được. Các chỉ số liên quan có thể chưa đầy đủ: {overview.warnings.join(' · ')}</span></div>}

    <section className="overview-section">
      <div className="overview-section-heading"><div><span>NHÂN SỰ</span><h3>Quy mô nhân sự</h3></div><button onClick={() => goTo('employee-master')}>Hồ sơ nhân sự <ArrowUpRight size={13}/></button></div>
      <div className="overview-kpis">
        <article className="overview-kpi"><div className="overview-kpi-icon blue"><Users size={18}/></div><span>Tổng nhân sự</span><strong>{overview.loading ? '—' : overview.employees.length.toLocaleString('vi-VN')}</strong><small>Employee Master</small></article>
        <article className="overview-kpi"><div className="overview-kpi-icon green"><UserCheck size={18}/></div><span>Đang làm việc</span><strong>{overview.loading ? '—' : activeEmployees.length.toLocaleString('vi-VN')}</strong><small>{overview.employees.length ? `${(activeEmployees.length / overview.employees.length * 100).toFixed(1)}% tổng nhân sự` : 'Chưa có dữ liệu'}</small></article>
        <article className="overview-kpi"><div className="overview-kpi-icon red"><UserX size={18}/></div><span>Đã nghỉ việc</span><strong>{overview.loading ? '—' : inactiveEmployees.length.toLocaleString('vi-VN')}</strong><small>Trạng thái từ hồ sơ nhân sự</small></article>
        <article className="overview-kpi"><div className="overview-kpi-icon teal"><Landmark size={18}/></div><span>Tham gia BHXH</span><strong>{overview.loading ? '—' : insuranceCount.toLocaleString('vi-VN')}</strong><small>Ưu tiên trường BHXH trong Master</small></article>
      </div>
    </section>

    <div className="overview-grid overview-grid-main">
      <section className="overview-panel">
        <div className="overview-section-heading"><div><span>KỲ LƯƠNG ĐANG CHỌN</span><h3>{selectedPeriod ? periodLabel(selectedPeriod) : 'Chưa có kỳ lương'}</h3></div><span className={`overview-status ${String(selectedPeriod?.status || '').toLowerCase()}`}>{selectedPeriod ? statusText(selectedPeriod.status) : 'Chưa có dữ liệu'}</span></div>
        {selectedPeriod ? <><div className="overview-period-meta"><span>Mã kỳ <strong>{selectedPeriod.code || selectedPeriod.period_code || '—'}</strong></span><span>Thời gian <strong>{selectedPeriod.start_date || selectedPeriod.month || '—'}{selectedPeriod.end_date ? ` – ${selectedPeriod.end_date}` : ''}</strong></span><span>Nhân sự kỳ <strong>{periodEmployeeCount.toLocaleString('vi-VN')}</strong></span></div>
          <div className="overview-period-metrics"><div><span>Chấm công ngày</span><strong>{recordedDailyCount}/{periodEmployeeCount || '—'}</strong><small>Nhân sự có bản ghi</small></div><div><span>Chấm tiết dạy</span><strong>{recordedTeachingCount}/{periodEmployeeCount || '—'}</strong><small>Nhân sự có bản ghi</small></div><div><span>Kết quả tính lương</span><strong>{runEmployeeCount}/{periodEmployeeCount || '—'}</strong><small>{selectedRun ? statusText(selectedRun.status) : 'Chưa có phiên bản'}</small></div><div><span>Chưa có bản ghi chấm công</span><strong className={missingInputs ? 'text-warning' : 'text-success'}>{periodEmployeeCount ? missingInputs : '—'}</strong><small>Chưa có bản ghi chấm công</small></div></div>
        </> : <div className="overview-empty">Chưa có kỳ lương để tổng hợp. Tạo kỳ tại Quản lý Kỳ Lương.</div>}
      </section>
      <section className="overview-panel">
        <div className="overview-section-heading"><div><span>TIẾN ĐỘ NGHIỆP VỤ</span><h3>Quy trình xử lý bảng lương</h3></div><span className="overview-muted">7 giai đoạn</span></div>
        <div className="overview-stages">{stages.map((stage,index) => <button key={stage.label} className={`overview-stage ${stage.done ? 'done' : 'pending'}`} onClick={() => goTo(stage.slug)}><span className="overview-stage-index">{stage.done ? <CheckCircle2 size={15}/> : index + 1}</span><span className="overview-stage-copy"><strong>{stage.label}</strong><small>{stage.detail}</small></span><span className="overview-stage-status">{stage.status}</span><ArrowUpRight size={13}/></button>)}</div>
      </section>
    </div>

    <div className="overview-grid overview-grid-finance">
      <section className="overview-panel">
        <div className="overview-section-heading"><div><span>TÀI CHÍNH KỲ LƯƠNG</span><h3>Tổng quan chi phí tiền lương</h3></div><button onClick={() => goTo('payroll-summary')}>Tổng hợp lương <ArrowUpRight size={13}/></button></div>
        {selectedRun && runRows.length ? <><div className="overview-finance-kpis"><div><span>Tổng thu nhập</span><strong>{money(runTotals.gross)}</strong></div><div><span>Tổng khấu trừ*</span><strong>{money(runTotals.deductions)}</strong></div><div><span>Thực lĩnh</span><strong className="text-success">{money(runTotals.net)}</strong></div><div><span>BHXH doanh nghiệp</span><strong>{hasEmployerInsurance ? money(runTotals.employerInsurance) : 'Chưa có dữ liệu'}</strong></div></div>
          <div className="overview-chart-title">Cơ cấu thu nhập</div><div className="overview-bars">{[{label:'Lương cố định',value:runTotals.fixed},{label:'Tiết dạy / phụ đạo',value:runTotals.teaching},{label:'Khoản cộng',value:runTotals.additions}].map(item => <div className="overview-bar-row" key={item.label}><span>{item.label}</span><div><i style={{width:`${Math.max(0,Math.min(100,runTotals.gross ? item.value/runTotals.gross*100 : 0))}%`}}/></div><strong>{money(item.value)}</strong></div>)}</div><p className="overview-footnote">* Tổng khấu trừ gồm khoản trừ, BHXH NLĐ, công đoàn NLĐ và thuế TNCN theo snapshot phiên bản lương. Cơ cấu chỉ hiển thị các thành phần đã được lưu; không tự phân bổ nhóm tiết dạy/phụ đạo/dạy khác khi snapshot chưa tách riêng.</p>
        </> : <div className="overview-empty">Chưa có phiên bản lương đã lưu cho kỳ này. Dashboard không tự tạo số liệu.</div>}
      </section>
      <section className="overview-panel">
        <div className="overview-section-heading"><div><span>LỊCH SỬ CHI PHÍ</span><h3>Thực lĩnh theo kỳ gần nhất</h3></div><TrendingUp size={18} color="#168e88"/></div>
        {historyValues.some(v => v.hasData) ? <div className="overview-history-chart">{historyValues.map(item => <div className="overview-history-col" key={item.label}><strong>{item.hasData ? money(item.total) : '—'}</strong><div className="overview-history-track"><i style={{height:`${item.hasData ? Math.max(3,item.total/maxHistory*100) : 0}%`}}/></div><span>{item.label}</span></div>)}</div> : <div className="overview-empty">Chưa có đủ dữ liệu lịch sử từ các phiên bản lương đã lưu.</div>}
      </section>
    </div>

    <div className="overview-grid overview-grid-bottom">
      <section className="overview-panel">
        <div className="overview-section-heading"><div><span>NHÂN SỰ KỲ LƯƠNG</span><h3>Tình trạng bảng lương</h3></div><button onClick={() => goTo('payroll-approvals')}>Hồ sơ trình duyệt <ArrowUpRight size={13}/></button></div>
        <div className="overview-summary-table"><div><span>Tổng nhân sự trong kỳ</span><strong>{periodEmployeeCount || '—'}</strong></div><div><span>Đã có kết quả tính lương</span><strong>{selectedRun ? runEmployeeCount : '—'}</strong></div><div><span>Chưa có kết quả tính lương</span><strong>{selectedRun ? Math.max(0, periodEmployeeCount - runEmployeeCount) : '—'}</strong></div><div><span>Đã được duyệt</span><strong className="text-success">{selectedRun ? approvalCount : '—'}</strong></div><div><span>Chưa được duyệt</span><strong className="text-warning">{selectedRun ? pendingApprovalCount : '—'}</strong></div><div><span>Đã chốt</span><strong>{selectedRun ? (lockedRun ? runEmployeeCount : 0) : '—'}</strong></div></div>
        <p className="overview-footnote">Trạng thái duyệt/chốt được suy ra từ trạng thái phiên bản lương chính thức trong payroll_runs, không tự gán trạng thái riêng cho từng nhân sự.</p>
      </section>
      <section className="overview-panel overview-alert-panel">
        <div className="overview-section-heading"><div><span>CẦN XỬ LÝ</span><h3>Công việc nghiệp vụ</h3></div><span className="overview-alert-count">{alerts.length}</span></div>
        {alerts.length ? <div className="overview-alert-list">{alerts.map((item,index) => <button key={`${item.slug}-${index}`} onClick={() => goTo(item.slug)}><AlertTriangle size={15}/><span>{item.label}</span><ArrowUpRight size={13}/></button>)}</div> : <div className="overview-empty compact">Chưa phát hiện cảnh báo từ các nguồn dữ liệu đã đọc.</div>}
      </section>
    </div>
    <div className="overview-footnote overview-data-note"><BarChart3 size={13}/> Dữ liệu tổng hợp trực tiếp từ Employee Master, Kỳ Lương, chấm công, chấm tiết và phiên bản lương đã lưu. Các chỉ số bị giới hạn theo quyền truy cập Supabase hiện tại.</div>

    {modalOpen && <div className="todo-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !saving) setModalOpen(false); }}><section className="todo-modal" role="dialog" aria-modal="true" aria-labelledby="todo-modal-title"><header><div><h3 id="todo-modal-title">{editing ? 'Chỉnh sửa ghi chú' : 'Thêm ghi chú mới'}</h3><p>Lưu ghi chú vào danh sách cá nhân của bạn.</p></div><button onClick={() => setModalOpen(false)} disabled={saving} aria-label="Đóng"><X size={19}/></button></header><form onSubmit={saveTask}><label>Nội dung công việc <em>*</em><input autoFocus maxLength={180} required value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} placeholder="Nhập nội dung cần ghi nhớ"/></label><label>Ghi chú chi tiết<textarea rows={3} maxLength={2000} value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} placeholder="Thông tin hoặc ghi chú bổ sung (không bắt buộc)"/></label><div className="todo-form-grid"><label>Ngày hết hạn<input type="date" value={form.due_date} onChange={e => setForm(v => ({ ...v, due_date: e.target.value }))}/></label><label>Mức độ ưu tiên<select value={form.priority} onChange={e => setForm(v => ({ ...v, priority: e.target.value }))}>{PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label></div>{error && <div className="todo-alert todo-alert-error"><AlertCircle size={15}/>{error}</div>}<footer><button type="button" className="todo-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Hủy</button><button type="submit" className="todo-primary" disabled={saving}>{saving ? <Loader2 size={15} className="dashboard-spin"/> : <Check size={15}/>} {editing ? 'Lưu thay đổi' : 'Thêm ghi chú'}</button></footer></form></section></div>}
  </section>;
}
