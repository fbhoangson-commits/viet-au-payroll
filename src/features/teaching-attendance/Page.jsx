import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  CalendarDays, RefreshCw, Search, Download, Upload, FileSpreadsheet,
  Save, X, Pencil, AlertCircle, CheckCircle2, LockKeyhole, GraduationCap
} from 'lucide-react';
import { supabase } from '../../shared/supabase.js';
import './teaching-attendance.css';

const PERIODS = 'payroll_periods';
const SNAPSHOTS = 'payroll_period_employee_snapshots';
const GROUPS = 'salary_rate_groups';
const COLUMNS = 'salary_rate_columns';
const RATE_VALUES = 'salary_rate_values';
const RECORDS = 'teaching_attendance_records';
const GROUP_DEFS = [
  { key: 'TEACHING', label: 'Tiết dạy', aliases: ['teaching', 'tiet day'] },
  { key: 'TUTORING', label: 'Phụ đạo', aliases: ['tutoring', 'phu dao'] },
  { key: 'OTHER', label: 'Khác', aliases: ['other', 'khac'] },
];
const clean = v => String(v ?? '').trim();
const norm = v => clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLocaleLowerCase('vi').replace(/[^a-z0-9]+/g, ' ').trim();
const errorText = e => e?.message || e?.details || e?.hint || e?.code || 'Lỗi không xác định';
const fmt = v => v == null || v === '' ? '—' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
const money = v => v == null || v === '' ? '—' : `${Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} đ`;
const periodLabel = p => `${p.period_code || `KL-${p.period_year}${String(p.period_month).padStart(2, '0')}`} · ${new Date(Number(p.period_year), Number(p.period_month)-1, 1).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })} · ${p.status || ''}`;
const isLocked = p => ['LOCKED', 'CLOSED'].includes(String(p?.status || '').toUpperCase());
const rateValueFor = (values, col) => {
  const source = values && typeof values === 'object' ? values : {};
  const keys = [col?.id, col?.code, col?.name, col?.label].filter(v => v !== undefined && v !== null && clean(v) !== '');
  for (const key of keys) if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== '' && source[key] != null) return source[key];
  const normalized = value => norm(value);
  const wanted = new Set(keys.map(normalized));
  const match = Object.keys(source).find(key => wanted.has(normalized(key)));
  return match === undefined ? undefined : source[match];
};
const groupCode = g => {
  const code = norm(g?.code || '');
  const name = norm(g?.name || '');
  if (['teaching', 'tiet day'].includes(code) || ['teaching', 'tiet day'].includes(name)) return 'TEACHING';
  if (['tutoring', 'phu dao'].includes(code) || ['tutoring', 'phu dao'].includes(name)) return 'TUTORING';
  if (['other', 'khac'].includes(code) || ['other', 'khac'].includes(name)) return 'OTHER';
  return '';
};
async function fetchAll(queryFactory, pageSize = 500) {
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryFactory().range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data || [];
    all.push(...batch);
    if (batch.length < pageSize) return all;
  }
}
function downloadWorkbook(filename, sheetName, rows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
function parseNumber(raw) {
  if (raw === '' || raw == null) return { value: 0, valid: true };
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? { value: raw, valid: true } : { valid: false };
  let s = String(raw).trim().replace(/\s/g, '');
  if (!s) return { value: 0, valid: true };
  if (!/^[\d.,]+$/.test(s)) return { valid: false };
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes(',') || s.includes('.')) {
    const sep = s.includes(',') ? ',' : '.';
    const parts = s.split(sep);
    if (parts.length > 2) {
      const tail = parts.pop();
      s = parts.join('') + '.' + tail;
    } else if ((parts[1] || '').length === 3) s = parts.join('');
    else s = parts.join('.');
  }
  const value = Number(s);
  return Number.isFinite(value) && value >= 0 ? { value, valid: true } : { valid: false };
}

export default function Page() {
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState('');
  const [snapshots, setSnapshots] = useState([]);
  const [groups, setGroups] = useState([]);
  const [columns, setColumns] = useState([]);
  const [rateValues, setRateValues] = useState([]);
  const [records, setRecords] = useState([]);
  const [tab, setTab] = useState('TEACHING');
  const [search, setSearch] = useState('');
  const [editingEmployee, setEditingEmployee] = useState('');
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState(null);
  const fileRef = useRef(null);

  const selectedPeriod = useMemo(() => periods.find(p => p.id === periodId) || null, [periods, periodId]);
  const policyId = selectedPeriod?.salary_version_id || '';
  const locked = isLocked(selectedPeriod);
  const groupRows = useMemo(() => {
    const mapped = groups.filter(g => g.active !== false).map(g => ({ ...g, normalizedCode: groupCode(g) })).filter(g => g.normalizedCode);
    return GROUP_DEFS.map(def => ({ ...def, source: mapped.find(g => g.normalizedCode === def.key) || null }))
      .filter(g => g.source);
  }, [groups]);
  const currentGroup = groupRows.find(g => g.key === tab) || groupRows[0] || null;
  const currentColumns = useMemo(() => currentGroup ? columns.filter(c => c.group_id === currentGroup.source.id && c.is_active !== false).sort((a,b) => Number(a.display_order||0)-Number(b.display_order||0) || String(a.name).localeCompare(String(b.name), 'vi')) : [], [columns, currentGroup]);
  const rateMap = useMemo(() => {
    const map = new Map();
    // Merge column values across policy rows. Choosing a whole row can hide the
    // other columns when a row contains only a partial values object.
    const ordered = [...rateValues].sort((a,b) => Number(String(b.policy_version_id||'')===String(policyId||'')) - Number(String(a.policy_version_id||'')===String(policyId||'')));
    for (const row of ordered) {
      const key = `${row.employee_id}|${row.group_id}`;
      const merged = { ...(map.get(key) || {}) };
      const incoming = row.values && typeof row.values === 'object' ? row.values : {};
      for (const [columnKey, value] of Object.entries(incoming)) {
        if (value !== undefined && value !== null && value !== '' && (merged[columnKey] === undefined || merged[columnKey] === null || merged[columnKey] === '' || String(row.policy_version_id||'')===String(policyId||''))) merged[columnKey] = value;
      }
      map.set(key, merged);
    }
    return map;
  }, [rateValues, policyId]);
  const recordMap = useMemo(() => new Map(records.map(r => [`${r.employee_id}|${r.salary_rate_column_id}`, Number(r.lesson_count || 0)])), [records]);
  const visibleEmployees = useMemo(() => snapshots.filter(e => {
    const hay = norm([e.employee_code_snapshot, e.employee_name_snapshot, e.department_snapshot, e.position_snapshot].join(' '));
    return !norm(search) || hay.includes(norm(search));
  }).sort((a,b) => String(a.employee_code_snapshot || '').localeCompare(String(b.employee_code_snapshot || ''), 'vi', { numeric: true })), [snapshots, search]);
  const groupTotals = useMemo(() => {
    let lessons = 0, total = 0, missingRates = 0;
    for (const employee of visibleEmployees) {
      const rates = rateMap.get(`${employee.employee_id}|${currentGroup?.source?.id}`) || {};
      for (const col of currentColumns) {
        const n = recordMap.get(`${employee.employee_id}|${col.id}`) || 0;
        const rawRate = rateValueFor(rates, col);
        if (rawRate === '' || rawRate == null || !Number.isFinite(Number(rawRate))) missingRates++;
        else { lessons += n; total += n * Number(rawRate); }
      }
    }
    return { lessons, total, missingRates };
  }, [visibleEmployees, rateMap, currentGroup, currentColumns, recordMap]);

  const load = useCallback(async (preserve = true) => {
    if (!supabase) {
      setNotice({ type: 'error', text: 'Chưa cấu hình Supabase. Không thể tải hoặc lưu dữ liệu.' });
      setLoading(false);
      return;
    }
    setLoading(true); setNotice(null);
    try {
      const [periodRows, groupRowsResult, columnRows, policyRows] = await Promise.all([
        fetchAll(() => supabase.from(PERIODS).select('id,period_code,period_year,period_month,salary_version_id,status,created_at').order('period_year', { ascending: false }).order('period_month', { ascending: false })),
        supabase.from(GROUPS).select('*').order('sort_order').order('name'),
        supabase.from(COLUMNS).select('*').order('display_order').order('name'),
        fetchAll(() => supabase.from(RATE_VALUES).select('employee_id,group_id,policy_version_id,values')),
      ]);
      for (const result of [groupRowsResult, columnRows]) if (result.error) throw result.error;
      const nextPeriods = periodRows || [];
      setPeriods(nextPeriods);
      setGroups(groupRowsResult.data || []);
      setColumns(columnRows.data || []);
      setRateValues(policyRows || []);
      const nextId = periodId && nextPeriods.some(p => p.id === periodId) ? periodId : nextPeriods[0]?.id || '';
      setPeriodId(nextId);
      if (!nextId) {
        setSnapshots([]); setRecords([]);
        setNotice({ type: 'info', text: 'Chưa có Kỳ Lương. Hãy tạo kỳ tại mục Quản Lý Kỳ Lương trước.' });
        return;
      }
      const [snapshotResult, recordsResult] = await Promise.all([
        fetchAll(() => supabase.from(SNAPSHOTS).select('*').eq('period_id', nextId).order('employee_code_snapshot')),
        fetchAll(() => supabase.from(RECORDS).select('*').eq('period_id', nextId).order('employee_id')),
      ]);
      setSnapshots(snapshotResult || []);
      setRecords(recordsResult || []);
      if (!(snapshotResult || []).length) setNotice({ type: 'info', text: 'Kỳ này chưa có danh sách nhân sự chốt. Module chỉ sử dụng snapshot của kỳ, không tự lấy danh sách nhân sự hiện tại.' });
      else setNotice({ type: 'success', text: 'Đã tải cấu hình định mức, đơn giá và số tiết từ Supabase.' });
    } catch (e) {
      setNotice({ type: 'error', text: `Không tải được Chấm Công Tiết Dạy: ${errorText(e)}. Kiểm tra schema, migration và RLS.` });
    } finally { setLoading(false); }
  }, [periodId]);

  useEffect(() => { load(false); }, []); // Load on mount.
  useEffect(() => {
    if (!periodId || !supabase) { setSnapshots([]); setRecords([]); return; }
    let alive = true;
    (async () => {
      setLoading(true); setNotice(null);
      try {
        const [snapshotRows, recordRows] = await Promise.all([
          fetchAll(() => supabase.from(SNAPSHOTS).select('*').eq('period_id', periodId).order('employee_code_snapshot')),
          fetchAll(() => supabase.from(RECORDS).select('*').eq('period_id', periodId).order('employee_id')),
        ]);
        if (!alive) return;
        setSnapshots(snapshotRows); setRecords(recordRows);
        if (!snapshotRows.length) setNotice({ type: 'info', text: 'Kỳ này chưa có danh sách nhân sự chốt. Hãy kiểm tra Quản Lý Kỳ Lương/Chấm Công Ngày.' });
      } catch (e) { if (alive) setNotice({ type: 'error', text: `Không tải được dữ liệu của kỳ: ${errorText(e)}` }); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [periodId]);

  function startEdit(employee) {
    const next = {};
    for (const col of currentColumns) next[col.id] = String(recordMap.get(`${employee.employee_id}|${col.id}`) ?? 0);
    setEditingEmployee(employee.employee_id);
    setDraft(next);
  }
  function cancelEdit() { setEditingEmployee(''); setDraft({}); }

  async function saveEmployee(employee) {
    if (!selectedPeriod || locked || !currentGroup) return;
    const values = currentColumns.map(col => {
      const parsed = parseNumber(draft[col.id] ?? 0);
      return { col, parsed };
    });
    const invalid = values.find(x => !x.parsed.valid);
    if (invalid) { setNotice({ type: 'error', text: `Số tiết không hợp lệ tại cột ${invalid.col.name}. Chỉ nhập số không âm.` }); return; }
    const missing = values.find(({ col }) => {
      const rates = rateMap.get(`${employee.employee_id}|${currentGroup.source.id}`) || {};
      const rate = rateValueFor(rates, col); return rate == null || rate === '' || !Number.isFinite(Number(rate));
    });
    if (missing) {
      setNotice({ type: 'error', text: `Chưa có đơn giá hợp lệ cho ${employee.employee_name_snapshot} · ${missing.col.name}. Hãy bổ sung Định Mức Lương trước khi lưu.` });
      return;
    }
    setSaving(true); setNotice(null);
    try {
      const payload = values.map(({ col, parsed }) => ({
        period_id: selectedPeriod.id,
        employee_id: employee.employee_id,
        salary_rate_column_id: col.id,
        lesson_count: parsed.value,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from(RECORDS).upsert(payload, { onConflict: 'period_id,employee_id,salary_rate_column_id' });
      if (error) throw error;
      setRecords(prev => {
        const next = prev.filter(r => !(r.period_id === selectedPeriod.id && r.employee_id === employee.employee_id && currentColumns.some(c => c.id === r.salary_rate_column_id)));
        return [...next, ...payload];
      });
      cancelEdit();
      setNotice({ type: 'success', text: `Đã lưu số tiết của ${employee.employee_name_snapshot}.` });
    } catch (e) { setNotice({ type: 'error', text: `Không lưu được số tiết: ${errorText(e)}` }); }
    finally { setSaving(false); }
  }

  async function importFile(file) {
    if (!file || !selectedPeriod || locked || !currentGroup) return;
    setImporting(true); setNotice(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
      if (rows.length < 2) throw new Error('File không có dòng dữ liệu.');
      const headers = rows[0].map(v => norm(v));
      const codeIndex = headers.findIndex(h => ['ma nhan vien', 'ma nv', 'employee code', 'employee id'].includes(h));
      if (codeIndex < 0) throw new Error('Không tìm thấy cột Mã Nhân Viên trong file.');
      const colIndexes = currentColumns.map(col => {
        const candidates = [norm(col.code), norm(col.name), `${norm(col.name)} so tiet`, `${norm(col.code)} so tiet`];
        return { col, index: headers.findIndex(h => candidates.includes(h)) };
      });
      const missingCols = colIndexes.filter(x => x.index < 0);
      if (missingCols.length) throw new Error(`Thiếu cột số tiết: ${missingCols.map(x => x.col.name).join(', ')}. Hãy tải template mới của nhóm này.`);
      const employeeByCode = new Map(snapshots.map(e => [clean(e.employee_code_snapshot).toUpperCase(), e]));
      const updates = [], errors = [], seenEmployeeCodes = new Set();
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row.some(v => clean(v) !== '')) continue;
        const code = clean(row[codeIndex]).toUpperCase();
        if (seenEmployeeCodes.has(code)) { errors.push(`Dòng ${i+1}: Mã nhân viên ${code} bị lặp trong file.`); continue; }
        seenEmployeeCodes.add(code);
        const employee = employeeByCode.get(code);
        if (!employee) { errors.push(`Dòng ${i+1}: Mã nhân viên "${code}" không thuộc danh sách chốt kỳ.`); continue; }
        const rates = rateMap.get(`${employee.employee_id}|${currentGroup.source.id}`) || {};
        const values = [];
        let invalid = false;
        for (const { col, index } of colIndexes) {
          const parsed = parseNumber(row[index]);
          if (!parsed.valid) { errors.push(`Dòng ${i+1}: Số tiết không hợp lệ tại ${col.name}.`); invalid = true; break; }
          if (rates[col.id] == null || rates[col.id] === '' || !Number.isFinite(Number(rates[col.id]))) {
            errors.push(`Dòng ${i+1}: Chưa có đơn giá cho ${code} · ${col.name}.`); invalid = true; break;
          }
          values.push({ period_id: selectedPeriod.id, employee_id: employee.employee_id, salary_rate_column_id: col.id, lesson_count: parsed.value, updated_at: new Date().toISOString() });
        }
        if (!invalid) updates.push(...values);
      }
      if (!updates.length) throw new Error(`Không có dữ liệu hợp lệ để Import. ${errors.slice(0, 4).join(' ')}`);
      const { error } = await supabase.from(RECORDS).upsert(updates, { onConflict: 'period_id,employee_id,salary_rate_column_id' });
      if (error) throw error;
      await load(true);
      const summary = `Import thành công ${new Set(updates.map(x => x.employee_id)).size} nhân sự, ${updates.length} ô số tiết.` + (errors.length ? ` Có ${errors.length} lỗi; ví dụ: ${errors.slice(0, 3).join(' ')}` : '');
      setNotice({ type: errors.length ? 'info' : 'success', text: summary });
    } catch (e) { setNotice({ type: 'error', text: `Import thất bại: ${errorText(e)}` }); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  function exportCurrent(template = false) {
    if (!selectedPeriod || !currentGroup) return;
    const headers = ['Mã Nhân Viên', 'Họ Tên', ...currentColumns.map(c => c.code || c.name)];
    const rows = visibleEmployees.map(e => [
      e.employee_code_snapshot, e.employee_name_snapshot,
      ...currentColumns.map(c => template ? '' : recordMap.get(`${e.employee_id}|${c.id}`) ?? 0),
    ]);
    downloadWorkbook(`${template ? 'Template-' : ''}Cham-Cong-Tiet-${norm(currentGroup.label).replace(/\s+/g,'-')}-${selectedPeriod.period_code || selectedPeriod.id}.xlsx`, 'SoTiet', [headers, ...rows]);
  }

  if (loading && !periods.length) return <div className="teaching-attendance"><div className="ta-state"><span className="ta-spinner" />Đang tải dữ liệu Chấm Công Tiết Dạy…</div></div>;

  return <section className="teaching-attendance">
    <div className="ta-toolbar">
      <div className="ta-period-field">
        <label htmlFor="ta-period">Kỳ Lương</label>
        <select id="ta-period" value={periodId} onChange={e => { setPeriodId(e.target.value); cancelEdit(); }} disabled={!periods.length}>
          {!periods.length && <option value="">Chưa có Kỳ Lương</option>}
          {periods.map(p => <option key={p.id} value={p.id}>{periodLabel(p)}</option>)}
        </select>
        {selectedPeriod && <span className={`ta-status ${locked ? 'locked' : 'open'}`}>{selectedPeriod.status || '—'}</span>}
      </div>
      <button className="ta-btn ta-btn-secondary" onClick={() => load(true)} disabled={loading}><RefreshCw size={15} className={loading ? 'ta-spin' : ''}/> Làm mới</button>
    </div>

    {notice && <div className={`ta-notice ${notice.type}`} role="status">
      {notice.type === 'error' ? <AlertCircle size={17}/> : notice.type === 'success' ? <CheckCircle2 size={17}/> : <AlertCircle size={17}/>}
      <span>{notice.text}</span><button aria-label="Đóng thông báo" onClick={() => setNotice(null)}><X size={15}/></button>
    </div>}

    {selectedPeriod && <>
      <div className="ta-summary-grid">
        <div className="ta-summary-card"><span>Nhân sự chốt kỳ</span><strong>{snapshots.length.toLocaleString('vi-VN')}</strong></div>
        <div className="ta-summary-card"><span>Thành phần định mức</span><strong>{currentColumns.length.toLocaleString('vi-VN')}</strong></div>
        <div className="ta-summary-card"><span>Tổng số tiết nhóm đang xem</span><strong>{fmt(groupTotals.lessons)}</strong></div>
        <div className="ta-summary-card"><span>Tổng tiền nhóm đang xem</span><strong>{money(groupTotals.total)}</strong></div>
      </div>

      <div className="ta-card">
        <div className="ta-card-heading">
          <div><div className="ta-heading-title"><GraduationCap size={18}/> Chấm Công Tiết Dạy</div><p>Nhóm, cột và đơn giá được kế thừa từ Định Mức Lương; tại đây chỉ nhập số tiết.</p></div>
          {locked && <span className="ta-locked-label"><LockKeyhole size={14}/> Kỳ đã khóa</span>}
        </div>
        <div className="ta-tabs" role="tablist" aria-label="Nhóm chấm tiết">
          {GROUP_DEFS.map(def => {
            const actual = groupRows.find(g => g.key === def.key);
            if (!actual) return null;
            const count = columns.filter(c => c.group_id === actual.source.id && c.is_active !== false).length;
            return <button key={def.key} role="tab" aria-selected={tab === def.key} className={`ta-tab ${tab === def.key ? 'active' : ''}`} onClick={() => { setTab(def.key); cancelEdit(); }}>
              {def.label}<span>{count}</span>
            </button>;
          })}
        </div>
        {!groupRows.length ? <div className="ta-empty"><AlertCircle size={20}/><strong>Chưa tìm thấy nhóm định mức</strong><p>Kiểm tra mã nhóm TEACHING, TUTORING và OTHER tại Định Mức Lương. Không tự tạo nhóm mới ở màn hình này.</p></div> : <>
          <div className="ta-table-tools">
            <div className="ta-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã nhân viên, họ tên…"/></div>
            <div className="ta-actions">
              <button className="ta-btn ta-btn-secondary" onClick={() => exportCurrent(true)} disabled={locked || !currentColumns.length}><FileSpreadsheet size={15}/> Template</button>
              <button className="ta-btn ta-btn-secondary" onClick={() => fileRef.current?.click()} disabled={locked || importing || !currentColumns.length}><Upload size={15}/> {importing ? 'Đang Import…' : 'Import'}</button>
              <button className="ta-btn ta-btn-secondary" onClick={() => exportCurrent(false)} disabled={!currentColumns.length}><Download size={15}/> Export</button>
              <input ref={fileRef} className="ta-hidden-input" type="file" accept=".xlsx,.xls" onChange={e => importFile(e.target.files?.[0])}/>
            </div>
          </div>
          {!currentColumns.length ? <div className="ta-empty"><AlertCircle size={20}/><strong>Nhóm này chưa có cột định mức</strong><p>Hãy cấu hình cột tại Định Mức Lương. Module này không tự thêm cột.</p></div> :
          <div className="ta-table-wrap">
            <table className="ta-table">
              <thead>
                <tr>
                  <th rowSpan="2" className="ta-sticky-code">Mã NV</th>
                  <th rowSpan="2" className="ta-sticky-name">Họ và tên</th>
                  <th rowSpan="2">Phòng ban / Chức vụ</th>
                  {currentColumns.map(col => <th key={col.id} colSpan="2" className="ta-component-head">{col.name}</th>)}
                  <th rowSpan="2" className="ta-money-head">Tổng tiền</th>
                  <th rowSpan="2" className="ta-action-head">Thao tác</th>
                </tr>
                <tr>{currentColumns.map(col => <React.Fragment key={col.id}><th className="ta-subhead">Số tiết</th><th className="ta-subhead">Đơn giá</th></React.Fragment>)}</tr>
              </thead>
              <tbody>
                {visibleEmployees.map(employee => {
                  const editing = editingEmployee === employee.employee_id;
                  const rates = rateMap.get(`${employee.employee_id}|${currentGroup?.source?.id}`) || {};
                  let total = 0, missing = false;
                  const cells = currentColumns.map(col => {
                    const count = recordMap.get(`${employee.employee_id}|${col.id}`) || 0;
                    const rawRate = rateValueFor(rates, col);
                    const rate = rawRate == null || rawRate === '' || !Number.isFinite(Number(rawRate)) ? null : Number(rawRate);
                    if (rate == null) missing = true; else total += count * rate;
                    return { col, count, rate, amount: rate == null ? null : count * rate };
                  });
                  if (editing) {
                    total = 0;
                    cells.forEach(cell => {
                      const parsed = parseNumber(draft[cell.col.id] ?? 0);
                      if (cell.rate == null || !parsed.valid) missing = true;
                      else total += parsed.value * cell.rate;
                    });
                  }
                  return <tr key={employee.employee_id}>
                    <td className="ta-sticky-code ta-employee-code">{employee.employee_code_snapshot}</td>
                    <td className="ta-sticky-name"><strong>{employee.employee_name_snapshot}</strong></td>
                    <td className="ta-department">{[employee.department_snapshot, employee.position_snapshot].filter(Boolean).join(' · ') || '—'}</td>
                    {cells.map(({col,count,rate,amount}) => <React.Fragment key={col.id}>
                      <td className="ta-number-cell">{editing ? <input className="ta-count-input" type="number" min="0" step="any" value={draft[col.id] ?? 0} onChange={e => setDraft(prev => ({...prev,[col.id]:e.target.value}))} aria-label={`${employee.employee_code_snapshot} ${col.name} số tiết`}/> : fmt(count)}</td>
                      <td className="ta-rate-cell">{rate == null ? <span className="ta-missing-rate">Chưa có đơn giá</span> : money(rate)}{!editing && rate != null && <span className="ta-cell-amount">Thành tiền: {money(amount)}</span>}</td>
                    </React.Fragment>)}
                    <td className="ta-total-cell">{missing ? <span className="ta-missing-rate">Thiếu đơn giá</span> : money(total)}</td>
                    <td className="ta-action-cell">{editing ? <div className="ta-row-actions"><button className="ta-btn ta-btn-primary" onClick={() => saveEmployee(employee)} disabled={saving}><Save size={14}/> Lưu</button><button className="ta-btn ta-btn-ghost" onClick={cancelEdit} disabled={saving}><X size={14}/> Hủy</button></div> : <button className="ta-btn ta-btn-secondary ta-edit-btn" onClick={() => startEdit(employee)} disabled={locked || saving}><Pencil size={14}/> Sửa số tiết</button>}</td>
                  </tr>;
                })}
                {!visibleEmployees.length && <tr><td colSpan={currentColumns.length*2+5} className="ta-no-data">Không có nhân sự phù hợp.</td></tr>}
              </tbody>
              <tfoot><tr><th colSpan="3">Tổng nhóm (nhân sự đang hiển thị)</th>{currentColumns.map(col => {
                const rateValuesForCol = visibleEmployees.reduce((sum, e) => sum + (recordMap.get(`${e.employee_id}|${col.id}`) || 0), 0);
                const allRates = visibleEmployees.every(e => {
                  const r = rateMap.get(`${e.employee_id}|${currentGroup?.source?.id}`) || {};
                  return r[col.id] != null && r[col.id] !== '' && Number.isFinite(Number(r[col.id]));
                });
                const amount = visibleEmployees.reduce((sum,e) => {
                  const r = rateMap.get(`${e.employee_id}|${currentGroup?.source?.id}`) || {};
                  return sum + (recordMap.get(`${e.employee_id}|${col.id}`)||0) * (Number(r[col.id])||0);
                },0);
                return <React.Fragment key={col.id}><th>{fmt(rateValuesForCol)}</th><th>{allRates ? money(amount) : 'Thiếu đơn giá'}</th></React.Fragment>;
              })}<th>{groupTotals.missingRates ? 'Thiếu đơn giá' : money(groupTotals.total)}</th><th>—</th></tr></tfoot>
            </table>
          </div>}
        </>}
      </div>
    </>}
  </section>;
}
