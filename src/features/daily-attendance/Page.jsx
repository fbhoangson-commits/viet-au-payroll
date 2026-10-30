import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  CalendarDays, RefreshCw, Search, Download, Upload, Settings2, Save,
  AlertCircle, CheckCircle2, Plus, Trash2, Users, FileSpreadsheet, LockKeyhole,
} from 'lucide-react';
import { supabase } from '../../shared/supabase.js';
import { fetchEmployees } from '../employee-master/services/employeeService.js';
import './daily-attendance.css';

const PERIODS = 'payroll_periods';
const SNAPSHOTS = 'payroll_period_employee_snapshots';
const SETTINGS = 'daily_attendance_month_settings';
const CODES = 'daily_attendance_codes';
const RECORDS = 'daily_attendance_records';
const STANDARD_TYPES = [
  { value: '26', label: 'Công chuẩn 26 ngày' },
  { value: '28', label: 'Công chuẩn 28 ngày' },
  { value: 'NONE', label: 'Không chấm công ngày' },
];
const norm = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLocaleLowerCase('vi').trim();
const employeeName = (e) => e?.full_name || e?.name || e?.employee_name || e?.['Họ và Tên'] || '—';
const employeeCode = (e) => e?.employee_code || e?.code || e?.['Mã Nhân Viên'] || '';
const employeeDepartment = (e) => e?.department || e?.department_name || e?.unit || e?.['Phòng ban'] || '';
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const formatNumber = (value, digits = 2) => value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('vi-VN', { maximumFractionDigits: digits });
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const monthLabel = (year, month) => new Date(year, month - 1, 1).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
const getMonthDays = (period) => {
  if (!period) return [];
  const year = Number(period.period_year); const month = Number(period.period_month);
  if (!year || month < 1 || month > 12) return [];
  const count = new Date(year, month, 0).getDate();
  return Array.from({ length: count }, (_, i) => new Date(year, month - 1, i + 1));
};
const errorText = (error) => error?.message || error?.details || error?.hint || error?.code || 'Lỗi không xác định';
const periodLabel = (p) => `${p.period_code || `KY-${p.period_year}${String(p.period_month).padStart(2, '0')}`} · ${p.period_name || p.name || monthLabel(p.period_year, p.period_month)}`;

function downloadWorkbook(filename, rows, sheetName = 'Chấm công') {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// Supabase/PostgREST commonly caps one response at 1,000 rows.
// Fetch every page so counters and sync logic use the complete period.
async function fetchAllRows(queryFactory, pageSize = 500) {
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryFactory().range(from, from + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    all.push(...page);
    if (page.length < pageSize) return all;
  }
}

export default function Page() {
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState('');
  const [employees, setEmployees] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [workdayNorms, setWorkdayNorms] = useState([]);
  const [settings, setSettings] = useState(null);
  const [codes, setCodes] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [notice, setNotice] = useState(null);
  const [showConfig, setShowConfig] = useState(true);
  const [standard26Days, setStandard26Days] = useState('26');
  const [standard28Days, setStandard28Days] = useState('28');
  const [presentCode, setPresentCode] = useState('');
  const [sundayCode, setSundayCode] = useState('');
  const [configNote, setConfigNote] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newCodeLabel, setNewCodeLabel] = useState('');
  const [newCodeUnits, setNewCodeUnits] = useState('');
  const [newCodeNote, setNewCodeNote] = useState(false);
  const [newCodeColor, setNewCodeColor] = useState('#16834a');
  const [newCodeBold, setNewCodeBold] = useState(true);
  const [syncProgress, setSyncProgress] = useState(null);
  const [importing, setImporting] = useState(false);

  const selectedPeriod = useMemo(() => periods.find((p) => p.id === periodId) || null, [periods, periodId]);
  const days = useMemo(() => getMonthDays(selectedPeriod), [selectedPeriod]);
  const periodStatus = String(selectedPeriod?.status || '').toUpperCase();
  const isLocked = ['LOCKED', 'CLOSED'].includes(periodStatus);
  const canEdit = Boolean(selectedPeriod && !isLocked && ['DRAFT', 'OPEN', ''].includes(periodStatus));
  const recordMap = useMemo(() => new Map(records.map((r) => [`${r.employee_id}|${r.work_date}`, r])), [records]);
  const codeMap = useMemo(() => new Map(codes.map((c) => [c.code, c])), [codes]);
  const snapshotByEmployee = useMemo(() => new Map(snapshots.map((s) => [s.employee_id, s])), [snapshots]);

  const loadPeriods = useCallback(async () => {
    if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
    const { data, error } = await supabase.from(PERIODS)
      .select('id,period_code,period_year,period_month,salary_version_id,status,created_at')
      .order('period_year', { ascending: false }).order('period_month', { ascending: false });
    if (error) throw error;
    setPeriods(data || []);
    setPeriodId((old) => old && (data || []).some((p) => p.id === old) ? old : (data || [])[0]?.id || '');
  }, []);

  const loadPeriodData = useCallback(async (id) => {
    if (!supabase || !id) {
      setSnapshots([]); setRecords([]); setSettings(null); setCodes([]); setEmployees([]); setWorkdayNorms([]);
      return;
    }
    const results = await Promise.all([
      supabase.from(SNAPSHOTS).select('*').eq('period_id', id).order('employee_code_snapshot'),
      supabase.from('payroll_period_employees').select('employee_id').eq('period_id', id),
      supabase.from(SETTINGS).select('*').eq('period_id', id).maybeSingle(),
      supabase.from(CODES).select('*').eq('is_active', true).order('display_order').order('code'),
      fetchAllRows(() => supabase.from(RECORDS).select('*').eq('period_id', id).order('work_date').order('employee_id')),
      supabase.from('salary_workday_norms').select('employee_id,policy_version_id,workday_count').eq('policy_version_id', periods.find(p => p.id === id)?.salary_version_id || '00000000-0000-0000-0000-000000000000'),
    ]);
    const [s, membership, c, k, r, n] = results;
    for (const result of results) if (result.error) throw result.error;
    const memberIds = new Set((membership.data || []).map(x => x.employee_id));
    const authoritativeSnapshots = (s.data || []).filter(row => memberIds.has(row.employee_id));
    setSnapshots(authoritativeSnapshots); setSettings(c.data || null); setCodes(k.data || []); setRecords(Array.isArray(r) ? r : (r.data || [])); setWorkdayNorms(n.data || []);
    setStandard26Days(String(c.data?.standard_26_days ?? 26));
    setStandard28Days(String(c.data?.standard_28_days ?? 28));
    setConfigNote(c.data?.notes || '');
    setPresentCode(old => old || (k.data || []).find(x => /đi làm|có mặt|present/i.test(`${x.code} ${x.label}`))?.code || '');
    setSundayCode(old => old || (k.data || []).find(x => /off|chủ nhật|nghỉ cn|nghỉ chủ nhật/i.test(`${x.code} ${x.label}`))?.code || '');
  }, [periods]);

  const refresh = useCallback(async () => {
    if (!supabase) { setNotice({ type: 'error', text: 'Chưa cấu hình kết nối Supabase.' }); return; }
    setLoading(true); setNotice(null);
    try {
      const { data: periodRows, error: periodError } = await supabase.from(PERIODS)
        .select('id,period_code,period_year,period_month,salary_version_id,status,created_at')
        .order('period_year', { ascending: false }).order('period_month', { ascending: false });
      if (periodError) throw periodError;
      const rows = periodRows || [];
      setPeriods(rows);
      const id = periodId && rows.some((p) => p.id === periodId) ? periodId : rows[0]?.id || '';
      setPeriodId(id);
      await loadPeriodData(id);
      setNotice({ type: 'success', text: 'Đã làm mới dữ liệu từ Supabase.' });
    } catch (error) {
      setNotice({ type: 'error', text: `Không tải được dữ liệu chấm công: ${errorText(error)}. Kiểm tra migration và RLS.` });
    } finally { setLoading(false); }
  }, [periodId, loadPeriodData]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
        const { data, error } = await supabase.from(PERIODS)
          .select('id,period_code,period_year,period_month,salary_version_id,status,created_at')
          .order('period_year', { ascending: false }).order('period_month', { ascending: false });
        if (error) throw error;
        if (alive) { setPeriods(data || []); setPeriodId((data || [])[0]?.id || ''); }
      } catch (error) { if (alive) setNotice({ type: 'error', text: `Không tải được Kỳ Lương: ${errorText(error)}` }); }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!periodId || !supabase) { setSnapshots([]); setRecords([]); setSettings(null); setCodes([]); setWorkdayNorms([]); return undefined; }
    setLoading(true); setNotice(null);
    (async () => {
      try {
        const [s, c, k, r, employeeRows, normResult] = await Promise.all([
          supabase.from(SNAPSHOTS).select('*').eq('period_id', periodId).order('employee_code_snapshot'),
          supabase.from(SETTINGS).select('*').eq('period_id', periodId).maybeSingle(),
          supabase.from(CODES).select('*').eq('is_active', true).order('display_order').order('code'),
          fetchAllRows(() => supabase.from(RECORDS).select('*').eq('period_id', periodId).order('work_date').order('employee_id')),
          fetchEmployees(),
          supabase.from('salary_workday_norms').select('employee_id,policy_version_id,workday_count').eq('policy_version_id', periods.find(p => p.id === periodId)?.salary_version_id || '00000000-0000-0000-0000-000000000000'),
        ]);
        for (const result of [s, c, k, r, normResult]) if (result.error) throw result.error;
        if (!alive) return;
        setSnapshots(s.data || []); setSettings(c.data || null); setCodes(k.data || []); setRecords(Array.isArray(r) ? r : (r.data || [])); setEmployees(employeeRows || []); setWorkdayNorms(normResult.data || []);
        setStandard26Days(String(c.data?.standard_26_days ?? 26)); setStandard28Days(String(c.data?.standard_28_days ?? 28));
        setConfigNote(c.data?.notes || '');
        setPresentCode(old => old || (k.data || []).find(x => /đi làm|có mặt|present/i.test(`${x.code} ${x.label}`))?.code || '');
        setSundayCode(old => old || (k.data || []).find(x => /off|chủ nhật|nghỉ cn|nghỉ chủ nhật/i.test(`${x.code} ${x.label}`))?.code || '');
      } catch (error) { if (alive) setNotice({ type: 'error', text: `Không tải được dữ liệu kỳ: ${errorText(error)}. Có thể cần chạy migration Chấm công ngày.` }); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [periodId]);

  async function createSnapshot() {
    if (!canEdit || !selectedPeriod) return;
    if (snapshots.length) { setNotice({ type: 'error', text: 'Kỳ này đã có danh sách nhân sự chốt.' }); return; }
    if (!employees.length) { setNotice({ type: 'error', text: 'Không có nhân sự để chốt. Kiểm tra Employee Master.' }); return; }
    const confirmed = window.confirm(`Kỳ ${periodLabel(selectedPeriod)} chưa có danh sách nhân sự chốt. Bạn đang yêu cầu tạo snapshot từ Employee Master HIỆN TẠI (${employees.length} nhân sự). Đây không khôi phục được trạng thái nhân sự lịch sử tại ngày tạo kỳ. Chỉ tiếp tục nếu đã đối chiếu danh sách này. Tiếp tục?`);
    if (!confirmed) return;
    setSaving(true); setNotice(null);
    try {
      const payload = employees.filter((e) => e.id && employeeCode(e)).map((e) => ({
        period_id: selectedPeriod.id, employee_id: e.id,
        employee_code_snapshot: String(employeeCode(e)), employee_name_snapshot: String(employeeName(e)),
        department_snapshot: String(employeeDepartment(e) || ''),
        standard_type: null, standard_days: null,
      }));
      if (!payload.length) throw new Error('Không tìm được nhân sự có UUID và Mã Nhân Viên hợp lệ.');
      const { error } = await supabase.from(SNAPSHOTS).insert(payload);
      if (error) throw error;
      await loadPeriodData(selectedPeriod.id);
      setNotice({ type: 'success', text: `Đã chốt snapshot ${payload.length} nhân sự cho kỳ. Danh sách này không tự thay đổi khi Employee Master được cập nhật.` });
    } catch (error) { setNotice({ type: 'error', text: `Không chốt được danh sách: ${errorText(error)}` }); }
    finally { setSaving(false); }
  }

  async function saveSettings(event) {
    event.preventDefault();
    if (!canEdit || !selectedPeriod) return;
    for (const [label, value] of [['Nhóm 26 ngày', standard26Days], ['Nhóm 28 ngày', standard28Days]]) {
      if (!Number.isFinite(Number(value)) || Number(value) <= 0 || Number(value) > 31) {
        setNotice({ type: 'error', text: `${label}: công chuẩn thực tế phải lớn hơn 0 và không vượt quá 31.` }); return;
      }
    }
    setSaving(true); setNotice(null);
    try {
      const payload = {
        period_id: selectedPeriod.id,
        default_standard_type: '26',
        default_standard_days: Number(standard26Days),
        standard_26_days: Number(standard26Days),
        standard_28_days: Number(standard28Days),
        notes: configNote.trim() || null,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from(SETTINGS).upsert(payload, { onConflict: 'period_id' }).select('*').single();
      if (error) throw error;
      setSettings(data);
      setNotice({ type: 'success', text: 'Đã lưu công chuẩn thực tế của 3 nhóm cho Kỳ Lương này.' });
    } catch (error) { setNotice({ type: 'error', text: `Không lưu được cấu hình: ${errorText(error)}` }); }
    finally { setSaving(false); }
  }


  async function saveAttendance(snapshot, date, code) {
    if (!canEdit) return;
    const workDate = dateKey(date);
    const key = `${snapshot.employee_id}|${workDate}`;
    const old = recordMap.get(key);
    setSaving(true); setNotice(null);
    try {
      if (!code) {
        if (old) {
          const { error } = await supabase.from(RECORDS).delete().eq('id', old.id).eq('period_id', periodId);
          if (error) throw error;
          setRecords((prev) => prev.filter((r) => r.id !== old.id));
        }
      } else {
        if (!codeMap.has(code)) throw new Error('Mã công không còn hợp lệ. Hãy làm mới danh mục.');
        const payload = { period_id: periodId, employee_id: snapshot.employee_id, work_date: workDate, attendance_code: code, note: old?.note || null, updated_at: new Date().toISOString() };
        const { data, error } = await supabase.from(RECORDS).upsert(payload, { onConflict: 'period_id,employee_id,work_date' }).select('*').single();
        if (error) throw error;
        setRecords((prev) => [...prev.filter((r) => !(r.employee_id === snapshot.employee_id && r.work_date === workDate)), data]);
      }
      setNotice({ type: 'success', text: `Đã lưu ${snapshot.employee_code_snapshot} · ${workDate}.` });
    } catch (error) { setNotice({ type: 'error', text: `Không lưu được chấm công: ${errorText(error)}` }); }
    finally { setSaving(false); }
  }

  async function syncStandardAttendance() {
    if (!canEdit || !selectedPeriod || saving || syncProgress) return;
    if (!presentCode || !sundayCode) { setNotice({ type: 'error', text: 'Hãy chọn rõ mã công Có mặt và mã công Nghỉ Chủ nhật trước khi đồng bộ.' }); return; }
    if (!codeMap.has(presentCode) || !codeMap.has(sundayCode)) { setNotice({ type: 'error', text: 'Mã công được chọn không còn hợp lệ. Hãy làm mới danh mục mã công.' }); return; }

    // Build from the complete period snapshot, never from UI-filtered rows.
    const normByEmployee = new Map(workdayNorms.map(n => [n.employee_id, n.workday_count == null ? null : Number(n.workday_count)]));
    const allCandidates = [];
    let unknownCount = 0;
    for (const snapshot of snapshots) {
      const rawNorm = normByEmployee.get(snapshot.employee_id);
      // Missing/zero standard is the agreed no-attendance group.
      if (rawNorm == null || rawNorm === 0) continue;
      if (rawNorm !== 26 && rawNorm !== 28) { unknownCount += 1; continue; }
      for (const date of days) {
        const key = `${snapshot.employee_id}|${dateKey(date)}`;
        if (recordMap.has(key)) continue; // preserve all previously entered cells
        allCandidates.push({ period_id: selectedPeriod.id, employee_id: snapshot.employee_id, work_date: dateKey(date), attendance_code: date.getDay() === 0 ? sundayCode : presentCode });
      }
    }
    if (unknownCount) { setNotice({ type: 'error', text: `${unknownCount} nhân sự có định mức khác 0, 26 hoặc 28. Hãy kiểm tra Định Mức Ngày Công trước khi đồng bộ.` }); return; }
    if (!allCandidates.length) { setNotice({ type: 'success', text: 'Không có ô trống cần đồng bộ. Các ô đã nhập được giữ nguyên.' }); return; }
    if (!window.confirm(`Đồng bộ ${allCandidates.length.toLocaleString('vi-VN')} ô trống của kỳ ${periodLabel(selectedPeriod)}? Hệ thống sẽ tự chia thành nhiều đợt xử lý; không ghi đè ô đã có dữ liệu.`)) return;

    const batchSize = 400; // safely below common PostgREST payload/row limits
    const total = allCandidates.length;
    let processed = 0;
    setSaving(true); setSyncProgress({ processed: 0, total }); setNotice(null);
    try {
      for (let offset = 0; offset < total; offset += batchSize) {
        // Stop if the user switched periods while an async request was in flight.
        if (selectedPeriod.id !== periodId) throw new Error('Kỳ lương đã thay đổi trong lúc đồng bộ. Hãy làm mới dữ liệu trước khi tiếp tục.');
        const batch = allCandidates.slice(offset, offset + batchSize);
        const { error } = await supabase.from(RECORDS).upsert(batch, {
          onConflict: 'period_id,employee_id,work_date',
          ignoreDuplicates: true,
        });
        if (error) throw new Error(`Đã xử lý ${processed.toLocaleString('vi-VN')}/${total.toLocaleString('vi-VN')} ô. Đợt tiếp theo gặp lỗi: ${errorText(error)}`);
        processed += batch.length;
        setSyncProgress({ processed, total });
      }
      await loadPeriodData(selectedPeriod.id);
      setNotice({ type: 'success', text: `Đã xử lý đồng bộ ${processed.toLocaleString('vi-VN')} ô trống qua ${Math.ceil(total / batchSize)} đợt. Các ô đã có dữ liệu được giữ nguyên.` });
    } catch (error) {
      try { await loadPeriodData(selectedPeriod.id); } catch { /* preserve original sync error */ }
      setNotice({ type: 'error', text: `Đồng bộ chưa hoàn tất: ${errorText(error)}. Các đợt đã lưu vẫn được giữ; hãy kiểm tra dữ liệu rồi chạy lại để xử lý các ô còn trống.` });
    } finally { setSaving(false); setSyncProgress(null); }
  }

  async function addCode(event) {
    event.preventDefault();
    if (!canEdit) return;
    const code = newCode.trim().toUpperCase(); const label = newCodeLabel.trim();
    if (!code || !label) { setNotice({ type: 'error', text: 'Vui lòng nhập mã và tên mã công.' }); return; }
    const units = newCodeUnits.trim() === '' ? null : Number(newCodeUnits);
    if (units !== null && (!Number.isFinite(units) || units < 0 || units > 1)) { setNotice({ type: 'error', text: 'Hệ số công phải từ 0 đến 1 hoặc để trống nếu chưa chốt quy đổi.' }); return; }
    try {
      const { data, error } = await supabase.from(CODES).insert({ code, label, work_units: units, color: newCodeColor, is_bold: newCodeBold, requires_note: newCodeNote, is_active: true, display_order: codes.length + 1 }).select('*').single();
      if (error) throw error;
      setCodes((prev) => [...prev, data].sort((a, b) => Number(a.display_order) - Number(b.display_order)));
      setNewCode(''); setNewCodeLabel(''); setNewCodeUnits(''); setNewCodeNote(false); setNewCodeColor('#16834a'); setNewCodeBold(true);
      setNotice({ type: 'success', text: `Đã thêm mã công ${code}.` });
    } catch (error) { setNotice({ type: 'error', text: `Không thêm được mã công: ${errorText(error)}` }); }
  }

  async function updateCodeStyle(code, patch) {
    if (!canEdit || !code?.id) return;
    try {
      const payload = { ...patch, updated_at: new Date().toISOString() };
      const { error } = await supabase.from(CODES).update(payload).eq('id', code.id);
      if (error) throw error;
      setCodes(prev => prev.map(item => item.id === code.id ? { ...item, ...patch } : item));
      setNotice({ type: 'success', text: `Đã cập nhật kiểu hiển thị mã ${code.code}.` });
    } catch (error) { setNotice({ type: 'error', text: `Không cập nhật được kiểu hiển thị mã công: ${errorText(error)}` }); }
  }

  async function deactivateCode(code) {
    if (!canEdit || !window.confirm(`Ngừng sử dụng mã công ${code.code}? Dữ liệu đã nhập bằng mã này sẽ được giữ nguyên.`)) return;
    try {
      const { error } = await supabase.from(CODES).update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', code.id);
      if (error) throw error;
      setCodes((prev) => prev.filter((c) => c.id !== code.id));
      setNotice({ type: 'success', text: `Đã ngừng sử dụng mã ${code.code}; dữ liệu lịch sử được giữ nguyên.` });
    } catch (error) { setNotice({ type: 'error', text: `Không cập nhật được mã công: ${errorText(error)}` }); }
  }

  const rows = useMemo(() => snapshots.map((s) => {
    const normRow = workdayNorms.find(n => n.employee_id === s.employee_id);
    const rawNorm = normRow?.workday_count == null ? null : Number(normRow.workday_count);
    const type = rawNorm == null || rawNorm === 0 ? 'NONE' : rawNorm === 26 ? '26' : rawNorm === 28 ? '28' : 'UNKNOWN';
    const standard = type === '26' ? Number(settings?.standard_26_days ?? 26) : type === '28' ? Number(settings?.standard_28_days ?? 28) : null;
    const employeeRecords = records.filter((r) => r.employee_id === s.employee_id);
    const enteredCount = employeeRecords.length;
    const counted = employeeRecords.reduce((sum, r) => {
      const c = codeMap.get(r.attendance_code);
      return sum + (c?.work_units == null ? 0 : Number(c.work_units));
    }, 0);
    const hasUnconfigured = employeeRecords.some((r) => codeMap.get(r.attendance_code)?.work_units == null);
    const complete = days.length > 0 && days.every((d) => recordMap.has(`${s.employee_id}|${dateKey(d)}`));
    let status = 'Chưa đủ dữ liệu';
    if (type === 'NONE') status = 'Không áp dụng';
    else if (type === 'UNKNOWN') status = 'Thiếu định mức';
    else if (complete && !hasUnconfigured && standard > 0) status = counted >= standard ? 'Đủ công' : 'Thiếu công';
    return { snapshot: s, type, standard, rawNorm, enteredCount, counted, complete, hasUnconfigured, status };
  }).filter((r) => {
    const text = norm(`${r.snapshot.employee_code_snapshot} ${r.snapshot.employee_name_snapshot} ${r.snapshot.department_snapshot || ''}`);
    if (search && !text.includes(norm(search))) return false;
    if (groupFilter !== 'ALL' && r.type !== groupFilter) return false;
    if (filter === 'ENTERED' && r.enteredCount === 0) return false;
    if (filter === 'MISSING' && r.enteredCount > 0) return false;
    if (filter !== 'ALL' && !['ENTERED', 'MISSING'].includes(filter) && r.status !== filter) return false;
    return true;
  }), [snapshots, workdayNorms, settings, records, codeMap, recordMap, days, search, filter, groupFilter]);

  const totals = useMemo(() => ({
    employees: snapshots.length,
    entered: snapshots.filter((s) => records.some((r) => r.employee_id === s.employee_id)).length,
    entries: records.length,
    complete: rows.filter((r) => r.status === 'Đủ công').length,
    missing: rows.filter((r) => r.status === 'Thiếu công').length,
  }), [snapshots, records, rows]);

  function exportAttendance() {
    if (!selectedPeriod) return;
    const output = [];
    for (const s of snapshots) {
      for (const date of days) {
        const r = recordMap.get(`${s.employee_id}|${dateKey(date)}`);
        output.push({
          'Mã Kỳ': selectedPeriod.period_code || selectedPeriod.id,
          'Mã Nhân Viên': s.employee_code_snapshot,
          'Họ và Tên': s.employee_name_snapshot,
          'Ngày chấm công': dateKey(date), 'Mã công': r?.attendance_code || '', 'Ghi chú': r?.note || '',
          'Loại công chuẩn': (() => { const n = workdayNorms.find(x => x.employee_id === s.employee_id)?.workday_count; return n === 26 ? 'Nhóm 26 ngày' : n === 28 ? 'Nhóm 28 ngày' : n === 0 ? 'Không tính công' : 'Thiếu định mức'; })(),
          'Công chuẩn tháng': (() => { const n = workdayNorms.find(x => x.employee_id === s.employee_id)?.workday_count; return n === 26 ? settings?.standard_26_days ?? 26 : n === 28 ? settings?.standard_28_days ?? 28 : ''; })(),
        });
      }
    }
    downloadWorkbook(`Cham-cong-${selectedPeriod.period_code || `${selectedPeriod.period_year}-${selectedPeriod.period_month}`}.xlsx`, output);
  }

  function downloadTemplate() {
    if (!selectedPeriod) return;
    downloadWorkbook('Template-Cham-Cong-Ngay.xlsx', [{ 'Mã Kỳ': selectedPeriod.period_code || selectedPeriod.id, 'Mã Nhân Viên': '', 'Ngày chấm công': `${selectedPeriod.period_year}-${String(selectedPeriod.period_month).padStart(2, '0')}-01`, 'Mã công': '', 'Ghi chú': '' }], 'Import');
  }

  async function importFile(file) {
    if (!file || !selectedPeriod || !canEdit) return;
    setImporting(true); setNotice(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      if (!raw.length) throw new Error('File không có dòng dữ liệu.');
      const keys = Object.keys(raw[0]);
      const header = (wanted) => keys.find((k) => wanted.includes(norm(k)));
      const periodKey = header(['ma ky', 'ma ky luong', 'period code']);
      const employeeKey = header(['ma nhan vien', 'employee code']);
      const dateCol = header(['ngay cham cong', 'ngay', 'work date']);
      const codeCol = header(['ma cong', 'attendance code']);
      const noteCol = header(['ghi chu', 'note']);
      if (!employeeKey || !dateCol || !codeCol) throw new Error('File cần có cột Mã Nhân Viên, Ngày chấm công và Mã công.');
      const snapshotByCode = new Map(snapshots.map((s) => [norm(s.employee_code_snapshot), s]));
      const parsed = []; const errors = [];
      raw.forEach((row, index) => {
        const code = String(row[employeeKey] || '').trim();
        if (!code && !String(row[dateCol] || '').trim()) return;
        if (periodKey && String(row[periodKey]).trim() && ![selectedPeriod.id, selectedPeriod.period_code].includes(String(row[periodKey]).trim())) {
          errors.push(`Dòng ${index + 2}: Mã kỳ không khớp kỳ đang chọn.`); return;
        }
        const snapshot = snapshotByCode.get(norm(code));
        if (!snapshot) { errors.push(`Dòng ${index + 2}: Mã nhân viên “${code}” không thuộc danh sách chốt của kỳ.`); return; }
        let date = String(row[dateCol] || '').trim();
        if (date.includes('/')) { const parts = date.split('/'); if (parts.length === 3) date = `${parts[2].padStart(4, '0')}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`; }
        if (date instanceof Date) date = dateKey(date);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push(`Dòng ${index + 2}: Ngày không hợp lệ.`); return; }
        const parsedDate = new Date(`${date}T00:00:00`);
        if (parsedDate.getFullYear() !== Number(selectedPeriod.period_year) || parsedDate.getMonth() + 1 !== Number(selectedPeriod.period_month)) { errors.push(`Dòng ${index + 2}: Ngày ${date} nằm ngoài tháng của kỳ.`); return; }
        const codeValue = String(row[codeCol] || '').trim().toUpperCase();
        if (codeValue && !codeMap.has(codeValue)) { errors.push(`Dòng ${index + 2}: Mã công “${codeValue}” chưa được cấu hình.`); return; }
        parsed.push({ period_id: periodId, employee_id: snapshot.employee_id, work_date: date, attendance_code: codeValue, note: noteCol ? String(row[noteCol] || '').trim() || null : null, _code: code, _row: index + 2 });
      });
      const seen = new Set();
      for (const item of parsed) { const key = `${item.employee_id}|${item.work_date}`; if (seen.has(key)) errors.push(`Dòng ${item._row}: Trùng nhân sự/ngày trong file.`); seen.add(key); }
      if (errors.length) throw new Error(`Có ${errors.length} lỗi, chưa nhập dòng nào. ${errors.slice(0, 8).join(' ')}`);
      if (!parsed.length) throw new Error('Không có dòng hợp lệ để nhập.');
      const overwriteCount = parsed.filter((p) => recordMap.has(`${p.employee_id}|${p.work_date}`)).length;
      if (!window.confirm(`Xác nhận import ${parsed.length} dòng vào kỳ ${periodLabel(selectedPeriod)}?\nDòng trùng với dữ liệu hiện có: ${overwriteCount}. Các dòng này sẽ được cập nhật theo file.\nKhông có dữ liệu nào được ghi trước khi xác nhận.`)) return;
      const payload = parsed.filter((p) => p.attendance_code).map(({ _code, _row, ...rest }) => rest);
      const deletes = parsed.filter((p) => !p.attendance_code);
      if (payload.length) {
        const { error } = await supabase.from(RECORDS).upsert(payload, { onConflict: 'period_id,employee_id,work_date' });
        if (error) throw error;
      }
      for (const p of deletes) {
        const old = recordMap.get(`${p.employee_id}|${p.work_date}`);
        if (old) { const { error } = await supabase.from(RECORDS).delete().eq('id', old.id).eq('period_id', periodId); if (error) throw error; }
      }
      await loadPeriodData(periodId);
      setNotice({ type: 'success', text: `Import thành công ${parsed.length} dòng; đã cập nhật ${overwriteCount} dòng trùng. Ô mã công trống được hiểu là yêu cầu xóa giá trị cũ sau khi xác nhận.` });
    } catch (error) { setNotice({ type: 'error', text: `Import thất bại: ${errorText(error)}` }); }
    finally { setImporting(false); }
  }

  return <section className="feature-page daily-attendance-page">
    <div className="feature-heading"><div className="feature-heading-icon"><CalendarDays size={22}/></div><div><div className="eyebrow">KHÔNG GIAN NGHIỆP VỤ</div><h2>Chấm công ngày</h2><p>Nhập, đối chiếu và tổng hợp công theo Kỳ Lương đang chọn.</p></div></div>
    <div className="da-toolbar panel">
      <label className="da-period-field"><span>Kỳ Lương <b>*</b></span><select value={periodId} onChange={(e) => setPeriodId(e.target.value)} disabled={loading || saving || !periods.length}><option value="">{periods.length ? 'Chọn Kỳ Lương' : 'Chưa có Kỳ Lương'}</option>{periods.map((p) => <option key={p.id} value={p.id}>{periodLabel(p)} · {p.status}</option>)}</select></label>
      <div className="da-period-summary">{selectedPeriod ? <><strong>{periodLabel(selectedPeriod)}</strong><span>{monthLabel(selectedPeriod.period_year, selectedPeriod.period_month)} · {days.length} ngày trong tháng</span><span className={`da-status ${isLocked ? 'locked' : ''}`}>{isLocked ? 'Đã khóa' : selectedPeriod.status || 'Chưa xác định trạng thái'}</span></> : <span>Chọn kỳ để bắt đầu.</span>}</div>
      <button className="btn btn-secondary" onClick={refresh} disabled={loading}><RefreshCw size={14}/> Làm mới</button>
    </div>
    {!periods.length && !loading && <div className="da-empty panel"><CalendarDays size={30}/><h3>Chưa có Kỳ Lương</h3><p>Vui lòng tạo Kỳ Lương tại menu Quản Lý Kỳ Lương trước khi nhập chấm công.</p></div>}
    {notice && <div className={`da-notice ${notice.type}`} role="status">{notice.type === 'error' ? <AlertCircle size={16}/> : <CheckCircle2 size={16}/>}<span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Đóng">×</button></div>}
    {selectedPeriod && <>
      {isLocked && <div className="da-notice warning"><LockKeyhole size={16}/><span>Kỳ lương đã khóa. Dữ liệu chỉ xem, không thể chỉnh sửa hoặc import.</span></div>}
      <div className="da-metrics">
        <div className="da-metric"><span>Nhân sự chốt kỳ</span><strong>{totals.employees}</strong></div>
        <div className="da-metric"><span>Nhân sự đã nhập công</span><strong>{totals.entered}</strong></div>
        <div className="da-metric"><span>Lượt chấm công đã lưu</span><strong>{totals.entries}</strong></div>
        <div className="da-metric"><span>Đủ công / Thiếu công</span><strong>{totals.complete} / {totals.missing}</strong></div>
      </div>
      <section className="panel da-config-panel">
        <div className="da-section-heading"><div><h3><Settings2 size={17}/> Cấu hình chấm công chuẩn</h3><p>Đối chiếu công chuẩn từ Định Mức Ngày Công và điều chỉnh công chuẩn thực tế của từng nhóm cho kỳ này.</p></div><button className="btn btn-secondary" onClick={() => setShowConfig((v) => !v)}>{showConfig ? 'Thu gọn' : 'Mở cấu hình'}</button></div>
        {showConfig && <form className="da-config-form" onSubmit={saveSettings}>
          <label><span>Nhóm 26 ngày — công chuẩn thực tế</span><input type="number" min="0.5" max="31" step="0.5" value={standard26Days} onChange={(e) => setStandard26Days(e.target.value)} disabled={!canEdit} required/></label>
          <label><span>Nhóm 28 ngày — công chuẩn thực tế</span><input type="number" min="0.5" max="31" step="0.5" value={standard28Days} onChange={(e) => setStandard28Days(e.target.value)} disabled={!canEdit} required/></label>
          <label className="da-note-field"><span>Ghi chú</span><input value={configNote} onChange={(e) => setConfigNote(e.target.value)} disabled={!canEdit} placeholder="Ví dụ: Công chuẩn điều chỉnh theo kế hoạch tháng"/></label>
          <button className="btn btn-primary" disabled={!canEdit || saving}><Save size={14}/> Lưu cấu hình kỳ</button>
        </form>}
        <p className="da-help">Nhóm của từng nhân sự được lấy từ Định Mức Ngày Công theo chính sách gắn với Kỳ Lương. Nhóm không tính công có định mức 0; không chỉnh công chuẩn từng nhân sự tại đây.</p>
      </section>
      <section className="panel da-codes-panel">
        <div className="da-section-heading"><div><h3><FileSpreadsheet size={17}/> Danh mục mã công</h3><p>Chỉ hệ số đã được cấu hình mới được cộng vào công thực tế. Để trống hệ số nếu chưa chốt quy đổi.</p></div></div>
        <form className="da-code-form" onSubmit={addCode}>
          <label><span>Mã công</span><input value={newCode} onChange={(e) => setNewCode(e.target.value)} maxLength={12} placeholder="VD: X, P, K" required disabled={!canEdit}/></label>
          <label><span>Tên mã công</span><input value={newCodeLabel} onChange={(e) => setNewCodeLabel(e.target.value)} placeholder="VD: Đi làm" required disabled={!canEdit}/></label>
          <label><span>Hệ số công</span><input type="number" min="0" max="1" step="0.5" value={newCodeUnits} onChange={(e) => setNewCodeUnits(e.target.value)} placeholder="Để trống nếu chưa chốt" disabled={!canEdit}/></label>
          <label><span>Màu chữ</span><div className="da-color-input da-color-input-compact"><input type="color" value={newCodeColor} onChange={(e) => setNewCodeColor(e.target.value)} disabled={!canEdit} aria-label="Chọn màu chữ mã công"/></div></label><label className="da-checkbox"><input type="checkbox" checked={newCodeBold} onChange={(e) => setNewCodeBold(e.target.checked)} disabled={!canEdit}/> Chữ đậm</label>
          <label className="da-checkbox"><input type="checkbox" checked={newCodeNote} onChange={(e) => setNewCodeNote(e.target.checked)} disabled={!canEdit}/> Yêu cầu ghi chú</label>
          <button className="btn btn-primary" disabled={!canEdit}><Plus size={14}/> Thêm mã</button>
        </form>
        <div className="da-code-list">{codes.map((c) => <div key={c.id} className="da-code-item">
          <span className="da-code-preview" style={{ color: c.color || '#475569', fontWeight: c.is_bold === false ? 500 : 750 }}>{c.code}</span>
          <span className="da-code-label">{c.label}<small>{c.work_units == null ? 'Chưa cấu hình quy đổi' : `${formatNumber(c.work_units)} công`}{c.requires_note ? ' · Cần ghi chú' : ''}</small></span>
          {canEdit && <label className="da-code-style-control" title={`Chọn màu chữ mã ${c.code}`}><input type="color" value={/^#[0-9A-Fa-f]{6}$/.test(c.color || '') ? c.color : '#475569'} aria-label={`Màu chữ mã ${c.code}`} onChange={(e) => updateCodeStyle(c, { color: e.target.value })}/></label>}
          {canEdit && <label className="da-code-bold"><input type="checkbox" checked={c.is_bold !== false} onChange={(e) => updateCodeStyle(c, { is_bold: e.target.checked })}/> Đậm</label>}
          {canEdit && <button type="button" className="btn btn-ghost btn-icon" title="Ngừng sử dụng mã" onClick={() => deactivateCode(c)}><Trash2 size={14}/></button>}
        </div>)}{!codes.length && <p className="da-muted">Chưa có mã công. Hãy thêm mã và chỉ nhập hệ số sau khi đã thống nhất quy tắc quy đổi.</p>}</div>
      </section>
      <section className="panel da-table-panel">
        <div className="da-section-heading"><div><h3><CalendarDays size={17}/> Bảng chấm công theo ngày</h3><p>{snapshots.length} nhân sự trong danh sách chốt · {days.length} ngày · dữ liệu theo kỳ đang chọn.</p></div><div className="da-actions"><label className="da-code-map">Mã Có mặt<select value={presentCode} onChange={e => setPresentCode(e.target.value)} disabled={!canEdit}><option value="">Chọn mã</option>{codes.map(c => <option key={c.id} value={c.code}>{c.code} · {c.label}</option>)}</select></label><label className="da-code-map">Mã nghỉ CN<select value={sundayCode} onChange={e => setSundayCode(e.target.value)} disabled={!canEdit}><option value="">Chọn mã</option>{codes.map(c => <option key={c.id} value={c.code}>{c.code} · {c.label}</option>)}</select></label><button className="btn btn-primary" onClick={syncStandardAttendance} disabled={!canEdit || saving || !snapshots.length}><CalendarDays size={14}/> {syncProgress ? `Đang đồng bộ ${syncProgress.processed.toLocaleString('vi-VN')}/${syncProgress.total.toLocaleString('vi-VN')}` : 'Đồng bộ công chuẩn'}</button><button className="btn btn-secondary" onClick={downloadTemplate} disabled={!snapshots.length}><Download size={14}/> Template</button><label className={`btn btn-secondary da-upload ${!canEdit || importing ? 'disabled' : ''}`}><Upload size={14}/> {importing ? 'Đang nhập…' : 'Import'}<input type="file" accept=".xlsx,.xls,.csv" disabled={!canEdit || importing || !snapshots.length} onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = ''; }}/></label><button className="btn btn-secondary" onClick={exportAttendance} disabled={!snapshots.length}><Download size={14}/> Export</button></div></div>
        <div className="da-filters"><label className="da-search"><Search size={15}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã nhân viên, họ tên…"/></label><select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}><option value="ALL">Tất cả nhóm công</option><option value="26">Nhóm 26 ngày</option><option value="28">Nhóm 28 ngày</option><option value="NONE">Nhóm không tính công</option><option value="UNKNOWN">Thiếu định mức</option></select><select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="ALL">Tất cả trạng thái</option><option value="ENTERED">Đã nhập chấm công</option><option value="MISSING">Chưa nhập chấm công</option><option value="Đủ công">Đủ công</option><option value="Thiếu công">Thiếu công</option><option value="Chưa đủ dữ liệu">Chưa đủ dữ liệu</option><option value="Không áp dụng">Không áp dụng</option><option value="Thiếu định mức">Thiếu định mức</option></select></div>
        {!snapshots.length ? <div className="da-snapshot-empty"><Users size={27}/><h3>Chưa có danh sách nhân sự chốt cho kỳ này</h3><p>Không tự lấy nhân sự hiện tại làm snapshot. Nếu đây là kỳ cũ chưa có snapshot, hãy đối chiếu danh sách trước khi chốt từ Employee Master hiện tại.</p><button className="btn btn-primary" onClick={createSnapshot} disabled={!canEdit || saving || !employees.length}><Users size={14}/> Chốt danh sách nhân sự cho kỳ</button><small>Thao tác cần xác nhận và không thể tự động đồng bộ lại theo Employee Master.</small></div> : <div className="da-table-wrap"><table className="da-table"><thead><tr><th className="da-sticky-col da-sticky-one">Mã NV</th><th className="da-sticky-col da-sticky-two">Họ và tên</th><th>Loại chuẩn</th><th>Chuẩn</th>{days.map((d) => <th key={dateKey(d)} className={`${[0,6].includes(d.getDay()) ? 'weekend' : ''} da-day-head`}><span>{d.toLocaleDateString('vi-VN', { weekday: 'short' })}</span><strong>{String(d.getDate()).padStart(2, '0')}</strong></th>)}<th>Công thực tế</th><th>Tỷ lệ</th><th>Đánh giá</th></tr></thead><tbody>{rows.map((row) => {
          const s = row.snapshot;
          return <tr key={s.id}><td className="da-sticky-col da-sticky-one"><strong>{s.employee_code_snapshot}</strong></td><td className="da-sticky-col da-sticky-two"><strong>{s.employee_name_snapshot}</strong><small>{s.department_snapshot || ''}</small></td><td>{row.type === 'UNKNOWN' ? <span className="da-warning-text">Thiếu định mức</span> : (STANDARD_TYPES.find((x) => x.value === row.type)?.label || row.type)}</td><td>{formatNumber(row.standard, 1)}</td>{days.map((date) => { const record = recordMap.get(`${s.employee_id}|${dateKey(date)}`); return <td key={dateKey(date)} className={`${[0,6].includes(date.getDay()) ? 'weekend' : ''} da-cell`}>{row.type === 'NONE' ? <span className="da-not-applicable">—</span> : <select aria-label={`${s.employee_code_snapshot} ${dateKey(date)}`} value={record?.attendance_code || ''} disabled={!canEdit || !codes.length} onChange={(e) => saveAttendance(s, date, e.target.value)} title={record?.note || ''} style={record?.attendance_code ? { color: codeMap.get(record.attendance_code)?.color || '#334155', fontWeight: codeMap.get(record.attendance_code)?.is_bold === false ? 500 : 750 } : undefined}><option value="">—</option>{codes.map((c) => <option key={c.id} value={c.code}>{c.code}</option>)}</select>}</td>})}<td><strong>{row.type === 'NONE' ? '—' : formatNumber(row.counted, 2)}</strong>{row.hasUnconfigured && <small className="da-warning-text">Có mã chưa quy đổi</small>}</td><td>{row.type === 'NONE' || !row.standard ? '—' : `${formatNumber(row.counted / row.standard * 100, 2)}%`}</td><td><span className={`da-result ${row.status === 'Đủ công' ? 'good' : row.status === 'Thiếu công' ? 'bad' : row.status === 'Không áp dụng' ? 'na' : 'pending'}`}>{row.status}</span></td></tr>;
        })}{!rows.length && <tr><td colSpan={days.length + 7} className="da-no-rows">Không có nhân sự phù hợp bộ lọc.</td></tr>}</tbody></table></div>}
        <div className="da-footer">Hiển thị {rows.length}/{snapshots.length} nhân sự · Ô trống là chưa nhập, không tự động được hiểu là vắng mặt. Công thực tế chỉ cộng hệ số đã cấu hình.</div>
      </section>
    </>}
  </section>;
}
