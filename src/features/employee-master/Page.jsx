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
  status: 'Trạng Thái', department: 'Phòng Ban', position: 'Chức Vụ',
  job_title: 'Chức Vụ', email: 'Email', phone: 'Điện Thoại',
  phone_number: 'Điện Thoại', gender: 'Giới Tính', date_of_birth: 'Ngày Sinh',
  start_date: 'Ngày Vào Làm', hire_date: 'Ngày Vào Làm', end_date: 'Ngày Nghỉ Việc',
  created_at: 'Ngày Tạo', updated_at: 'Cập Nhật Lúc'
};
// Explicit import-header mapping is required even when employees is empty.
// Never send a Vietnamese spreadsheet Header directly as a Postgres column name.
const IMPORT_HEADER_MAP = {
  'mã nhân viên': 'employee_code', 'ma nhan vien': 'employee_code', 'employee_code': 'employee_code',
  'họ và tên': 'full_name', 'họ và tên nhân viên': 'full_name', 'ho va ten': 'full_name', 'full_name': 'full_name',
  'mst / cccd': 'tax_code', 'mst/cccd': 'tax_code', 'mã số thuế / cccd': 'tax_code', 'mã số thuế': 'tax_code', 'cccd': 'tax_code',
  'phân loại': 'employment_type', 'phan loai': 'employment_type', 'nhóm': 'employee_group', 'nhom': 'employee_group',
  'chức danh': 'position', 'chuc danh': 'position', 'chức vụ': 'position', 'chuc vu': 'position', 'job_title': 'position',
  'bộ phận': 'department', 'bo phan': 'department', 'phòng ban': 'department', 'phong ban': 'department',
  'trạng thái nhân sự': 'status', 'trạng thái': 'status', 'trang thai nhan su': 'status', 'status': 'status',
  'ngày vào làm': 'hire_date', 'ngay vao lam': 'hire_date', 'ngày nghỉ': 'end_date', 'ngay nghi': 'end_date',
  'tham gia bhxh': 'social_insurance', 'bhxh': 'social_insurance', 'người phụ thuộc': 'dependents_count', 'nguoi phu thuoc': 'dependents_count',
  'email': 'email', 'địa chỉ': 'address', 'dia chi': 'address', 'ghi chú hồ sơ': 'notes', 'ghi chú': 'notes', 'ghi chu': 'notes',
  'điện thoại': 'phone', 'số điện thoại': 'phone', 'phone': 'phone', 'phone_number': 'phone'
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

function downloadWorkbook(rows, fileName = 'Nhan-su-Master.xlsx') {
  const data = rows.map(row => Object.fromEntries(Object.entries(row).filter(([k]) => k !== 'id')));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'NhanSu');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['HƯỚNG DẪN IMPORT NHÂN SỰ'],
    ['1. Giữ nguyên Header để hệ thống đối chiếu trường dữ liệu.'],
    ['2. employee_code / Mã Nhân Viên là khóa đối chiếu bắt buộc.'],
    ['3. Dòng có mã đã tồn tại sẽ cập nhật; mã mới sẽ tạo hồ sơ mới.'],
    ['4. Cột không có trong file sẽ không bị cập nhật.'],
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
      setEmployees(rows);
      setProfile(userProfile);
    } catch (e) {
      setError(e?.message || 'Không thể tải danh sách nhân sự.');
    } finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  const fields = useMemo(() => {
    const keys = new Set(employees.flatMap(row => Object.keys(row)));
    DEFAULT_FIELDS.forEach(f => { if (!keys.size || keys.has(f.key)) keys.add(f.key); });
    return [...keys].filter(k => !['id'].includes(k)).map(key => ({ key, label: labelFor(key) }));
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
  function openDetails(row) { setSelected(row); setForm({ ...row }); setEditing(false); setShowForm(true); setError(''); }
  function updateForm(key, value) { setForm(old => ({ ...old, [key]: value })); }

  async function save() {
    setError(''); setNotice(null);
    const codeKey = Object.hasOwn(form, 'employee_code') || !selected ? 'employee_code' : null;
    const nameKey = Object.hasOwn(form, 'full_name') || !selected ? 'full_name' : (Object.hasOwn(form, 'name') ? 'name' : null);
    if (codeKey && !norm(form[codeKey])) { setError('Vui lòng nhập Mã Nhân Viên.'); return; }
    if (nameKey && !norm(form[nameKey])) { setError('Vui lòng nhập Họ và Tên.'); return; }
    setSaving(true);
    try {
      const payload = {};
      Object.entries(form).forEach(([k,v]) => { if (k !== 'id' && k !== 'created_at' && k !== 'updated_at') payload[k] = v; });
      const saved = await saveEmployee(payload, selected?.id || null);
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
        for (const [header, value] of Object.entries(raw)) {
          // Blank cells and absent Headers must never erase existing values.
          if (value === null || value === undefined || String(value).trim() === '') continue;
          const headerKey = normalizeHeader(header);
          const existingField = current.length
            ? Object.keys(current[0]).find(k => k === header || normalizeHeader(labelFor(k)) === headerKey)
            : null;
          // Resolve from the explicit map first: an empty employees table cannot
          // be used to infer its column names from a current row.
          const key = mapImportHeader(header) || existingField;
          if (!key) {
            // Do not submit arbitrary spreadsheet Header names as SQL columns.
            // Surface unsupported Headers as row errors instead of failing every row
            // with PostgREST's schema-cache error.
            failed.push({ row: i+2, code: norm(raw[importPreview.codeHeader]), message: `Header chưa được ánh xạ: ${header}` });
            continue;
          }
          if (key === 'id' || ['created_at','updated_at'].includes(key)) continue;
          normalized[key] = value instanceof Date ? value.toISOString() : value;
        }
        const code = norm(normalized.employee_code || raw[importPreview.codeHeader]);
        normalized.employee_code = code;
        const existing = byCode.get(code);
        try {
          if (existing) {
            const payload = { ...normalized }; delete payload.employee_code; // protect stable identity key on update
            if (Object.keys(payload).length) { await saveEmployee(payload, existing.id); updated++; }
          } else {
            await saveEmployee(normalized); created++;
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
      <table className="em-table"><thead><tr><th>MÃ NHÂN VIÊN</th><th>HỌ VÀ TÊN</th><th>PHÒNG BAN</th><th>CHỨC VỤ</th><th>LIÊN HỆ</th><th>TRẠNG THÁI</th><th></th></tr></thead>
      <tbody>{loading ? <tr><td colSpan="7" className="em-empty"><RefreshCw className="em-spin" size={20}/> Đang tải dữ liệu từ Supabase…</td></tr> : error && !employees.length ? <tr><td colSpan="7" className="em-empty"><ShieldAlert size={22}/><strong>Không thể tải dữ liệu</strong><span>Kiểm tra cấu hình Supabase, schema bảng employees và chính sách RLS.</span></td></tr> : !visible.length ? <tr><td colSpan="7" className="em-empty"><Users size={25}/><strong>Chưa có hồ sơ nhân sự phù hợp</strong><span>Danh sách sẽ hiển thị khi có dữ liệu nhân sự trong Supabase.</span></td></tr> : visible.map(row=><tr key={row.id || row.employee_code}><td><span className="em-code">{row.employee_code || '—'}</span></td><td><button className="em-name" onClick={()=>openDetails(row)}>{displayName(row)}</button><small className="em-sub">{row.email || ''}</small></td><td>{row.department || row.department_name || '—'}</td><td>{row.position || row.job_title || '—'}</td><td>{row.phone || row.phone_number || '—'}</td><td><span className={`em-status ${isInactive(row)?'inactive':'active'}`}>{row.status || row.employment_status || 'Đang làm việc'}</span></td><td><button className="em-icon-btn" title="Xem hồ sơ" onClick={()=>openDetails(row)}><Eye size={16}/></button></td></tr>)}</tbody></table>
      <div className="em-table-footer"><span>{filtered.length} hồ sơ · Trang {Math.min(page,pages)} / {pages}</span><div><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={16}/></button><button disabled={page>=pages} onClick={()=>setPage(p=>p+1)}><ChevronRight size={16}/></button></div></div>
    </div>
    <div className="em-permission-note"><ShieldAlert size={15}/><span>Quyền đọc/ghi được kiểm soát bởi phiên đăng nhập và chính sách RLS của Supabase. Hồ sơ tài khoản: {profile?.appUser ? 'đã tìm thấy trong app_users' : 'chưa xác minh được ánh xạ app_users; thao tác sẽ tuân theo RLS'}.</span></div>

    {showForm && <div className="em-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){setShowForm(false);}}}><section className="em-modal">
      <header><div><small>HỒ SƠ NHÂN SỰ</small><h3>{selected ? displayName(selected) : 'Thêm Nhân Sự'}</h3></div><button className="em-icon-btn" onClick={()=>setShowForm(false)}><X size={18}/></button></header>
      {error && <div className="em-alert danger"><AlertCircle size={16}/>{error}</div>}
      <div className="em-form-grid">{(selected ? fields.filter(f=>!['id','created_at','updated_at'].includes(f.key)) : DEFAULT_FIELDS).map(field=><label className="em-field" key={field.key}><span>{field.label}</span>{editing ? <input value={form[field.key] == null ? '' : String(form[field.key])} disabled={['id','created_at','updated_at'].includes(field.key)} onChange={e=>updateForm(field.key,e.target.value)} placeholder={`Nhập ${field.label.toLocaleLowerCase('vi')}`}/> : <div className="em-read-value">{form[field.key] == null || form[field.key] === '' ? '—' : String(form[field.key])}</div>}</label>)}</div>
      {!editing && selected && <details className="em-raw-details"><summary>Xem toàn bộ dữ liệu hồ sơ</summary><pre>{JSON.stringify(selected,null,2)}</pre></details>}
      <footer>{editing ? <><button className="em-btn em-btn-light" onClick={()=>{if(selected){setForm({...selected});setEditing(false);}else setShowForm(false);}}>Hủy</button><button className="em-btn em-btn-primary" disabled={saving} onClick={save}><Save size={16}/>{saving?'Đang lưu…':'Lưu hồ sơ'}</button></> : <><button className="em-btn em-btn-light" onClick={()=>setShowForm(false)}>Đóng</button><button className="em-btn em-btn-primary" onClick={()=>setEditing(true)}><Pencil size={16}/> Chỉnh sửa</button></>}</footer>
    </section></div>}

    {importPreview && <div className="em-modal-backdrop"><section className="em-modal em-import-modal"><header><div><small>IMPORT EXCEL</small><h3>Xem trước dữ liệu</h3><p>{importPreview.fileName} · {importPreview.rows.length} dòng</p></div><button className="em-icon-btn" onClick={()=>setImportPreview(null)}><X size={18}/></button></header>
      <div className="em-import-summary"><span><CheckCircle2 size={16}/>{importPreview.rows.length-importPreview.errors.length} dòng hợp lệ</span><span className={importPreview.errors.length?'bad':''}><AlertCircle size={16}/>{importPreview.errors.length} lỗi</span></div>
      {importPreview.errors.length>0 && <div className="em-import-errors">{importPreview.errors.map((e,i)=><div key={i}>Dòng {e.row}: {e.message}</div>)}</div>}
      <div className="em-import-table"><table><thead><tr>{importPreview.headers.slice(0,6).map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{importPreview.rows.slice(0,5).map((r,i)=><tr key={i}>{importPreview.headers.slice(0,6).map(h=><td key={h}>{String(r[h] ?? '')}</td>)}</tr>)}</tbody></table></div>
      <footer><button className="em-btn em-btn-light" onClick={()=>setImportPreview(null)}>Hủy</button><button className="em-btn em-btn-primary" disabled={importBusy || importPreview.errors.length>0} onClick={confirmImport}><FileSpreadsheet size={16}/>{importBusy?'Đang import…':'Xác nhận Import'}</button></footer>
    </section></div>}
  </section>;
}
