import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Search, Plus, RefreshCw, Save, Pencil, X, Download, Upload, FileSpreadsheet, Layers3, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../shared/supabase.js';
import './salary-rates.css';

const DEFAULT_GROUPS = [
  { code: 'FIXED', name: 'Cố Định', columns: ['Lương Cơ Bản', 'Thâm Niên', 'Thâm Niên 2026', 'Phụ Cấp'] },
  { code: 'TEACHING', name: 'Tiết dạy', columns: ['Khối 10', 'Khối 11', 'Khối 12'] },
  { code: 'TUTORING', name: 'Phụ đạo', columns: ['Chiều', 'Tối', 'Thứ 7', 'Chủ Nhật'] },
  { code: 'OTHER', name: 'Khác', columns: ['Coi Thi', 'IELTS', 'Trợ Giảng'] },
];
const errText = e => e?.message || e?.details || 'Có lỗi chưa xác định.';
const moneyLabel = v => v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString('vi-VN');
const isMissingTable = e => /relation .* does not exist|could not find the table|schema cache/i.test(String(e?.message || ''));

export default function Page() {
  const [groups, setGroups] = useState([]);
  const [columns, setColumns] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [values, setValues] = useState({});
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedPolicy, setSelectedPolicy] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [groupDraft, setGroupDraft] = useState('');
  const [columnDraft, setColumnDraft] = useState('');
  const [editingGroup, setEditingGroup] = useState('');
  const [editingColumn, setEditingColumn] = useState('');

  const tell = (type, text) => setNotice({ type, text });
  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); tell('error', 'Chưa cấu hình kết nối Supabase. Không có dữ liệu nào được lưu cục bộ.'); return; }
    setLoading(true); setNotice({ type: '', text: '' });
    try {
      const results = await Promise.all([
        supabase.from('salary_rate_groups').select('*').order('display_order', { ascending: true }),
        supabase.from('salary_rate_columns').select('*').order('display_order', { ascending: true }),
        supabase.from('salary_policy_versions').select('id,code,name,status,effective_from,effective_to').order('effective_from', { ascending: false }),
        supabase.from('employees').select('id,employee_code,full_name,name,status,department,position').order('employee_code', { ascending: true }),
        supabase.from('employee_salary_rates').select('*'),
      ]);
      const failed = results.find(r => r.error);
      if (failed) throw failed.error;
      const [g, c, p, e, v] = results.map(r => r.data || []);
      setGroups(g); setColumns(c); setPolicies(p); setEmployees(e);
      setValues(Object.fromEntries(v.map(r => [`${r.policy_version_id}|${r.employee_id}|${r.column_id}`, r.value ?? ''])));
      setSelectedGroup(prev => g.some(x => x.id === prev) ? prev : (g[0]?.id || ''));
      setSelectedPolicy(prev => p.some(x => x.id === prev && x.status !== 'RETIRED') ? prev : (p.find(x => x.status !== 'RETIRED')?.id || ''));
    } catch (e) {
      tell('error', isMissingTable(e) ? `Thiếu bảng dữ liệu Định Mức Lương trên Supabase. Hãy kiểm tra và chạy migration đi kèm trước khi sử dụng. (${errText(e)})` : `Không tải được dữ liệu Supabase: ${errText(e)}`);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const activeColumns = useMemo(() => columns.filter(c => c.group_id === selectedGroup && c.is_active !== false), [columns, selectedGroup]);
  const activeEmployees = useMemo(() => employees.filter(e => !/nghỉ việc|inactive|terminated|resigned/i.test(String(e.status || '')) && `${e.employee_code || ''} ${e.full_name || e.name || ''} ${e.department || ''}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))), [employees, search]);
  const selectedPolicyRow = policies.find(p => p.id === selectedPolicy);
  const keyFor = (employeeId, columnId) => `${selectedPolicy}|${employeeId}|${columnId}`;
  const setCell = (employeeId, columnId, value) => setValues(prev => ({ ...prev, [keyFor(employeeId, columnId)]: value }));

  async function saveGroup(event) {
    event?.preventDefault();
    const name = groupDraft.trim();
    if (!name) return tell('error', 'Vui lòng nhập tên nhóm.');
    try {
      const existing = groups.find(g => g.id === editingGroup);
      const payload = { name, code: existing?.code || `CUSTOM_${Date.now()}`, display_order: existing?.display_order ?? groups.length + 1, is_active: true, updated_at: new Date().toISOString() };
      const q = editingGroup ? supabase.from('salary_rate_groups').update({ name, updated_at: payload.updated_at }).eq('id', editingGroup) : supabase.from('salary_rate_groups').insert(payload);
      const { error } = await q; if (error) throw error;
      setGroupDraft(''); setEditingGroup(''); await load(); tell('success', editingGroup ? 'Đã cập nhật nhóm.' : 'Đã tạo nhóm.');
    } catch (e) { tell('error', `Không lưu được nhóm: ${errText(e)}`); }
  }
  async function saveColumn(event) {
    event?.preventDefault();
    const name = columnDraft.trim();
    if (!name || !selectedGroup) return tell('error', 'Vui lòng chọn nhóm và nhập tên cột.');
    try {
      const payload = { group_id: selectedGroup, name, code: `COL_${Date.now()}`, display_order: columns.filter(c => c.group_id === selectedGroup).length + 1, is_active: true };
      const q = editingColumn ? supabase.from('salary_rate_columns').update({ name, updated_at: new Date().toISOString() }).eq('id', editingColumn) : supabase.from('salary_rate_columns').insert(payload);
      const { error } = await q; if (error) throw error;
      setColumnDraft(''); setEditingColumn(''); await load(); tell('success', 'Đã lưu cột định mức.');
    } catch (e) { tell('error', `Không lưu được cột: ${errText(e)}`); }
  }
  async function saveRates() {
    if (!selectedPolicy) return tell('error', 'Cần tạo hoặc chọn Chính Sách Lương trước khi lưu định mức.');
    setSaving(true);
    try {
      const rows = [];
      for (const employee of activeEmployees) for (const col of activeColumns) {
        const raw = values[keyFor(employee.id, col.id)];
        if (raw === undefined || raw === '') continue;
        const value = Number(String(raw).replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
        if (!Number.isFinite(value)) throw new Error(`Giá trị không hợp lệ: ${employee.employee_code} / ${col.name}`);
        rows.push({ policy_version_id: selectedPolicy, employee_id: employee.id, column_id: col.id, value, updated_at: new Date().toISOString() });
      }
      if (rows.length) {
        const { error } = await supabase.from('employee_salary_rates').upsert(rows, { onConflict: 'policy_version_id,employee_id,column_id' });
        if (error) throw error;
      }
      tell('success', `Đã lưu ${rows.length} giá trị định mức lên Supabase.`);
      await load();
    } catch (e) { tell('error', `Không lưu được định mức: ${errText(e)}`); }
    finally { setSaving(false); }
  }
  function exportExcel() {
    const rows = activeEmployees.map(e => {
      const row = { 'Mã Nhân Viên': e.employee_code, 'Họ và Tên': e.full_name || e.name || '' };
      activeColumns.forEach(c => { row[c.name] = values[keyFor(e.id, c.id)] ?? ''; });
      return row;
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'DinhMucLuong');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['HƯỚNG DẪN'], ['Không sửa Mã Nhân Viên để ánh xạ dữ liệu.'], ['Không có trong file sẽ không tự động xóa dữ liệu trên hệ thống.'], ['Chính sách lương', selectedPolicyRow ? `${selectedPolicyRow.code} - ${selectedPolicyRow.name}` : 'Chưa chọn']]), 'HuongDan');
    XLSX.writeFile(wb, 'Mau_Dinh_Muc_Luong.xlsx');
  }
  async function importExcel(file) {
    try {
      if (!file) return;
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = wb.Sheets.DinhMucLuong || wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const employeeByCode = new Map(employees.map(e => [String(e.employee_code || '').trim().toLocaleUpperCase('vi'), e]));
      const colByName = new Map(activeColumns.map(c => [c.name.trim().toLocaleLowerCase('vi'), c]));
      const prepared = []; const errors = [];
      rows.forEach((row, i) => {
        const code = String(row['Mã Nhân Viên'] || row['Ma Nhan Vien'] || row.employee_code || '').trim().toLocaleUpperCase('vi');
        const employee = employeeByCode.get(code);
        if (!employee) { errors.push(`Dòng ${i + 2}: không tìm thấy Mã Nhân Viên "${code}".`); return; }
        Object.entries(row).forEach(([header, raw]) => {
          if (['Mã Nhân Viên','Ma Nhan Vien','employee_code','Họ và Tên','Ho va Ten'].includes(header) || raw === '') return;
          const col = colByName.get(header.trim().toLocaleLowerCase('vi'));
          if (!col) { errors.push(`Dòng ${i + 2}: cột "${header}" không thuộc nhóm đang chọn.`); return; }
          const value = Number(String(raw).trim().replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
          if (!Number.isFinite(value)) { errors.push(`Dòng ${i + 2}: giá trị "${raw}" không hợp lệ ở cột "${header}".`); return; }
          prepared.push({ policy_version_id: selectedPolicy, employee_id: employee.id, column_id: col.id, value, updated_at: new Date().toISOString() });
        });
      });
      if (errors.length) { tell('error', `Import dừng, chưa ghi dữ liệu. ${errors.slice(0, 5).join(' ')}${errors.length > 5 ? ` Còn ${errors.length - 5} lỗi.` : ''}`); return; }
      if (!selectedPolicy) return tell('error', 'Hãy chọn Chính Sách Lương trước khi import.');
      if (!prepared.length) return tell('error', 'Không có giá trị định mức hợp lệ để import.');
      const { error } = await supabase.from('employee_salary_rates').upsert(prepared, { onConflict: 'policy_version_id,employee_id,column_id' });
      if (error) throw error;
      tell('success', `Import thành công ${prepared.length} giá trị. Dữ liệu không có trong file được giữ nguyên.`);
      await load();
    } catch (e) { tell('error', `Không import được file: ${errText(e)}`); }
  }

  return <section className="salary-rates-page">
    <div className="sr-heading"><div><div className="sr-eyebrow">CẤU HÌNH LƯƠNG · WORKSPACE</div><h2>Định Mức Lương</h2><p>Quản lý nhóm, cột định mức và giá trị theo Chính Sách Lương.</p></div><button className="sr-btn sr-btn-light" onClick={load} disabled={loading}><RefreshCw size={15}/> Làm mới</button></div>
    {notice.text && <div className={`sr-notice ${notice.type}`} role="status">{notice.type === 'error' ? <AlertCircle size={17}/> : <CheckCircle2 size={17}/>}<span>{notice.text}</span><button onClick={() => setNotice({ type: '', text: '' })} aria-label="Đóng"><X size={15}/></button></div>}
    <div className="sr-panel">
      <div className="sr-toolbar"><label className="sr-policy">Chính Sách Lương<select value={selectedPolicy} onChange={e => setSelectedPolicy(e.target.value)}><option value="">Chọn chính sách</option>{policies.filter(p => p.status !== 'RETIRED').map(p => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></label><div className="sr-actions"><button className="sr-btn sr-btn-light" onClick={exportExcel}><Download size={15}/> Export Excel</button><label className="sr-btn sr-btn-light sr-file"><Upload size={15}/> Import Excel<input type="file" accept=".xlsx,.xls,.csv" onChange={e => { importExcel(e.target.files?.[0]); e.target.value = ''; }}/></label><button className="sr-btn sr-btn-primary" onClick={saveRates} disabled={saving || loading}><Save size={15}/>{saving ? 'Đang lưu…' : 'Lưu định mức'}</button></div></div>
      {!policies.length && !loading && <div className="sr-warning">Chưa có Chính Sách Lương. Hãy tạo chính sách trước; module không tự tạo chính sách thay người dùng.</div>}
      <div className="sr-layout">
        <aside className="sr-groups"><div className="sr-section-title"><Layers3 size={16}/> Nhóm định mức</div>{groups.map(g => <button key={g.id} className={`sr-group ${selectedGroup === g.id ? 'selected' : ''}`} onClick={() => setSelectedGroup(g.id)}><span>{g.name}</span><small>{columns.filter(c => c.group_id === g.id && c.is_active !== false).length} cột</small></button>)}<form className="sr-add-form" onSubmit={saveGroup}><input value={groupDraft} onChange={e => setGroupDraft(e.target.value)} placeholder={editingGroup ? 'Tên nhóm mới' : 'Tên nhóm mới'} aria-label="Tên nhóm mới"/><button title="Thêm nhóm" type="submit"><Plus size={16}/></button>{editingGroup && <button type="button" onClick={() => {setEditingGroup('');setGroupDraft('');}}><X size={15}/></button>}</form></aside>
        <div className="sr-work">
          <div className="sr-column-head"><div><h3>{groups.find(g => g.id === selectedGroup)?.name || 'Chọn nhóm định mức'}</h3><p>Quản lý các thành phần thuộc nhóm đang chọn.</p></div><form className="sr-add-column" onSubmit={saveColumn}><input value={columnDraft} onChange={e => setColumnDraft(e.target.value)} placeholder="Tên cột mới" aria-label="Tên cột mới"/><button className="sr-btn sr-btn-light" type="submit"><Plus size={15}/> Thêm cột</button></form></div>
          <div className="sr-table-tools"><label className="sr-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã nhân viên, họ tên, bộ phận…"/></label><span>{activeEmployees.length} nhân sự · {activeColumns.length} cột</span></div>
          {loading ? <div className="sr-empty">Đang tải dữ liệu từ Supabase…</div> : <div className="sr-table-wrap"><table className="sr-table"><thead><tr><th>Mã Nhân Viên</th><th>Họ và Tên</th>{activeColumns.map(c => <th key={c.id}>{c.name}</th>)}</tr></thead><tbody>{activeEmployees.map(e => <tr key={e.id}><td>{e.employee_code || '—'}</td><td>{e.full_name || e.name || '—'}</td>{activeColumns.map(c => <td key={c.id}><input className="sr-value" inputMode="decimal" aria-label={`${e.employee_code} ${c.name}`} value={values[keyFor(e.id, c.id)] ?? ''} onChange={ev => setCell(e.id, c.id, ev.target.value)} placeholder="—"/></td>)}</tr>)}{!activeEmployees.length && <tr><td colSpan={activeColumns.length + 2} className="sr-empty">Không có nhân sự phù hợp.</td>}</tbody></table></div>}
          <div className="sr-footnote"><FileSpreadsheet size={15}/> Chỉ lưu các giá trị có nhập. Dữ liệu không có trong file import hoặc đang nằm ở nhóm khác không bị xóa.</div>
        </div>
      </div>
    </div>
  </section>;
}
