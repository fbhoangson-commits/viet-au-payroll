import React,{useEffect,useMemo,useState} from 'react';
import * as XLSX from 'xlsx';
import {Plus,Settings2,RefreshCw,Search,Save,Trash2,Users,Columns3,Download,Upload,FileSpreadsheet} from 'lucide-react';
import './salary-rates.css';
import { supabase as sharedSupabase } from '../../shared/supabase.js';
import { fetchEmployees } from '../employee-master/services/employeeService.js';
const today=()=>new Date().toISOString().slice(0,10);
const money=n=>n===''||n==null?'':Number(n).toLocaleString('vi-VN',{maximumFractionDigits:2});
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLocaleLowerCase('vi').trim();
const fieldKey=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLocaleLowerCase('vi').replace(/[^a-z0-9]+/g,' ').trim();
function employeeGroupOf(row){
 const custom=row?.custom_fields&&typeof row.custom_fields==='object'?row.custom_fields:{};
 const direct=row?.employee_group??row?.group;
 if(direct!==undefined&&direct!==null&&String(direct).trim())return String(direct).trim();
 const entries=Object.entries(custom);
 const match=entries.find(([key])=>['employee group','nhom','nhom nhan su'].includes(fieldKey(key)));
 if(match&&match[1]!==undefined&&match[1]!==null&&String(match[1]).trim())return String(match[1]).trim();
 const expanded=Object.entries(row||{}).find(([key])=>['employee group','nhom','nhom nhan su'].includes(fieldKey(key))&&key!=='group'&&key!=='employee_group');
 return expanded&&expanded[1]!==undefined&&expanded[1]!==null&&String(expanded[1]).trim()?String(expanded[1]).trim():'';
}
const csvCell=v=>`\"${String(v??'').replace(/\"/g,'\"\"')}\"`;
function downloadCsv(filename,rows){const csv='\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);}
function parseCsv(text){
 const first=(text.split(/\r?\n/,1)[0]||'');let delimiter=',',best=-1;
 for(const d of [',',';','\t']){let n=0,q=false;for(let i=0;i<first.length;i++){if(first[i]==='"')q=!q;else if(first[i]===d&&!q)n++;}if(n>best){best=n;delimiter=d;}}
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'&&quoted&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=!quoted;else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()!==''))rows.push(row);row=[];cell='';}else cell+=c;}
 if(cell!==''||row.length){row.push(cell);if(row.some(x=>x.trim()!==''))rows.push(row);}return rows;
}
function parseLocalizedNumber(raw){
 const s=String(raw??'').trim().replace(/[₫đĐ\s]/g,'');if(!s)return {value:'',valid:true};
 if(!/^[+-]?[\d.,]+$/.test(s))return {valid:false};
 const commas=(s.match(/,/g)||[]).length,dots=(s.match(/\./g)||[]).length;
 let normalized=s;
 if(commas&&dots){const decimal=s.lastIndexOf(',')>s.lastIndexOf('.')?',':'.';normalized=decimal===','?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');}
 else if(commas||dots){const sep=commas?',':'.',count=commas||dots,parts=s.split(sep);if(count===1){const tail=parts[1]||'';if(tail.length===3)normalized=parts.join('');else normalized=s.replace(sep,'.');}else{const tail=parts.pop();normalized=parts.join('')+'.'+tail;}}
 const n=Number(normalized);return Number.isFinite(n)?{value:n,valid:true}:{valid:false};
}
function SalaryRatesModule({supabase,employees=[],policies=[],notify=()=>{}}){
 const [groups,setGroups]=useState([]),[fields,setFields]=useState([]),[values,setValues]=useState([]),[groupId,setGroupId]=useState(''),[policyId,setPolicyId]=useState(''),[query,setQuery]=useState(''),[department,setDepartment]=useState(''),[employmentType,setEmploymentType]=useState(''),[status,setStatus]=useState('active'),[loading,setLoading]=useState(false),[config,setConfig]=useState(false),[groupName,setGroupName]=useState(''),[fieldName,setFieldName]=useState(''),[editingField,setEditingField]=useState(null),[editingEmployee,setEditingEmployee]=useState(null),[draftValues,setDraftValues]=useState({});
 async function load(){if(!supabase)return;setLoading(true);try{const [g,f,v]=await Promise.all([supabase.from('salary_rate_groups').select('*').order('sort_order').order('name'),supabase.from('salary_rate_columns').select('*').order('display_order').order('name'),supabase.from('salary_rate_values').select('*')]);if(g.error)throw g.error;if(f.error)throw f.error;if(v.error)throw v.error;setGroups(g.data||[]);setFields(f.data||[]);setValues(v.data||[]);if(!groupId&&g.data?.length)setGroupId(g.data[0].id);if(!policyId&&policies.length)setPolicyId(policies.find(p=>p.status==='ACTIVE')?.id||policies[0].id);}catch(e){notify(`Không tải được cấu hình bảng định mức: ${e.message||e.code}. Cần chạy migration SQL đi kèm.`)}finally{setLoading(false)}}
 useEffect(()=>{load()},[supabase]);
 useEffect(()=>{if(!policyId&&policies.length){const active=policies.find(p=>String(p.status||'').toUpperCase()==='ACTIVE')||policies[0];if(active?.id)setPolicyId(active.id);}},[policies,policyId]);
 const currentGroup=groups.find(g=>g.id===groupId);const groupFields=fields.filter(f=>f.group_id===groupId&&f.is_active!==false);const depts=[...new Set(employees.map(e=>e.department).filter(Boolean))].sort();const types=[...new Set(employees.map(e=>e.group||e.employment_type).filter(Boolean))].sort();
 const filtered=useMemo(()=>employees.filter(e=>{const q=norm(query),hay=norm([e.id,e.name,e.department,e.role,e.group,e.classification,e.email].join(' '));const s=norm(e.status||'Đang làm việc');return(!q||hay.includes(q))&&(!department||e.department===department)&&(!employmentType||(e.group||e.employment_type)===employmentType)&&(status==='all'||(status==='active'&&!s.includes('nghi'))||(status==='inactive'&&s.includes('nghi')))}).sort((a,b)=>String(a.id||'').localeCompare(String(b.id||''),'en',{numeric:true,sensitivity:'base'})),[employees,query,department,employmentType,status]);
 const valueMap=useMemo(()=>new Map(values.filter(v=>v.group_id===groupId&&v.policy_version_id===policyId).map(v=>[v.employee_id,v])),[values,groupId,policyId]);
 function startEdit(employee){const current=valueMap.get(employee.supabaseId)?.values||{};setEditingEmployee(employee.id);setDraftValues({...current});}
 function cancelEdit(){setEditingEmployee(null);setDraftValues({});}
 async function saveRow(employee){
  if(!employee.supabaseId)return notify(`Nhân viên ${employee.id} chưa có UUID Supabase. Đồng bộ Master trước.`);
  const payload={employee_id:employee.supabaseId,group_id:groupId,policy_version_id:policyId,values:{...(valueMap.get(employee.supabaseId)?.values||{}),...draftValues},updated_at:new Date().toISOString()};
  try{const {error}=await supabase.from('salary_rate_values').upsert(payload,{onConflict:'employee_id,group_id,policy_version_id'});if(error)throw error;setValues(prev=>[...prev.filter(x=>!(x.employee_id===payload.employee_id&&x.group_id===groupId&&x.policy_version_id===policyId)),{...payload}]);cancelEdit();notify(`Đã lưu định mức của ${employee.name}.`);}catch(e){notify(`Không lưu được định mức: ${e.message||e.code}`)}
 }
 async function addGroup(e){e.preventDefault();if(!groupName.trim())return;try{const {data,error}=await supabase.from('salary_rate_groups').insert({code:norm(groupName).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').toUpperCase(),name:groupName.trim(),sort_order:groups.length,active:true}).select('*').single();if(error)throw error;setGroups(p=>[...p,data]);setGroupId(data.id);setGroupName('');notify('Đã thêm nhóm định mức.')}catch(e){notify(`Không thêm được nhóm: ${e.message||e.code}`)}}
 async function addField(e){e.preventDefault();if(!fieldName.trim()||!groupId)return;try{
   const code=norm(fieldName).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').toUpperCase();
   if(!code)throw new Error('Không tạo được mã cột từ tên đã nhập.');
   const payload={group_id:groupId,code,name:fieldName.trim(),display_order:groupFields.length,is_active:true,updated_at:new Date().toISOString()};
   const q=editingField?supabase.from('salary_rate_columns').update({name:payload.name,display_order:payload.display_order,is_active:true,updated_at:payload.updated_at}).eq('id',editingField):supabase.from('salary_rate_columns').insert(payload);
   const {data,error}=await q.select('*').single();if(error)throw error;
   setFields(p=>editingField?p.map(x=>x.id===editingField?data:x):[...p,data]);setFieldName('');setEditingField(null);notify('Đã lưu cột định mức.');
  }catch(e){notify(`Không lưu được cột: ${e.message||e.code}`)}}
  async function deleteField(id){if(!confirm('Ngừng sử dụng cột này? Dữ liệu đã lưu sẽ không bị xóa.'))return;try{const {error}=await supabase.from('salary_rate_columns').update({is_active:false}).eq('id',id);if(error)throw error;setFields(p=>p.map(x=>x.id===id?{...x,is_active:false}:x));notify('Đã ẩn cột; dữ liệu cũ được giữ nguyên.')}catch(e){notify(`Không cập nhật được cột: ${e.message||e.code}`)}}
 async function exportCurrent(){const headers=['Mã nhân viên','Họ tên','Phòng ban','Chức vụ','Nhóm định mức','Mã phiên bản',...groupFields.map(f=>f.name)];const rows=filtered.map(e=>{const v=valueMap.get(e.supabaseId)?.values||{};return [e.id,e.name,e.department||'',e.role||'',currentGroup?.name||'',policies.find(p=>p.id===policyId)?.code||'',...groupFields.map(f=>v[f.id]??'')]});downloadCsv(`dinh-muc-${norm(currentGroup?.name||'nhom').replace(/\s+/g,'-')}.csv`,[headers,...rows]);}
 function downloadTemplate(){const headers=['Mã nhân viên','Họ tên','Phòng ban','Chức vụ','Nhóm định mức','Mã phiên bản',...groupFields.map(f=>f.name)];const example=['VA001','Nguyễn Văn A','Phòng ban','Chức vụ',currentGroup?.name||'',policies.find(p=>p.id===policyId)?.code||'',...groupFields.map(()=> '')];downloadCsv(`template-dinh-muc-${norm(currentGroup?.name||'nhom').replace(/\s+/g,'-')}.csv`,[headers,example]);}
 async function importCsv(file){
  if(!file)return;
  try{
   const isExcel=/\.(xlsx|xls)$/i.test(file.name);
   let rows;
   if(isExcel){const workbook=XLSX.read(await file.arrayBuffer(),{type:'array'});rows=XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{header:1,raw:false,defval:''});}
   else rows=parseCsv((await file.text()).replace(/^\uFEFF/,''));
   if(rows.length<2)throw new Error('File không có dữ liệu.');
   const headers=rows[0].map(x=>x.trim());
   const headerKey=x=>norm(x).replace(/[._-]/g,' ').replace(/\s+/g,' ').trim();
   const codeIndex=headers.findIndex(x=>['ma nhan vien','mnv','ma nv','employee code','employee id'].includes(headerKey(x)));
   if(codeIndex<0)throw new Error('Thiếu cột bắt buộc “Mã nhân viên”.');
   const fieldIndexes=groupFields.map(f=>({field:f,index:headers.findIndex(h=>headerKey(h)===headerKey(f.name))})).filter(x=>x.index>=0);
   if(!fieldIndexes.length)throw new Error('Không tìm thấy cột thành phần của nhóm đang chọn. Hãy tải template mới.');
   const parsed=[],issues=[];let unknown=0;
   for(let ri=1;ri<rows.length;ri++){
    const cells=rows[ri],code=(cells[codeIndex]||'').trim();if(!code)continue;
    const employee=employees.find(e=>norm(e.id)===norm(code));
    if(!employee?.supabaseId){unknown++;continue;}
    const vals={};
    for(const {field,index} of fieldIndexes){
      const raw=(cells[index]??'').trim();
      
      if(raw===''){vals[field.id]=null;continue;}
      const n=parseLocalizedNumber(raw);
      if(!n.valid){issues.push(`Dòng ${ri+1}, ${code}, cột ${field.name}: “${raw}” không phải số hợp lệ.`);continue;}
      vals[field.id]=n.value;
    }
    parsed.push({employee,vals,code});
   }
   if(issues.length)throw new Error(issues.slice(0,5).join(' ') + (issues.length>5?` Còn ${issues.length-5} lỗi khác.`:''));
   if(!policyId)throw new Error('Vui lòng chọn phiên bản chính sách trước khi Import.');
   if(!parsed.length)throw new Error('Không có mã nhân viên hợp lệ để nhập.');
   const duplicate=parsed.map(x=>x.code.toLowerCase()).filter((x,i,a)=>a.indexOf(x)!==i);
   if(duplicate.length)throw new Error(`File có mã nhân viên trùng: ${[...new Set(duplicate)].join(', ')}. Hãy sửa file rồi nhập lại.`);
   const confirmText=`Xác nhận thay thế định mức nhóm “${currentGroup?.name||''}”, phiên bản ${policies.find(p=>p.id===policyId)?.code||''}?\\n\\nSố nhân viên cập nhật: ${parsed.length}\\nMã không tìm thấy/bỏ qua: ${unknown}\\nCác cột có trong file sẽ được thay thế theo Mã Nhân Viên; ô trống sẽ xóa giá trị cũ của cột đó. Nhân viên không có trong file được giữ nguyên.`;
   if(!confirm(confirmText))return;
   for(const item of parsed){
    const old=values.find(v=>v.employee_id===item.employee.supabaseId&&v.group_id===groupId&&v.policy_version_id===policyId);
    const next={...(old?.values||{})};
    fieldIndexes.forEach(({field})=>{if(Object.prototype.hasOwnProperty.call(item.vals,field.id)){if(item.vals[field.id]===null)delete next[field.id];else next[field.id]=item.vals[field.id];}});
    const payload={employee_id:item.employee.supabaseId,group_id:groupId,policy_version_id:policyId,values:next,updated_at:new Date().toISOString()};
    const {error}=await supabase.from('salary_rate_values').upsert(payload,{onConflict:'employee_id,group_id,policy_version_id'});if(error)throw error;
   }
   await load();notify(`Import hoàn tất: cập nhật ${parsed.length} nhân viên; bỏ qua ${unknown} mã không tìm thấy.`);
  }catch(e){notify(`Không nhập được file: ${e.message||e}`)}
 }
 return <section className="panel salary-rates-module"><div className="section-intro"><div><h3>Định mức lương</h3><p>Danh sách nhân viên luôn là nền tảng. Chọn nhóm để hiển thị các cột thành phần tương ứng.</p></div><div className="salary-rate-actions"><button className="btn btn-secondary" onClick={downloadTemplate}><FileSpreadsheet size={14}/> Tải template</button><label className="btn btn-secondary salary-rate-file-button"><Upload size={14}/> Import<input type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={e=>{importCsv(e.target.files?.[0]);e.target.value='';}}/></label><button className="btn btn-secondary" onClick={exportCurrent}><Download size={14}/> Export</button><button className="btn btn-secondary" onClick={load}><RefreshCw size={14}/> Làm mới</button><button className="btn btn-secondary" onClick={()=>setConfig(v=>!v)}><Settings2 size={14}/> Cấu hình nhóm & cột</button></div></div>
 <div className="salary-rate-filters"><label>Phiên bản chính sách<select value={policyId} onChange={e=>setPolicyId(e.target.value)}><option value="">Chọn phiên bản</option>{policies.map(p=><option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></label><label className="salary-rate-search"><span>Tìm nhân viên</span><div><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Mã, họ tên, phòng ban, chức vụ (có/không dấu)"/></div></label><label>Phòng ban<select value={department} onChange={e=>setDepartment(e.target.value)}><option value="">Tất cả phòng ban</option>{depts.map(x=><option key={x}>{x}</option>)}</select></label><label>Nhóm nhân sự<select value={employmentType} onChange={e=>setEmploymentType(e.target.value)}><option value="">Tất cả nhóm</option>{types.map(x=><option key={x}>{x}</option>)}</select></label><label>Trạng thái<select value={status} onChange={e=>setStatus(e.target.value)}><option value="active">Đang làm việc</option><option value="inactive">Đã nghỉ</option><option value="all">Tất cả</option></select></label></div>
 <div className="salary-rate-tabs">{groups.map(g=><button key={g.id} className={g.id===groupId?'active':''} onClick={()=>setGroupId(g.id)}>{g.name}<span>{fields.filter(f=>f.group_id===g.id&&f.is_active!==false).length}</span></button>)}</div>
 {config&&<div className="salary-rate-config"><form onSubmit={addGroup}><h4><Users size={16}/> Thêm nhóm định mức</h4><div className="salary-rate-inline"><input value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder="Tên nhóm mới, ví dụ: Phụ cấp" required/><button className="btn btn-primary"><Plus size={14}/> Thêm nhóm</button></div></form><form onSubmit={addField}><h4><Columns3 size={16}/> {editingField?'Sửa cột định mức':'Thêm cột vào nhóm đang chọn'}</h4><div className="salary-rate-inline"><input value={fieldName} onChange={e=>setFieldName(e.target.value)} placeholder="Tên cột" required/><button className="btn btn-primary"><Save size={14}/>{editingField?'Lưu cột':'Thêm cột'}</button>{editingField&&<button type="button" className="btn btn-secondary" onClick={()=>{setEditingField(null);setFieldName('')}}>Hủy</button>}</div></form><div className="salary-rate-field-list">{groupFields.map(f=><div key={f.id}><span>{f.name} <small>Mã: {f.code}</small></span><button className="icon-button" title="Sửa cột" onClick={()=>{setEditingField(f.id);setFieldName(f.name);}}>Sửa</button><button className="icon-button" title="Ẩn cột" onClick={()=>deleteField(f.id)}><Trash2 size={14}/></button></div>)}</div></div>}
 <div className="salary-rate-table-wrap"><table><thead><tr><th>MÃ NHÂN VIÊN</th><th>HỌ TÊN</th><th>PHÒNG BAN / CHỨC VỤ</th>{groupFields.map(f=><th key={f.id}>{f.name}<small>{f.code}</small></th>)}<th>THAO TÁC</th></tr></thead><tbody>{filtered.map(e=>{const row=valueMap.get(e.supabaseId);return <tr key={e.id}><td className="salary-rate-employee-code">{e.id}</td><td><strong>{e.name}</strong><small className="salary-rate-employee-group">Nhóm: {e.group||e.employment_type||e.classification||e.phân_loại||e.employee_classification||'Chưa phân nhóm'}</small></td><td>{e.department||'—'}<small>{e.role||''}</small></td>{groupFields.map(f=><td key={f.id}>{editingEmployee===e.id?<input aria-label={`${e.name} - ${f.name}`} type="number" step="any" value={draftValues[f.id]??''} onChange={ev=>setDraftValues(prev=>({...prev,[f.id]:ev.target.value===''?'':Number(ev.target.value)}))} placeholder="—"/>:<span>{row?.values?.[f.id]===undefined||row?.values?.[f.id]===null?'—':money(row.values[f.id])}</span>}</td>)}<td className="salary-rate-row-actions">{editingEmployee===e.id?<><button className="btn btn-primary" onClick={()=>saveRow(e)}>Lưu</button><button className="btn btn-secondary" onClick={cancelEdit}>Hủy</button></>:<button className="btn btn-secondary" onClick={()=>startEdit(e)}>Sửa</button>}</td></tr>})}{!filtered.length&&<tr><td colSpan={4+groupFields.length} className="salary-rate-empty">{loading?'Đang tải dữ liệu...':'Không tìm thấy nhân viên phù hợp bộ lọc.'}</td></tr>}</tbody></table></div><div className="salary-rate-footer">Hiển thị {filtered.length}/{employees.length} nhân viên · Mặc định chỉ xem; bấm Sửa tại từng nhân sự để cập nhật. Định mức chỉ lưu chính sách, chưa tự động tác động công thức tính lương.</div>
 </section>
}


export default function Page(){
 const [employees,setEmployees]=useState([]);
 const [policies,setPolicies]=useState([]);
 const [notice,setNotice]=useState('');
 const notify=(message)=>setNotice(String(message||''));
 useEffect(()=>{
   let alive=true;
   (async()=>{
     try{
       if(!sharedSupabase)throw new Error('Chưa cấu hình kết nối Supabase.');
       const [employeeRows,policyResult]=await Promise.all([
         fetchEmployees(),
         sharedSupabase.from('salary_policy_versions').select('id,code,name,status,effective_from,effective_to').order('effective_from',{ascending:false})
       ]);
       if(policyResult.error)throw policyResult.error;
       if(alive){
         setEmployees((employeeRows||[]).map(e=>({...e,id:e.employee_code||e.id,name:e.full_name||e.name||'',supabaseId:e.id,department:e.department||e.department_name||'',role:e.position||e.role||'',group:employeeGroupOf(e),employment_type:e.employment_type||'',status:e.status||'Đang làm việc',classification:e.classification||e.employment_type||''})));
         setPolicies(policyResult.data||[]);
       }
     }catch(error){if(alive)setNotice(`Không tải được dữ liệu: ${error.message||error.code||'Lỗi'}`);}
   })();
   return ()=>{alive=false};
 },[]);
 return <><SalaryRatesModule supabase={sharedSupabase} employees={employees} policies={policies} notify={notify}/>{notice&&<div role="status" className="salary-rate-toast">{notice}</div>}</>;
}
