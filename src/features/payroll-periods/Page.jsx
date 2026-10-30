import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  CalendarRange, Plus, RefreshCw, Search, Edit3, Eye, X, Save, AlertCircle,
  CheckCircle2, Download, Upload, FileSpreadsheet, Settings2, Archive, Users, Trash2
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../shared/supabase.js';
import './payroll-periods.css';

const TABLE = 'payroll_periods';
const COLUMN_TABLE = 'payroll_period_custom_columns';
const VALUE_TABLE = 'payroll_period_custom_values';
const today = () => new Date().toISOString().slice(0, 10);
const monthNow = () => new Date().toISOString().slice(0, 7);
const makeCode = (type, month, count = 1) => `${type === 'FIXED' ? 'KL' : 'PS'}-${String(month || monthNow()).replace('-', '')}${count > 1 ? `-${String(count).padStart(2, '0')}` : ''}`;
const statusLabel = { DRAFT: 'Bản nháp', OPEN: 'Đang mở', CLOSED: 'Đã đóng' };
const statusClass = { DRAFT: 'draft', OPEN: 'open', CLOSED: 'closed' };
const dateLabel = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN') : '—';
const monthLabel = value => value ? new Date(`${value}-01T00:00:00`).toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' }) : '—';
const clean = value => String(value ?? '').trim();
const normHeader = value => clean(value).toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim();
const employeeCode = row => clean(row.employee_code || row.code || row.ma_nhan_vien || row['Mã Nhân Viên']).toUpperCase();
const employeeName = row => row.full_name || row.name || row.employee_name || row['Họ và Tên'] || employeeCode(row) || 'Chưa có tên';
const inactive = row => /nghi|inactive|terminated|resigned|da nghi/i.test(String(row.status || row.employment_status || ''));
const defaultForm = type => ({ type, name: '', month: monthNow(), start_date: `${monthNow()}-01`, end_date: '', description: '', status: 'DRAFT', salary_version_id: '', salary_rate_version_id: '' });
const DEFAULT_COLUMNS = [
  { key: 'meal', label: 'Ăn trưa', data_type: 'currency', required: false, display_order: 1, is_active: true },
  { key: 'phone', label: 'Điện thoại', data_type: 'currency', required: false, display_order: 2, is_active: true },
  { key: 'uniform', label: 'Đồng phục', data_type: 'currency', required: false, display_order: 3, is_active: true },
];
const formatNumber = value => Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

export default function Page() {
  const [tab, setTab] = useState('FIXED');
  const [periods, setPeriods] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [periodEmployeeIds, setPeriodEmployeeIds] = useState([]);
  const [employeePickerSearch, setEmployeePickerSearch] = useState('');
  const [loadingPeriodEmployees, setLoadingPeriodEmployees] = useState(false);
  const [salaryPolicies, setSalaryPolicies] = useState([]);
  const [salaryRateVersions, setSalaryRateVersions] = useState([]);
  const [columns, setColumns] = useState([]);
  const [values, setValues] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm('FIXED'));
  const [editingId, setEditingId] = useState(null);
  const [showColumns, setShowColumns] = useState(false);
  const [columnForm, setColumnForm] = useState({ key: '', label: '', data_type: 'currency', required: false });
  const [editingColumnId, setEditingColumnId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [importReport, setImportReport] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(async (preserveSelected = true) => {
    if (!supabase || !isSupabaseConfigured) { setError('Chưa cấu hình Supabase. Không thể tải hoặc lưu kỳ lương.'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [periodResult, employeeResult, policyResult, rateVersionResult] = await Promise.all([
        supabase.from(TABLE).select('*').order('created_at', { ascending: false }),
        supabase.from('employees').select('*').order('employee_code', { ascending: true, nullsFirst: false }),
        supabase.from('salary_policy_versions').select('id,code,name,status,effective_from,effective_to').order('effective_from', { ascending: false }),
        supabase.from('salary_rate_versions').select('id,policy_version_id,code,name').order('created_at', { ascending: true }),
      ]);
      if (periodResult.error) throw periodResult.error;
      if (employeeResult.error) throw new Error(`Không tải được Nhân Sự Master: ${employeeResult.error.message}`);
      if (policyResult.error) throw new Error(`Không tải được Chính Sách Lương: ${policyResult.error.message}`);
      if (rateVersionResult.error) throw new Error(`Không tải được Phiên Bản Định Mức: ${rateVersionResult.error.message}`);
      setPeriods(periodResult.data || []);
      setEmployees(employeeResult.data || []);
      setSalaryPolicies(policyResult.data || []);
      setSalaryRateVersions(rateVersionResult.data || []);
      if (preserveSelected && selected) {
        const current = (periodResult.data || []).find(p => p.id === selected.id);
        if (current) setSelected(current); else setSelected(null);
      }
    } catch (e) { setError(`Không tải được dữ liệu kỳ lương: ${e.message}. Kiểm tra migration và quyền RLS.`); }
    finally { setLoading(false); }
  }, [selected]);

  const loadDetails = useCallback(async period => {
    if (!period || !supabase) return;
    setSelected(period); setError(''); setImportReport(null);
    if (period.type !== 'EVENT') { setColumns([]); setValues([]); return; }
    try {
      const [columnResult, valueResult] = await Promise.all([
        supabase.from(COLUMN_TABLE).select('*').eq('period_id', period.id).order('display_order', { ascending: true }),
        supabase.from(VALUE_TABLE).select('*').eq('period_id', period.id),
      ]);
      if (columnResult.error) throw columnResult.error;
      if (valueResult.error) throw valueResult.error;
      setColumns(columnResult.data || []); setValues(valueResult.data || []);
    } catch (e) { setError(`Không tải được chi tiết kỳ phát sinh: ${e.message}`); }
  }, []);

  useEffect(() => { load(false); }, []); // initial load only

  const visiblePeriods = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('vi');
    return periods.filter(p => p.type === (tab === 'FIXED' ? 'FIXED' : 'EVENT'))
      .filter(p => statusFilter === 'ALL' || p.status === statusFilter)
      .filter(p => !q || [p.code, p.name, p.description, p.month].some(v => String(v || '').toLocaleLowerCase('vi').includes(q)))
      .sort((a, b) => String(b.month || b.start_date || b.created_at || '').localeCompare(String(a.month || a.start_date || a.created_at || '')));
  }, [periods, tab, statusFilter, search]);

  const selectableEmployees = useMemo(() => {
    const q = employeePickerSearch.trim().toLocaleLowerCase('vi');
    return employees.filter(e => (!inactive(e) || periodEmployeeIds.includes(e.id)) && employeeCode(e))
      .filter(e => !q || [employeeCode(e), employeeName(e), e.department, e.position, e.job_title].some(v => String(v || '').toLocaleLowerCase('vi').includes(q)))
      .sort((a,b) => employeeCode(a).localeCompare(employeeCode(b),'vi'));
  }, [employees, employeePickerSearch, periodEmployeeIds]);

  const openCreate = () => {
    setEditingId(null); setForm(defaultForm(tab)); setEmployeePickerSearch('');
    setPeriodEmployeeIds(tab === 'FIXED' ? employees.filter(e => !inactive(e) && employeeCode(e)).map(e => e.id) : []);
    setShowForm(true); setSelected(null); setError(''); setMessage('');
  };
  const openEdit = async period => {
    setEditingId(period.id);
    setForm({ type: period.type, name: period.name || '', month: period.month || monthNow(), start_date: period.start_date || `${period.month || monthNow()}-01`, end_date: period.end_date || '', description: period.description || '', status: period.status || 'DRAFT', salary_version_id: period.salary_version_id || '', salary_rate_version_id: period.salary_rate_version_id || '' });
    setEmployeePickerSearch(''); setShowForm(true); setError(''); setMessage('');
    if (period.type === 'FIXED') {
      setLoadingPeriodEmployees(true);
      try {
        const { data, error: membershipError } = await supabase.from('payroll_period_employees').select('employee_id').eq('period_id', period.id);
        if (membershipError) throw membershipError;
        setPeriodEmployeeIds((data || []).map(x => x.employee_id));
      } catch (e) {
        setError(`Không tải được danh sách nhân sự của kỳ: ${e.message}`);
        setPeriodEmployeeIds([]);
      } finally { setLoadingPeriodEmployees(false); }
    } else setPeriodEmployeeIds([]);
  };
  const savePeriod = async event => {
    event.preventDefault(); if (!supabase || saving) return;
    if (!form.name.trim()) { setError('Vui lòng nhập tên kỳ.'); return; }
    if (form.type === 'FIXED' && !form.month) { setError('Vui lòng chọn tháng/năm kỳ lương.'); return; }
    if (!form.salary_version_id) { setError('Vui lòng chọn Chính Sách Lương áp dụng cho kỳ này.'); return; }
    if (!form.salary_rate_version_id) { setError('Vui lòng chọn Phiên Bản Định Mức áp dụng cho kỳ này.'); return; }
    const chosenRateVersion = salaryRateVersions.find(v => v.id === form.salary_rate_version_id && v.policy_version_id === form.salary_version_id);
    if (!chosenRateVersion) { setError('Phiên Bản Định Mức không thuộc Chính Sách Lương đã chọn.'); return; }
    const chosenPolicy = salaryPolicies.find(p => p.id === form.salary_version_id);
    if (!chosenPolicy) { setError('Chính Sách Lương đã chọn không còn tồn tại. Vui lòng tải lại danh sách và chọn lại.'); return; }
    if (!editingId && String(chosenPolicy.status).toUpperCase() !== 'ACTIVE') { setError('Chỉ được tạo kỳ mới với Chính Sách Lương đang hoạt động.'); return; }
    if (form.end_date && form.start_date && form.end_date < form.start_date) { setError('Ngày kết thúc không được trước ngày bắt đầu.'); return; }
    if (form.type === 'FIXED') {
      const duplicate = periods.find(p => p.type === 'FIXED' && p.month === form.month && p.id !== editingId);
      if (duplicate) { setError(`Đã tồn tại kỳ lương cố định ${monthLabel(form.month)} (${duplicate.code}). Mỗi tháng chỉ có một kỳ.`); return; }
    }
    if (editingId && form.type === 'FIXED') {
      const existingPeriod = periods.find(p => p.id === editingId);
      if (String(existingPeriod?.status || '').toUpperCase() === 'CLOSED') {
        const { data: currentMembership, error: membershipReadError } = await supabase.from('payroll_period_employees').select('employee_id').eq('period_id', editingId);
        if (membershipReadError) { setError(`Không kiểm tra được danh sách nhân sự hiện tại: ${membershipReadError.message}`); return; }
        const currentIds = new Set((currentMembership || []).map(x => x.employee_id));
        const requestedIds = new Set(periodEmployeeIds);
        if (currentIds.size !== requestedIds.size || [...currentIds].some(id => !requestedIds.has(id))) {
          setError('Kỳ lương đã đóng. Hãy mở lại kỳ trước khi thay đổi danh sách nhân sự.');
          return;
        }
      }
    }
    setSaving(true); setError(''); setMessage('');
    try {
      const currentEmployees = form.type === 'FIXED' ? employees.filter(e => periodEmployeeIds.includes(e.id) && employeeCode(e)) : [];
      const monthForCode = form.month || form.start_date?.slice(0, 7) || monthNow();
      const sameMonthCount = periods.filter(p => p.type === form.type && String(p.month || p.start_date || '').startsWith(monthForCode)).length;
      const code = editingId ? periods.find(p => p.id === editingId)?.code : makeCode(form.type === 'FIXED' ? 'FIXED' : 'EVENT', monthForCode, sameMonthCount + 1);
      const legacyMonth = form.type === 'FIXED' ? form.month : (form.start_date || today()).slice(0, 7);
      const [legacyYear, legacyMonthNumber] = legacyMonth.split('-').map(Number);
      const payload = { code, period_code: code, type: form.type, name: form.name.trim(), salary_version_id: form.salary_version_id, salary_rate_version_id: form.salary_rate_version_id, month: form.type === 'FIXED' ? form.month : null, period_year: legacyYear, period_month: legacyMonthNumber, start_date: form.start_date || null, end_date: form.end_date || null, description: form.description.trim() || null, status: editingId ? form.status : 'DRAFT', employee_count: editingId ? (periods.find(p => p.id === editingId)?.employee_count || 0) : currentEmployees.length, updated_at: new Date().toISOString() };
      let result;
      if (editingId) result = await supabase.from(TABLE).update(payload).eq('id', editingId).select('*').single();
      else result = await supabase.from(TABLE).insert(payload).select('*').single();
      if (result.error) throw result.error;
      const period = result.data;
      if (form.type === 'FIXED') {
        // Chỉ cập nhật membership của kỳ; không chạm attendance/payroll snapshots hay Employee Master.
        const { data: existingMembership, error: existingMembershipError } = await supabase
          .from('payroll_period_employees').select('employee_id').eq('period_id', period.id);
        if (existingMembershipError) throw new Error(`Không đọc được danh sách nhân sự hiện tại: ${existingMembershipError.message}`);
        const existingIds = new Set((existingMembership || []).map(x => x.employee_id));
        const desiredIds = new Set(currentEmployees.map(x => x.id));
        const removeIds = [...existingIds].filter(id => !desiredIds.has(id));
        const addEmployees = currentEmployees.filter(x => !existingIds.has(x.id));
        if (removeIds.length) {
          const { error: deleteMembershipError } = await supabase.from('payroll_period_employees').delete().eq('period_id', period.id).in('employee_id', removeIds);
          if (deleteMembershipError) throw new Error(`Không thể bỏ nhân sự khỏi kỳ: ${deleteMembershipError.message}`);
        }
        if (addEmployees.length) {
          const snapshots = addEmployees.map(e => ({ period_id: period.id, employee_id: e.id, employee_code: employeeCode(e), employee_name: employeeName(e), department: e.department || e['Phòng Ban'] || null, position: e.position || e.job_title || e['Chức Vụ'] || null }));
          const snapshotResult = await supabase.from('payroll_period_employees').insert(snapshots);
          if (snapshotResult.error) throw new Error(`Đã lưu thông tin kỳ nhưng chưa cập nhật đủ nhân sự: ${snapshotResult.error.message}`);
        }
        const countUpdate = await supabase.from(TABLE).update({ employee_count: currentEmployees.length }).eq('id', period.id);
        if (countUpdate.error) throw new Error(`Không cập nhật được số lượng nhân sự: ${countUpdate.error.message}`);
      }
      if (!editingId && form.type === 'EVENT') {
        const seeded = DEFAULT_COLUMNS.map((c, i) => ({ period_id: period.id, key: c.key, label: c.label, data_type: c.data_type, is_required: c.required, display_order: i + 1, is_active: true }));
        const colResult = await supabase.from(COLUMN_TABLE).insert(seeded).select('*');
        if (colResult.error) throw new Error(`Đã tạo kỳ nhưng chưa tạo được cột mặc định: ${colResult.error.message}`);
      }
      setShowForm(false); setEditingId(null); setMessage(editingId ? 'Đã cập nhật thông tin kỳ.' : `Đã tạo ${form.type === 'FIXED' ? 'kỳ lương cố định và chốt danh sách nhân sự' : 'kỳ phát sinh'}.`);
      await load(false);
      if (form.type === 'EVENT') await loadDetails(period);
    } catch (e) { setError(`Không lưu được kỳ lương: ${e.message}`); }
    finally { setSaving(false); }
  };

  const changeStatus = async (period, nextStatus) => {
    if (!supabase || period.status === nextStatus) return;
    const prompt = nextStatus === 'CLOSED' ? 'Đóng kỳ này? Hãy chắc chắn các thao tác nhập liệu đã hoàn tất.' : nextStatus === 'OPEN' ? 'Mở kỳ này để tiếp tục nhập liệu?' : 'Chuyển kỳ về bản nháp?';
    if (!window.confirm(prompt)) return;
    // Clear previous alerts so a stale success message cannot remain beside a new error.
    setError('');
    setMessage('');
    const { error: updateError } = await supabase.from(TABLE).update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', period.id);
    if (updateError) { setError(`Không cập nhật được trạng thái: ${updateError.message}`); return; }
    setMessage(`Đã cập nhật trạng thái kỳ ${period.code}.`);
    await load(false);
    if (selected?.id === period.id) setSelected({ ...period, status: nextStatus });
  };

  const deletePeriod = async period => {
    if (!supabase || saving) return;
    const label = period.code || period.name || 'kỳ lương này';
    if (!window.confirm(`XÓA KỲ ${label}?\n\nThao tác này không thể hoàn tác. Hệ thống sẽ chỉ xóa kỳ nếu chưa có dữ liệu nghiệp vụ liên kết; nếu đã phát sinh dữ liệu, thao tác sẽ bị chặn để bảo vệ lịch sử chấm công và tính lương.`)) return;
    setSaving(true); setError(''); setMessage('');
    try {
      // Membership rows are created automatically when a period is created.
      // They may be removed with the period, but actual attendance/payroll data must be preserved.
      const dependencies = [
        ['teaching_attendance_records', 'Chấm Công Tiết Dạy'],
        ['daily_attendance_records', 'Chấm công ngày'],
        ['payroll_period_insurance_tax_data', 'Dữ liệu BHXH/thuế'],
        ['payroll_adjustments', 'Khoản cộng/trừ'],
        [COLUMN_TABLE, 'Cột dữ liệu kỳ phát sinh'],
        [VALUE_TABLE, 'Dữ liệu kỳ phát sinh'],
      ];
      const linked = [];
      for (const [table, title] of dependencies) {
        const { count, error: checkError } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('period_id', period.id);
        if (checkError) throw new Error(`Không thể kiểm tra dữ liệu liên kết ở bảng ${table}: ${checkError.message}. Để an toàn, kỳ chưa bị xóa.`);
        if ((count || 0) > 0) linked.push(`${title}: ${count}`);
      }
      if (linked.length) {
        setError(`Không thể xóa kỳ ${label} vì đã có dữ liệu liên kết (${linked.join('; ')}). Hãy giữ kỳ để bảo toàn dữ liệu lịch sử.`);
        return;
      }
      // The employee list/snapshot is part of the period setup, not payroll history by itself.
      // Delete only these membership rows after confirming no period-scoped business records exist.
      for (const table of ['payroll_period_employees', 'payroll_period_employee_snapshots']) {
        const { error: membershipDeleteError } = await supabase.from(table).delete().eq('period_id', period.id);
        if (membershipDeleteError) {
          throw new Error(`Không thể xóa danh sách nhân sự kỳ trong bảng ${table}: ${membershipDeleteError.message}. Kỳ lương chưa được xóa.`);
        }
      }
      // Supabase/Postgres RLS can silently affect zero rows on DELETE without returning an error.
      // Request the deleted ID so the UI only reports success when the database confirms deletion.
      const { data: deletedRows, error: deleteError } = await supabase
        .from(TABLE)
        .delete()
        .eq('id', period.id)
        .select('id');
      if (deleteError) throw deleteError;
      if (!deletedRows || deletedRows.length === 0) {
        throw new Error(`Supabase không xóa bản ghi kỳ ${label}. Khả năng cao quyền DELETE/RLS trên bảng ${TABLE} chưa cho phép tài khoản hiện tại xóa. Danh sách nhân sự kỳ đã được dọn trước đó; bản ghi kỳ vẫn được giữ nguyên. Cần kiểm tra policy DELETE của bảng payroll_periods.`);
      }
      if (selected?.id === period.id) setSelected(null);
      setMessage(`Đã xóa kỳ ${label}.`);
      await load(false);
    } catch (e) {
      setError(`Không xóa được kỳ ${label}: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveColumn = async event => {
    event.preventDefault(); if (!supabase || !selected || selected.type !== 'EVENT') return;
    const label = columnForm.label.trim(); if (!label) { setError('Vui lòng nhập tên cột.'); return; }
    const key = editingColumnId ? columns.find(c => c.id === editingColumnId)?.key : (columnForm.key.trim() || `field_${Date.now()}`);
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) { setError('Mã cột chỉ dùng chữ không dấu, số và dấu gạch dưới; bắt đầu bằng chữ.'); return; }
    if (columns.some(c => c.key === key && c.id !== editingColumnId)) { setError('Mã cột đã tồn tại trong kỳ này.'); return; }
    setSaving(true); setError('');
    const payload = { period_id: selected.id, key, label, data_type: columnForm.data_type, is_required: Boolean(columnForm.required), display_order: editingColumnId ? (columns.find(c => c.id === editingColumnId)?.display_order || columns.length + 1) : columns.length + 1, is_active: true, updated_at: new Date().toISOString() };
    const result = editingColumnId ? await supabase.from(COLUMN_TABLE).update(payload).eq('id', editingColumnId).select('*').single() : await supabase.from(COLUMN_TABLE).insert(payload).select('*').single();
    if (result.error) { setError(`Không lưu được cấu hình cột: ${result.error.message}`); setSaving(false); return; }
    setColumns(old => editingColumnId ? old.map(c => c.id === editingColumnId ? result.data : c) : [...old, result.data].sort((a,b) => a.display_order-b.display_order));
    setColumnForm({ key: '', label: '', data_type: 'currency', required: false }); setEditingColumnId(null); setSaving(false); setMessage('Đã lưu cấu hình cột.');
  };

  const editColumn = col => { setEditingColumnId(col.id); setColumnForm({ key: col.key, label: col.label, data_type: col.data_type || 'text', required: Boolean(col.is_required) }); };
  const toggleColumn = async col => {
    if (!supabase) return;
    const { error: e } = await supabase.from(COLUMN_TABLE).update({ is_active: !col.is_active, updated_at: new Date().toISOString() }).eq('id', col.id);
    if (e) { setError(`Không cập nhật được cột: ${e.message}`); return; }
    setColumns(old => old.map(c => c.id === col.id ? { ...c, is_active: !c.is_active } : c));
  };
  const moveColumn = async (col, direction) => {
    const ordered = [...columns].sort((a,b) => a.display_order-b.display_order); const index = ordered.findIndex(c => c.id === col.id); const target = index + direction;
    if (target < 0 || target >= ordered.length || !supabase) return;
    const a = ordered[index], b = ordered[target];
    const results = await Promise.all([
      supabase.from(COLUMN_TABLE).update({ display_order: b.display_order, updated_at: new Date().toISOString() }).eq('id', a.id),
      supabase.from(COLUMN_TABLE).update({ display_order: a.display_order, updated_at: new Date().toISOString() }).eq('id', b.id),
    ]);
    const failed = results.find(r => r.error); if (failed) { setError(`Không sắp xếp được cột: ${failed.error.message}`); return; }
    setColumns(ordered.map(c => c.id === a.id ? { ...c, display_order: b.display_order } : c.id === b.id ? { ...c, display_order: a.display_order } : c).sort((x,y) => x.display_order-y.display_order));
  };

  const importExcel = async event => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file || !selected || selected.type !== 'EVENT' || !supabase) return;
    setError(''); setMessage(''); setImportReport(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]]; const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!rows.length) throw new Error('File Excel không có dòng dữ liệu.');
      const employeeMap = new Map(employees.map(e => [employeeCode(e), e]).filter(([code]) => code));
      const activeColumns = columns.filter(c => c.is_active);
      const headers = Object.keys(rows[0] || {}); const codeHeader = headers.find(h => ['ma nhan vien','ma nv','employee code','employee code'].includes(normHeader(h)));
      if (!codeHeader) throw new Error('Không tìm thấy cột Mã Nhân Viên trong file Excel.');
      const headerForColumn = new Map(activeColumns.map(c => [c.id, headers.find(h => normHeader(h) === normHeader(c.label) || normHeader(h) === normHeader(c.key))]));
      const errors = []; const payloads = []; const seen = new Set();
      rows.forEach((row, index) => {
        const code = clean(row[codeHeader]).toUpperCase(); if (!code) { errors.push({ row: index + 2, reason: 'Thiếu Mã Nhân Viên' }); return; }
        if (seen.has(code)) { errors.push({ row: index + 2, reason: `Mã ${code} bị trùng trong file` }); return; } seen.add(code);
        const employee = employeeMap.get(code); if (!employee) { errors.push({ row: index + 2, reason: `Không tìm thấy ${code} trong Nhân Sự Master` }); return; }
        const data = {};
        activeColumns.forEach(col => {
          const header = headerForColumn.get(col.id); if (!header) return;
          const raw = row[header];
          if (col.data_type === 'currency' || col.data_type === 'number') {
            if (raw === '' || raw === null || raw === undefined) data[col.key] = 0;
            else if (typeof raw === 'number') data[col.key] = raw;
            else { const parsed = Number(String(raw).replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.').replace(/[^\d.-]/g, '')); data[col.key] = Number.isFinite(parsed) ? parsed : null; }
            if (data[col.key] === null) errors.push({ row: index + 2, reason: `Giá trị không hợp lệ tại cột ${col.label}` });
          } else data[col.key] = clean(raw);
          if (col.is_required && (data[col.key] === '' || data[col.key] === null || data[col.key] === undefined)) errors.push({ row: index + 2, reason: `Thiếu dữ liệu bắt buộc: ${col.label}` });
        });
        payloads.push({ period_id: selected.id, employee_id: employee.id, employee_code: code, employee_name: employeeName(employee), data_values: data, updated_at: new Date().toISOString() });
      });
      if (errors.length) { setImportReport({ total: rows.length, success: 0, errors }); setError('Import chưa ghi dữ liệu vì file có dòng lỗi. Sửa các lỗi bên dưới rồi import lại để tránh cập nhật một phần.'); return; }
      for (const payload of payloads) {
        const result = await supabase.from(VALUE_TABLE).upsert(payload, { onConflict: 'period_id,employee_id' });
        if (result.error) throw result.error;
      }
      setImportReport({ total: rows.length, success: payloads.length, errors: [] }); setMessage(`Import thành công ${payloads.length} dòng theo Mã Nhân Viên.`);
      const { data: refreshed, error: refreshError } = await supabase.from(VALUE_TABLE).select('*').eq('period_id', selected.id);
      if (refreshError) throw refreshError; setValues(refreshed || []);
    } catch (e) { setError(`Import Excel thất bại: ${e.message}`); }
  };

  const downloadTemplate = () => {
    if (!selected || selected.type !== 'EVENT') return;
    const activeColumns = columns.filter(c => c.is_active);
    const data = [{ 'Mã Nhân Viên': '', ...Object.fromEntries(activeColumns.map(c => [c.label, c.data_type === 'currency' || c.data_type === 'number' ? 0 : ''])) }];
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'DuLieu');
    const guide = [['Hướng dẫn'], ['Nhập đúng Mã Nhân Viên từ Nhân Sự Master.'], ['Tên cột phải giữ nguyên theo template.'], ['Không xóa hoặc đổi tên cột Mã Nhân Viên.'], ['Dòng mẫu chỉ để hướng dẫn; xóa dòng mẫu trước khi import dữ liệu thật.']];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(guide), 'HuongDan'); XLSX.writeFile(wb, `${selected.code}-template.xlsx`);
  };
  const exportExcel = () => {
    if (!selected || selected.type !== 'EVENT') return;
    const employeeMap = new Map(employees.map(e => [e.id, e])); const activeColumns = columns.filter(c => c.is_active);
    const data = values.map(v => ({ 'Mã Nhân Viên': v.employee_code, 'Họ và Tên': v.employee_name || employeeName(employeeMap.get(v.employee_id) || {}), ...Object.fromEntries(activeColumns.map(c => [c.label, v.data_values?.[c.key] ?? (c.data_type === 'currency' || c.data_type === 'number' ? 0 : '')])) }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'DuLieu'); XLSX.writeFile(wb, `${selected.code}.xlsx`);
  };

  const activeColumns = columns.filter(c => c.is_active).sort((a,b) => a.display_order-b.display_order);
  const selectedValueMap = useMemo(() => new Map(values.map(v => [v.employee_id, v])), [values]);

  return <section className="pp-page">
    <div className="pp-heading"><div className="pp-heading-icon"><CalendarRange size={22}/></div><div><div className="eyebrow">KHÔNG GIAN NGHIỆP VỤ</div><h2>Quản Lý Kỳ Lương</h2><p>Tạo và quản lý kỳ lương tháng cố định hoặc kỳ phát sinh có cấu hình dữ liệu linh hoạt.</p></div><button className="pp-button secondary" onClick={() => load()} disabled={loading}><RefreshCw size={15}/> Làm mới</button></div>
    <div className="pp-note"><CalendarRange size={18}/><div><strong>Nguyên tắc quản lý kỳ</strong><p>Kỳ cố định chốt danh sách nhân sự tại thời điểm tạo và không sao chép chấm công kỳ trước. Kỳ phát sinh có bộ cột riêng; dữ liệu lưu theo từng kỳ trên Supabase.</p></div></div>
    {error && <div className="pp-alert error" role="alert"><AlertCircle size={17}/><span>{error}</span><button onClick={() => setError('')} aria-label="Đóng"><X size={15}/></button></div>}
    {message && <div className="pp-alert success" role="status"><CheckCircle2 size={17}/><span>{message}</span><button onClick={() => setMessage('')} aria-label="Đóng"><X size={15}/></button></div>}
    {!isSupabaseConfigured && <div className="pp-alert error"><AlertCircle size={17}/>Chưa cấu hình Supabase. Module không sử dụng dữ liệu giả hoặc LocalStorage.</div>}

    <div className="pp-tabs" role="tablist"><button className={tab === 'FIXED' ? 'active' : ''} onClick={() => { setTab('FIXED'); setSelected(null); setShowForm(false); setError(''); }} role="tab"><CalendarRange size={16}/>Kỳ Lương Tháng Cố Định <span>{periods.filter(p => p.type === 'FIXED').length}</span></button><button className={tab === 'EVENT' ? 'active' : ''} onClick={() => { setTab('EVENT'); setSelected(null); setShowForm(false); setError(''); }} role="tab"><FileSpreadsheet size={16}/>Kỳ Phát Sinh <span>{periods.filter(p => p.type === 'EVENT').length}</span></button></div>

    <div className="pp-toolbar"><div className="pp-toolbar-actions"><button className="pp-button primary" onClick={openCreate}><Plus size={15}/> Tạo {tab === 'FIXED' ? 'Kỳ Lương' : 'Kỳ Phát Sinh'}</button><button className="pp-button secondary" onClick={() => load()} disabled={loading}><RefreshCw size={15}/> Làm mới</button></div><div className="pp-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã kỳ, tên kỳ…"/></div><select aria-label="Lọc trạng thái" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="ALL">Tất cả trạng thái</option><option value="DRAFT">Bản nháp</option><option value="OPEN">Đang mở</option><option value="CLOSED">Đã đóng</option></select></div>

    {showForm && <section className="pp-card"><div className="pp-card-heading"><div><h3>{editingId ? 'Chỉnh sửa kỳ' : tab === 'FIXED' ? 'Tạo Kỳ Lương Tháng Cố Định' : 'Tạo Kỳ Phát Sinh'}</h3><p>{editingId ? 'Chỉ cập nhật thông tin kỳ, không tạo lại snapshot nhân sự.' : tab === 'FIXED' ? 'Mỗi tháng chỉ có một kỳ; danh sách nhân sự được chốt tại thời điểm tạo.' : 'Kỳ phát sinh được tạo độc lập, có thể cấu hình cột sau khi tạo.'}</p></div><button className="pp-icon-button" onClick={() => setShowForm(false)} aria-label="Đóng"><X size={16}/></button></div>
      <form className="pp-form" onSubmit={savePeriod}>
        {tab === 'FIXED' && <label>Tháng/năm <span>*</span><input type="month" required value={form.month} disabled={Boolean(editingId)} onChange={e => setForm(v => ({ ...v, month: e.target.value, start_date: `${e.target.value}-01` }))}/></label>}
        <label className="pp-form-wide">Chính Sách Lương áp dụng <span>*</span><select required value={form.salary_version_id} disabled={Boolean(editingId)} onChange={e => { const policyId=e.target.value; const first=salaryRateVersions.find(v=>v.policy_version_id===policyId); setForm(v => ({ ...v, salary_version_id: policyId, salary_rate_version_id: first?.id || '' })); }}><option value="">-- Chọn chính sách lương --</option>{salaryPolicies.filter(p => String(p.status).toUpperCase() === 'ACTIVE' || p.id === form.salary_version_id).map(p => <option key={p.id} value={p.id}>{p.code} — {p.name} ({dateLabel(p.effective_from)}{p.effective_to ? ` đến ${dateLabel(p.effective_to)}` : ' trở đi'})</option>)}</select>{!salaryPolicies.some(p => String(p.status).toUpperCase() === 'ACTIVE') && <small>Chưa có chính sách lương đang hoạt động. Hãy tạo/kích hoạt chính sách trước.</small>}</label>
        <label className="pp-form-wide">Phiên Bản Định Mức áp dụng <span>*</span><select required value={form.salary_rate_version_id} disabled={Boolean(editingId)} onChange={e=>setForm(v=>({...v,salary_rate_version_id:e.target.value}))}><option value="">-- Chọn phiên bản định mức --</option>{salaryRateVersions.filter(v=>v.policy_version_id===form.salary_version_id).map(v=><option key={v.id} value={v.id}>{v.code} — {v.name}</option>)}</select><small>Kỳ lương sẽ sử dụng đúng bộ định mức của phiên bản này.</small></label>
        <label className="pp-form-wide">Tên kỳ <span>*</span><input required maxLength={180} value={form.name} placeholder={tab === 'FIXED' ? 'VD: Kỳ lương tháng 09/2026' : 'VD: Kỳ thưởng thành tích 2026'} onChange={e => setForm(v => ({ ...v, name: e.target.value }))}/></label>
        <label>Ngày bắt đầu<input type="date" value={form.start_date || ''} onChange={e => setForm(v => ({ ...v, start_date: e.target.value }))}/></label><label>Ngày kết thúc<input type="date" min={form.start_date || undefined} value={form.end_date || ''} onChange={e => setForm(v => ({ ...v, end_date: e.target.value }))}/></label>
        <label>Trạng thái<select value={editingId ? form.status : 'DRAFT'} disabled={!editingId} onChange={e => setForm(v => ({ ...v, status: e.target.value }))}><option value="DRAFT">Bản nháp</option><option value="OPEN">Đang mở</option><option value="CLOSED">Đã đóng</option></select></label>
        {form.type === 'FIXED' && <div className="pp-form-wide pp-employee-selector">
          <div className="pp-employee-selector-head"><div><strong>Nhân sự được tính lương trong kỳ</strong><small>Đã chọn {periodEmployeeIds.length}/{employees.filter(e => !inactive(e) && employeeCode(e)).length} nhân sự đang hoạt động. Danh sách này độc lập với Employee Master.</small></div>
            <div className="pp-employee-selector-actions"><button type="button" className="pp-button secondary" disabled={Boolean(editingId && String(periods.find(p => p.id === editingId)?.status || '').toUpperCase() === 'CLOSED')} onClick={() => setPeriodEmployeeIds(employees.filter(e => !inactive(e) && employeeCode(e)).map(e => e.id))}>Chọn tất cả</button><button type="button" className="pp-button secondary" disabled={Boolean(editingId && String(periods.find(p => p.id === editingId)?.status || '').toUpperCase() === 'CLOSED')} onClick={() => setPeriodEmployeeIds([])}>Bỏ chọn tất cả</button></div>
          </div>
          <div className="pp-employee-search"><Search size={15}/><input value={employeePickerSearch} onChange={e => setEmployeePickerSearch(e.target.value)} placeholder="Tìm mã nhân viên, họ tên, vị trí..."/></div>
          {loadingPeriodEmployees ? <div className="pp-employee-empty">Đang tải danh sách nhân sự của kỳ...</div> : <div className="pp-employee-list">
            {selectableEmployees.map(e => <label key={e.id} className="pp-employee-option"><input type="checkbox" checked={periodEmployeeIds.includes(e.id)} disabled={Boolean(editingId && String(periods.find(p => p.id === editingId)?.status || '').toUpperCase() === 'CLOSED')} onChange={ev => setPeriodEmployeeIds(old => ev.target.checked ? [...old,e.id] : old.filter(id => id !== e.id))}/><strong>{employeeCode(e)}</strong><span>{employeeName(e)}</span><small>{e.position || e.job_title || '—'}{e.department ? ` · ${e.department}` : ''}</small></label>)}
            {selectableEmployees.length === 0 && <div className="pp-employee-empty">Không tìm thấy nhân sự phù hợp.</div>}
          </div>}
          {editingId && <small className="pp-employee-warning">Khi lưu, chỉ thay đổi danh sách nhân sự của kỳ này. Dữ liệu chấm công, kết quả tính lương và các kỳ khác không bị xóa hoặc thay đổi.</small>}
        </div>}
        <label className="pp-form-wide">Mô tả / mục đích<textarea rows={2} maxLength={1000} value={form.description} placeholder="Thông tin bổ sung (không bắt buộc)" onChange={e => setForm(v => ({ ...v, description: e.target.value }))}/></label>
        <div className="pp-form-actions pp-form-wide"><button className="pp-button primary" type="submit" disabled={saving || !isSupabaseConfigured}><Save size={15}/>{saving ? 'Đang lưu…' : editingId ? 'Lưu thay đổi' : 'Tạo kỳ nháp'}</button><button type="button" className="pp-button secondary" onClick={() => setShowForm(false)}>Hủy</button></div>
      </form></section>}

    <section className="pp-card"><div className="pp-card-heading"><div><h3>{tab === 'FIXED' ? 'Danh sách kỳ lương tháng cố định' : 'Danh sách kỳ phát sinh'}</h3><p>{visiblePeriods.length} kỳ trong danh sách · {periods.filter(p => p.type === (tab === 'FIXED' ? 'FIXED' : 'EVENT')).length} tổng cộng</p></div></div>
      <div className="pp-table-wrap"><table className="pp-table"><thead><tr><th>Mã kỳ</th><th>Tên kỳ</th><th>{tab === 'FIXED' ? 'Tháng lương' : 'Thời gian'}</th><th>Nhân sự</th><th>Trạng thái</th><th>Mô tả</th><th>Thao tác</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="7" className="pp-empty">Đang tải dữ liệu từ Supabase…</td></tr> : visiblePeriods.length ? visiblePeriods.map(period => <tr key={period.id} className={selected?.id === period.id ? 'selected' : ''}>
          <td><strong>{period.code}</strong></td><td><span className="pp-period-name">{period.name}</span></td><td>{tab === 'FIXED' ? monthLabel(period.month) : `${dateLabel(period.start_date)} – ${dateLabel(period.end_date)}`}</td><td>{period.type === 'FIXED' ? <span className="pp-count"><Users size={13}/>{period.employee_count ?? '—'}</span> : <span className="pp-count"><Users size={13}/>{values.length && selected?.id === period.id ? values.length : '—'}</span>}</td>
          <td><span className={`pp-status ${statusClass[period.status] || 'draft'}`}>{statusLabel[period.status] || period.status || 'Bản nháp'}</span></td><td className="pp-description">{period.description || '—'}</td><td><div className="pp-row-actions"><button className="pp-icon-button" title="Xem chi tiết" onClick={() => loadDetails(period)}><Eye size={15}/></button><button className="pp-icon-button" title="Sửa thông tin" onClick={() => openEdit(period)}><Edit3 size={15}/></button>{period.status !== 'CLOSED' ? <button className="pp-button small secondary" onClick={() => changeStatus(period, 'CLOSED')}>Đóng kỳ</button> : <button className="pp-button small secondary" onClick={() => changeStatus(period, 'OPEN')}>Mở kỳ</button>}<button className="pp-button small secondary" title="Xóa kỳ lương" onClick={() => deletePeriod(period)} disabled={saving}><Trash2 size={13}/> Xóa</button></div></td>
        </tr>) : <tr><td colSpan="7" className="pp-empty">{error ? 'Không thể hiển thị dữ liệu khi kết nối chưa sẵn sàng.' : 'Chưa có kỳ phù hợp. Bấm “Tạo Kỳ” để bắt đầu.'}</td></tr>}
      </tbody></table></div><p className="pp-footnote">Xóa kỳ chỉ khả dụng khi chưa có dữ liệu nghiệp vụ liên kết. Kỳ đã phát sinh chấm công hoặc dữ liệu lương sẽ được bảo vệ để giữ nguyên lịch sử.</p>
    </section>

    {selected && <section className="pp-card pp-detail"><div className="pp-card-heading"><div><div className="pp-detail-eyebrow">CHI TIẾT KỲ</div><h3>{selected.code} · {selected.name}</h3><p>{selected.type === 'FIXED' ? 'Danh sách nhân sự được chốt tại thời điểm tạo kỳ. Chưa tự động sao chép dữ liệu chấm công hoặc tính lương.' : 'Dữ liệu phát sinh và cấu hình cột được lưu riêng cho kỳ này.'}</p></div><button className="pp-icon-button" onClick={() => setSelected(null)} aria-label="Đóng chi tiết"><X size={16}/></button></div>
      {selected.type === 'FIXED' ? <div className="pp-info-grid"><div><span>Tháng lương</span><strong>{monthLabel(selected.month)}</strong></div><div><span>Ngày bắt đầu</span><strong>{dateLabel(selected.start_date)}</strong></div><div><span>Ngày kết thúc</span><strong>{dateLabel(selected.end_date)}</strong></div><div><span>Trạng thái</span><strong>{statusLabel[selected.status] || selected.status}</strong></div></div> : <>
        <div className="pp-toolbar pp-detail-toolbar"><div className="pp-toolbar-actions"><button className="pp-button secondary" onClick={downloadTemplate}><Download size={15}/> Tải template</button><button className="pp-button secondary" onClick={() => fileRef.current?.click()} disabled={selected.status === 'CLOSED'}><Upload size={15}/> Import Excel</button><button className="pp-button secondary" onClick={exportExcel}><Download size={15}/> Export Excel</button><button className="pp-button secondary" onClick={() => { setShowColumns(v => !v); setColumnForm({ key: '', label: '', data_type: 'currency', required: false }); setEditingColumnId(null); }}><Settings2 size={15}/> Cấu hình cột</button><input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={importExcel}/></div><span className="pp-detail-count">{values.length} dòng dữ liệu</span></div>
        {showColumns && <div className="pp-column-config"><div className="pp-card-heading"><div><h3>{editingColumnId ? 'Sửa cột dữ liệu' : 'Cấu hình cột dữ liệu'}</h3><p>Đổi tên không làm thay đổi khóa dữ liệu; cột ngừng sử dụng vẫn giữ dữ liệu lịch sử.</p></div></div><form className="pp-column-form" onSubmit={saveColumn}><label>Mã cột {!editingColumnId && <span>*</span>}<input value={columnForm.key} disabled={Boolean(editingColumnId)} required={!editingColumnId} placeholder="VD: meal_support" onChange={e => setColumnForm(v => ({ ...v, key: e.target.value }))}/></label><label>Tên hiển thị <span>*</span><input required value={columnForm.label} placeholder="VD: Ăn trưa" onChange={e => setColumnForm(v => ({ ...v, label: e.target.value }))}/></label><label>Kiểu dữ liệu<select value={columnForm.data_type} onChange={e => setColumnForm(v => ({ ...v, data_type: e.target.value }))}><option value="currency">Tiền tệ</option><option value="number">Số</option><option value="text">Văn bản</option><option value="date">Ngày</option></select></label><label className="pp-checkbox"><input type="checkbox" checked={columnForm.required} onChange={e => setColumnForm(v => ({ ...v, required: e.target.checked }))}/> Bắt buộc nhập</label><div className="pp-form-actions"><button className="pp-button primary" type="submit" disabled={saving}><Save size={14}/> {editingColumnId ? 'Lưu cột' : 'Thêm cột'}</button>{editingColumnId && <button className="pp-button secondary" type="button" onClick={() => { setEditingColumnId(null); setColumnForm({ key: '', label: '', data_type: 'currency', required: false }); }}>Hủy sửa</button>}</div></form>
          <div className="pp-column-list">{[...columns].sort((a,b) => a.display_order-b.display_order).map((col, i) => <div className={`pp-column-row ${!col.is_active ? 'inactive' : ''}`} key={col.id}><div><strong>{col.label}</strong><small>{col.key} · {({currency:'Tiền tệ',number:'Số',text:'Văn bản',date:'Ngày'})[col.data_type] || col.data_type}{col.is_required ? ' · Bắt buộc' : ''}</small></div><div className="pp-row-actions"><button className="pp-icon-button" title="Lên" disabled={i === 0} onClick={() => moveColumn(col, -1)}>↑</button><button className="pp-icon-button" title="Xuống" disabled={i === columns.length - 1} onClick={() => moveColumn(col, 1)}>↓</button><button className="pp-icon-button" title="Sửa" onClick={() => editColumn(col)}><Edit3 size={14}/></button><button className="pp-button small secondary" onClick={() => toggleColumn(col)}>{col.is_active ? 'Ngừng dùng' : 'Kích hoạt'}</button></div></div>)}</div>
        </div>}
        {importReport && <div className={`pp-import-report ${importReport.errors.length ? 'has-errors' : ''}`}><strong>{importReport.success ? `Import thành công ${importReport.success}/${importReport.total} dòng.` : `Kiểm tra ${importReport.total} dòng: ${importReport.errors.length} lỗi.`}</strong>{importReport.errors.slice(0, 30).map((item, i) => <div key={`${item.row}-${i}`}>Dòng {item.row}: {item.reason}</div>)}{importReport.errors.length > 30 && <small>Còn {importReport.errors.length - 30} lỗi khác.</small>}</div>}
        <div className="pp-table-wrap">
          <table className="pp-table pp-data-table">
            <thead>
              <tr>
                <th>Mã Nhân Viên</th>
                <th>Họ và Tên</th>
                {activeColumns.map((column) => (
                  <th key={column.id}>{column.label}</th>
                ))}
                <th>Tổng tiền</th>
              </tr>
            </thead>
            <tbody>
              {values.map((value) => {
                const numericTotal = activeColumns
                  .filter((column) => column.data_type === 'currency' || column.data_type === 'number')
                  .reduce((sum, column) => sum + (Number(value.data_values?.[column.key]) || 0), 0);
                const matchedEmployee = employees.find((employee) => employee.id === value.employee_id) || {};
                return (
                  <tr key={value.id}>
                    <td><strong>{value.employee_code}</strong></td>
                    <td>{value.employee_name || employeeName(matchedEmployee)}</td>
                    {activeColumns.map((column) => (
                      <td key={column.id}>
                        {column.data_type === 'currency' || column.data_type === 'number'
                          ? formatNumber(value.data_values?.[column.key] ?? 0)
                          : (value.data_values?.[column.key] || '—')}
                      </td>
                    ))}
                    <td><strong>{formatNumber(numericTotal)}</strong></td>
                  </tr>
                );
              })}
              {!values.length && (
                <tr>
                  <td colSpan={activeColumns.length + 3} className="pp-empty">
                    Chưa có dữ liệu. Hãy tải template hoặc import Excel theo Mã Nhân Viên.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </>}
    </section>}
  </section>;
}
