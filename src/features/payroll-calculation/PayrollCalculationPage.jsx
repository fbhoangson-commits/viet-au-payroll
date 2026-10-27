import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase, isSupabaseConfigured } from '../../shared/supabase.js';
import { RefreshCw, Search, Download, AlertTriangle, Users, Wallet, Calculator, ShieldCheck, FileSpreadsheet, CircleDollarSign } from 'lucide-react';
import './payroll-calculation.css';

const money = value => Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' ₫';
const num = value => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = String(value).trim().replace(/\s/g, '');
  if (!s) return 0;
  const normalized = s.includes(',') && s.includes('.') ? (s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')) : s.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};
const clean = v => String(v ?? '').trim();
const norm = v => clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLocaleLowerCase('vi');
const codeOf = e => clean(e?.employee_code || e?.employee_code_snapshot || e?.code || '');
const nameOf = e => clean(e?.employee_name_snapshot || e?.employee_name || e?.full_name || e?.name || codeOf(e) || 'Chưa có tên');
const periodTitle = p => clean(p?.name || p?.period_code || p?.code || `Kỳ ${p?.period_year || ''}-${String(p?.period_month || '').padStart(2,'0')}`);
const statusTitle = s => ({DRAFT:'Bản nháp',OPEN:'Đang mở',CLOSED:'Đã đóng',LOCKED:'Đã khóa',PENDING:'Chờ xử lý',APPROVED:'Đã duyệt'}[String(s||'').toUpperCase()] || s || 'Chưa xác định');
const errorText = e => e?.message || e?.details || String(e || 'Lỗi không xác định');
const MENU = {
  'payroll-overview': { title:'Tổng Quan Kỳ Lương', description:'Tổng hợp tiến độ xử lý và kết quả của kỳ lương đang chọn.', icon:Calculator },
  'period-employees': { title:'Nhân Sự Kỳ Lương', description:'Danh sách nhân sự đã được chốt vào kỳ lương và trạng thái dữ liệu.', icon:Users },
  'fixed-salary': { title:'Lương Cố Định', description:'Tổng hợp các cấu phần lương cố định từ định mức và phiên bản chính sách áp dụng.', icon:Wallet },
  'teaching-pay': { title:'Lương Tiết Dạy & Phụ Đạo', description:'Tổng hợp số tiết, đơn giá và thành tiền từ dữ liệu Chấm Công Tiết Dạy.', icon:FileSpreadsheet },
  'payroll-deductions': { title:'Khoản Cộng Trừ', description:'Tổng hợp khoản cộng, khoản trừ được áp dụng trong kỳ lương.', icon:CircleDollarSign },
  'insurance-union': { title:'Bảo Hiểm & Phí Công Đoàn', description:'Đối chiếu phần người lao động đóng và phần đơn vị đóng.', icon:ShieldCheck },
  'personal-income-tax': { title:'Thuế TNCN', description:'Tổng hợp căn cứ và kết quả thuế từ dữ liệu thuế đã cấu hình cho kỳ.', icon:Calculator },
  'payroll-summary': { title:'Tổng Hợp Lương', description:'Bảng tổng hợp kết quả lương theo từng nhân sự trong kỳ.', icon:FileSpreadsheet },
};
const moneyColumns = new Set(['fixed','teaching','additions','deductions','insuranceEmployee','unionEmployee','tax','gross','net','employerInsurance']);
const colLabel = {
 code:'Mã Nhân Viên', name:'Họ và Tên', classification:'Phân loại', department:'Bộ phận', position:'Chức danh',
 fixed:'Lương Cố Định', teaching:'Tiết Dạy & Phụ Đạo', additions:'Khoản Cộng', deductions:'Khoản Trừ',
 insuranceEmployee:'BHXH NLĐ', unionEmployee:'Phí Công Đoàn NLĐ', employerInsurance:'BHXH đơn vị',
 tax:'Thuế TNCN', gross:'Tổng Thu Nhập', net:'Thực Lĩnh', status:'Trạng Thái Dữ Liệu',
 lessonCount:'Tổng Số Tiết', rateCount:'Số Cấu Phần Có Đơn Giá', taxable:'Thu Nhập Tính Thuế',
 participates:'Tham Gia BHXH', taxStatus:'Trạng Thái Thuế'
};
async function fetchRows(table, label, warnings, required=false) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) {
    if (required) throw new Error(`${label}: ${errorText(error)}`);
    warnings.push(`${label}: chưa đọc được (${errorText(error)})`);
    return [];
  }
  return data || [];
}
function tax5(value) {
  const x=Math.max(0,num(value));
  if(x<=10000000)return Math.round(x*.05);
  if(x<=30000000)return Math.round(x*.10-500000);
  if(x<=60000000)return Math.round(x*.20-3500000);
  if(x<=100000000)return Math.round(x*.30-9500000);
  return Math.round(x*.35-14500000);
}
function estimateTax(row) {
  if(row?.has_commitment && row?.commitment_validated) return 0;
  const taxable=Math.max(0,num(row?.taxable_income_override!=='' && row?.taxable_income_override!==null && row?.taxable_income_override!==undefined ? row.taxable_income_override : row?.calculated_taxable_income ?? row?.taxable_income));
  const type=norm(row?.employee_type || row?.employee_classification);
  return type.includes('co huu') ? tax5(taxable) : taxable>=5000000 ? Math.round(taxable*.1) : 0;
}
function rowPeriodId(r) { return clean(r?.period_id); }
function employeeId(r) { return clean(r?.employee_id); }
function isActiveAdjustment(r) { return !['CANCELLED','CANCELED','INACTIVE','ĐÃ HỦY','DA HUY'].includes(String(r?.status||'').toUpperCase()); }

export default function PayrollCalculationPage({ page }) {
  const meta = MENU[page] || MENU['payroll-overview'];
  const Icon = meta.icon;
  const [periods,setPeriods] = useState([]);
  const [periodId,setPeriodId] = useState('');
  const [rows,setRows] = useState([]);
  const [loading,setLoading] = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const [error,setError] = useState('');
  const [warnings,setWarnings] = useState([]);
  const [search,setSearch] = useState('');
  const [typeFilter,setTypeFilter] = useState('ALL');
  const [dataLoaded,setDataLoaded] = useState(false);

  const load = useCallback(async (keepPeriod=true) => {
    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase chưa được cấu hình. Không thể tải dữ liệu kỳ lương thật.');
      setLoading(false); setRefreshing(false); return;
    }
    setRefreshing(true); setError('');
    const notes=[];
    try {
      const {data: periodRows,error: periodError}=await supabase.from('payroll_periods').select('*').order('period_year',{ascending:false,nullsFirst:false}).order('period_month',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false});
      if(periodError) throw new Error(`Không tải được Kỳ Lương: ${errorText(periodError)}`);
      const fixedPeriods=(periodRows||[]).filter(p=>String(p.type||'FIXED').toUpperCase()==='FIXED');
      setPeriods(fixedPeriods);
      const selectedId=(keepPeriod && periodId && fixedPeriods.some(p=>p.id===periodId)) ? periodId : (fixedPeriods[0]?.id || '');
      setPeriodId(selectedId);
      if(!selectedId){setRows([]);setWarnings(['Chưa có Kỳ Lương tháng (FIXED). Hãy tạo Kỳ Lương trong menu Quản lý Kỳ Lương.']);setDataLoaded(true);return;}
      const [snapshotA,snapshotB,employees,groups,columns,rateValues,teachingRecords,adjustments,taxRows,insuranceProfiles,dependents,supportRows,attendanceRecords] = await Promise.all([
        fetchRows('payroll_period_employees','Danh sách nhân sự kỳ',notes),
        fetchRows('payroll_period_employee_snapshots','Snapshot nhân sự kỳ',notes),
        fetchRows('employees','Employee Master',notes,true),
        fetchRows('salary_rate_groups','Nhóm định mức',notes),
        fetchRows('salary_rate_columns','Cột định mức',notes),
        fetchRows('salary_rate_values','Giá trị định mức',notes),
        fetchRows('teaching_attendance_records','Chấm Công Tiết Dạy',notes),
        fetchRows('payroll_adjustments','Khoản cộng trừ',notes),
        fetchRows('payroll_period_insurance_tax_data','Dữ liệu BHXH/thuế kỳ',notes),
        fetchRows('employee_insurance_profiles','Hồ sơ BHXH',notes),
        fetchRows('employee_tax_dependents','Người phụ thuộc',notes),
        fetchRows('employee_support_allowances','Hỗ trợ nhân sự',notes),
        fetchRows('daily_attendance_records','Chấm công ngày',notes),
      ]);
      const snapshotsRaw=snapshotA.filter(r=>rowPeriodId(r)===selectedId);
      const snapshots=snapshotsRaw.length ? snapshotsRaw : snapshotB.filter(r=>rowPeriodId(r)===selectedId);
      const masterById=new Map(employees.map(e=>[clean(e.id),e]));
      const groupsById=new Map(groups.map(g=>[clean(g.id),g]));
      const columnsById=new Map(columns.map(c=>[clean(c.id),c]));
      const valuesByEmployee=new Map();
      for(const r of rateValues.filter(v=>!v.policy_version_id || v.policy_version_id=== (fixedPeriods.find(p=>p.id===selectedId)?.salary_version_id))) {
        const key=employeeId(r); if(!valuesByEmployee.has(key)) valuesByEmployee.set(key,[]);
        valuesByEmployee.get(key).push(r);
      }
      const selectedRateColumns=columns.filter(c=>c.is_active!==false);
      const periodTeaching=teachingRecords.filter(r=>rowPeriodId(r)===selectedId);
      const periodAdjustments=adjustments.filter(r=>rowPeriodId(r)===selectedId && isActiveAdjustment(r));
      const periodTax=taxRows.filter(r=>rowPeriodId(r)===selectedId);
      const taxByEmployee=new Map(periodTax.map(r=>[employeeId(r),r]));
      const insuranceByEmployee=new Map();
      for(const r of insuranceProfiles) insuranceByEmployee.set(employeeId(r),r);
      const supportFor=(id,code)=>supportRows.filter(r=>(employeeId(r)===id || clean(r.employee_code)===code) && (!r.period_id || rowPeriodId(r)===selectedId) && !['CANCELLED','INACTIVE'].includes(String(r.status||'').toUpperCase())).reduce((s,r)=>s+num(r.amount||r.support_amount),0);
      const depCountFor=(id,code)=>dependents.filter(r=>(employeeId(r)===id || clean(r.employee_code)===code) && r.is_active!==false && !['INACTIVE','CANCELLED'].includes(String(r.status||'').toUpperCase())).length;
      const output=snapshots.map(s=>{
        const id=employeeId(s), code=clean(s.employee_code||s.employee_code_snapshot), master=masterById.get(id)||{};
        const rateRows=valuesByEmployee.get(id)||[];
        let fixed=0,rateCount=0;
        for(const rv of rateRows){
          const group=groupsById.get(clean(rv.group_id));
          const groupName=norm(group?.name||group?.code||'');
          if(groupName.includes('tiet day')||groupName.includes('phu dao')||groupName==='khac'||groupName.includes('teaching')||groupName.includes('tutoring')) continue;
          const vals=rv.values && typeof rv.values==='object' ? rv.values : {};
          for(const c of selectedRateColumns.filter(c=>clean(c.group_id)===clean(rv.group_id))){
            if(vals[c.id]!==undefined && vals[c.id]!==null && vals[c.id]!==''){fixed+=num(vals[c.id]);rateCount++;}
          }
        }
        const lessons=periodTeaching.filter(r=>employeeId(r)===id);
        let teaching=0, lessonCount=0, missingRates=0;
        for(const rec of lessons){
          const col=columnsById.get(clean(rec.salary_rate_column_id));
          if(!col) continue;
          lessonCount+=num(rec.lesson_count);
          const rv=rateRows.find(v=>clean(v.group_id)===clean(col.group_id));
          const rate=rv?.values?.[col.id];
          if(rate===undefined||rate===null||rate==='') missingRates++;
          else teaching+=num(rec.lesson_count)*num(rate);
        }
        const employeeAdjustments=periodAdjustments.filter(r=>employeeId(r)===id || clean(r.employee_code)===code);
        const additions=employeeAdjustments.filter(r=>String(r.kind||'').toUpperCase()==='ADD').reduce((sum,r)=>sum+num(r.amount),0);
        const deductions=employeeAdjustments.filter(r=>String(r.kind||'').toUpperCase()==='DEDUCT').reduce((sum,r)=>sum+num(r.amount),0);
        const tax=taxByEmployee.get(id)||{};
        const insurance=insuranceByEmployee.get(id)||{};
        const insuranceEmployee=num(tax.employee_insurance_amount ?? tax.insurance_employee_amount ?? (num(tax.insurance_salary_base ?? insurance.insurance_salary_base)*((num(tax.employee_social_rate ?? insurance.employee_social_rate)+num(tax.employee_health_rate ?? insurance.employee_health_rate)+num(tax.employee_unemployment_rate ?? insurance.employee_unemployment_rate))/100)));
        const employerInsurance=num(tax.employer_insurance_amount ?? tax.insurance_employer_amount ?? 0);
        const unionEmployee=num(tax.union_employee_amount ?? tax.union_fee_employee_amount ?? 0);
        const taxable=num(tax.taxable_income_override!=='' && tax.taxable_income_override!==null && tax.taxable_income_override!==undefined ? tax.taxable_income_override : tax.calculated_taxable_income ?? tax.taxable_income ?? 0);
        const taxAmount=estimateTax(tax);
        const gross=fixed+teaching+additions;
        const net=gross-deductions-insuranceEmployee-unionEmployee-taxAmount;
        const classification=clean(tax.employee_type||tax.employee_classification||master.employment_type||master.employee_classification||master.employee_group||s.employee_type||'');
        const status=[];
        if(!rateRows.length) status.push('Chưa có định mức');
        if(lessons.some(r=>!columnsById.get(clean(r.salary_rate_column_id)))) status.push('Có dòng tiết dạy chưa khớp cấu hình');
        if(missingRates) status.push('Thiếu đơn giá tiết dạy');
        if(!taxByEmployee.has(id)) status.push('Chưa có dữ liệu BHXH/thuế kỳ');
        return {id,code,name:nameOf(s)||nameOf(master),classification,department:s.department||s.department_snapshot||master.department||'—',position:s.position||s.position_snapshot||master.position||master.job_title||'—',fixed,teaching,lessonCount,rateCount,additions,deductions,insuranceEmployee,employerInsurance,unionEmployee,tax,taxable,taxAmount,gross,net,participates:tax.participates_insurance??insurance.participates_insurance??insurance.social_insurance??false,dependents:tax.dependent_count??depCountFor(id,code),support:supportFor(id,code),status:status.length?status.join('; '):'Đã đọc dữ liệu nguồn',hasIssue:status.length>0};
      }).sort((a,b)=>a.code.localeCompare(b.code,'vi',{numeric:true}));
      setRows(output);setWarnings(notes);setDataLoaded(true);
    } catch(e) {setError(errorText(e));setRows([]);setWarnings(notes);setDataLoaded(false);}
    finally {setLoading(false);setRefreshing(false);}
  },[periodId]);

  useEffect(()=>{load(false);},[]);
  useEffect(()=>{if(periodId) load(true);},[periodId]);

  const visible=useMemo(()=>rows.filter(r=>{
    const q=norm(search);
    const matches=!q||norm([r.code,r.name,r.department,r.position,r.classification].join(' ')).includes(q);
    const typeMatches=typeFilter==='ALL'||(typeFilter==='ISSUES'?r.hasIssue:norm(r.classification).includes(norm(typeFilter)));
    return matches&&typeMatches;
  }),[rows,search,typeFilter]);
  const totals=useMemo(()=>rows.reduce((s,r)=>{
    for(const key of ['fixed','teaching','additions','deductions','insuranceEmployee','unionEmployee','employerInsurance','taxAmount','gross','net'])s[key]+=num(r[key]);
    s.lessonCount+=num(r.lessonCount);if(r.hasIssue)s.issues++;
    return s;
  },{fixed:0,teaching:0,additions:0,deductions:0,insuranceEmployee:0,unionEmployee:0,employerInsurance:0,taxAmount:0,gross:0,net:0,lessonCount:0,issues:0}),[rows]);

  const columns = useMemo(()=>{
    if(page==='period-employees')return ['code','name','classification','department','position','status'];
    if(page==='fixed-salary')return ['code','name','classification','fixed','rateCount','status'];
    if(page==='teaching-pay')return ['code','name','lessonCount','teaching','status'];
    if(page==='payroll-deductions')return ['code','name','additions','deductions','status'];
    if(page==='insurance-union')return ['code','name','participates','insuranceEmployee','unionEmployee','employerInsurance','status'];
    if(page==='personal-income-tax')return ['code','name','classification','taxable','taxAmount','taxStatus'];
    if(page==='payroll-summary')return ['code','name','classification','fixed','teaching','additions','deductions','insuranceEmployee','unionEmployee','taxAmount','gross','net'];
    return ['code','name','classification','fixed','teaching','additions','deductions','insuranceEmployee','unionEmployee','taxAmount','gross','net','status'];
  },[page]);
  const exportRows=()=> {
    const data=visible.map(r=>Object.fromEntries(columns.map(k=>[colLabel[k]||k,k==='participates'?(r[k]?'Có':'Không'):(moneyColumns.has(k)?num(r[k]):k==='taxable'?num(r[k]):(r[k]??''))])));
    const ws=XLSX.utils.json_to_sheet(data.length?data:[Object.fromEntries(columns.map(k=>[colLabel[k]||k,'']))]);
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Tính lương');
    XLSX.writeFile(wb,`${page}-${periodTitle(periods.find(p=>p.id===periodId)).replace(/[^\wÀ-ỹ-]+/g,'-')}.xlsx`);
  };
  const selectedPeriod=periods.find(p=>p.id===periodId);
  const metric=(label,value,icon,sub='')=><div className="pc-metric" key={label}><div className="pc-metric-icon">{React.createElement(icon,{size:18})}</div><div className="pc-metric-label">{label}</div><div className="pc-metric-value">{value}</div>{sub&&<div className="pc-metric-sub">{sub}</div>}</div>;

  return <section className="pc-page">
    <header className="pc-heading"><div className="pc-heading-icon"><Icon size={22}/></div><div className="pc-heading-copy"><div className="pc-eyebrow">TÍNH LƯƠNG · WORKSPACE</div><h2>{meta.title}</h2><p>{meta.description}</p></div></header>
    <div className="pc-toolbar">
      <label className="pc-period">Kỳ Lương<select value={periodId} onChange={e=>setPeriodId(e.target.value)} disabled={loading}><option value="">-- Chọn Kỳ Lương --</option>{periods.map(p=><option key={p.id} value={p.id}>{periodTitle(p)} · {statusTitle(p.status)}</option>)}</select></label>
      <label className="pc-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm mã nhân viên, họ tên..."/></label>
      <select className="pc-filter" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} aria-label="Lọc dữ liệu"><option value="ALL">Tất cả dữ liệu</option><option value="ISSUES">Cần kiểm tra</option>{[...new Set(rows.map(r=>r.classification).filter(Boolean))].map(v=><option key={v} value={v}>{v}</option>)}</select>
      <button className="pc-button" onClick={()=>load(true)} disabled={refreshing}><RefreshCw size={15}/> Làm mới</button>
      <button className="pc-button pc-primary" onClick={exportRows} disabled={!visible.length}><Download size={15}/> Xuất Excel</button>
    </div>
    {error&&<div className="pc-alert pc-error"><AlertTriangle size={17}/><div><strong>Không tải được dữ liệu</strong><p>{error}</p></div></div>}
    {warnings.length>0&&<div className="pc-alert"><AlertTriangle size={17}/><div><strong>Một số nguồn dữ liệu cần kiểm tra</strong><ul>{warnings.slice(0,5).map((w,i)=><li key={i}>{w}</li>)}</ul></div></div>}
    {page==='payroll-overview'&&<div className="pc-metrics">
      {metric('Nhân sự trong kỳ',rows.length,Users)}
      {metric('Cần kiểm tra',totals.issues,AlertTriangle)}
      {metric('Tổng thu nhập',money(totals.gross),Wallet)}
      {metric('Tổng khấu trừ NLĐ',money(totals.insuranceEmployee+totals.unionEmployee+totals.taxAmount+totals.deductions),ShieldCheck)}
      {metric('Tổng thực lĩnh',money(totals.net),CircleDollarSign)}
      {metric('Phần BHXH đơn vị',money(totals.employerInsurance),Calculator)}
      <div className="pc-period-status"><span>TRẠNG THÁI KỲ</span><strong>{selectedPeriod?statusTitle(selectedPeriod.status):'Chưa chọn kỳ'}</strong><small>{selectedPeriod?periodTitle(selectedPeriod):'Tạo kỳ trong menu Quản lý Kỳ Lương'}</small></div>
    </div>}
    {page==='payroll-summary'&&<div className="pc-metrics pc-summary-metrics">
      {metric('Nhân sự',rows.length,Users)}{metric('Tổng lương cố định',money(totals.fixed),Wallet)}{metric('Tiết dạy & phụ đạo',money(totals.teaching),FileSpreadsheet)}{metric('Tổng thu nhập',money(totals.gross),Calculator)}{metric('Tổng thuế TNCN',money(totals.taxAmount),ShieldCheck)}{metric('Thực lĩnh',money(totals.net),CircleDollarSign)}
    </div>}
    <div className="pc-table-card">
      <div className="pc-table-heading"><div><h3>{page==='payroll-overview'?'Chi tiết tổng quan theo nhân sự':meta.title}</h3><p>{selectedPeriod?`${periodTitle(selectedPeriod)} · ${rows.length} nhân sự đã chốt`:'Chưa có dữ liệu kỳ lương để hiển thị'}</p></div><span className="pc-count">{visible.length} dòng</span></div>
      {loading||refreshing&&!dataLoaded ? <div className="pc-empty"><RefreshCw className="pc-spin" size={22}/><strong>Đang tải dữ liệu kỳ lương...</strong></div>
      : !selectedPeriod ? <div className="pc-empty"><CalendarRangeIcon/><strong>Chưa có Kỳ Lương tháng</strong><p>Tạo Kỳ Lương tại menu Dữ Liệu Kỳ Lương → Quản lý Kỳ Lương.</p></div>
      : !visible.length ? <div className="pc-empty"><Users size={26}/><strong>{rows.length?'Không tìm thấy nhân sự phù hợp':'Kỳ Lương chưa có danh sách nhân sự được chốt'}</strong><p>{rows.length?'Thử thay đổi từ khóa hoặc bộ lọc.':'Kiểm tra danh sách nhân sự của Kỳ Lương. Không có dữ liệu mẫu được tạo tự động.'}</p></div>
      : <div className="pc-table-wrap"><table className="pc-table"><thead><tr>{columns.map(k=><th key={k}>{colLabel[k]||k}</th>)}</tr></thead><tbody>{visible.map(r=><tr key={r.id||r.code}>{columns.map(k=><td key={k} className={moneyColumns.has(k)||k==='taxable'||k==='lessonCount'||k==='rateCount'?'pc-number':''}>{k==='status'?<span className={`pc-status ${r.hasIssue?'pc-status-warn':'pc-status-ok'}`}>{r.status}</span>:k==='taxStatus'?<span className={`pc-status ${r.taxAmount||r.taxable?'pc-status-ok':'pc-status-warn'}`}>{r.tax?.taxable_income_override!=null?'Có điều chỉnh':r.tax?.calculated_taxable_income!=null?'Đã tính':'Chưa có kết quả thuế'}</span>:k==='participates'?(r.participates?'Có':'Không'):k==='taxable'?money(r.taxable):moneyColumns.has(k)?money(r[k]):k==='lessonCount'||k==='rateCount'?num(r[k]).toLocaleString('vi-VN'):r[k]||'—'}</td>)}</tr>)}</tbody>
      {page!=='period-employees'&&<tfoot><tr><th colSpan={Math.max(2,columns.length-2)}>TỔNG CỘNG</th>{columns.slice(-2).map(k=><th key={k} className="pc-number">{moneyColumns.has(k)?money(totals[k]||0):'—'}</th>)}</tr></tfoot>}</table></div>}
    </div>
    <div className="pc-footnote"><AlertTriangle size={14}/><span>Đây là màn hình tổng hợp chỉ đọc. Số liệu lấy từ các bảng dữ liệu hiện có; các cấu phần chưa có nguồn hoặc chưa đủ điều kiện tính sẽ được cảnh báo. Chưa thực hiện duyệt hoặc khóa kỳ.</span></div>
  </section>;
}
function CalendarRangeIcon(){return <Calculator size={26}/>}
