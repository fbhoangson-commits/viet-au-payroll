import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { CalendarDays, Download, Upload, RefreshCw, Search, FileSpreadsheet, AlertCircle, Save } from 'lucide-react';
import { supabase } from '../../shared/supabase.js';
import { fetchEmployees } from '../employee-master/services/employeeService.js';
import './workday-norms.css';

const FIXED_COMPONENTS = [
  { code: 'BASE_SALARY', labels: ['lương cơ bản', 'base_salary'] },
  { code: 'SENIORITY', labels: ['thâm niên', 'seniority'] },
  { code: 'SENIORITY_2026', labels: ['thâm niên 2026', 'seniority_2026'] },
  { code: 'ALLOWANCE', labels: ['phụ cấp', 'allowance'] },
];
const norm = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLocaleLowerCase('vi').trim().replace(/\s+/g, ' ');
const getPosition = (e) => e.position || e.job_title || e.role || e.chuc_danh || e['Chức danh'] || e['Chức vụ'] || e.custom_fields?.position || e.custom_fields?.job_title || '';
const getName = (e) => e.full_name || e.name || e.employee_name || '—';
const getCode = (e) => e.employee_code || e.code || e.id || '—';
const money = (n) => Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
function downloadCsv(name, rows) { const csv = '\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\r\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }
function parseNumber(raw) { const s = String(raw ?? '').trim().replace(/[\s₫đĐ]/g, ''); if (!s) return null; if (!/^[+-]?[\d.,]+$/.test(s)) return NaN; let t = s; if (s.includes(',') && s.includes('.')) t = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''); else if (s.includes(',') || s.includes('.')) { const sep = s.includes(',') ? ',' : '.'; const parts = s.split(sep); t = parts.length === 2 && parts[1].length !== 3 ? parts.join('.') : parts.join(''); } const n = Number(t); return Number.isFinite(n) ? n : NaN; }
function expandEmployee(e) { return { ...e, custom_fields: e.custom_fields && typeof e.custom_fields === 'object' ? e.custom_fields : {} }; }
function getEmployeePosition(e) { const direct = getPosition(e); if (direct) return String(direct).trim(); const cf = e.custom_fields || {}; const key = Object.keys(cf).find(k => ['chuc danh', 'chuc vu', 'position', 'job title'].includes(norm(k))); return key ? String(cf[key] || '').trim() : ''; }
function getPolicyCode(p) { return p?.code || p?.name || ''; }

export default function Page() {
  const [employees, setEmployees] = useState([]); const [policies, setPolicies] = useState([]); const [policyId, setPolicyId] = useState('');
  const [norms, setNorms] = useState([]); const [fields, setFields] = useState([]); const [rateValues, setRateValues] = useState([]); const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false); const [search, setSearch] = useState(''); const [message, setMessage] = useState(null); const [importSummary, setImportSummary] = useState(null);

  const load = useCallback(async () => {
    if (!supabase) { setMessage({ type: 'error', text: 'Chưa cấu hình kết nối Supabase.' }); return; }
    setLoading(true); setMessage(null);
    try {
      const results = await Promise.all([
        fetchEmployees(),
        supabase.from('salary_policy_versions').select('id,code,name,status,effective_from,effective_to').order('effective_from', { ascending: false }),
        supabase.from('salary_workday_norms').select('*').order('position_name'),
        supabase.from('salary_rate_fields').select('*').order('sort_order').order('name'),
        supabase.from('salary_rate_values').select('*'),
        supabase.from('salary_rate_groups').select('*'),
      ]);
      const [employeeRows, p, n, f, v, g] = results;
      if (p.error) throw p.error; if (n.error) throw n.error; if (f.error) throw f.error; if (v.error) throw v.error; if (g.error) throw g.error;
      setEmployees((employeeRows || []).map(expandEmployee)); setPolicies(p.data || []); setNorms(n.data || []); setFields(f.data || []); setRateValues(v.data || []); setGroups(g.data || []);
      setPolicyId(old => old && (p.data || []).some(x => x.id === old) ? old : ((p.data || []).find(x => String(x.status).toUpperCase() === 'ACTIVE') || (p.data || [])[0])?.id || '');
    } catch (e) { setMessage({ type: 'error', text: `Không tải được dữ liệu: ${e.message || e.code}. Kiểm tra schema và migration Định Mức Ngày Công.` }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const fixedFieldMap = useMemo(() => FIXED_COMPONENTS.map(component => ({ ...component, field: fields.find(f => [f.code, f.field_code, f.name, f.label].some(x => x && component.labels.includes(norm(x)) || x && norm(x).replace(/_/g, ' ') === norm(component.code).replace(/_/g, ' '))) })), [fields]);
  const fixedGroupId = useMemo(() => groups.find(g => norm(g.name) === 'co dinh' || norm(g.code) === 'fixed')?.id, [groups]);
  const normByPosition = useMemo(() => new Map(norms.filter(n => n.policy_version_id === policyId).map(n => [norm(n.position_key || n.position_name), n])), [norms, policyId]);
  const rateMap = useMemo(() => new Map(rateValues.filter(v => v.policy_version_id === policyId && (!fixedGroupId || v.group_id === fixedGroupId)).map(v => [v.employee_id, v])), [rateValues, policyId, fixedGroupId]);
  const rows = useMemo(() => employees.map(e => {
    const position = getEmployeePosition(e); const workdayNorm = normByPosition.get(norm(position)); const stored = rateMap.get(e.id) || rateMap.get(e.supabase_id);
    const values = stored?.values || {}; const components = fixedFieldMap.map(c => ({ ...c, value: c.field ? values[c.field.id] : undefined }));
    const missing = components.filter(c => c.value === undefined || c.value === null || c.value === '').map(c => c.labels[0]);
    const days = Number(workdayNorm?.workday_count); const total = components.every(c => c.value !== undefined && c.value !== null && c.value !== '') ? components.reduce((sum, c) => sum + Number(c.value), 0) : null;
    const daily = total !== null && Number.isFinite(days) && days > 0 ? total / days : null; const hourly = daily === null ? null : daily / 8; const minute = hourly === null ? null : hourly / 60;
    return { employee: e, code: getCode(e), name: getName(e), position, workdayNorm, days, components, total, daily, hourly, minute, missing };
  }).filter(r => !search || norm([r.code, r.name, r.position].join(' ')).includes(norm(search))), [employees, normByPosition, rateMap, fixedFieldMap, search]);

  async function importFile(file) {
    setMessage(null); setImportSummary(null); if (!file) return;
    try {
      const isExcel = /\.(xlsx|xls)$/i.test(file.name); let data;
      if (isExcel) { const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' }); const ws = wb.Sheets[wb.SheetNames[0]]; data = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false }); }
      else { const text = (await file.text()).replace(/^\uFEFF/, ''); const wb = XLSX.read(text, { type: 'string' }); data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false }); }
      if (!data.length) throw new Error('File không có dòng dữ liệu.');
      const headers = Object.keys(data[0]);
      const codeHeader = headers.find(h => ['ma nhan vien', 'ma nv', 'employee code', 'employee_code', 'staff code', 'code'].includes(norm(h).replace(/_/g, ' ')));
      const daysHeader = headers.find(h => ['so ngay cong', 'ngay cong', 'workday count', 'workdays', 'days'].includes(norm(h)));
      if (!codeHeader || !daysHeader) throw new Error('File cần có hai cột: Mã Nhân Viên và Số ngày công. Hệ thống sẽ tra vị trí từ Nhân Sự Master theo mã nhân viên.');
      if (!policyId) throw new Error('Vui lòng chọn Chính Sách Lương trước khi Import.');
      const employeeByCode = new Map();
      employees.forEach(e => { const code = String(getCode(e) || '').trim().toUpperCase(); if (code && code !== '—') employeeByCode.set(code, e); });
      const seenCodes = new Set(); const byPosition = new Map(); const errors = []; let matchedEmployees = 0;
      data.forEach((r, i) => {
        const code = String(r[codeHeader] ?? '').trim().toUpperCase();
        const days = parseNumber(r[daysHeader]);
        if (!code) { errors.push(`Dòng ${i + 2}: thiếu Mã Nhân Viên.`); return; }
        if (seenCodes.has(code)) { errors.push(`Dòng ${i + 2}: Mã Nhân Viên ${code} bị trùng.`); return; }
        seenCodes.add(code);
        const employee = employeeByCode.get(code);
        if (!employee) { errors.push(`Dòng ${i + 2}: không tìm thấy Mã Nhân Viên ${code} trong Nhân Sự Master.`); return; }
        const position = getEmployeePosition(employee);
        if (!position) { errors.push(`Dòng ${i + 2}: nhân sự ${code} chưa có Vị trí/Chức danh trong Nhân Sự Master.`); return; }
        if (days === null || !Number.isFinite(days) || days <= 0) { errors.push(`Dòng ${i + 2}: số ngày công phải lớn hơn 0.`); return; }
        matchedEmployees++;
        const key = norm(position); const existing = byPosition.get(key);
        if (existing && Number(existing.workday_count) !== Number(days)) {
          errors.push(`Dòng ${i + 2}: vị trí “${position}” có số ngày công không thống nhất (${existing.workday_count} và ${days}).`); return;
        }
        if (!existing) byPosition.set(key, { position_name: position, position_key: key, workday_count: days, policy_version_id: policyId });
      });
      const valid = [...byPosition.values()];
      if (errors.length) setImportSummary({ errors, validCount: valid.length, total: data.length, matchedEmployees });
      if (!valid.length) throw new Error(errors.slice(0, 5).join(' ') || 'Không có dòng hợp lệ để Import.');
      const confirmed = window.confirm(`Xác nhận Import định mức ngày công cho chính sách ${getPolicyCode(policies.find(p => p.id === policyId))}?\n\nMã nhân viên đối chiếu: ${matchedEmployees}\nVị trí hợp lệ để lưu: ${valid.length}\nDòng lỗi: ${errors.length}\n\nVị trí được lấy từ Nhân Sự Master theo Mã Nhân Viên. Các vị trí không có trong file sẽ được giữ nguyên.`);
      if (!confirmed) return;
      setBusy(true);
      const { error } = await supabase.from('salary_workday_norms').upsert(valid, { onConflict: 'policy_version_id,position_key' }); if (error) throw error;
      await load(); setImportSummary({ errors, validCount: valid.length, total: data.length, saved: valid.length, matchedEmployees }); setMessage({ type: errors.length ? 'warning' : 'success', text: `Import thành công ${valid.length} vị trí từ ${matchedEmployees} mã nhân viên; ${errors.length} dòng cần kiểm tra.` });
    } catch (e) { setMessage({ type: 'error', text: `Không Import được: ${e.message || e}` }); }
    finally { setBusy(false); }
  }
  function downloadTemplate() { downloadCsv('template-dinh-muc-ngay-cong.csv', [['Mã Nhân Viên', 'Số ngày công'], ['VA001', '26'], ['VA002', '26']]); }
  function exportRows() { downloadCsv('dinh-muc-ngay-cong.csv', [['Mã Nhân Viên', 'Họ và Tên', 'Vị trí', 'Chính Sách Lương', 'Số ngày công', 'Lương/ngày Công', 'Đơn giá Giờ', 'Đơn giá Phút', 'Trạng thái'], ...rows.map(r => [r.code, r.name, r.position, getPolicyCode(policies.find(p => p.id === policyId)), r.workdayNorm?.workday_count ?? '', r.daily ?? '', r.hourly ?? '', r.minute ?? '', r.daily === null ? `Thiếu dữ liệu: ${[...r.missing, !r.workdayNorm ? 'Định mức ngày công' : ''].filter(Boolean).join(', ')}` : 'Đủ dữ liệu'])]); }

  function downloadTemplate() { downloadCsv('template-dinh-muc-ngay-cong.csv', [['Vị trí', 'Số ngày công'], ['Giáo viên', '26'], ['Văn Phòng', '26']]); }
  function exportRows() { downloadCsv('dinh-muc-ngay-cong.csv', [['Mã Nhân Viên', 'Họ và Tên', 'Vị trí', 'Chính Sách Lương', 'Số ngày công', 'Lương Cơ Bản', 'Thâm Niên', 'Thâm Niên 2026', 'Phụ Cấp', 'Tổng lương cố định', 'Lương/ngày Công', 'Trạng thái'], ...rows.map(r => [r.code, r.name, r.position, getPolicyCode(policies.find(p => p.id === policyId)), r.workdayNorm?.workday_count ?? '', ...r.components.map(c => c.value ?? ''), r.total ?? '', r.daily ?? '', r.daily === null ? `Thiếu dữ liệu: ${[...r.missing, !r.workdayNorm ? 'Định mức ngày công' : ''].filter(Boolean).join(', ')}` : 'Đủ dữ liệu'])]); }

  return <section className="feature-page workday-module">
    <div className="feature-heading"><div className="feature-heading-icon"><CalendarDays size={19}/></div><div><div className="eyebrow">KHÔNG GIAN NGHIỆP VỤ</div><h2>Định Mức Ngày Công</h2><p>Import định mức theo vị trí và tính Lương/ngày Công từ 4 thành phần lương cố định.</p></div></div>
    <div className="wn-toolbar">
      <button className="wn-button" onClick={downloadTemplate}><FileSpreadsheet size={15}/> Tải template</button>
      <label className="wn-button"><Upload size={15}/> Import<input type="file" accept=".csv,.xlsx,.xls" onChange={e => { importFile(e.target.files?.[0]); e.target.value = ''; }}/></label>
      <button className="wn-button" onClick={exportRows}><Download size={15}/> Export</button>
      <button className="wn-button" onClick={load} disabled={loading}><RefreshCw size={15}/> Làm mới</button>
      <label className="wn-policy">Chính Sách Lương<select value={policyId} onChange={e => setPolicyId(e.target.value)}><option value="">Chọn chính sách</option>{policies.map(p => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></label>
      <label className="wn-search"><Search size={15}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã, họ tên, vị trí..."/></label>
    </div>
    {message && <div className={`wn-message ${message.type}`}><AlertCircle size={16}/><span>{message.text}</span></div>}
    {importSummary?.errors?.length > 0 && <details className="wn-errors"><summary>Xem {importSummary.errors.length} dòng cần kiểm tra</summary><ul>{importSummary.errors.map((e, i) => <li key={i}>{e}</li>)}</ul></details>}
    <div className="wn-formula"><strong>Công thức:</strong> Lương/ngày Công = tổng 4 thành phần lương cố định lấy từ Định Mức Lương ÷ Số ngày công; Đơn giá Giờ = Lương/ngày Công ÷ 8; Đơn giá Phút = Đơn giá Giờ ÷ 60. <span>Các thành phần lương được lấy ngầm từ Định Mức Lương, không hiển thị thành cột riêng.</span></div>
    <div className="wn-table-wrap"><table className="wn-table"><thead><tr><th>Mã Nhân Viên</th><th>Họ và Tên</th><th>Vị trí</th><th>Số ngày công</th><th>Lương/ngày Công</th><th>Đơn giá Giờ</th><th>Đơn giá Phút</th></tr></thead><tbody>{rows.map(r => <tr key={r.employee.id}><td className="wn-code">{r.code}</td><td><strong>{r.name}</strong><small>{r.employee.employee_group || r.employee.custom_fields?.employee_group || r.employee['Nhóm'] || ''}</small></td><td>{r.position || '—'}</td><td>{r.workdayNorm ? money(r.days) : <span className="wn-missing">Chưa cấu hình</span>}</td><td className={r.daily === null ? 'wn-no-result' : 'wn-daily'}>{r.daily === null ? <span title={[...r.missing, !r.workdayNorm ? 'Chưa có định mức ngày công' : ''].filter(Boolean).join(', ')}>Thiếu dữ liệu</span> : money(r.daily)}</td><td className={r.hourly === null ? 'wn-no-result' : 'wn-daily'}>{r.hourly === null ? '—' : money(r.hourly)}</td><td className={r.minute === null ? 'wn-no-result' : 'wn-daily'}>{r.minute === null ? '—' : money(r.minute)}</td></tr>)}{!rows.length && <tr><td colSpan={7} className="wn-empty">{loading ? 'Đang tải dữ liệu...' : 'Không có dữ liệu phù hợp.'}</td></tr>}</tbody></table></div>
    <div className="wn-footer">Hiển thị {rows.length}/{employees.length} nhân sự · Lương/ngày Công, Đơn giá Giờ và Đơn giá Phút là kết quả tính toán tham chiếu; không tự thay đổi các thành phần lương gốc hoặc công thức tính lương.</div>
  </section>;
}
