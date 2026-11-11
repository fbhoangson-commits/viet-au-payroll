import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Search, Plus, Download, Upload, FileDown, RefreshCw, Users, UserCheck,
  UserX, Eye, Pencil, X, Save, Filter, ChevronLeft, ChevronRight,
  AlertCircle, CheckCircle2, FileSpreadsheet, ShieldAlert, Settings2, Trash2
} from 'lucide-react';
import { fetchEmployees, saveEmployee, getCurrentUserProfile, fetchEmployeeColumnConfigs, saveEmployeeColumnConfigs } from './services/employeeService.js';
import './styles/employee-master.css';

const PAGE_SIZE = 10;
const MASTER_COLUMNS = [
  { key: 'employee_code', label: 'Mã Nhân Viên', required: true },
  { key: 'full_name', label: 'Họ và Tên', required: true },
  { key: 'date_of_birth', label: 'Ngày Sinh', type: 'date' },
  { key: 'gender', label: 'Giới Tính', type: 'dropdown', options: ['Nam', 'Nữ', 'Khác'] },
  { key: 'cccd', label: 'CCCD' },
  { key: 'tax_code', label: 'Mã Số Thuế' },
  { key: 'phone', label: 'Điện Thoại' },
  { key: 'email', label: 'Email' },
  { key: 'department', label: 'Bộ Phận' },
  { key: 'position', label: 'Chức Danh' },
  { key: 'employment_type', label: 'Phân Loại', type: 'dropdown', options: ['Cơ Hữu', 'Hợp Đồng', 'Thỉnh Giảng'] },
  { key: 'status', label: 'Trạng Thái Nhân Sự', type: 'dropdown', options: ['Đang làm việc', 'Nghỉ chế độ', 'Nghỉ việc'] },
  { key: 'hire_date', label: 'Ngày Vào Làm', type: 'date' },
  { key: 'bank_name', label: 'Ngân Hàng' },
  { key: 'bank_account_name', label: 'Tên Tài Khoản Ngân Hàng' },
  { key: 'bank_account_number', label: 'Số Tài Khoản Ngân Hàng' },
  { key: 'notes', label: 'Ghi Chú Hồ Sơ' },
  { key: 'profile_documents', label: 'Hồ Sơ' },
  { key: 'employee_group', label: 'Nhóm' },
  { key: 'mst_cccd', label: 'MST / CCCD' },
  { key: 'social_insurance', label: 'Tham Gia BHXH', type: 'dropdown', options: ['Có', 'Không'] },
  { key: 'dependents_count', label: 'Người Phụ Thuộc', type: 'number' },
];
const MASTER_BY_LABEL = new Map(MASTER_COLUMNS.map(c => [c.label, c]));
const LABELS = Object.fromEntries(MASTER_COLUMNS.map(c => [c.key, c.label]));
Object.assign(LABELS, { name: 'Họ và Tên', employee_name: 'Họ và Tên', phone_number: 'Điện Thoại', job_title: 'Chức Danh', start_date: 'Ngày Vào Làm', national_id: 'MST / CCCD' });
const normalizeHeader = header => String(header ?? '').trim().toLocaleLowerCase('vi').replace(/\s+/g, ' ');
const removeDiacritics = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const masterColumnByHeader = header => {
  const exact = MASTER_BY_LABEL.get(String(header ?? '').trim());
  if (exact) return exact;
  const normalized = normalizeHeader(header);
  return MASTER_COLUMNS.find(c => normalizeHeader(c.label) === normalized || removeDiacritics(normalizeHeader(c.label)) === removeDiacritics(normalized)) || null;
};
// Explicit import-header mapping is required even when employees is empty.
// Never send a Vietnamese spreadsheet Header directly as a Postgres column name.
const IMPORT_HEADER_MAP = Object.fromEntries(MASTER_COLUMNS.map(c => [normalizeHeader(c.label), c.key]));
const mapImportHeader = header => masterColumnByHeader(header)?.key || null;
const masterValue = (row, column) => {
  const aliases = {
    cccd: ['cccd', 'national_id', 'CCCD'], tax_code: ['tax_code', 'Mã Số Thuế'], mst_cccd: ['mst_cccd', 'MST / CCCD', 'national_id', 'tax_code'],
    bank_name: ['bank_name', 'bank_code', 'Ngân Hàng'], bank_account_name: ['bank_account_name', 'account_holder', 'Tên Tài Khoản Ngân Hàng'], bank_account_number: ['bank_account_number', 'account_number', 'Số Tài Khoản Ngân Hàng'],
    profile_documents: ['profile_documents', 'Hồ Sơ'], employee_group: ['employee_group', 'group', 'Nhóm'], employment_type: ['employment_type', 'Phân Loại'], social_insurance: ['social_insurance', 'Tham Gia BHXH'], dependents_count: ['dependents_count', 'dependent_count', 'Người Phụ Thuộc']
  };
  for (const key of (aliases[column.key] || [column.key])) {
    if (Object.prototype.hasOwnProperty.call(row || {}, key) && row[key] !== null && row[key] !== undefined && String(row[key]).trim() !== '') return row[key];
    const custom = row?.custom_fields;
    if (custom && typeof custom === 'object') {
      if (Object.prototype.hasOwnProperty.call(custom, key) && custom[key] !== null && custom[key] !== undefined && String(custom[key]).trim() !== '') return custom[key];
      const ck = Object.keys(custom).find(k => normalizeHeader(k) === normalizeHeader(key));
      if (ck && custom[ck] !== null && custom[ck] !== undefined && String(custom[ck]).trim() !== '') return custom[ck];
    }
  }
  return '';
};
const normalizeImportValue = (column, value) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (column?.type === 'number' && value !== null && value !== undefined && String(value).trim() !== '') return Number(String(value).replace(/,/g, '').trim());
  return value;
};
const DEFAULT_FIELDS = MASTER_COLUMNS;
const labelFor = key => LABELS[key] || key.replaceAll('_', ' ').replace(/\b\w/g, x => x.toUpperCase());
const norm = v => String(v ?? '').trim();
const employeeStatusOf = row => norm(row?.status ?? row?.employment_status ?? '').toLocaleLowerCase('vi')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
const isLeaveStatus = row => {
  const status = employeeStatusOf(row);
  return /^(nghi khong luong|nghi thai san|nghi bao hiem|tam nghi)$/.test(status)
    || /^(nghi che do)(\b|$)/.test(status);
};
const isTerminated = row => {
  const status = employeeStatusOf(row);
  return /^(nghi viec|da nghi viec|terminated|resigned|inactive)$/.test(status);
};
// Giữ tương thích với các chỗ hiển thị trạng thái cũ: chỉ "Nghỉ việc" mới là nghỉ việc.
const isInactive = isTerminated;
const isWorking = row => !isLeaveStatus(row) && !isTerminated(row);
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
  const customFields = { ...(previous?.custom_fields && typeof previous.custom_fields === 'object' ? previous.custom_fields : {}), ...(source.custom_fields && typeof source.custom_fields === 'object' ? source.custom_fields : {}) };
  const incomingOrder = Array.isArray(source.custom_field_order) ? source.custom_field_order : [];
  const previousOrder = Array.isArray(previous?.custom_field_order) ? previous.custom_field_order : [];
  const customOrder = [...incomingOrder, ...previousOrder.filter(key => !incomingOrder.includes(key))];
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


function formatExcelValue(value) { if (value === null || value === undefined) return ''; if (value instanceof Date) return value.toISOString().slice(0, 10); return value; }
function downloadWorkbook(rows, fileName = 'Nhan-su-Master.xlsx') {
  const data = rows.map(row => Object.fromEntries(MASTER_COLUMNS.map(column => [column.label, formatExcelValue(masterValue(row, column))])));
  const aoa = [MASTER_COLUMNS.map(c => c.label), ...data.map(row => MASTER_COLUMNS.map(c => row[c.label]))];
  const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = MASTER_COLUMNS.map(column => { const maxLen = Math.max(column.label.length, ...data.map(row => String(row[column.label] ?? '').length)); return { wch: Math.min(Math.max(maxLen + 2, 12), 38) }; });
  ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(MASTER_COLUMNS.length - 1)}${Math.max(1, aoa.length)}` };
  XLSX.utils.book_append_sheet(wb, ws, 'Nhân Sự');
  const guide = XLSX.utils.aoa_to_sheet([
    ['HƯỚNG DẪN IMPORT NHÂN SỰ'],
    ['File này sử dụng đúng 22 cột của Nhân Sự Master. Không thêm hoặc đổi tên cột.'],
    ['Mã Nhân Viên là khóa đối chiếu bắt buộc.'],
    ['Mã đã tồn tại sẽ cập nhật hồ sơ; mã mới sẽ tạo hồ sơ mới.'],
    ['Cột bỏ trống khi cập nhật sẽ không xóa dữ liệu đang có.'],
    ['Không xóa nhân sự bằng cách xóa dòng khỏi file.']
  ]); guide['!cols'] = [{ wch: 90 }]; XLSX.utils.book_append_sheet(wb, guide, 'Hướng Dẫn'); XLSX.writeFile(wb, fileName);
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
  const [columnConfigs, setColumnConfigs] = useState([]);
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [columnDraft, setColumnDraft] = useState([]);
  const [configSaving, setConfigSaving] = useState(false);
  const [configWarning, setConfigWarning] = useState('');

  async function reload() {
    setLoading(true); setError('');
    try {
      const [rows, userProfile] = await Promise.all([fetchEmployees(), getCurrentUserProfile()]);
      setEmployees(rows.map(expandEmployee));
      setProfile(userProfile);
      try { const configs = await fetchEmployeeColumnConfigs(); setColumnConfigs(configs); setConfigWarning(''); }
      catch (configError) { setConfigWarning(/employee_master_column_configs/i.test(configError?.message || '') ? 'Cần chạy migration cấu hình cột trong Supabase trước khi lưu cấu hình.' : (configError?.message || 'Không tải được cấu hình cột.')); }
    } catch (e) {
      setError(e?.message || 'Không thể tải danh sách nhân sự.');
    } finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  const fields = useMemo(() => {
    const configuredFields = [...columnConfigs].sort((a,b) => Number(a.display_order || 0) - Number(b.display_order || 0));
    if (configuredFields.length) return configuredFields.map(c => ({ key: c.field_key, label: c.label || labelFor(c.field_key), data_type: c.data_type || 'text', options: Array.isArray(c.options) ? c.options : [], show_in_list: c.is_active !== false && c.show_in_list !== false, is_system: Boolean(c.is_system), is_active: c.is_active !== false }));
    const importedOrder = employees.flatMap(row => customFieldOrderOf(row));
    const uniqueImported = [...new Set(importedOrder)].filter(k => !['id','created_at','updated_at','custom_fields','custom_field_order'].includes(k));
    if (uniqueImported.length) return uniqueImported.map((key, index) => ({ key, label: labelFor(key), data_type: ['employee_code','full_name','name','email','phone','address','hire_date','start_date','date_of_birth'].includes(key) ? 'text' : 'dropdown', options: [...new Set(employees.map(r => norm(valueForField(r,key))).filter(Boolean))], show_in_list: index < 7 }));
    const keys = new Set(employees.flatMap(row => Object.keys(row).filter(k => !['custom_fields','custom_field_order'].includes(k))));
    DEFAULT_FIELDS.forEach(f => { if (!keys.size || keys.has(f.key)) keys.add(f.key); });
    return [...keys].filter(k => !['id','created_at','updated_at'].includes(k)).map((key,index) => ({ key, label: labelFor(key), data_type: 'text', options: [], show_in_list: index < 7 }));
  }, [employees, columnConfigs]);
  const listFields = fields.filter(f => f.show_in_list !== false && !['id','created_at','updated_at','custom_fields','custom_field_order'].includes(f.key));

  function openColumnConfig() {
    const base = fields.map((f, index) => ({ field_key: f.key, label: f.label, data_type: f.data_type || 'text', show_in_list: f.show_in_list !== false, display_order: index, options: Array.isArray(f.options) ? f.options : [], is_system: ['employee_code','full_name'].includes(f.key), is_active: f.is_active !== false }));
    setColumnDraft(base); setShowColumnConfig(true); setConfigWarning('');
  }
  function updateColumnDraft(index, patch) { setColumnDraft(old => old.map((f,i) => i === index ? { ...f, ...patch } : f)); }
  function addColumnDraft() {
    const label = window.prompt('Nhập tên cột mới:');
    if (!label || !label.trim()) return;
    const key = `custom_${label.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}_${Date.now().toString().slice(-4)}`;
    setColumnDraft(old => [...old, { field_key:key, label:label.trim(), data_type:'text', show_in_list:false, display_order:old.length, options:[], is_system:false, is_active:true }]);
  }
  async function saveColumnDraft() {
    setConfigSaving(true); setError('');
    try {
      const normalized = columnDraft.map((f,index) => ({ ...f, display_order:index, field_key:String(f.field_key).trim(), label:String(f.label || f.field_key).trim() }));
      if (normalized.some(f => !f.field_key || !f.label)) throw new Error('Mã cột và tên cột không được để trống.');
      if (new Set(normalized.map(f=>f.field_key)).size !== normalized.length) throw new Error('Mã cột bị trùng.');
      const saved = await saveEmployeeColumnConfigs(normalized);
      setColumnConfigs(saved.sort((a,b)=>Number(a.display_order||0)-Number(b.display_order||0)));
      setShowColumnConfig(false); setNotice({type:'success',text:'Đã lưu cấu hình cột lên Supabase.'});
    } catch (e) { setConfigWarning(e?.message || 'Không lưu được cấu hình cột.'); }
    finally { setConfigSaving(false); }
  }
  async function addDropdownOption(field, value) {
    const current = columnConfigs.find(c=>c.field_key===field.key) || field;
    const options = [...new Set([...(Array.isArray(current.options)?current.options:[]), value])];
    const record = { field_key:field.key, label:current.label || field.label, data_type:'dropdown', show_in_list:current.show_in_list !== false, display_order:Number(current.display_order ?? fields.findIndex(f=>f.key===field.key)), options, is_system:Boolean(current.is_system), is_active:true };
    try { const saved = await saveEmployeeColumnConfigs([record]); setColumnConfigs(old=>[...old.filter(c=>c.field_key!==field.key), ...saved].sort((a,b)=>Number(a.display_order||0)-Number(b.display_order||0))); return true; }
    catch (e) { setError(`Không lưu được giá trị Dropdown: ${e.message}`); return false; }
  }


  const filtered = useMemo(() => employees.filter(row => {
    if (statusFilter === 'active' && !isWorking(row)) return false;
    if (statusFilter === 'leave' && !isLeaveStatus(row)) return false;
    if (statusFilter === 'inactive' && !isTerminated(row)) return false;
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
  // Hiển thị toàn bộ hồ sơ trong một danh sách cuộn dọc; không phân trang.
  const visible = filtered;

  async function generateNextEmployeeCode() {
    const rows = await fetchEmployees();
    let maxNumber = 0;
    for (const row of rows || []) {
      const code = norm(row?.employee_code);
      const match = code.match(/^VA(\d+)$/i);
      if (match) maxNumber = Math.max(maxNumber, Number(match[1]));
    }
    return `VA${String(maxNumber + 1).padStart(3, '0')}`;
  }

  async function startCreate() {
    const initial = {};
    MASTER_COLUMNS.forEach(f => { initial[f.key] = f.key === 'status' ? 'Đang làm việc' : ''; });
    setSelected(null); setForm(initial); setEditing(true); setShowForm(true); setError(''); setNotice(null);

    try {
      const nextCode = await generateNextEmployeeCode();
      setForm(old => ({ ...old, employee_code: nextCode }));
    } catch (e) {
      setShowForm(false);
      setEditing(false);
      setError(`Không thể tự sinh Mã Nhân Viên: ${e?.message || 'Không tải được dữ liệu nhân sự.'}`);
    }
  }
  function openDetails(row) { setSelected(row); setForm(expandEmployee(row)); setEditing(false); setShowForm(true); setError(''); }
  function updateForm(key, value) { setForm(old => ({ ...old, [key]: value })); }

  async function save() {
    setError(''); setNotice(null);
    const codeKey = Object.hasOwn(form, 'employee_code') || !selected ? 'employee_code' : null;
    const nameKey = Object.hasOwn(form, 'full_name') || !selected ? 'full_name' : (Object.hasOwn(form, 'name') ? 'name' : null);
    if (nameKey && !norm(form[nameKey])) { setError('Vui lòng nhập Họ và Tên.'); return; }
    setSaving(true);
    try {
      // Khi THÊM mới, không tin mã đang nằm trong state/form vì có thể đã cũ.
      // Đọc lại Master ngay trước khi lưu và sinh lại mã +1 từ mã lớn nhất hiện tại.
      const formToSave = selected ? form : { ...form, employee_code: await generateNextEmployeeCode() };
      const payload = buildEmployeePayload(formToSave, selected);
      const saved = await saveWithSchemaFallback(payload, selected?.id || null);
      setNotice({ type: 'success', text: selected ? 'Đã cập nhật hồ sơ nhân sự.' : 'Đã tạo hồ sơ nhân sự.' });
      setShowForm(false); setSelected(saved); await reload();
    } catch (e) { setError(e?.message || 'Không thể lưu hồ sơ. Kiểm tra schema và quyền RLS.'); }
    finally { setSaving(false); }
  }

  async function readImport(file) {
    setError(''); setNotice(null);
    try {
      const buffer = await file.arrayBuffer(); const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const ws = wb.Sheets['Nhân Sự'] || wb.Sheets.NhanSu || wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
      if (!rows.length) throw new Error('File không có dòng dữ liệu.');
      const headers = Object.keys(rows[0]); const codeHeader = headers.find(h => mapImportHeader(h) === 'employee_code');
      if (!codeHeader) throw new Error('Không tìm thấy cột Mã Nhân Viên. Hãy dùng đúng Template Nhân Sự Master.');
      const unknownHeaders = headers.filter(h => !masterColumnByHeader(h)); const seen = new Set(); const errors = [];
      rows.forEach((r,i) => { const code = norm(r[codeHeader]); if (!code) errors.push({ row:i+2, message:'Thiếu Mã Nhân Viên' }); else if (seen.has(code)) errors.push({ row:i+2, message:`Mã trùng trong file: ${code}` }); seen.add(code); });
      if (unknownHeaders.length) errors.push({ row:1, message:`File có cột không thuộc Nhân Sự Master: ${unknownHeaders.join(', ')}` });
      setImportPreview({ rows, headers, codeHeader, errors, fileName:file.name, unknownHeaders });
    } catch(e) { setError(e.message || 'Không đọc được file Excel.'); }
  }
  async function confirmImport() {
    if (!importPreview || importPreview.errors.length) return; setImportBusy(true); setError(''); setNotice(null);
    let created=0, updated=0, failed=[];
    try {
      const current=await fetchEmployees(); const byCode=new Map(current.map(r=>[norm(r.employee_code),r]));
      for(let i=0;i<importPreview.rows.length;i++) {
        const raw=importPreview.rows[i], normalized={}, customFields={}, customOrder=[];
        for(const column of MASTER_COLUMNS){ const header=importPreview.headers.find(h=>mapImportHeader(h)===column.key); if(!header) continue; const value=normalizeImportValue(column,raw[header]); if(value===null||value===undefined||String(value).trim()==='') continue;
          const physicalKey={employee_code:'employee_code',full_name:'full_name',date_of_birth:'date_of_birth',gender:'gender',phone:'phone',email:'email',department:'department',position:'position',status:'status',hire_date:'hire_date'}[column.key];
          if(physicalKey) normalized[physicalKey]=value; else { customFields[column.label]=value; customOrder.push(column.label); }
        }
        const code=norm(normalized.employee_code||raw[importPreview.codeHeader]); normalized.employee_code=code; const existing=byCode.get(code);
        try { const previous=existing||null; const mergedCustom={...(previous?.custom_fields&&typeof previous.custom_fields==='object'?previous.custom_fields:{})}; Object.assign(mergedCustom,customFields); const payload=buildEmployeePayload({...normalized,custom_fields:mergedCustom,custom_field_order:customOrder},previous); if(existing){delete payload.employee_code; await saveWithSchemaFallback(payload,existing.id); updated++;} else {await saveWithSchemaFallback(payload); created++;} }
        catch(e){failed.push({row:i+2,code,message:e.message});}
      }
      await reload(); if(failed.length) setError(`Đã xử lý ${created+updated} hồ sơ; ${failed.length} dòng lỗi. ${failed.slice(0,3).map(x=>`Dòng ${x.row} (${x.code}): ${x.message}`).join(' | ')}`); else setNotice({type:'success',text:`Import thành công: ${created} hồ sơ mới, ${updated} hồ sơ cập nhật.`}); setImportPreview(null);
    } finally { setImportBusy(false); }
  }

  const statTotal = employees.length;
  const statWorking = employees.filter(isWorking).length;
  const statLeave = employees.filter(isLeaveStatus).length;
  const statInactive = employees.filter(isTerminated).length;

  return <section className="em-page">
    <div className="em-title-row">
      <div><div className="em-eyebrow">DỮ LIỆU GỐC · SINGLE SOURCE OF TRUTH</div><h2>Nhân Sự Master</h2><p>Quản lý hồ sơ nhân sự tập trung cho toàn bộ hệ thống tiền lương.</p></div>
      <div className="em-actions">
        <button className="em-btn em-btn-light" onClick={()=>downloadWorkbook([], 'Template-Nhan-Su-Master.xlsx')}><FileDown size={16}/> Tải Template</button>
        <button className="em-btn em-btn-light" onClick={()=>downloadWorkbook(filtered)}><Download size={16}/> Export Excel</button>
        <button className="em-btn em-btn-light" onClick={()=>fileRef.current?.click()}><Upload size={16}/> Import Excel</button>
        <button className="em-btn em-btn-light" onClick={openColumnConfig}><Settings2 size={16}/> Cấu hình giao diện</button>
        <button className="em-btn em-btn-primary" onClick={startCreate}><Plus size={17}/> Thêm Nhân Sự</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e=>{if(e.target.files?.[0]) readImport(e.target.files[0]); e.target.value='';}}/>
      </div>
    </div>
    <div className="em-stats">
      <div className="em-stat"><span className="em-stat-icon blue"><Users size={18}/></span><div><small>Tổng nhân sự</small><strong>{statTotal}</strong></div></div>
      <div className="em-stat"><span className="em-stat-icon green"><UserCheck size={18}/></span><div><small>Đang làm việc</small><strong>{statWorking}</strong></div></div>
      <div className="em-stat"><span className="em-stat-icon amber"><UserCheck size={18}/></span><div><small>Nghỉ chế độ</small><strong>{statLeave}</strong></div></div>
      <div className="em-stat"><span className="em-stat-icon red"><UserX size={18}/></span><div><small>Nghỉ việc</small><strong>{statInactive}</strong></div></div>
    </div>
    {notice && <div className={`em-alert success`}><CheckCircle2 size={17}/>{notice.text}<button onClick={()=>setNotice(null)} aria-label="Đóng"><X size={15}/></button></div>}
    {error && <div className="em-alert danger"><AlertCircle size={17}/><span>{error}</span><button onClick={()=>setError('')} aria-label="Đóng"><X size={15}/></button></div>}
    {configWarning && <div className="em-alert danger"><AlertCircle size={17}/><span>{configWarning}</span><button onClick={()=>setConfigWarning('')} aria-label="Đóng"><X size={15}/></button></div>}
    <div className="em-toolbar">
      <div className="em-search"><Search size={17}/><input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Tìm mã nhân viên, họ tên, phòng ban..."/></div>
      <div className="em-filters"><Filter size={16}/><select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1);}}><option value="active">Đang làm việc</option><option value="leave">Nghỉ chế độ</option><option value="inactive">Nghỉ việc</option><option value="all">Tất cả nhân sự</option></select><select value={filterField} onChange={e=>{setFilterField(e.target.value);setFilterValue('');setPage(1);}}><option value="">Chọn trường lọc</option>{fields.filter(f=>!isInternalKey(f.key)).map(f=><option key={f.key} value={f.key}>{f.label}</option>)}</select>{filterField && <select value={filterValue} onChange={e=>{setFilterValue(e.target.value);setPage(1);}}><option value="">Tất cả giá trị</option>{filterValues.map(v=><option key={v} value={v}>{v}</option>)}</select>}</div>
      <button className="em-icon-btn" title="Tải lại dữ liệu" onClick={reload}><RefreshCw size={17}/></button>
    </div>
    <div className="em-table-wrap">
      <table className="em-table"><thead><tr>{listFields.map(f=><th key={f.key}>{f.label.toLocaleUpperCase('vi')}</th>)}<th></th></tr></thead>
      <tbody>{loading ? <tr><td colSpan={listFields.length+1} className="em-empty"><RefreshCw className="em-spin" size={20}/> Đang tải dữ liệu từ Supabase…</td></tr> : error && !employees.length ? <tr><td colSpan={listFields.length+1} className="em-empty"><ShieldAlert size={22}/><strong>Không thể tải dữ liệu</strong><span>Kiểm tra cấu hình Supabase, schema bảng employees và chính sách RLS.</span></td></tr> : !visible.length ? <tr><td colSpan={listFields.length+1} className="em-empty"><Users size={25}/><strong>Chưa có hồ sơ nhân sự phù hợp</strong><span>Danh sách sẽ hiển thị khi có dữ liệu nhân sự trong Supabase.</span></td></tr> : visible.map(row=><tr key={row.id || row.employee_code}>{listFields.map(f=><td key={f.key}>{f.key==='employee_code' ? <span className="em-code">{valueForField(row,f.key) || '—'}</span> : ['full_name','name','employee_name'].includes(f.key) ? <button className="em-name" onClick={()=>openDetails(row)}>{valueForField(row,f.key) || displayName(row)}</button> : f.key==='status' || f.key==='employment_status' ? <span className={`em-status ${isTerminated(row)?'inactive':isLeaveStatus(row)?'leave':'active'}`}>{valueForField(row,f.key) || 'Đang làm việc'}</span> : String(valueForField(row,f.key) ?? '—')}</td>)}<td><button className="em-icon-btn" title="Xem hồ sơ" onClick={()=>openDetails(row)}><Eye size={16}/></button></td></tr>)}</tbody></table>
      <div className="em-table-footer"><span>{filtered.length} hồ sơ · Cuộn dọc để xem toàn bộ danh sách</span></div>
    </div>
    <div className="em-permission-note"><ShieldAlert size={15}/><span>Quyền đọc/ghi được kiểm soát bởi phiên đăng nhập và chính sách RLS của Supabase. Hồ sơ tài khoản: {profile?.appUser ? 'đã tìm thấy trong app_users' : 'chưa xác minh được ánh xạ app_users; thao tác sẽ tuân theo RLS'}.</span></div>

    {showForm && <div className="em-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){setShowForm(false);}}}><section className="em-modal">
      <header><div><small>HỒ SƠ NHÂN SỰ</small><h3>{selected ? displayName(selected) : 'Thêm Nhân Sự'}</h3></div><button className="em-icon-btn" onClick={()=>setShowForm(false)}><X size={18}/></button></header>
      {error && <div className="em-alert danger"><AlertCircle size={16}/>{error}</div>}
      <div className="em-form-grid">{MASTER_COLUMNS.map(field=><label className="em-field" key={field.key}><span>{field.label}</span>{editing ? (field.data_type === 'dropdown' ? <select value={form[field.key] == null ? '' : String(form[field.key])} disabled={['id','created_at','updated_at'].includes(field.key)} onChange={async e=>{ if(e.target.value==='__ADD_NEW__'){ const value=window.prompt(`Thêm giá trị cho ${field.label}:`); if(value&&value.trim()){const ok=await addDropdownOption(field,value.trim()); if(ok) updateForm(field.key,value.trim());} } else updateForm(field.key,e.target.value); }}><option value="">— Chọn {field.label} —</option>{[...new Set([...(field.options||[]), ...(form[field.key]?[String(form[field.key])]:[])])].map(opt=><option key={opt} value={opt}>{opt}</option>)}<option value="__ADD_NEW__">＋ Thêm mới...</option></select> : <input type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'} value={form[field.key] == null ? '' : String(form[field.key])} disabled={['id','created_at','updated_at','employee_code'].includes(field.key)} onChange={e=>updateForm(field.key,e.target.value)} placeholder={field.key==='employee_code' ? 'Tự sinh' : `Nhập ${field.label.toLocaleLowerCase('vi')}`}/>) : <div className="em-read-value">{form[field.key] == null || form[field.key] === '' ? '—' : String(form[field.key])}</div>}</label>)}</div>
      {!editing && selected && <details className="em-raw-details"><summary>Xem toàn bộ dữ liệu hồ sơ</summary><pre>{JSON.stringify(selected,null,2)}</pre></details>}
      <footer>{editing ? <><button className="em-btn em-btn-light" onClick={()=>{if(selected){setForm(expandEmployee(selected));setEditing(false);}else setShowForm(false);}}>Hủy</button><button className="em-btn em-btn-primary" disabled={saving} onClick={save}><Save size={16}/>{saving?'Đang lưu…':'Lưu hồ sơ'}</button></> : <><button className="em-btn em-btn-light" onClick={()=>setShowForm(false)}>Đóng</button><button className="em-btn em-btn-primary" onClick={()=>setEditing(true)}><Pencil size={16}/> Chỉnh sửa</button></>}</footer>
    </section></div>}

    {showColumnConfig && <div className="em-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowColumnConfig(false);}}><section className="em-modal em-config-modal"><header><div><small>CẤU HÌNH NHÂN SỰ MASTER</small><h3>Cấu hình cột giao diện</h3><p>Thứ tự danh sách độc lập với hồ sơ chi tiết. Bỏ chọn “Hiện trên danh sách” chỉ đưa cột vào hồ sơ chi tiết, không xóa dữ liệu.</p></div><button className="em-icon-btn" onClick={()=>setShowColumnConfig(false)}><X size={18}/></button></header>
      {configWarning && <div className="em-alert danger">{configWarning}</div>}
      <div className="em-config-actions"><button className="em-btn em-btn-light" onClick={addColumnDraft}><Plus size={15}/> Thêm cột</button><span>Mã cột phải duy nhất. Cột Mã Nhân Viên và Họ và Tên không thể ẩn khỏi hồ sơ.</span></div>
      <div className="em-config-table-wrap"><table className="em-config-table"><thead><tr><th>Thứ tự</th><th>Mã cột</th><th>Tên cột</th><th>Kiểu dữ liệu</th><th>Hiện trên danh sách</th><th>Danh mục Dropdown</th><th>Thao tác</th></tr></thead><tbody>{columnDraft.map((field,index)=><tr key={`${field.field_key}-${index}`}><td><div className="em-order-controls"><button type="button" disabled={index===0} onClick={()=>setColumnDraft(old=>{const a=[...old];[a[index-1],a[index]]=[a[index],a[index-1]];return a;})}>↑</button><button type="button" disabled={index===columnDraft.length-1} onClick={()=>setColumnDraft(old=>{const a=[...old];[a[index+1],a[index]]=[a[index],a[index+1]];return a;})}>↓</button></div></td><td><code>{field.field_key}</code></td><td><input value={field.label} onChange={e=>updateColumnDraft(index,{label:e.target.value})}/></td><td><select value={field.data_type||'text'} onChange={e=>updateColumnDraft(index,{data_type:e.target.value})}><option value="text">Văn bản</option><option value="number">Số</option><option value="date">Ngày</option><option value="currency">Tiền tệ</option><option value="checkbox">Có/Không</option><option value="dropdown">Dropdown</option><option value="multi_select">Nhiều lựa chọn</option></select></td><td><input type="checkbox" checked={field.show_in_list!==false} onChange={e=>updateColumnDraft(index,{show_in_list:e.target.checked})}/></td><td>{field.data_type==='dropdown'||field.data_type==='multi_select'?<textarea rows="2" value={(field.options||[]).join('\n')} placeholder="Mỗi lựa chọn một dòng" onChange={e=>updateColumnDraft(index,{options:[...new Set(e.target.value.split('\n').map(v=>v.trim()).filter(Boolean))]})}/>:<span className="em-config-muted">—</span>}</td><td>{field.is_system?<span className="em-config-muted">Bắt buộc</span>:<button className="em-icon-btn" title={field.is_active===false?'Khôi phục cột':'Ngừng sử dụng cột'} onClick={()=>updateColumnDraft(index,{is_active:field.is_active===false,show_in_list:field.is_active===false?false:false})}>{field.is_active===false?<Plus size={15}/>:<Trash2 size={15}/>}</button>}</td></tr>)}</tbody></table></div>
      <footer><button className="em-btn em-btn-light" onClick={()=>setShowColumnConfig(false)}>Hủy</button><button className="em-btn em-btn-primary" disabled={configSaving} onClick={saveColumnDraft}><Save size={15}/>{configSaving?'Đang lưu…':'Lưu cấu hình'}</button></footer>
    </section></div>}

    {importPreview && <div className="em-modal-backdrop"><section className="em-modal em-import-modal"><header><div><small>IMPORT EXCEL</small><h3>Xem trước dữ liệu</h3><p>{importPreview.fileName} · {importPreview.rows.length} dòng</p></div><button className="em-icon-btn" onClick={()=>setImportPreview(null)}><X size={18}/></button></header>
      <div className="em-import-summary"><span><CheckCircle2 size={16}/>{importPreview.rows.length-importPreview.errors.length} dòng hợp lệ</span><span className={importPreview.errors.length?'bad':''}><AlertCircle size={16}/>{importPreview.errors.length} lỗi</span></div>
      {importPreview.errors.length>0 && <div className="em-import-errors">{importPreview.errors.map((e,i)=><div key={i}>Dòng {e.row}: {e.message}</div>)}</div>}
      <div className="em-import-table"><table><thead><tr>{importPreview.headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{importPreview.rows.slice(0,5).map((r,i)=><tr key={i}>{importPreview.headers.map(h=><td key={h}>{String(r[h] ?? '')}</td>)}</tr>)}</tbody></table></div>
      <footer><button className="em-btn em-btn-light" onClick={()=>setImportPreview(null)}>Hủy</button><button className="em-btn em-btn-primary" disabled={importBusy || importPreview.errors.length>0} onClick={confirmImport}><FileSpreadsheet size={16}/>{importBusy?'Đang import…':'Xác nhận Import'}</button></footer>
    </section></div>}
  </section>;
}
