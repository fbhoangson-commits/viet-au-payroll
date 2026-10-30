import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Plus, RefreshCw, Search, Download, Upload, Edit3, Trash2, CheckCircle2,
  X, Save, Wallet, Users, FileSpreadsheet, CalendarDays, Link2, AlertCircle
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../shared/supabase.js';
import './employee-support.css';

const ITEM_TABLE='employee_support_items';
const LINK_TABLE='employee_support_period_links';
const money=n=>Math.round(Number(n||0)).toLocaleString('vi-VN');
const monthNow=()=>new Date().toISOString().slice(0,7);
const clean=v=>String(v??'').trim();
const TYPES=[
  {value:'CURRENT',label:'Nhân sự hiện tại'},
  {value:'FORMER',label:'Nhân sự đã nghỉ việc'},
  {value:'INTERN',label:'Thực tập sinh'},
  {value:'TRAINEE',label:'Học việc'},
  {value:'OTHER',label:'Đối tượng khác'},
];
const STATUSES=[
  {value:'DRAFT',label:'Nháp'},
  {value:'PENDING',label:'Chờ duyệt'},
  {value:'APPROVED',label:'Đã duyệt'},
  {value:'LINKED',label:'Đã đưa vào kỳ lương'},
  {value:'PAID',label:'Đã thanh toán'},
  {value:'CANCELLED',label:'Đã hủy'},
];
const statusLabel=v=>STATUSES.find(x=>x.value===v)?.label||v||'—';
const typeLabel=v=>TYPES.find(x=>x.value===v)?.label||v||'—';
const DEFAULT_TAX={tax_rate:0.10,tax_threshold:5000000};
const blank=()=>({recipient_type:'CURRENT',employee_id:'',employee_code:'',recipient_name:'',description:'',support_type:'',support_month:monthNow(),amount:'',apply_tax_10:false,payment_date:'',notes:'',status:'DRAFT'});
const taxOf=(row,settings=DEFAULT_TAX)=>row.apply_tax_10&&Number(row.amount)>Number(settings.tax_threshold)?Math.round(Number(row.amount)*Number(settings.tax_rate)):0;
const errorText=e=>e?.message||String(e||'Lỗi không xác định');

export default function Page(){
 const [items,setItems]=useState([]),[employees,setEmployees]=useState([]),[periods,setPeriods]=useState([]),[taxSettings,setTaxSettings]=useState(DEFAULT_TAX),[showTaxSettings,setShowTaxSettings]=useState(false),[taxDraft,setTaxDraft]=useState(DEFAULT_TAX);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [search,setSearch]=useState(''),[typeFilter,setTypeFilter]=useState('ALL'),[statusFilter,setStatusFilter]=useState('ALL'),[linkFilter,setLinkFilter]=useState('ALL'),[monthFilter,setMonthFilter]=useState(''),[dateFrom,setDateFrom]=useState(''),[dateTo,setDateTo]=useState('');
 const [form,setForm]=useState(blank()),[editing,setEditing]=useState(null),[showForm,setShowForm]=useState(false),[employeeSearch,setEmployeeSearch]=useState(''),[attachmentFile,setAttachmentFile]=useState(null);
 const [selected,setSelected]=useState([]),[showLink,setShowLink]=useState(false),[periodId,setPeriodId]=useState(''),[linking,setLinking]=useState(false);
 const [importPreview,setImportPreview]=useState(null);const fileRef=useRef(null);
 const load=useCallback(async()=>{
  if(!supabase||!isSupabaseConfigured){setError('Chưa cấu hình Supabase.');setLoading(false);return;}
  setLoading(true);setError('');
  try{
   const [a,b,c,d]=await Promise.all([
    supabase.from(ITEM_TABLE).select('*').order('created_at',{ascending:false}),
    supabase.from('employees').select('*').order('employee_code',{ascending:true}),
    supabase.from('payroll_periods').select('id,code,name,month,status,type').eq('type','FIXED').order('created_at',{ascending:false}),
    supabase.from('employee_support_tax_settings').select('*').eq('config_key','default').maybeSingle()
   ]);
   if(a.error)throw a.error;if(b.error)throw b.error;if(c.error)throw c.error;if(d.error)throw d.error;
   if(d.data){const cfg={tax_rate:Number(d.data.tax_rate),tax_threshold:Number(d.data.tax_threshold)};setTaxSettings(cfg);setTaxDraft(cfg);}
   const itemRows=a.data||[];
   let links=[];
   if(itemRows.length){const r=await supabase.from(LINK_TABLE).select('*');if(r.error)throw r.error;links=r.data||[];}
   const byId=new Map(links.map(x=>[x.support_item_id,x]));
   setItems(itemRows.map(x=>({...x,period_link:byId.get(x.id)||null})));
   setEmployees(b.data||[]);setPeriods(c.data||[]);
  }catch(e){setError(`Không tải được Hỗ trợ nhân sự: ${errorText(e)}. Kiểm tra migration và quyền RLS.`);}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{load();},[load]);
 const visible=useMemo(()=>items.filter(x=>{
  const q=search.toLocaleLowerCase('vi');
  const matches=!q||[x.employee_code,x.recipient_name,x.description,x.support_type].some(v=>String(v||'').toLocaleLowerCase('vi').includes(q));
  return matches&&(typeFilter==='ALL'||x.recipient_type===typeFilter)&&(statusFilter==='ALL'||x.status===statusFilter)&&(linkFilter==='ALL'||(linkFilter==='LINKED'?!!x.period_link:!x.period_link))&&(!monthFilter||x.support_month===monthFilter)&&(!dateFrom||String(x.created_at||'').slice(0,10)>=dateFrom)&&(!dateTo||String(x.created_at||'').slice(0,10)<=dateTo);
 }),[items,search,typeFilter,statusFilter,linkFilter,monthFilter,dateFrom,dateTo]);
 const selectedRows=useMemo(()=>items.filter(x=>selected.includes(x.id)),[items,selected]);
 const selectedTotal=selectedRows.reduce((s,x)=>s+Number(x.amount||0),0);
 const selectedTax=selectedRows.reduce((s,x)=>s+Number(x.tax_amount??taxOf(x)),0);
 const filteredTotal=visible.reduce((s,x)=>s+Number(x.amount||0),0);
 const openNew=()=>{setEditing(null);setForm(blank());setEmployeeSearch('');setAttachmentFile(null);setError('');setShowForm(true);};
 const openEdit=row=>{if(row.period_link||['LINKED','PAID','CANCELLED'].includes(row.status)){setError('Khoản hỗ trợ đã đưa vào kỳ lương/đã thanh toán/đã hủy không được sửa trực tiếp.');return;}setEditing(row.id);setForm({...blank(),...row,amount:String(row.amount??'')});setEmployeeSearch('');setAttachmentFile(null);setError('');setShowForm(true);};
 const employeeOptions=employees.filter(x=>{const q=employeeSearch.trim().toLocaleLowerCase('vi');return !q||[x.employee_code,x.code,x.full_name,x.name,x.employee_name,x.position,x.department].some(v=>String(v||'').toLocaleLowerCase('vi').includes(q));});
 const chooseEmployee=id=>{const e=employees.find(x=>x.id===id);setForm(f=>({...f,employee_id:id,employee_code:e?.employee_code||e?.code||'',recipient_name:e?.full_name||e?.name||e?.employee_name||''}));setEmployeeSearch('');setEmployeePickerOpen(false);};
 const save=async e=>{
  e.preventDefault();if(saving)return;
  if(!clean(form.description)||!clean(form.recipient_name)||!(Number(form.amount)>0)||!Number.isInteger(Number(form.amount))){setError('Vui lòng nhập người nhận, nội dung và số tiền nguyên dương.');return;}
  if(form.recipient_type==='CURRENT'&&!form.employee_id){setError('Vui lòng chọn hồ sơ nhân sự hiện tại.');return;}
  setSaving(true);setError('');
  try{
   const amount=Math.round(Number(form.amount)),tax=taxOf({...form,amount},taxSettings);
   let attachmentPath=form.attachment_path||null;
   if(attachmentFile){
    const safeName=attachmentFile.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]/g,'_');
    const path=`support/${Date.now()}-${safeName}`;
    const upload=await supabase.storage.from('employee-support-attachments').upload(path,attachmentFile,{upsert:false});
    if(upload.error)throw upload.error;
    attachmentPath=path;
   }
   const payload={recipient_type:form.recipient_type,employee_id:form.employee_id||null,employee_code:clean(form.employee_code)||null,recipient_name:clean(form.recipient_name),description:clean(form.description),support_type:clean(form.support_type)||null,support_month:form.support_month,amount,apply_tax_10:!!form.apply_tax_10,tax_rate:taxSettings.tax_rate,tax_threshold:taxSettings.tax_threshold,tax_amount:tax,net_amount:amount-tax,payment_date:form.payment_date||null,attachment_path:attachmentPath,notes:clean(form.notes)||null,status:form.status||'DRAFT',updated_at:new Date().toISOString()};
   const result=editing?await supabase.from(ITEM_TABLE).update(payload).eq('id',editing).select().single():await supabase.from(ITEM_TABLE).insert(payload).select().single();
   if(result.error)throw result.error;
   await load();setShowForm(false);setMessage(editing?'Đã cập nhật khoản hỗ trợ.':'Đã tạo khoản hỗ trợ.');
  }catch(err){setError(errorText(err));}finally{setSaving(false);}
 };
 const setStatus=async(row,status)=>{
  if(row.period_link||['LINKED','PAID'].includes(row.status)){setError('Khoản đã gắn kỳ lương không thể thay đổi trạng thái tại đây.');return;}
  const {error:e}=await supabase.from(ITEM_TABLE).update({status,updated_at:new Date().toISOString()}).eq('id',row.id);
  if(e)setError(errorText(e));else{setMessage(`Đã cập nhật trạng thái: ${statusLabel(status)}.`);load();}
 };
 const openLink=()=>{const eligible=selectedRows.filter(x=>x.status==='APPROVED'&&!x.period_link);if(eligible.length!==selectedRows.length||!eligible.length){setError('Chỉ chọn các khoản đã duyệt và chưa đưa vào kỳ lương.');return;}setPeriodId('');setShowLink(true);setError('');};
 const linkToPeriod=async()=>{
  const period=periods.find(p=>p.id===periodId);if(!period){setError('Vui lòng chọn Kỳ Lương.');return;}
  if(!['DRAFT','OPEN'].includes(String(period.status||'').toUpperCase())){setError('Chỉ được đưa hỗ trợ vào kỳ lương đang mở hoặc bản nháp.');return;}
  setLinking(true);setError('');
  try{
   const ids=selectedRows.map(x=>x.id);
   const {data:linkedCount,error:e}=await supabase.rpc('employee_support_link_to_period',{p_support_item_ids:ids,p_period_id:period.id});if(e)throw e;
   setSelected([]);setShowLink(false);setMessage(`Đã đưa ${Number(linkedCount||ids.length)} khoản hỗ trợ vào ${period.name||period.code||'Kỳ Lương'}.`);await load();
  }catch(err){setError(`Không thể đưa vào kỳ lương: ${errorText(err)}`);}finally{setLinking(false);}
 };
 const openAttachment=async path=>{if(!path)return;const {data,error:e}=await supabase.storage.from('employee-support-attachments').createSignedUrl(path,300);if(e){setError(errorText(e));return;}window.open(data.signedUrl,'_blank','noopener,noreferrer');};
 const exportExcel=()=>{
  const data=visible.map(x=>({'Mã nhân viên':x.employee_code,'Họ tên':x.recipient_name,'Loại đối tượng':typeLabel(x.recipient_type),'Nội dung hỗ trợ':x.description,'Loại hỗ trợ':x.support_type,'Kỳ hỗ trợ':x.support_month,'Số tiền':x.amount,'Áp dụng thuế 10%':x.apply_tax_10?'Có':'Không','Thuế TNCN':x.tax_amount,'Thực nhận':x.net_amount,'Trạng thái':statusLabel(x.status),'Ghi chú':x.notes}));
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data),'Ho tro');XLSX.writeFile(wb,'BAO_CAO_HO_TRO_NHAN_SU.xlsx');
 };
 const downloadTemplate=()=>{const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Mã nhân viên','Họ tên','Loại đối tượng','Nội dung hỗ trợ','Kỳ hỗ trợ','Số tiền','Áp dụng thuế TNCN','Ghi chú'],['VA001','NGUYỄN VĂN A','CURRENT','Hỗ trợ đặc biệt',monthNow(),5000000,'Không','Ghi chú']]),'Du lieu');XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['HƯỚNG DẪN'],['Mã nhân viên: bắt buộc với CURRENT; để trống nếu không thuộc Employee Master.'],['Loại đối tượng: CURRENT, FORMER, INTERN, TRAINEE, OTHER.'],['Kỳ hỗ trợ: YYYY-MM.'],['Số tiền: số nguyên dương, không nhập ký hiệu tiền tệ.'],['Áp dụng thuế TNCN: Có hoặc Không; ngưỡng > 5.000.000 đồng.'],['Import sẽ kiểm tra và xem trước; không tự ghi đè dữ liệu hiện có.']]),'Huong dan');XLSX.writeFile(wb,'MAU_IMPORT_HO_TRO_NHAN_SU.xlsx');};
 const readImport=async file=>{
  try{const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});const preview=rows.map((r,i)=>{const code=clean(r['Mã nhân viên']||r['Ma nhan vien']);const emp=employees.find(x=>clean(x.employee_code||x.code).toLowerCase()===code.toLowerCase());const amount=Number(String(r['Số tiền']??r['So tien']??'').replace(/[., ]/g,''));const type=clean(r['Loại đối tượng']||r['Loai doi tuong']|| (emp?'CURRENT':'OTHER')).toUpperCase();const errors=[];if(!clean(r['Nội dung hỗ trợ']||r['Noi dung ho tro']))errors.push('Thiếu nội dung');if(!(amount>0&&Number.isInteger(amount)))errors.push('Số tiền không hợp lệ');if(type==='CURRENT'&&!emp)errors.push('Không tìm thấy mã nhân viên');if(!clean(r['Họ tên']||r['Ho ten'])&&!emp)errors.push('Thiếu họ tên');return {line:i+2,code,emp,amount,type,description:clean(r['Nội dung hỗ trợ']||r['Noi dung ho tro']),name:clean(r['Họ tên']||r['Ho ten'])||emp?.full_name||emp?.name||'',month:clean(r['Kỳ hỗ trợ']||r['Ky ho tro'])||monthNow(),apply: /^(co|có|yes|true|1)$/i.test(clean(r['Áp dụng thuế TNCN']||r['Ap dung thue TNCN'])),notes:clean(r['Ghi chú']||r['Ghi chu']),errors};});
   const seen=new Set();
   preview.forEach(x=>{
    const fingerprint=[x.code.toLowerCase(),x.name.toLocaleLowerCase('vi'),x.month,x.description.toLocaleLowerCase('vi'),x.amount].join('|');
    if(seen.has(fingerprint))x.errors.push('Dòng trùng trong file Import');
    seen.add(fingerprint);
    const exists=items.some(old=>old.status!=='CANCELLED'&&clean(old.employee_code).toLowerCase()===x.code.toLowerCase()&&clean(old.recipient_name).toLocaleLowerCase('vi')===x.name.toLocaleLowerCase('vi')&&old.support_month===x.month&&clean(old.description).toLocaleLowerCase('vi')===x.description.toLocaleLowerCase('vi')&&Number(old.amount)===x.amount);
    if(exists)x.errors.push('Khoản hỗ trợ đã tồn tại trong hệ thống');
   });
   setImportPreview(preview);}
  catch(e){setError(`Không đọc được Excel: ${errorText(e)}`);}
 };
 const confirmImport=async()=>{const valid=(importPreview||[]).filter(x=>!x.errors.length);if(!valid.length){setError('Không có dòng hợp lệ để Import.');return;}setSaving(true);try{const payload=valid.map(x=>{const tax=x.apply&&x.amount>taxSettings.tax_threshold?Math.round(x.amount*taxSettings.tax_rate):0;return {recipient_type:TYPES.some(t=>t.value===x.type)?x.type:'OTHER',employee_id:x.emp?.id||null,employee_code:x.code||x.emp?.employee_code||null,recipient_name:x.name,description:x.description,support_month:x.month,amount:x.amount,apply_tax_10:x.apply,tax_rate:taxSettings.tax_rate,tax_threshold:taxSettings.tax_threshold,tax_amount:tax,net_amount:x.amount-tax,status:'DRAFT',notes:x.notes||null};});const {error:e}=await supabase.from(ITEM_TABLE).insert(payload);if(e)throw e;setImportPreview(null);await load();setMessage(`Đã Import ${payload.length} khoản hỗ trợ.`);}catch(e){setError(errorText(e));}finally{setSaving(false);}};
 const markPaid=async row=>{if(!row.period_link){setError('Chỉ xác nhận thanh toán sau khi khoản đã được đưa vào Kỳ Lương.');return;}const {error:e}=await supabase.from(ITEM_TABLE).update({status:'PAID',paid_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',row.id);if(e)setError(errorText(e));else{setMessage('Đã xác nhận thanh toán.');load();}};
 return <div className="employee-support-page">
  <div className="es-intro"><div><span className="es-eyebrow">DỮ LIỆU KỲ LƯƠNG</span><h2>Hỗ trợ nhân sự</h2><p>Quản lý các khoản hỗ trợ, truy lĩnh và chi trả đặc biệt ngoài công thức lương.</p></div><div className="es-actions"><button onClick={downloadTemplate}><FileSpreadsheet size={16}/> Tải template</button><button onClick={()=>fileRef.current?.click()}><Upload size={16}/> Import</button><button onClick={exportExcel}><Download size={16}/> Export</button><button onClick={load}><RefreshCw size={16}/> Làm mới</button><button onClick={()=>{setTaxDraft(taxSettings);setShowTaxSettings(true);}}>Cấu hình thuế</button><button className="primary" onClick={openNew}><Plus size={16}/> Thêm khoản hỗ trợ</button><input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e=>{if(e.target.files?.[0])readImport(e.target.files[0]);e.target.value='';}}/></div></div>
  <div className="es-stats"><div><span>Tổng khoản đang lọc</span><strong>{visible.length}</strong></div><div><span>Tổng tiền hỗ trợ</span><strong>{money(filteredTotal)} ₫</strong></div><div><span>Chưa đưa vào kỳ lương</span><strong>{visible.filter(x=>!x.period_link).length}</strong></div><div><span>Đã thanh toán</span><strong>{visible.filter(x=>x.status==='PAID').length}</strong></div></div>
  <div className="es-toolbar"><div className="es-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm mã nhân viên, họ tên, nội dung..."/></div><select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="ALL">Tất cả đối tượng</option>{TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="ALL">Tất cả trạng thái</option>{STATUSES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select><select value={linkFilter} onChange={e=>setLinkFilter(e.target.value)}><option value="ALL">Tất cả kỳ lương</option><option value="UNLINKED">Chưa đưa vào kỳ lương</option><option value="LINKED">Đã đưa vào kỳ lương</option></select><input type="month" value={monthFilter} onChange={e=>setMonthFilter(e.target.value)} aria-label="Kỳ hỗ trợ"/><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} aria-label="Từ ngày tạo"/><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} aria-label="Đến ngày tạo"/></div>
  {error&&<div className="es-alert error"><AlertCircle size={16}/>{error}<button onClick={()=>setError('')}><X size={14}/></button></div>}{message&&<div className="es-alert success"><CheckCircle2 size={16}/>{message}<button onClick={()=>setMessage('')}><X size={14}/></button></div>}
  {selected.length>0&&<div className="es-selection"><span>Đã chọn {selectedRows.length} khoản · Tổng {money(selectedTotal)} ₫ · Thuế {money(selectedTax)} ₫ · Thực nhận {money(selectedTotal-selectedTax)} ₫</span><button className="primary" onClick={openLink}><Link2 size={15}/> Đưa vào Kỳ Lương</button><button onClick={()=>setSelected([])}>Bỏ chọn</button></div>}
  <div className="es-table-wrap"><table className="es-table"><thead><tr><th><input type="checkbox" checked={visible.length>0&&visible.every(x=>selected.includes(x.id))} onChange={e=>setSelected(e.target.checked?[...new Set([...selected,...visible.map(x=>x.id)])]:selected.filter(id=>!visible.some(x=>x.id===id)))}/></th><th>STT</th><th>Mã nhân viên</th><th>Họ và tên</th><th>Loại đối tượng</th><th>Nội dung hỗ trợ</th><th>Kỳ hỗ trợ</th><th className="right">Số tiền</th><th className="right">Thuế TNCN</th><th className="right">Thực nhận</th><th>Trạng thái</th><th>Kỳ lương</th><th>Thao tác</th></tr></thead><tbody>
   {loading?<tr><td colSpan="13" className="empty">Đang tải dữ liệu...</td></tr>:visible.length===0?<tr><td colSpan="13" className="empty">Chưa có khoản hỗ trợ phù hợp.</td></tr>:visible.map((x,i)=><tr key={x.id}><td><input type="checkbox" checked={selected.includes(x.id)} disabled={!!x.period_link||x.status!=='APPROVED'} onChange={e=>setSelected(old=>e.target.checked?[...old,x.id]:old.filter(id=>id!==x.id))}/></td><td>{i+1}</td><td className="code">{x.employee_code||'—'}</td><td className="name">{x.recipient_name}</td><td>{typeLabel(x.recipient_type)}</td><td>{x.description}</td><td>{x.support_month||'—'}</td><td className="right">{money(x.amount)} ₫</td><td className="right">{money(x.tax_amount)} ₫</td><td className="right">{money(x.net_amount)} ₫</td><td><span className={`es-status ${String(x.status).toLowerCase()}`}>{statusLabel(x.status)}</span></td><td>{x.period_link?.period_id?(periods.find(p=>p.id===x.period_link.period_id)?.name||periods.find(p=>p.id===x.period_link.period_id)?.code||'Đã liên kết'):'—'}</td><td><div className="es-row-actions">{x.attachment_path&&<button title="Mở tài liệu" onClick={()=>openAttachment(x.attachment_path)}>Tệp</button>}{x.status==='DRAFT'&&<button title="Gửi duyệt" onClick={()=>setStatus(x,'PENDING')}>Gửi duyệt</button>}{x.status==='PENDING'&&<button title="Duyệt" onClick={()=>setStatus(x,'APPROVED')}>Duyệt</button>}{x.status==='APPROVED'&&<button title="Sửa" onClick={()=>openEdit(x)}><Edit3 size={14}/></button>}{x.status==='LINKED'&&<button title="Đã thanh toán" onClick={()=>markPaid(x)}>Đã trả</button>}{['DRAFT','PENDING'].includes(x.status)&&<button title="Sửa" onClick={()=>openEdit(x)}><Edit3 size={14}/></button>}{['DRAFT','PENDING','APPROVED'].includes(x.status)&&<button title="Hủy" onClick={()=>setStatus(x,'CANCELLED')}><Trash2 size={14}/></button>}</div></td></tr>)}
  </tbody></table></div>
  {showForm&&<div className="es-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setShowForm(false)}><form className="es-modal" onSubmit={save}><div className="es-modal-head"><div><h3>{editing?'Chỉnh sửa khoản hỗ trợ':'Thêm khoản hỗ trợ'}</h3><p>Nhập trực tiếp số tiền, không áp dụng công thức định mức.</p></div><button type="button" onClick={()=>setShowForm(false)}><X/></button></div><div className="es-form-grid">
   <label>Đối tượng nhận<select value={form.recipient_type} onChange={e=>setForm(f=>({...f,recipient_type:e.target.value,employee_id:'',employee_code:'',recipient_name:''}))}>{TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
   {form.recipient_type==='CURRENT'&&<label className="wide">Chọn nhân sự<div className="es-employee-picker"><input value={form.employee_id?(employees.find(x=>x.id===form.employee_id)?.employee_code||employees.find(x=>x.id===form.employee_id)?.code||'')+' · '+(employees.find(x=>x.id===form.employee_id)?.full_name||employees.find(x=>x.id===form.employee_id)?.name||employees.find(x=>x.id===form.employee_id)?.employee_name||''):employeeSearch} onChange={e=>{setForm(f=>({...f,employee_id:'',employee_code:'',recipient_name:''}));setEmployeeSearch(e.target.value);setEmployeePickerOpen(true);}} onFocus={()=>{setEmployeeSearch('');setEmployeePickerOpen(true);}} placeholder="Tìm theo mã nhân viên hoặc họ tên..."/>{employeePickerOpen&&<div className="es-employee-options">{employeeOptions.slice(0,100).map(x=><button type="button" key={x.id} onMouseDown={e=>e.preventDefault()} onClick={()=>chooseEmployee(x.id)}><strong>{x.employee_code||x.code||'—'}</strong><span>{x.full_name||x.name||x.employee_name}</span></button>)}{employeeOptions.length===0&&<div className="es-no-employee">Không tìm thấy nhân sự phù hợp.</div>}{employeeOptions.length>100&&<div className="es-no-employee">Nhập thêm ký tự để thu hẹp kết quả ({employeeOptions.length} nhân sự).</div>}</div>}</div></label>}
   {form.recipient_type!=='CURRENT'&&<><label className="wide">Liên kết hồ sơ Employee Master (nếu có)<div className="es-employee-picker"><input value={form.employee_id?(employees.find(x=>x.id===form.employee_id)?.employee_code||employees.find(x=>x.id===form.employee_id)?.code||'')+' · '+(employees.find(x=>x.id===form.employee_id)?.full_name||employees.find(x=>x.id===form.employee_id)?.name||employees.find(x=>x.id===form.employee_id)?.employee_name||''):employeeSearch} onChange={e=>{setForm(f=>({...f,employee_id:'',employee_code:'',recipient_name:''}));setEmployeeSearch(e.target.value);setEmployeePickerOpen(true);}} onFocus={()=>{setEmployeeSearch('');setEmployeePickerOpen(true);}} placeholder="Tìm mã hoặc họ tên để liên kết (không bắt buộc)..."/>{employeePickerOpen&&<div className="es-employee-options"><button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>{setForm(f=>({...f,employee_id:''}));setEmployeeSearch('');setEmployeePickerOpen(false);}}><strong>Không liên kết</strong><span>Người nhận ngoài Employee Master</span></button>{employeeOptions.slice(0,100).map(x=><button type="button" key={x.id} onMouseDown={e=>e.preventDefault()} onClick={()=>{setForm(f=>({...f,employee_id:x.id,employee_code:x.employee_code||x.code||f.employee_code,recipient_name:x.full_name||x.name||x.employee_name||f.recipient_name}));setEmployeeSearch('');setEmployeePickerOpen(false);}}><strong>{x.employee_code||x.code||'—'}</strong><span>{x.full_name||x.name||x.employee_name}</span></button>)}{employeeOptions.length===0&&<div className="es-no-employee">Không tìm thấy nhân sự phù hợp.</div>}</div>}</div></label><label>Mã nhân viên (không bắt buộc)<input value={form.employee_code} onChange={e=>setForm(f=>({...f,employee_code:e.target.value}))}/></label><label>Họ và tên người nhận<input required value={form.recipient_name} onChange={e=>setForm(f=>({...f,recipient_name:e.target.value}))}/></label></>}
   <label className="wide">Nội dung hỗ trợ<input required value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Ví dụ: Hỗ trợ trong thời gian nghỉ chế độ..."/></label>
   <label>Loại hỗ trợ<input value={form.support_type||''} onChange={e=>setForm(f=>({...f,support_type:e.target.value}))} placeholder="Nhập loại hỗ trợ"/></label>
   <label>Kỳ hỗ trợ<input type="month" required value={form.support_month} onChange={e=>setForm(f=>({...f,support_month:e.target.value}))}/></label>
   <label>Số tiền hỗ trợ (₫)<input required inputMode="numeric" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value.replace(/[^0-9]/g,'')}))} placeholder="Nhập số nguyên dương"/></label>
   <label>Ngày chi trả dự kiến<input type="date" value={form.payment_date||''} onChange={e=>setForm(f=>({...f,payment_date:e.target.value}))}/></label>
   <label className="wide">Tài liệu đính kèm (PDF, JPG, PNG, DOCX)<input type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={e=>setAttachmentFile(e.target.files?.[0]||null)}/>{form.attachment_path&&<small>Đã có tệp: <button type='button' className='es-inline-link' onClick={()=>openAttachment(form.attachment_path)}>Mở tài liệu</button></small>}</label>
   <label className="wide">Ghi chú<textarea rows="2" value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></label>
   <label className="es-check wide"><input type="checkbox" checked={!!form.apply_tax_10} onChange={e=>setForm(f=>({...f,apply_tax_10:e.target.checked}))}/> Áp dụng khấu trừ thuế TNCN 10% nếu khoản chi trả trên 5.000.000 đồng</label>
  </div><div className="es-tax-preview"><div><span>Trước thuế</span><strong>{money(form.amount)} ₫</strong></div><div><span>Thuế TNCN</span><strong>{money(taxOf(form,taxSettings))} ₫</strong></div><div><span>Thực nhận</span><strong>{money(Math.max(0,Number(form.amount||0)-taxOf(form,taxSettings)))} ₫</strong></div></div><div className="es-modal-foot"><button type="button" onClick={()=>setShowForm(false)}>Hủy</button><button className="primary" disabled={saving}><Save size={15}/> {saving?'Đang lưu...':'Lưu khoản hỗ trợ'}</button></div></form></div>}
  {showLink&&<div className="es-modal-backdrop"><div className="es-modal es-link-modal"><div className="es-modal-head"><div><h3>Đưa khoản hỗ trợ vào Kỳ Lương</h3><p>{selectedRows.length} khoản · {money(selectedTotal)} ₫ · Thuế {money(selectedTax)} ₫ · Thực nhận {money(selectedTotal-selectedTax)} ₫</p></div><button onClick={()=>setShowLink(false)}><X/></button></div><label>Chọn Kỳ Lương<select value={periodId} onChange={e=>setPeriodId(e.target.value)}><option value="">-- Chọn kỳ đang mở --</option>{periods.filter(p=>['DRAFT','OPEN'].includes(String(p.status||'').toUpperCase())).map(p=><option key={p.id} value={p.id}>{p.name||p.code} · {p.month} · {p.status}</option>)}</select></label><div className="es-modal-foot"><button onClick={()=>setShowLink(false)}>Hủy</button><button className="primary" disabled={linking||!periodId} onClick={linkToPeriod}><Link2 size={15}/> {linking?'Đang đưa vào kỳ...':'Xác nhận đưa vào kỳ'}</button></div></div></div>}
  {showTaxSettings&&<div className="es-modal-backdrop"><form className="es-modal es-tax-settings" onSubmit={async e=>{e.preventDefault();const rate=Number(taxDraft.tax_rate),threshold=Number(taxDraft.tax_threshold);if(!(rate>0&&rate<=1&&threshold>=0)){setError('Tỷ lệ thuế phải từ 0 đến 100%; ngưỡng không âm.');return;}const {error:e2}=await supabase.from('employee_support_tax_settings').upsert({config_key:'default',tax_rate:rate,tax_threshold:Math.round(threshold),updated_at:new Date().toISOString()},{onConflict:'config_key'});if(e2){setError(errorText(e2));return;}const cfg={tax_rate:rate,tax_threshold:Math.round(threshold)};setTaxSettings(cfg);setShowTaxSettings(false);setMessage('Đã cập nhật cấu hình thuế hỗ trợ.');}}><div className="es-modal-head"><div><h3>Cấu hình khấu trừ thuế hỗ trợ</h3><p>Áp dụng cho các khoản hỗ trợ được chọn khấu trừ thuế.</p></div><button type="button" onClick={()=>setShowTaxSettings(false)}><X/></button></div><div className="es-form-grid"><label>Tỷ lệ thuế (%)<input type="number" min="0.01" max="100" step="0.01" value={Number(taxDraft.tax_rate||0)*100} onChange={e=>setTaxDraft(x=>({...x,tax_rate:Number(e.target.value)/100}))}/></label><label>Ngưỡng áp dụng (₫)<input type="number" min="0" step="1000" value={taxDraft.tax_threshold} onChange={e=>setTaxDraft(x=>({...x,tax_threshold:Number(e.target.value)}))}/></label></div><div className="es-modal-foot"><button type="button" onClick={()=>setShowTaxSettings(false)}>Hủy</button><button className="primary">Lưu cấu hình</button></div></form></div>}
  {importPreview&&<div className="es-modal-backdrop"><div className="es-modal es-import-modal"><div className="es-modal-head"><div><h3>Xem trước Import</h3><p>{importPreview.filter(x=>!x.errors.length).length} dòng hợp lệ / {importPreview.length} dòng</p></div><button onClick={()=>setImportPreview(null)}><X/></button></div><div className="es-import-list">{importPreview.map(x=><div key={x.line} className={x.errors.length?'invalid':''}><strong>Dòng {x.line}: {x.name||x.code||'Chưa có tên'}</strong><span>{x.description} · {money(x.amount)} ₫</span><small>{x.errors.join(' · ')||'Hợp lệ'}</small></div>)}</div><div className="es-modal-foot"><button onClick={()=>setImportPreview(null)}>Hủy</button><button className="primary" disabled={saving||!importPreview.some(x=>!x.errors.length)} onClick={confirmImport}><Upload size={15}/> Xác nhận Import</button></div></div></div>}
 </div>;
}
