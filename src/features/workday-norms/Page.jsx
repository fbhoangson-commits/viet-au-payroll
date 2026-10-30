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
const money = (n) => Number.isFinite(Number(n)) ? Math.round(Number(n)).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) : '—';
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
function downloadCsv(name, rows) { const csv = '\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\r\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }
function parseNumber(raw) { const s = String(raw ?? '').trim().replace(/[\s₫đĐ]/g, ''); if (!s) return null; if (!/^[+-]?[\d.,]+$/.test(s)) return NaN; let t = s; if (s.includes(',') && s.includes('.')) t = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''); else if (s.includes(',') || s.includes('.')) { const sep = s.includes(',') ? ',' : '.'; const parts = s.split(sep); t = parts.length === 2 && parts[1].length !== 3 ? parts.join('.') : parts.join(''); } const n = Number(t); return Number.isFinite(n) ? n : NaN; }
function expandEmployee(e) { return { ...e, custom_fields: e.custom_fields && typeof e.custom_fields === 'object' ? e.custom_fields : {} }; }
function getEmployeePosition(e) { const direct = getPosition(e); if (direct) return String(direct).trim(); const cf = e.custom_fields || {}; const key = Object.keys(cf).find(k => ['chuc danh', 'chuc vu', 'position', 'job title'].includes(norm(k))); return key ? String(cf[key] || '').trim() : ''; }
function getPolicyCode(p) { return p?.code || p?.name || ''; }
function getRateValue(values, field, component) {
  if (!values || !field) return undefined;
  const keys = [field.id, field.code, field.field_code, field.name, field.label, component.code, ...component.labels];
  for (const key of keys) { if (key != null && Object.prototype.hasOwnProperty.call(values, key) && values[key] !== '') return values[key]; }
  const wanted = new Set(keys.filter(Boolean).map(k => norm(k).replace(/_/g, ' ')));
  const found = Object.keys(values).find(k => wanted.has(norm(k).replace(/_/g, ' ')));
  return found ? values[found] : undefined;
}

export default function Page() {
  const [employees, setEmployees] = useState([]); const [policies, setPolicies] = useState([]); const [policyId, setPolicyId] = useState(''); const [rateVersions,setRateVersions]=useState([]); const [rateVersionId,setRateVersionId]=useState('');
  const [norms, setNorms] = useState([]); const [fields, setFields] = useState([]); const [rateValues, setRateValues] = useState([]); const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false); const [search, setSearch] = useState(''); const [message, setMessage] = useState(null); const [importSummary, setImportSummary] = useState(null);

  const load = useCallback(async () => {
    if (!supabase) { setMessage({ type: 'error', text: 'Chưa cấu hình kết nối Supabase.' }); return; }
    setLoading(true); setMessage(null);
    try {
      const results = await Promise.all([
        fetchEmployees(),
        supabase.from('salary_policy_versions').select('id,code,name,status,effective_from,effective_to').order('effective_from', { ascending: false }),
        supabase.from('salary_workday_norms').select('*').order('created_at', { ascending: false }),
        supabase.from('salary_rate_columns').select('*').eq('is_active', true).order('display_order').order('name'),
        supabase.from('salary_rate_values').select('*'),
        supabase.from('salary_rate_versions').select('*').order('created_at'),
        supabase.from('salary_rate_version_values').select('*'),
        supabase.from('salary_rate_groups').select('*'),
      ]);
      const [employeeRows, p, n, f, v, g, rv, rvv] = results;
      if (p.error) throw p.error; if (n.error) throw n.error; if (f.error) throw f.error; if (v.error) throw v.error; if (g.error) throw g.error; if (rv.error) throw rv.error; if (rvv.error) throw rvv.error;
      setEmployees((employeeRows || []).map(expandEmployee)); setPolicies(p.data || []); setNorms(n.data || []); setFields(f.data || []); setRateValues([...(v.data || []),...(rvv.data || [])]); setGroups(g.data || []); setRateVersions(rv.data||[]);
      setPolicyId(old => old && (p.data || []).some(x => x.id === old) ? old : ((p.data || []).find(x => String(x.status).toUpperCase() === 'ACTIVE') || (p.data || [])[0])?.id || '');
      const chosenPolicyId=(p.data||[]).find(x=>String(x.status).toUpperCase()==='ACTIVE')?.id||(p.data||[])[0]?.id||''; setRateVersionId(old=>old&&(rv.data||[]).some(x=>x.id===old&&x.policy_version_id===(policyId||chosenPolicyId))?old:(rv.data||[]).find(x=>x.policy_version_id===(policyId||chosenPolicyId))?.id||'');
    } catch (e) { setMessage({ type: 'error', text: `Không tải được dữ liệu: ${e.message || e.code}. Kiểm tra schema và migration Định Mức Ngày Công.` }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(()=>{const list=rateVersions.filter(v=>v.policy_version_id===policyId);if(list.length&&!list.some(v=>v.id===rateVersionId))setRateVersionId(list[0].id);},[policyId,rateVersions]);
  useEffect(()=>{const v=rateVersions.find(x=>x.id===rateVersionId);if(v){if(v.groups_snapshot?.length)setGroups(v.groups_snapshot);if(v.columns_snapshot?.length)setFields(v.columns_snapshot.filter(c=>c.is_active!==false));}},[rateVersionId,rateVersions]);

  const fixedFieldMap = useMemo(() => FIXED_COMPONENTS.map(component => ({ ...component, field: fields.find(f => [f.code, f.field_code, f.name, f.label].some(x => x && component.labels.includes(norm(x)) || x && norm(x).replace(/_/g, ' ') === norm(component.code).replace(/_/g, ' '))) })), [fields]);
  const fixedGroupId = useMemo(() => groups.find(g => norm(g.name) === 'co dinh' || norm(g.code) === 'fixed')?.id, [groups]);
  const normByEmployee = useMemo(() => new Map(norms.filter(n => n.policy_version_id === policyId && n.employee_id).map(n => [String(n.employee_id), n])), [norms, policyId]);
  const rateMap = useMemo(() => { const versionRows=rateVersionId?rateValues.filter(v=>v.rate_version_id===rateVersionId):[]; const source=rateVersionId?versionRows:rateValues.filter(v=>v.policy_version_id===policyId); return new Map(source.filter(v => !fixedGroupId || v.group_id === fixedGroupId).map(v => [v.employee_id, v])); }, [rateValues, policyId, rateVersionId, fixedGroupId]);
  const rows = useMemo(() => employees.map(e => {
    const position = getEmployeePosition(e); const workdayNorm = normByEmployee.get(String(e.id)) || normByEmployee.get(String(e.supabase_id || '')); const stored = rateMap.get(e.id) || rateMap.get(e.supabase_id);
    const values = stored?.values || {}; const components = fixedFieldMap.map(c => ({ ...c, value: getRateValue(values, c.field, c) }));
    const missing = components.filter(c => c.value === undefined || c.value === null || c.value === '').map(c => c.labels[0]);
    const days = Number(workdayNorm?.workday_count);
    // Cộng các thành phần lương có giá trị hợp lệ; thành phần trống/thiếu không chặn phép tính.
    // parseNumber hỗ trợ số dạng Việt Nam như 5.000.000 hoặc 1.250,50.
    const availableAmounts = components
      .map(c => parseNumber(c.value))
      .filter(n => n !== null && Number.isFinite(n));
    const total = availableAmounts.length ? availableAmounts.reduce((sum, n) => sum + n, 0) : null;
    const daily = total !== null && Number.isFinite(days) && days > 0 ? total / days : null;
    const hourly = daily === null ? null : daily / 8;
    const minute = hourly === null ? null : hourly / 60;
    return { employee: e, code: getCode(e), name: getName(e), position, workdayNorm, days, components, total, daily, hourly, minute, missing };
  }).filter(r => !search || norm([r.code, r.name, r.position].join(' ')).includes(norm(search))), [employees, normByEmployee, rateMap, fixedFieldMap, search]);

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
      const seenCodes = new Set(); const valid = []; const errors = []; let matchedEmployees = 0;
      data.forEach((r, i) => {
        const code = String(r[codeHeader] ?? '').trim().toUpperCase();
        const days = parseNumber(r[daysHeader]);
        if (!code) { errors.push(`Dòng ${i + 2}: thiếu Mã Nhân Viên.`); return; }
        if (seenCodes.has(code)) { errors.push(`Dòng ${i + 2}: Mã Nhân Viên ${code} bị trùng.`); return; }
        seenCodes.add(code);
        const employee = employeeByCode.get(code);
        if (!employee) { errors.push(`Dòng ${i + 2}: không tìm thấy Mã Nhân Viên ${code} trong Nhân Sự Master.`); return; }
        if (days === null || !Number.isFinite(days) || days < 0 || days > 31) { errors.push(`Dòng ${i + 2}: số ngày công phải từ 0 đến 31; nhập 0 cho nhóm Không tính công.`); return; }
        const employeeId = employee.id || employee.supabase_id;
        if (!employeeId) { errors.push(`Dòng ${i + 2}: nhân sự ${code} chưa có ID ổn định để lưu.`); return; }
        matchedEmployees++;
        valid.push({ employee_id: employeeId, policy_version_id: policyId, position_key: null, position_name: null, workday_count: days });
      });
      const confirmed = window.confirm(`Xác nhận Import định mức ngày công cho chính sách ${getPolicyCode(policies.find(p => p.id === policyId))}?\n\nMã nhân viên đối chiếu: ${matchedEmployees}\nNhân sự hợp lệ để lưu: ${valid.length}\nDòng lỗi: ${errors.length}\n\nDữ liệu được lưu trực tiếp theo Mã Nhân Viên. Nhân sự không có trong file sẽ được giữ nguyên.`);
      if (!confirmed) return;
      setBusy(true);
      const { error } = await supabase.from('salary_workday_norms').upsert(valid, { onConflict: 'policy_version_id,employee_id' }); if (error) throw error;
      await load(); setImportSummary({ errors, validCount: valid.length, total: data.length, saved: valid.length, matchedEmployees }); setMessage({ type: errors.length ? 'warning' : 'success', text: `Import thành công ${valid.length} nhân sự theo Mã Nhân Viên; ${errors.length} dòng cần kiểm tra.` });
    } catch (e) { setMessage({ type: 'error', text: `Không Import được: ${e.message || e}` }); }
    finally { setBusy(false); }
  }
  function downloadTemplate() { downloadCsv('template-dinh-muc-ngay-cong.csv', [['Mã Nhân Viên', 'Số ngày công'], ['VA001', '26'], ['VA002', '28'], ['VA003', '0']]); }
  function exportRows() { downloadCsv('dinh-muc-ngay-cong.csv', [['Mã Nhân Viên', 'Họ và Tên', 'Vị trí', 'Chính Sách Lương', 'Số ngày công', 'Lương/ngày Công', 'Đơn giá Giờ', 'Đơn giá Phút', 'Trạng thái'], ...rows.map(r => [r.code, r.name, r.position, getPolicyCode(policies.find(p => p.id === policyId)), r.workdayNorm?.workday_count ?? '', r.daily ?? '', r.hourly ?? '', r.minute ?? '', r.daily === null ? `Thiếu dữ liệu: ${[...r.missing, !r.workdayNorm ? 'Định mức ngày công' : ''].filter(Boolean).join(', ')}` : 'Đủ dữ liệu'])]); }


  return <section className="feature-page workday-module">
    <div className="feature-heading"><div className="feature-heading-icon"><CalendarDays size={19}/></div><div><div className="eyebrow">KHÔNG GIAN NGHIỆP VỤ</div><h2>Định Mức Ngày Công</h2><p>Import định mức theo vị trí và tính Lương/ngày Công từ 4 thành phần lương cố định.</p></div></div>
    <div className="wn-toolbar">
      <button className="wn-button" onClick={downloadTemplate}><FileSpreadsheet size={15}/> Tải template</button>
      <label className="wn-button"><Upload size={15}/> Import<input type="file" accept=".csv,.xlsx,.xls" onChange={e => { importFile(e.target.files?.[0]); e.target.value = ''; }}/></label>
      <button className="wn-button" onClick={exportRows}><Download size={15}/> Export</button>
      <button className="wn-button" onClick={load} disabled={loading}><RefreshCw size={15}/> Làm mới</button>
      <label className="wn-policy">Chính Sách Lương<select value={policyId} onChange={e => setPolicyId(e.target.value)}><option value="">Chọn chính sách</option>{policies.map(p => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></label><label className="wn-policy">Phiên Bản Định Mức<select value={rateVersionId} onChange={e=>setRateVersionId(e.target.value)}><option value="">Chọn phiên bản</option>{rateVersions.filter(v=>v.policy_version_id===policyId).map(v=><option key={v.id} value={v.id}>{v.code} · {v.name}</option>)}</select></label>
      <label className="wn-search"><Search size={15}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã, họ tên, vị trí..."/></label>
    </div>
    {message && <div className={`wn-message ${message.type}`}><AlertCircle size={16}/><span>{message.text}</span></div>}
    {importSummary?.errors?.length > 0 && <details className="wn-errors"><summary>Xem {importSummary.errors.length} dòng cần kiểm tra</summary><ul>{importSummary.errors.map((e, i) => <li key={i}>{e}</li>)}</ul></details>}
    <div className="wn-formula"><strong>Công thức:</strong> Lương/ngày Công = tổng các thành phần lương cố định có dữ liệu lấy từ Định Mức Lương ÷ Số ngày công; Đơn giá Giờ = Lương/ngày Công ÷ 8; Đơn giá Phút = Đơn giá Giờ ÷ 60. <span>Các thành phần lương được lấy ngầm từ Định Mức Lương, không hiển thị thành cột riêng.</span></div>
    <div className="wn-table-wrap">
      <table className="wn-table">
        <thead>
          <tr>
            <th>Mã Nhân Viên</th><th>Họ và Tên</th><th>Vị trí</th><th>Số ngày công</th>
            <th>Lương/ngày Công</th><th>Đơn giá Giờ</th><th>Đơn giá Phút</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.employee.id}>
              <td className="wn-code">{r.code}</td>
              <td><strong>{r.name}</strong><small>{r.employee.employee_group || r.employee.custom_fields?.employee_group || r.employee['Nhóm'] || ''}</small></td>
              <td>{r.position || '—'}</td>
              <td>{r.workdayNorm ? money(r.days) : <span className="wn-missing">Chưa cấu hình</span>}</td>
              <td className={r.daily === null ? 'wn-no-result' : 'wn-daily'}>
                {r.daily === null
                  ? <span title={[...r.missing, !r.workdayNorm ? 'Chưa có định mức ngày công' : ''].filter(Boolean).join(', ')}>Thiếu dữ liệu</span>
                  : money(r.daily)}
              </td>
              <td className={r.hourly === null ? 'wn-no-result' : 'wn-daily'}>{r.hourly === null ? '—' : money(r.hourly)}</td>
              <td className={r.minute === null ? 'wn-no-result' : 'wn-daily'}>{r.minute === null ? '—' : money(r.minute)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="wn-empty">
                {loading ? 'Đang tải dữ liệu...' : 'Không có dữ liệu phù hợp.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    <div className="wn-footer">Hiển thị {rows.length}/{employees.length} nhân sự · Lương/ngày Công, Đơn giá Giờ và Đơn giá Phút là kết quả tính toán tham chiếu; không tự thay đổi các thành phần lương gốc hoặc công thức tính lương.</div>
  </section>;
}
