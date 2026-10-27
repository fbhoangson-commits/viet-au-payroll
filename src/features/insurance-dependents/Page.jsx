import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Search, Upload, Download, FileSpreadsheet, RefreshCw, Pencil, Save, X, AlertCircle, CheckCircle2, Settings2, Eye } from 'lucide-react';
import {
  fetchEmployeesForInsurance, fetchModuleRows, saveModuleRow, fetchTaxReliefConfig, saveTaxReliefConfig,
  saveDependentRows, DEPENDENT_TABLE, INSURANCE_TABLE, COMMITMENT_TABLE, UNION_TABLE
} from './services/insuranceDependentsService.js';
import './styles/insurance-dependents.css';

const TABS = [
  { id: 'insurance', label: 'Bảo Hiểm Xã Hội', table: INSURANCE_TABLE },
  { id: 'relief', label: 'Giảm Trừ Gia Cảnh', table: DEPENDENT_TABLE },
  { id: 'commitment', label: 'Cam Kết Thu Nhập', table: COMMITMENT_TABLE },
  { id: 'union', label: 'Công Đoàn', table: UNION_TABLE },
];
const money = n => n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const yesNo = v => v === true ? 'Có' : v === false ? 'Không' : 'Chưa cấu hình';
const employeeCode = e => e.employee_code || e.code || '';
const employeeName = e => e.full_name || e.name || '';
const employeeDept = e => e.department || e.department_name || e.division || '';
const employeePosition = e => e.position || e.job_title || e.title || '';
const norm = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').trim().toLocaleLowerCase('vi');
const parseNumber = v => {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').trim().replace(/[₫đ\s]/gi, '');
  if (!s) return null;
  if (s.includes('.') && s.includes(',')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  else if (s.includes('.') && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const fieldsByTab = {
  insurance: [
    ['participates_insurance','Tham gia BHXH','boolean'], ['insurance_salary_base','Lương căn cứ đóng','number'],
    ['employee_social_rate','NLĐ - BHXH (%)','number'], ['employee_health_rate','NLĐ - BHYT (%)','number'], ['employee_unemployment_rate','NLĐ - BHTN (%)','number'],
    ['employer_social_rate','DN - BHXH (%)','number'], ['employer_health_rate','DN - BHYT (%)','number'], ['employer_unemployment_rate','DN - BHTN (%)','number'],
    ['effective_from','Ngày hiệu lực','date'], ['effective_to','Ngày hết hiệu lực','date'], ['notes','Ghi chú','text']
  ],
  relief: [
    ['dependent_count','Số người phụ thuộc','number'], ['notes','Ghi chú','text']
  ],
  commitment: [
    ['has_commitment','Có cam kết thu nhập','boolean'], ['effective_from','Ngày hiệu lực','date'], ['effective_to','Ngày hết hiệu lực','date'], ['document_reference','Thông tin hồ sơ','text'], ['notes','Ghi chú','text']
  ],
  union: [
    ['is_union_member','Là đoàn viên','boolean'], ['contribution_base','Mức căn cứ tính đóng','number'], ['employee_contribution','NLĐ đóng','number'], ['employer_contribution','Doanh nghiệp đóng','number'], ['effective_from','Ngày hiệu lực','date'], ['effective_to','Ngày hết hiệu lực','date'], ['notes','Ghi chú','text']
  ]
};
const columnMap = {
  'ma nhan vien':'employee_code','employee code':'employee_code','employee_code':'employee_code','mnv':'employee_code',
  'tham gia bhxh':'participates_insurance','bhxh':'participates_insurance','luong can cu dong':'insurance_salary_base',
  'so nguoi phu thuoc':'dependent_count','nguoi phu thuoc':'dependent_count','co cam ket thu nhap':'has_commitment','trang thai cam ket':'has_commitment',
  'la doan vien':'is_union_member','trang thai doan vien':'is_union_member','muc can cu tinh dong':'contribution_base','nlđ dong':'employee_contribution','nld dong':'employee_contribution','doanh nghiep dong':'employer_contribution',
  'ngay hieu luc':'effective_from','ngay het hieu luc':'effective_to','ghi chu':'notes','thong tin ho so':'document_reference',
  'nld - bhxh (%)':'employee_social_rate','nld - bhyt (%)':'employee_health_rate','nld - bhtn (%)':'employee_unemployment_rate',
  'dn - bhxh (%)':'employer_social_rate','dn - bhyt (%)':'employer_health_rate','dn - bhtn (%)':'employer_unemployment_rate'
};
function dateValue(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0,10);
  if (typeof v === 'number') { const d = XLSX.SSF.parse_date_code(v); return d ? `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}` : null; }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` : null;
}
export default function Page() {
  const [tab, setTab] = useState('insurance');
  const [employees, setEmployees] = useState([]);
  const [insurance, setInsurance] = useState([]);
  const [dependents, setDependents] = useState([]);
  const [commitments, setCommitments] = useState([]);
  const [unions, setUnions] = useState([]);
  const [taxConfig, setTaxConfig] = useState({ personal_relief_amount: 15500000, dependent_relief_amount: 6200000 });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [editing, setEditing] = useState(null);
  const [reliefSettings, setReliefSettings] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [dependentsModal, setDependentsModal] = useState(null);
  const [dependentDraft, setDependentDraft] = useState([]);
  const activeTab = TABS.find(t => t.id === tab);
  const load = useCallback(async () => {
    setLoading(true); setMessage(null);
    try {
      const [emps, ins, deps, comm, unionRows, tax] = await Promise.all([
        fetchEmployeesForInsurance(), fetchModuleRows(INSURANCE_TABLE), fetchModuleRows(DEPENDENT_TABLE),
        fetchModuleRows(COMMITMENT_TABLE), fetchModuleRows(UNION_TABLE), fetchTaxReliefConfig()
      ]);
      setEmployees(emps); setInsurance(ins); setDependents(deps); setCommitments(comm); setUnions(unionRows); setTaxConfig(tax);
    } catch (e) { setMessage({type:'error',text:`Không tải được dữ liệu Supabase: ${e.message || e}`}); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const rows = useMemo(() => {
    const byTab = { insurance, relief: dependents, commitment: commitments, union: unions };
    const records = byTab[tab] || [];
    const byId = new Map();
    records.forEach(r => { const id = r.employee_id; if (id && !byId.has(id)) byId.set(id, r); });
    const needle = norm(search);
    return employees.filter(e => {
      const r = byId.get(e.id) || {};
      const hay = norm([employeeCode(e),employeeName(e),employeeDept(e),employeePosition(e),e.employee_group,e.employment_type].join(' '));
      if (needle && !hay.includes(needle)) return false;
      if (tab === 'insurance' && filter !== 'all') {
        if (filter === 'yes' && r.participates_insurance !== true) return false;
        if (filter === 'no' && r.participates_insurance !== false) return false;
      }
      if (tab === 'commitment' && filter !== 'all') {
        if (filter === 'yes' && r.has_commitment !== true) return false;
        if (filter === 'no' && r.has_commitment !== false) return false;
      }
      if (tab === 'union' && filter !== 'all') {
        if (filter === 'yes' && r.is_union_member !== true) return false;
        if (filter === 'no' && r.is_union_member !== false) return false;
      }
      return true;
    }).map(e => ({employee:e, record:byId.get(e.id) || null, dependentList: dependents.filter(d=>d.employee_id===e.id)}));
  }, [employees,insurance,dependents,commitments,unions,tab,search,filter]);
  const fields = fieldsByTab[tab] || [];
  const startEdit = item => {
    const defaults = tab === 'insurance' ? { participates_insurance:null } : tab === 'commitment' ? {has_commitment:false} : tab === 'union' ? {is_union_member:false} : {dependent_count:item.dependentList.length};
    setEditing({ employee:item.employee, record:{...defaults,...(item.record||{}), employee_id:item.employee.id} });
  };
  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true); setMessage(null);
    try {
      const payload = {...editing.record, employee_id:editing.employee.id};
      if (tab === 'relief') {
        payload.dependent_count = Math.max(0, Number(payload.dependent_count)||0);
        const existing = dependents.filter(d=>d.employee_id===editing.employee.id);
        // The count is a summary only; never delete or fabricate dependent identities.
        payload.dependent_count = payload.dependent_count;
        if (existing.length && payload.dependent_count !== existing.length) {
          setMessage({type:'warning',text:'Số lượng đã lưu khác số hồ sơ người phụ thuộc chi tiết. Hãy dùng “Quản lý hồ sơ” để chỉnh danh sách; không tự tạo hoặc xóa danh tính người phụ thuộc.'});
        }
      } else {
        const table = activeTab.table;
        await saveModuleRow(table,payload);
        await load();
        setMessage({type:'success',text:'Đã lưu dữ liệu lên Supabase.'});
      }
      setEditing(null);
    } catch (e) { setMessage({type:'error',text:`Lưu thất bại: ${e.message || e}`}); }
    finally { setSaving(false); }
  };
  const exportRows = () => {
    const tabFields = fieldsByTab[tab];
    const data = rows.map(({employee:e,record:r,dependentList}) => {
      const obj = {'Mã Nhân Viên':employeeCode(e),'Họ và Tên':employeeName(e),'Phòng ban':employeeDept(e),'Chức vụ':employeePosition(e)};
      tabFields.forEach(([key,label,type]) => { obj[label] = key === 'dependent_count' ? (r?.dependent_count ?? dependentList.length) : (r?.[key] ?? ''); });
      return obj;
    });
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data),activeTab.label.slice(0,31));
    XLSX.writeFile(wb,`VietAu_${tab}_export.xlsx`);
  };
  const downloadTemplate = () => {
    const tabFields = fieldsByTab[tab];
    const headers = ['Mã Nhân Viên',...tabFields.map(f=>f[1])];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([headers]),'Import');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
      ['HƯỚNG DẪN IMPORT'],['1. Giữ nguyên cột Mã Nhân Viên để đối chiếu Nhân Sự Master.'],
      ['2. Có thể sắp xếp dòng tùy ý; không dùng họ tên làm khóa.'],['3. Ô trống không xóa dữ liệu hiện có.'],
      ['4. Kiểm tra dữ liệu xem trước trước khi xác nhận import.'],['5. Không nhập tỷ lệ nếu chưa được nhà trường xác nhận.']
    ]),'Huong dan');
    XLSX.writeFile(wb,`VietAu_template_${tab}.xlsx`);
  };
  const readImport = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const source = XLSX.utils.sheet_to_json(sheet,{defval:'',raw:true});
      const employeeByCode = new Map(employees.map(e=>[norm(employeeCode(e)),e]));
      const seen = new Set(); const errors=[]; const prepared=[];
      source.forEach((row,i) => {
        const mapped={};
        Object.entries(row).forEach(([header,value]) => {
          const key = columnMap[norm(header)] || (fieldsByTab[tab].some(f=>f[0]===header) ? header : null);
          if (key) mapped[key]=value;
        });
        const code = mapped.employee_code || row['Mã Nhân Viên'] || row['Ma Nhan Vien'];
        if (!String(code||'').trim()) { errors.push({row:i+2,reason:'Thiếu Mã Nhân Viên'}); return; }
        const key=norm(code);
        if (seen.has(key)) { errors.push({row:i+2,reason:`Mã nhân viên trùng: ${code}`}); return; }
        seen.add(key);
        const employee=employeeByCode.get(key);
        if (!employee) { errors.push({row:i+2,reason:`Không tìm thấy mã ${code} trong Nhân Sự Master`}); return; }
        const existing = (tab==='insurance'?insurance:tab==='relief'?dependents:tab==='commitment'?commitments:unions).find(r=>r.employee_id===employee.id);
        const payload={...(existing||{}),employee_id:employee.id};
        fieldsByTab[tab].forEach(([field,,type])=>{
          if (!(field in mapped) || mapped[field] === '') return;
          let value=mapped[field];
          if(type==='number') { value=parseNumber(value); if(value===null) errors.push({row:i+2,reason:`Giá trị số không hợp lệ ở ${field}`}); }
          if(type==='boolean') { const v=norm(value); value=['co','yes','true','1','tham gia','la doan vien'].includes(v) ? true : ['khong','no','false','0','khong tham gia'].includes(v) ? false : null; if(value===null) errors.push({row:i+2,reason:`Giá trị Có/Không không hợp lệ ở ${field}`}); }
          if(type==='date') { value=dateValue(value); if(!value) errors.push({row:i+2,reason:`Ngày không hợp lệ ở ${field}`}); }
          payload[field]=value;
        });
        prepared.push({row:i+2,code:String(code).trim(),employee,payload});
      });
      setImportPreview({prepared,errors,filename:file.name});
    } catch(e) { setMessage({type:'error',text:`Không đọc được Excel: ${e.message||e}`}); }
  };
  const confirmImport = async () => {
    if(!importPreview) return;
    setSaving(true); let success=0; const errors=[...importPreview.errors];
    for(const item of importPreview.prepared) {
      try {
        if(tab==='relief') {
          // Summary counts are not person records; update the employees table is deliberately forbidden.
          const existing=dependents.filter(d=>d.employee_id===item.employee.id);
          if (item.payload.dependent_count !== undefined && Number(item.payload.dependent_count)!==existing.length) {
            errors.push({row:item.row,reason:'Không import số lượng tổng đè lên danh sách hồ sơ chi tiết; quản lý hồ sơ chi tiết riêng.'}); continue;
          }
        } else { await saveModuleRow(activeTab.table,item.payload); success++; }
      } catch(e) { errors.push({row:item.row,reason:e.message||String(e)}); }
    }
    await load(); setSaving(false);
    setMessage({type:errors.length?'warning':'success',text:`Import hoàn tất: ${success} dòng thành công, ${errors.length} dòng cần kiểm tra.`});
    setImportPreview({...importPreview,done:true,success,errors});
  };
  const openDependents = item => {
    setDependentsModal(item.employee);
    setDependentDraft(dependents.filter(d=>d.employee_id===item.employee.id).map(d=>({...d})));
  };
  const saveDependents = async () => {
    setSaving(true); setMessage(null);
    try {
      await saveDependentRows(dependentsModal.id,dependentDraft);
      await load(); setDependentsModal(null); setMessage({type:'success',text:'Đã lưu hồ sơ người phụ thuộc.'});
    } catch(e) { setMessage({type:'error',text:`Lưu hồ sơ thất bại: ${e.message||e}`}); }
    finally { setSaving(false); }
  };
  const saveTaxConfig = async () => {
    setSaving(true);
    try { const saved=await saveTaxReliefConfig({personal_relief_amount:Number(taxConfig.personal_relief_amount),dependent_relief_amount:Number(taxConfig.dependent_relief_amount)}); setTaxConfig(saved); setReliefSettings(false); setMessage({type:'success',text:'Đã lưu cấu hình giảm trừ gia cảnh.'}); }
    catch(e){setMessage({type:'error',text:`Không lưu được cấu hình: ${e.message||e}`});}
    finally{setSaving(false);}
  };
  const detailInsurance = item => {
    const r=item.record||{};
    const parts=[['Người lao động', [['BHXH',r.employee_social_rate],['BHYT',r.employee_health_rate],['BHTN',r.employee_unemployment_rate]]],['Doanh nghiệp',[['BHXH',r.employer_social_rate],['BHYT',r.employer_health_rate],['BHTN',r.employer_unemployment_rate]]]];
    return <div className="id-contribution">{parts.map(([title,arr])=><div key={title}><strong>{title}</strong>{arr.map(([label,rate])=><span key={label}>{label}: {rate==null?'Chưa cấu hình':`${rate}%`}</span>)}</div>)}</div>;
  };
  return <section className="id-page">
    <div className="id-heading"><div><div className="id-eyebrow">KHÔNG GIAN NGHIỆP VỤ</div><h2>Bảo Hiểm và Người Phụ Thuộc</h2><p>Quản lý bảo hiểm, giảm trừ gia cảnh, cam kết thu nhập và Công Đoàn.</p></div><button className="id-btn" onClick={load}><RefreshCw size={15}/> Làm mới</button></div>
    <div className="id-toolbar">
      <button className="id-btn" onClick={downloadTemplate}><FileSpreadsheet size={15}/> Tải template</button>
      <label className="id-btn"><Upload size={15}/> Import<input type="file" accept=".xlsx,.xls,.csv" hidden onChange={readImport}/></label>
      <button className="id-btn" onClick={exportRows}><Download size={15}/> Export</button>
      {tab==='relief' && <button className="id-btn" onClick={()=>setReliefSettings(true)}><Settings2 size={15}/> Cấu hình giảm trừ</button>}
      <div className="id-spacer"/>
      <div className="id-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm mã, họ tên, phòng ban..."/></div>
    </div>
    <div className="id-tabs">{TABS.map(t=><button key={t.id} className={tab===t.id?'active':''} onClick={()=>{setTab(t.id);setFilter('all');setImportPreview(null);setMessage(null);}}>{t.label}</button>)}</div>
    {tab==='insurance' || tab==='commitment' || tab==='union' ? <div className="id-filter">
      <span>Lọc trạng thái</span><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Tất cả</option><option value="yes">{tab==='insurance'?'Có tham gia BHXH':tab==='union'?'Là đoàn viên':'Có cam kết'}</option><option value="no">{tab==='insurance'?'Không tham gia BHXH':tab==='union'?'Không là đoàn viên':'Không có cam kết'}</option></select>
    </div>:null}
    {tab==='relief' && <div className="id-note">Giảm trừ cá nhân: <strong>{money(taxConfig.personal_relief_amount)} ₫</strong> · Mỗi người phụ thuộc: <strong>{money(taxConfig.dependent_relief_amount)} ₫</strong>. Dữ liệu giảm trừ độc lập với trạng thái BHXH.</div>}
    {message && <div className={`id-message ${message.type}`}><AlertCircle size={16}/><span>{message.text}</span></div>}
    {importPreview && <div className="id-preview"><div><strong>Xem trước import</strong><span>{importPreview.filename}: {importPreview.prepared.length} dòng hợp lệ sơ bộ, {importPreview.errors.length} lỗi</span></div>{!importPreview.done?<><button className="id-btn primary" disabled={saving} onClick={confirmImport}>Xác nhận import</button><button className="id-btn" onClick={()=>setImportPreview(null)}>Hủy</button></>:<button className="id-btn" onClick={()=>setImportPreview(null)}>Đóng xem trước</button>}{importPreview.errors.length>0&&<ul>{importPreview.errors.slice(0,30).map((e,i)=><li key={i}>Dòng {e.row}: {e.reason}</li>)}</ul>}</div>}
    <div className="id-table-wrap">
      <table className="id-table"><thead><tr><th>Mã Nhân Viên</th><th>Họ và Tên</th><th>Phòng ban / Chức vụ</th>
        {tab==='insurance'&&<><th>Tham gia BHXH</th><th>Lương căn cứ</th><th>Tỷ lệ NLĐ (%)</th><th>Tiền NLĐ đóng</th><th>Tỷ lệ DN (%)</th><th>Tiền DN đóng</th></>}
        {tab==='relief'&&<><th>Số người phụ thuộc</th><th>Giảm trừ cá nhân</th><th>Giảm trừ phụ thuộc</th><th>Tổng giảm trừ</th></>}
        {tab==='commitment'&&<><th>Trạng thái cam kết</th><th>Ngày hiệu lực</th><th>Ngày hết hiệu lực</th><th>Hồ sơ / Ghi chú</th></>}
        {tab==='union'&&<><th>Trạng thái đoàn viên</th><th>Mức căn cứ</th><th>NLĐ đóng</th><th>Doanh nghiệp đóng</th><th>Ngày hiệu lực</th></>}
        <th>Thao tác</th></tr></thead><tbody>
        {loading?<tr><td colSpan="10" className="id-empty">Đang tải dữ liệu từ Supabase…</td></tr>:rows.map(item=>{const e=item.employee,r=item.record||{}, count=Number(r.dependent_count??item.dependentList.length)||0;return <tr key={e.id}>
          <td className="id-code">{employeeCode(e)||'—'}</td><td><strong>{employeeName(e)||'—'}</strong><small>{e.employee_group||e.employment_type||''}</small></td><td>{employeeDept(e)||'—'}<small>{employeePosition(e)||''}</small></td>
          {tab==='insurance'&&<><td><span className={`id-pill ${r.participates_insurance===true?'yes':r.participates_insurance===false?'no':''}`}>{yesNo(r.participates_insurance)}</span></td><td>{money(r.insurance_salary_base)}</td><td>{r.employee_social_rate==null&&r.employee_health_rate==null&&r.employee_unemployment_rate==null?'Chưa cấu hình':[r.employee_social_rate,r.employee_health_rate,r.employee_unemployment_rate].map(x=>x==null?'—':`${x}%`).join(' / ')}</td><td>{[r.employee_social_rate,r.employee_health_rate,r.employee_unemployment_rate].every(x=>x==null)||r.insurance_salary_base==null?'Chưa cấu hình':money(Number(r.insurance_salary_base)*[r.employee_social_rate,r.employee_health_rate,r.employee_unemployment_rate].reduce((sum,x)=>sum+(Number(x)||0),0)/100)+' ₫'}</td><td>{r.employer_social_rate==null&&r.employer_health_rate==null&&r.employer_unemployment_rate==null?'Chưa cấu hình':[r.employer_social_rate,r.employer_health_rate,r.employer_unemployment_rate].map(x=>x==null?'—':`${x}%`).join(' / ')}</td><td>{[r.employer_social_rate,r.employer_health_rate,r.employer_unemployment_rate].every(x=>x==null)||r.insurance_salary_base==null?'Chưa cấu hình':money(Number(r.insurance_salary_base)*[r.employer_social_rate,r.employer_health_rate,r.employer_unemployment_rate].reduce((sum,x)=>sum+(Number(x)||0),0)/100)+' ₫'}</td></>}
          {tab==='relief'&&<><td>{count} <button className="id-link" onClick={()=>openDependents(item)}>{item.dependentList.length?'Quản lý hồ sơ':'Thêm hồ sơ'}</button></td><td>{money(taxConfig.personal_relief_amount)} ₫</td><td>{money(count*Number(taxConfig.dependent_relief_amount||0))} ₫</td><td className="id-total">{money(Number(taxConfig.personal_relief_amount||0)+count*Number(taxConfig.dependent_relief_amount||0))} ₫</td></>}
          {tab==='commitment'&&<><td>{yesNo(r.has_commitment)}</td><td>{r.effective_from||'—'}</td><td>{r.effective_to||'—'}</td><td>{r.document_reference||r.notes||'—'}</td></>}
          {tab==='union'&&<><td>{yesNo(r.is_union_member)}</td><td>{money(r.contribution_base)}</td><td>{money(r.employee_contribution)}</td><td>{money(r.employer_contribution)}</td><td>{r.effective_from||'—'}</td></>}
          <td className="id-actions">{tab!=='relief'&&<button className="id-icon-btn" onClick={()=>startEdit(item)} title="Sửa"><Pencil size={15}/></button>}{tab==='insurance'&&<button className="id-icon-btn" onClick={()=>setDependentsModal({insuranceDetails:true,employee:e})} title="Xem cấu phần tỷ lệ"><Eye size={15}/></button>}</td>
        </tr>})}
        {!loading&&!rows.length&&<tr><td colSpan="10" className="id-empty">Không có nhân sự phù hợp.</td></tr>}
      </tbody></table>
    </div>
    <div className="id-footer">Hiển thị {rows.length}/{employees.length} nhân sự · Dữ liệu nhân sự đọc từ Master; các tỷ lệ và số tiền chưa cấu hình sẽ không tự suy diễn.</div>
    {editing&&<div className="id-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(null)}}><div className="id-modal"><div className="id-modal-head"><div><h3>Cập nhật {activeTab.label}</h3><p>{employeeCode(editing.employee)} · {employeeName(editing.employee)}</p></div><button className="id-icon-btn" onClick={()=>setEditing(null)}><X size={18}/></button></div><div className="id-form-grid">{fields.map(([key,label,type])=><label key={key}>{label}{type==='boolean'?<select value={editing.record[key]===true?'true':editing.record[key]===false?'false':''} onChange={e=>setEditing(old=>({...old,record:{...old.record,[key]:e.target.value===''?null:e.target.value==='true'}}))}><option value="">Chưa cấu hình</option><option value="true">Có</option><option value="false">Không</option></select>:type==='text'?<input value={editing.record[key]??''} onChange={e=>setEditing(old=>({...old,record:{...old.record,[key]:e.target.value}}))}/>:<input type={type==='date'?'date':'number'} min={type==='number'?'0':undefined} step={type==='number'?'any':undefined} value={editing.record[key]??''} onChange={e=>setEditing(old=>({...old,record:{...old.record,[key]:e.target.value===''?null:type==='number'?Number(e.target.value):e.target.value}}))}/>}</label>)}</div><div className="id-modal-actions"><button className="id-btn" onClick={()=>setEditing(null)}>Hủy</button><button className="id-btn primary" disabled={saving||tab==='relief'} onClick={saveEdit}><Save size={15}/> {saving?'Đang lưu…':'Lưu dữ liệu'}</button></div>{tab==='relief'&&<p className="id-help">Số lượng người phụ thuộc được xác định từ hồ sơ chi tiết. Hãy dùng “Quản lý hồ sơ” để thêm/sửa người phụ thuộc.</p>}</div></div>}
    {reliefSettings&&<div className="id-overlay"><div className="id-modal"><div className="id-modal-head"><div><h3>Cấu hình giảm trừ gia cảnh</h3><p>Thay đổi có hiệu lực cho phép tính tham chiếu tại module này.</p></div><button className="id-icon-btn" onClick={()=>setReliefSettings(false)}><X size={18}/></button></div><div className="id-form-grid"><label>Giảm trừ cá nhân (đồng)<input type="number" min="0" value={taxConfig.personal_relief_amount??''} onChange={e=>setTaxConfig(v=>({...v,personal_relief_amount:e.target.value}))}/></label><label>Giảm trừ mỗi người phụ thuộc (đồng)<input type="number" min="0" value={taxConfig.dependent_relief_amount??''} onChange={e=>setTaxConfig(v=>({...v,dependent_relief_amount:e.target.value}))}/></label></div><div className="id-modal-actions"><button className="id-btn" onClick={()=>setReliefSettings(false)}>Hủy</button><button className="id-btn primary" disabled={saving} onClick={saveTaxConfig}><Save size={15}/> Lưu cấu hình</button></div></div></div>}
    {dependentsModal&&dependentsModal.insuranceDetails&&<div className="id-overlay"><div className="id-modal"><div className="id-modal-head"><div><h3>Chi tiết tỷ lệ đóng</h3><p>{employeeCode(dependentsModal.employee)} · {employeeName(dependentsModal.employee)}</p></div><button className="id-icon-btn" onClick={()=>setDependentsModal(null)}><X size={18}/></button></div>{detailInsurance({record:insurance.find(r=>r.employee_id===dependentsModal.employee.id)})}<div className="id-modal-actions"><button className="id-btn" onClick={()=>setDependentsModal(null)}>Đóng</button></div></div></div>}
    {dependentsModal&&!dependentsModal.insuranceDetails&&<div className="id-overlay"><div className="id-modal id-dependent-modal"><div className="id-modal-head"><div><h3>Hồ sơ người phụ thuộc</h3><p>{employeeCode(dependentsModal)} · {employeeName(dependentsModal)}</p></div><button className="id-icon-btn" onClick={()=>setDependentsModal(null)}><X size={18}/></button></div><div className="id-dependent-list">{dependentDraft.map((d,i)=><div className="id-dependent-row" key={d.id||i}><label>Họ và tên<input value={d.full_name||''} onChange={e=>setDependentDraft(a=>a.map((x,j)=>j===i?{...x,full_name:e.target.value}:x))}/></label><label>Quan hệ<input value={d.relationship||''} onChange={e=>setDependentDraft(a=>a.map((x,j)=>j===i?{...x,relationship:e.target.value}:x))}/></label><label>Ngày sinh<input type="date" value={d.date_of_birth||''} onChange={e=>setDependentDraft(a=>a.map((x,j)=>j===i?{...x,date_of_birth:e.target.value}:x))}/></label><label>MST / giấy tờ<input value={d.tax_code||d.identification_number||''} onChange={e=>setDependentDraft(a=>a.map((x,j)=>j===i?{...x,tax_code:e.target.value}:x))}/></label><button className="id-icon-btn danger" onClick={()=>setDependentDraft(a=>a.filter((_,j)=>j!==i))}><X size={15}/></button></div>)}</div><div className="id-modal-actions"><button className="id-btn" onClick={()=>setDependentDraft(a=>[...a,{full_name:'',relationship:'',status:'Đang giảm trừ'}])}>+ Thêm người phụ thuộc</button><span className="id-spacer"/><button className="id-btn" onClick={()=>setDependentsModal(null)}>Hủy</button><button className="id-btn primary" disabled={saving} onClick={saveDependents}><Save size={15}/> Lưu hồ sơ</button></div><p className="id-help">Chỉ lưu hồ sơ được nhập; không tự suy diễn quan hệ, MST hoặc thời gian giảm trừ.</p></div></div>}
  </section>;
}
