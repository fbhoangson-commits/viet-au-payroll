import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Search, Plus, Download, Upload, FileDown, RefreshCw, Users, UserCheck,
  UserX, Eye, Pencil, X, Save, Filter, ChevronLeft, ChevronRight,
  AlertCircle, CheckCircle2, FileSpreadsheet, ShieldAlert
} from 'lucide-react';
import { fetchEmployees, saveEmployee, getCurrentUserProfile } from './services/employeeService.js';
import './styles/employee-master.css';

const PAGE_SIZE = 10;
const LABELS = {
  employee_code: 'Mã Nhân Viên', full_name: 'Họ và Tên', name: 'Họ và Tên',
  status: 'Trạng thái nhân sự', department: 'Bộ phận', position: 'Chức danh',
  job_title: 'Chức danh', email: 'Email', phone: 'Điện thoại',
  phone_number: 'Điện thoại', gender: 'Giới tính', date_of_birth: 'Ngày sinh',
  start_date: 'Ngày vào làm', hire_date: 'Ngày vào làm', end_date: 'Ngày nghỉ',
  address: 'Địa chỉ', notes: 'Ghi chú hồ sơ',
  national_id: 'MST / CCCD', tax_code: 'MST / CCCD',
  employment_type: 'Phân loại', employee_group: 'Nhóm',
  dependents_count: 'Người phụ thuộc', social_insurance: 'Tham gia BHXH',
  created_at: 'Ngày tạo', updated_at: 'Cập nhật lúc',
  'MST / CCCD': 'MST / CCCD', 'Phân loại': 'Phân loại', 'Nhóm': 'Nhóm',
  'Tham gia BHXH': 'Tham gia BHXH', 'Người phụ thuộc': 'Người phụ thuộc',
  'Ghi chú hồ sơ': 'Ghi chú hồ sơ'
};
// Explicit import-header mapping is required even when employees is empty.
// Never send a Vietnamese spreadsheet Header directly as a Postgres column name.
const IMPORT_HEADER_MAP = {
  'mã nhân viên': 'employee_code', 'ma nhan vien': 'employee_code', 'employee_code': 'employee_code', 'mã nv': 'employee_code', 'mnv': 'employee_code',
  'họ và tên': 'full_name', 'họ và tên nhân viên': 'full_name', 'ho va ten': 'full_name', 'full_name': 'full_name', 'họ tên': 'full_name', 'ho ten': 'full_name',
  'trạng thái nhân sự': 'status', 'trạng thái': 'status', 'trang thai nhan su': 'status', 'status': 'status',
  'bộ phận': 'department', 'bo phan': 'department', 'phòng ban': 'department', 'phong ban': 'department',
  'chức danh': 'position', 'chuc danh': 'position', 'chức vụ': 'position', 'chuc vu': 'position', 'position': 'position', 'job_title': 'job_title',
  'email': 'email', 'điện thoại': 'phone', 'số điện thoại': 'phone', 'phone': 'phone', 'phone_number': 'phone',
  'ngày vào làm': 'hire_date', 'ngay vao lam': 'hire_date', 'ngày nghỉ': 'end_date', 'ngày nghỉ việc': 'end_date',
  'địa chỉ': 'address', 'dia chi': 'address', 'ghi chú hồ sơ': 'notes', 'ghi chú': 'notes', 'ghi chu': 'notes',
  'ngày nghỉ': 'end_date', 'ngay nghi': 'end_date', 'mst / cccd': null,
  'phân loại': null, 'phan loai': null, 'nhóm': null, 'nhom': null,
  'tham gia bhxh': null, 'người phụ thuộc': null, 'nguoi phu thuoc': null
};
const normalizeHeader = header => String(header ?? '').trim().toLocaleLowerCase('vi').replace(/\s+/g, ' ');
const mapImportHeader = header => {
  const normalized = normalizeHeader(header);
  return IMPORT_HEADER_MAP[normalized] || IMPORT_HEADER_MAP[normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '')] || null;
};

const DEFAULT_FIELDS = [
  { key: 'employee_code', label: 'Mã Nhân Viên', required: true },
  { key: 'full_name', label: 'Họ và Tên', required: true },
  { key: 'department', label: 'Phòng Ban' },
  { key: 'position', label: 'Chức Vụ' },
  { key: 'phone', label: 'Điện Thoại' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Trạng Thái' }
];
const labelFor = key => LABELS[key] || key.replaceAll('_', ' ').replace(/\b\w/g, x => x.toUpperCase());
const norm = v => String(v ?? '').trim();
const isInactive = row => /nghỉ|inactive|terminated|resigned|đã nghỉ/i.test(String(row.status ?? row.employment_status ?? ''));
const displayName = row => row.full_name || row.name || row.employee_name || row.employee_code || 'Chưa có tên';
const isInternalKey = k => ['id','created_at','updated_at'].includes(k);
const isSchemaCacheColumnError = error => /could not find the .* column of 'employees' in the schema cache/i.test(String(error?.message || ''));
const getMissingColumn = error => {
  const match = String(error?.message || '').match(/could not find the ['"](.+?)['"] column of 'employees' in the schema cache/i);
  return match?.[1] || null;
};
const expandEmployee = row => ({ ...row, ...(row?.custom_fields && typeof row.custom_fields === 'object' ? row.custom_fields : {}) });
const customFieldOrderOf = row => Array.isArray(row?.custom_field_order) ? row.custom_field_order : [];
const valueForField = (row, key) => Object.prototype.hasOwnProperty.call(row || {}, key) ? row[key] : row?.custom_fields?.[key];
const buildEmployeePayload = (input, previous = null) => {
  const source = { ...input };
  const customFields = { ...(previous?.custom_fields && typeof previous.custom_fields === 'object' ? previous.custom_fields : {}) };
  const customOrder = [...(Array.isArray(previous?.custom_field_order) ? previous.custom_field_order : [])];
  const dbKeys = new Set(['id','employee_code','full_name','name','status','department','position','job_title','email','phone','phone_number','gender','date_of_birth','start_date','hire_date','end_date','address','notes','created_at','updated_at','custom_fields','custom_field_order']);
  for (const [key, value] of Object.entries(source)) {
    if (['id','created_at','updated_at','custom_fields','custom_field_order'].includes(key)) continue;
    if (!dbKeys.has(key)) {
      if (value !== undefined && value !== null && String(value).trim() !== '') customFields[key] = value;
      delete source[key];
      if (!customOrder.includes(key)) customOrder.push(key);
    }
  }
  source.custom_fields = customFields;
  source.custom_field_order = customOrder;
  return source;
};

async function saveWithSchemaFallback(payload, id = null) {
  let candidate = { ...payload };
  let customFields = { ...(candidate.custom_fields || {}) };
  let customOrder = Array.isArray(candidate.custom_field_order) ? [...candidate.custom_field_order] : [];
  // Retry only when PostgREST explicitly reports a missing column. Preserve that field as dynamic JSON data.
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      return await saveEmployee({ ...candidate, custom_fields: customFields, custom_field_order: customOrder }, id);
    } catch (error) {
      const missing = getMissingColumn(error);
      if (!missing || ['custom_fields','custom_field_order'].includes(missing)) throw error;

      // Robust schema fallback: any non-internal field rejected by the actual employees schema
      // becomes a dynamic JSONB field. Do not assume a field exists merely because its name
      // is familiar or appears in an Excel Header.
      const hasTopLevel = Object.prototype.hasOwnProperty.call(candidate, missing);
      const hasDynamic = Object.prototype.hasOwnProperty.call(customFields, missing);
      if (!hasTopLevel && !hasDynamic) throw error;
      const value = hasTopLevel ? candidate[missing] : customFields[missing];
      if (value !== undefined && value !== null && String(value).trim() !== '') customFields[missing] = value;
      if (!customOrder.includes(missing)) customOrder.push(missing);
      delete candidate[missing];
    }
  }
  throw new Error('Không thể ánh xạ các trường import sau nhiều lần thử. Kiểm tra schema employees.');
}


function downloadWorkbook(rows, fileName = 'Nhan-su-Master.xlsx') {
  const data = rows.map(row => { const custom = row.custom_fields && typeof row.custom_fields === 'object' ? row.custom_fields : {}; const order = Array.isArray(row.custom_field_order) ? row.custom_field_order : Object.keys(custom); const base = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','custom_fields','custom_field_order'].includes(k))); const flattened = { ...base }; for (const key of order) if (Object.prototype.hasOwnProperty.call(custom, key)) flattened[key] = custom[key]; for (const [key, value] of Object.entries(custom)) if (!Object.prototype.hasOwnProperty.call(flattened, key)) flattened[key] = value; return flattened; });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'NhanSu');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['HƯỚNG DẪN IMPORT NHÂN SỰ'],
    ['1. Giữ nguyên Header để hệ thống đối chiếu trường dữ liệu.'],
    ['2. employee_code / Mã Nhân Viên là khóa đối chiếu bắt buộc.'],
    ['3. Dòng có mã đã tồn tại sẽ cập nhật; mã mới sẽ tạo hồ sơ mới.'],
    ['4. Cột không có trong file sẽ không bị cập nhật.'],
    ['5. Có thể thêm Header mới; Header mới được lưu dưới dạng trường mở rộng theo đúng thứ tự file.'],
    ['5. Ô trống được bỏ qua khi cập nhật hồ sơ hiện có.'],
    ['6. Không xóa nhân sự bằng cách bỏ dòng khỏi file.']
  ]), 'HuongDan');
  XLSX.writeFile(wb, fileName);
}

export default function Page() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [filterField, setFilterField] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const fileRef = useRef(null);
  const [profile, setProfile] = useState(null);

  async function reload() {
    setLoading(true); setError('');
    try {
      const [rows, userProfile] = await Promise.all([fetchEmployees(), getCurrentUserProfile()]);
      setEmployees(rows.map(expandEmployee));
      setProfile(userProfile);
    } catch (e) {
      setError(e?.message || 'Không thể tải danh sách nhân sự.');
    } finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  const fields = useMemo(() => {
    const importedOrder = employees.flatMap(row => customFieldOrderOf(row));
    const uniqueImported = [...new Set(importedOrder)].filter(k => !['id','created_at','updated_at','custom_fields','custom_field_order'].includes(k));
    // If records were imported from an Excel template, its Header order is the canonical
    // display order. Do not append unrelated physical schema columns (e.g. national_id,
    // tax_code, employment_type) that were not present in that workbook.
    if (uniqueImported.length) {
      return uniqueImported.map(key => ({ key, label: labelFor(key) }));
    }
    const keys = new Set(employees.flatMap(row => Object.keys(row).filter(k => !['custom_fields','custom_field_order'].includes(k))));
    DEFAULT_FIELDS.forEach(f => { if (!keys.size || keys.has(f.key)) keys.add(f.key); });
    return [...keys].filter(k => !['id','created_at','updated_at'].includes(k)).map(key => ({ key, label: labelFor(key) }));
  }, [employees]);

  const filtered = useMemo(() => employees.filter(row => {
    const inactive = isInactive(row);
    if (statusFilter === 'active' && inactive) return false;
    if (statusFilter === 'inactive' && !inactive) return false;
    if (search) {
      const hay = Object.values(row).map(v => typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')).join(' ').toLocaleLowerCase('vi');
      if (!hay.includes(search.toLocaleLowerCase('vi'))) return false;
    }
    if (filterField && filterValue) {
      if (norm(row[filterField]) !== filterValue) return false;
    }
    return true;
  }), [employees, statusFilter, search, filterField, filterValue]);

  const filterValues = useMemo(() => [...new Set(employees.map(r => norm(r[filterField])).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')), [employees, filterField]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function startCreate() {
    const initial = {};
    DEFAULT_FIELDS.forEach(f => { initial[f.key] = f.key === 'status' ? 'Đang làm việc' : ''; });
    setSelected(null); setForm(initial); setEditing(true); setShowForm(true); setError(''); setNotice(null);
  }
  function openDetails(row) { setSelected(row); setForm(expandEmployee(row)); setEditing(false); setShowForm(true); setError(''); }
  function updateForm(key, value) { setForm(old => ({ ...old, [key]: value })); }

  async function save() {
    setError(''); setNotice(null);
    const codeKey = Object.hasOwn(form, 'employee_code') || !selected ? 'employee_code' : null;
    const nameKey = Object.hasOwn(form, 'full_name') || !selected ? 'full_name' : (Object.hasOwn(form, 'name') ? 'name' : null);
    if (codeKey && !norm(form[codeKey])) { setError('Vui lòng nhập Mã Nhân Viên.'); return; }
    if (nameKey && !norm(form[nameKey])) { setError('Vui lòng nhập Họ và Tên.'); return; }
    setSaving(true);
    try {
      const payload = buildEmployeePayload(form, selected);
      const saved = await saveWithSchemaFallback(payload, selected?.id || null);
      setNotice({ type: 'success', text: selected ? 'Đã cập nhật hồ sơ nhân sự.' : 'Đã tạo hồ sơ nhân sự.' });
      setShowForm(false); setSelected(saved); await reload();
    } catch (e) { setError(e?.message || 'Không thể lưu hồ sơ. Kiểm tra schema và quyền RLS.'); }
    finally { setSaving(false); }
  }

  async function readImport(file) {
    setError(''); setNotice(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const ws = wb.Sheets.NhanSu || wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
      if (!rows.length) throw new Error('File không có dòng dữ liệu.');
      const headers = Object.keys(rows[0]);
      const codeHeader = headers.find(h => mapImportHeader(h) === 'employee_code');
      if (!codeHeader) throw new Error('Không tìm thấy cột Mã Nhân Viên (employee_code).');
      const seen = new Set(); const errors = [];
      rows.forEach((r,i) => {
        const code = norm(r[codeHeader]);
        if (!code) errors.push({ row: i+2, message: 'Thiếu Mã Nhân Viên' });
        else if (seen.has(code)) errors.push({ row: i+2, message: `Mã trùng trong file: ${code}` });
        seen.add(code);
      });
      setImportPreview({ rows, headers, codeHeader, errors, fileName: file.name });
    } catch (e) { setError(e.message || 'Không đọc được file Excel.'); }
  }

  async function confirmImport() {
    if (!importPreview || importPreview.errors.length) return;
    setImportBusy(true); setError(''); setNotice(null);
    let created = 0, updated = 0, failed = [];
    try {
      const current = await fetchEmployees();
      const byCode = new Map(current.map(r => [norm(r.employee_code), r]));
      for (let i = 0; i < importPreview.rows.length; i++) {
        const raw = importPreview.rows[i];
        const normalized = {};
        const dynamicFields = {};
        const importedOrder = [];
        for (const [header, value] of Object.entries(raw)) {
          // Keep every workbook Header and its order, including columns whose cells are blank.
          // Blank cells never erase existing data.
          const mappedKey = mapImportHeader(header);
          const converted = value instanceof Date ? value.toISOString() : value;
          const physicalImportKeys = new Set([
            'employee_code', 'full_name', 'status', 'department', 'position', 'job_title',
            'email', 'phone', 'phone_number', 'gender', 'date_of_birth', 'start_date',
            'hire_date', 'end_date', 'address', 'notes'
          ]);
          const fieldKey = mappedKey && physicalImportKeys.has(mappedKey) ? mappedKey : header;
          if (!importedOrder.includes(fieldKey)) importedOrder.push(fieldKey);
          if (value === null || value === undefined || String(value).trim() === '') continue;
          // Only explicitly supported canonical fields are sent as physical columns. Every
          // other Header—including dependents_count, employee_group, and future columns—is
          // stored as dynamic data instead of being posted as a PostgreSQL column.
          if (mappedKey && physicalImportKeys.has(mappedKey)) normalized[mappedKey] = converted;
          else dynamicFields[header] = converted;
        }
        const code = norm(normalized.employee_code || raw[importPreview.codeHeader]);
        normalized.employee_code = code;
        const existing = byCode.get(code);
        try {
          const previous = existing || null;
          const mergedCustom = { ...(previous?.custom_fields && typeof previous.custom_fields === 'object' ? previous.custom_fields : {}) };
          Object.assign(mergedCustom, dynamicFields);
          // Header order from the workbook is authoritative for dynamic fields.
          const payload = buildEmployeePayload({ ...normalized, custom_fields: mergedCustom, custom_field_order: importedOrder }, previous);
          if (existing) {
            delete payload.employee_code; // protect stable identity key on update
            await saveWithSchemaFallback(payload, existing.id); updated++;
          } else {
            await saveWithSchemaFallback(payload); created++;
          }
        } catch (e) { failed.push({ row: i+2, code, message: e.message }); }
      }
      await reload();
      if (failed.length) {
        setError(`Đã xử lý ${created+updated} hồ sơ; ${failed.length} dòng lỗi. ${failed.slice(0,3).map(x=>`Dòng ${x.row} (${x.code}): ${x.message}`).join(' | ')}`);
      } else setNotice({ type: 'success', text: `Import thành công: ${created} hồ sơ mới, ${updated} hồ sơ cập nhật.` });
      setImportPreview(null);
    } finally { setImportBusy(false); }
  }

  const statTotal = employees.length;
  const statInactive = employees.filter(isInactive).length;
  const statActive = statTotal - statInactive;

  return <section className="em-page">
    <div className="em-title-row">
      <div><div className="em-eyebrow">DỮ LIỆU GỐC · SINGLE SOURCE OF TRUTH</div><h2>Nhân Sự Master</h2><p>Quản lý hồ sơ nhân sự tập trung cho toàn bộ hệ thống tiền lương.</p></div>
      <div className="em-actions">
        <button className="em-btn em-btn-light" onClick={()=>downloadWorkbook([], 'Template-Nhan-Su-Master.xlsx')}><FileDown size={16}/> Tải Template</button>
        <button className="em-btn em-btn-light" onClick={()=>downloadWorkbook(filtered)}><Download size={16}/> Export Excel</button>
        <button className="em-btn em-btn-light" onClick={()=>fileRef.current?.click()}><Upload size={16}/> Import Excel</button>
        <button className="em-btn em-btn-primary" onClick={startCreate}><Plus size={17}/> Thêm Nhân Sự</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e=>{if(e.target.files?.[0]) readImport(e.target.files[0]); e.target.value='';}}/>
      </div>
    </div>
    <div className="em-stats">
      <div className="em-stat"><span className="em-stat-icon blue"><Users size={18}/></span><div><small>Tổng nhân sự</small><strong>{statTotal}</strong></div></div>
      <div className="em-stat"><span className="em-stat-icon green"><UserCheck size={18}/></span><div><small>Đang làm việc</small><strong>{statActive}</strong></div></div>
      <div className="em-stat"><span className="em-stat-icon amber"><UserX size={18}/></span><div><small>Đã nghỉ việc</small><strong>{statInactive}</strong></div></div>
    </div>
    {notice && <div className={`em-alert success`}><CheckCircle2 size={17}/>{notice.text}<button onClick={()=>setNotice(null)} aria-label="Đóng"><X size={15}/></button></div>}
    {error && <div className="em-alert danger"><AlertCircle size={17}/><span>{error}</span><button onClick={()=>setError('')} aria-label="Đóng"><X size={15}/></button></div>}
    <div className="em-toolbar">
      <div className="em-search"><Search size={17}/><input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Tìm mã nhân viên, họ tên, phòng ban..."/></div>
      <div className="em-filters"><Filter size={16}/><select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1);}}><option value="active">Đang làm việc</option><option value="inactive">Đã nghỉ việc</option><option value="all">Tất cả nhân sự</option></select><select value={filterField} onChange={e=>{setFilterField(e.target.value);setFilterValue('');setPage(1);}}><option value="">Chọn trường lọc</option>{fields.filter(f=>!isInternalKey(f.key)).map(f=><option key={f.key} value={f.key}>{f.label}</option>)}</select>{filterField && <select value={filterValue} onChange={e=>{setFilterValue(e.target.value);setPage(1);}}><option value="">Tất cả giá trị</option>{filterValues.map(v=><option key={v} value={v}>{v}</option>)}</select>}</div>
      <button className="em-icon-btn" title="Tải lại dữ liệu" onClick={reload}><RefreshCw size={17}/></button>
    </div>
    <div className="em-table-wrap">
      <table className="em-table"><thead><tr>{fields.filter(f => !['id','created_at','updated_at','custom_fields','custom_field_order'].includes(f.key)).map(f=><th key={f.key}>{f.label.toLocaleUpperCase('vi')}</th>)}<th></th></tr></thead>
      <tbody>{loading ? <tr><td colSpan={fields.length+1} className="em-empty"><RefreshCw className="em-spin" size={20}/> Đang tải dữ liệu từ Supabase…</td></tr> : error && !employees.length ? <tr><td colSpan={fields.length+1} className="em-empty"><ShieldAlert size={22}/><strong>Không thể tải dữ liệu</strong><span>Kiểm tra cấu hình Supabase, schema bảng employees và chính sách RLS.</span></td></tr> : !visible.length ? <tr><td colSpan={fields.length+1} className="em-empty"><Users size={25}/><strong>Chưa có hồ sơ nhân sự phù hợp</strong><span>Danh sách sẽ hiển thị khi có dữ liệu nhân sự trong Supabase.</span></td></tr> : visible.map(row=><tr key={row.id || row.employee_code}>{fields.filter(f => !['id','created_at','updated_at','custom_fields','custom_field_order'].includes(f.key)).map(f=><td key={f.key}>{f.key==='employee_code' ? <span className="em-code">{valueForField(row,f.key) || '—'}</span> : ['full_name','name','employee_name'].includes(f.key) ? <button className="em-name" onClick={()=>openDetails(row)}>{valueForField(row,f.key) || displayName(row)}</button> : f.key==='status' || f.key==='employment_status' ? <span className={`em-status ${isInactive(row)?'inactive':'active'}`}>{valueForField(row,f.key) || 'Đang làm việc'}</span> : String(valueForField(row,f.key) ?? '—')}</td>)}<td><button className="em-icon-btn" title="Xem hồ sơ" onClick={()=>openDetails(row)}><Eye size={16}/></button></td></tr>)}</tbody></table>
      <div className="em-table-footer"><span>{filtered.length} hồ sơ · Trang {Math.min(page,pages)} / {pages}</span><div><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={16}/></button><button disabled={page>=pages} onClick={()=>setPage(p=>p+1)}><ChevronRight size={16}/></button></div></div>
    </div>
    <div className="em-permission-note"><ShieldAlert size={15}/><span>Quyền đọc/ghi được kiểm soát bởi phiên đăng nhập và chính sách RLS của Supabase. Hồ sơ tài khoản: {profile?.appUser ? 'đã tìm thấy trong app_users' : 'chưa xác minh được ánh xạ app_users; thao tác sẽ tuân theo RLS'}.</span></div>

    {showForm && <div className="em-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){setShowForm(false);}}}><section className="em-modal">
      <header><div><small>HỒ SƠ NHÂN SỰ</small><h3>{selected ? displayName(selected) : 'Thêm Nhân Sự'}</h3></div><button className="em-icon-btn" onClick={()=>setShowForm(false)}><X size={18}/></button></header>
      {error && <div className="em-alert danger"><AlertCircle size={16}/>{error}</div>}
      <div className="em-form-grid">{(selected ? fields.filter(f=>!['id','created_at','updated_at'].includes(f.key)) : DEFAULT_FIELDS).map(field=><label className="em-field" key={field.key}><span>{field.label}</span>{editing ? <input value={form[field.key] == null ? '' : String(form[field.key])} disabled={['id','created_at','updated_at'].includes(field.key)} onChange={e=>updateForm(field.key,e.target.value)} placeholder={`Nhập ${field.label.toLocaleLowerCase('vi')}`}/> : <div className="em-read-value">{form[field.key] == null || form[field.key] === '' ? '—' : String(form[field.key])}</div>}</label>)}</div>
      {!editing && selected && <details className="em-raw-details"><summary>Xem toàn bộ dữ liệu hồ sơ</summary><pre>{JSON.stringify(selected,null,2)}</pre></details>}
      <footer>{editing ? <><button className="em-btn em-btn-light" onClick={()=>{if(selected){setForm(expandEmployee(selected));setEditing(false);}else setShowForm(false);}}>Hủy</button><button className="em-btn em-btn-primary" disabled={saving} onClick={save}><Save size={16}/>{saving?'Đang lưu…':'Lưu hồ sơ'}</button></> : <><button className="em-btn em-btn-light" onClick={()=>setShowForm(false)}>Đóng</button><button className="em-btn em-btn-primary" onClick={()=>setEditing(true)}><Pencil size={16}/> Chỉnh sửa</button></>}</footer>
    </section></div>}

    {importPreview && <div className="em-modal-backdrop"><section className="em-modal em-import-modal"><header><div><small>IMPORT EXCEL</small><h3>Xem trước dữ liệu</h3><p>{importPreview.fileName} · {importPreview.rows.length} dòng</p></div><button className="em-icon-btn" onClick={()=>setImportPreview(null)}><X size={18}/></button></header>
      <div className="em-import-summary"><span><CheckCircle2 size={16}/>{importPreview.rows.length-importPreview.errors.length} dòng hợp lệ</span><span className={importPreview.errors.length?'bad':''}><AlertCircle size={16}/>{importPreview.errors.length} lỗi</span></div>
      {importPreview.errors.length>0 && <div className="em-import-errors">{importPreview.errors.map((e,i)=><div key={i}>Dòng {e.row}: {e.message}</div>)}</div>}
      <div className="em-import-table"><table><thead><tr>{importPreview.headers.slice(0,6).map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{importPreview.rows.slice(0,5).map((r,i)=><tr key={i}>{importPreview.headers.slice(0,6).map(h=><td key={h}>{String(r[h] ?? '')}</td>)}</tr>)}</tbody></table></div>
      <footer><button className="em-btn em-btn-light" onClick={()=>setImportPreview(null)}>Hủy</button><button className="em-btn em-btn-primary" disabled={importBusy || importPreview.errors.length>0} onClick={confirmImport}><FileSpreadsheet size={16}/>{importBusy?'Đang import…':'Xác nhận Import'}</button></footer>
    </section></div>}
  </section>;
}
